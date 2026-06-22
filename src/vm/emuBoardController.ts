import { Board } from "./board";
import { Emu8051Wasm, parseIntelHex } from "./emu8051Wasm";
import { SFR, ST841_MAP } from "./st841Map";

export class EmuBoardController {
  private emu: Emu8051Wasm | null = null;
  private rafId = 0;
  private running = false;
  private adcPending: { channel: number; ticksLeft: number } | null = null;
  private instructions = 0;
  private batchSize = 184320;
  private static readonly TIMER0_ACCEL = 6;
  private static readonly TRACE_SAMPLE_WHILE_RUN = 64;
  private trace: Array<{
    pc: number;
    opcode: number;
    acc: number;
    p0: number;
    p2: number;
    tick: number;
  }> = [];

  constructor(private board: Board) {}

  async init(): Promise<void> {
    if (!this.emu) {
      this.emu = await Emu8051Wasm.create();
      this.seedPorts();
    }
  }

  async reset(): Promise<void> {
    await this.init();
    this.stop();
    this.emu?.reset(true);
    this.adcPending = null;
    this.instructions = 0;
    this.trace = [];
    this.seedPorts();
    this.syncCpuToBoard();
  }

  async loadHex(hexText: string): Promise<number> {
    await this.reset();
    const image = parseIntelHex(hexText);
    // Model full 64K ROM. Empty addresses are NOP so ORG gaps are valid.
    for (let addr = 0; addr <= 0xffff; addr++) {
      this.emu?.writeCode(addr, 0x00);
    }
    for (const item of image) {
      this.emu?.writeCode(item.addr, item.value);
    }
    this.syncCpuToBoard();
    return image.length;
  }

  step(instructions = 1): void {
    if (!this.emu) return;
    for (let index = 0; index < instructions; index++) {
      const pc = this.emu.getPC() & 0xffff;
      const opcode = this.emu.readCode(pc) & 0xff;
      const op1 = this.emu.readCode((pc + 1) & 0xffff) & 0xff;
      const isMovAP0 = opcode === 0xe5 && op1 === SFR.p0;
      this.syncBoardInputsToCpu();
      // Make MOV A,P0 always sample live keypad value in RX mode.
      if (isMovAP0) {
        const p3 = this.emu.getSfr(SFR.p3) & 0xff;
        this.board.applyCpuPorts({
          p0: this.emu.getSfr(SFR.p0) & 0xff,
          p2: this.emu.getSfr(SFR.p2) & 0xff,
          p3,
        });
        if (((p3 >> 6) & 1) === 0) {
          this.emu.setSfr(SFR.p0, this.board.readPort("P0"));
        }
      }
      if (this.emu.tick()) {
        this.instructions += 1;
        const shouldTrace =
          !this.running ||
          index % EmuBoardController.TRACE_SAMPLE_WHILE_RUN === 0;
        if (shouldTrace) {
          this.pushTrace({
            pc,
            opcode,
            acc: this.emu.getSfr(SFR.acc) & 0xff,
            p0: this.emu.getSfr(SFR.p0) & 0xff,
            p2: this.emu.getSfr(SFR.p2) & 0xff,
            tick: this.instructions,
          });
        }
      }
      this.syncCpuToBoard();
    }
  }

  setSpeed(batchSize: number): void {
    this.batchSize = Math.max(1, Math.min(500000, batchSize | 0));
  }

  run(batchSize = this.batchSize): void {
    if (!this.emu || this.running) return;
    this.batchSize = Math.max(1, Math.min(500000, batchSize | 0));
    this.running = true;

    const frame = () => {
      if (!this.running) return;
      this.step(this.batchSize);
      this.rafId = window.requestAnimationFrame(frame);
    };

    this.rafId = window.requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getPC(): number {
    return this.emu?.getPC() ?? 0;
  }

  getSfr(addr: number): number {
    return this.emu?.getSfr(addr) ?? 0;
  }

  readCode(addr: number): number {
    return this.emu?.readCode(addr) ?? 0;
  }

  readIram(addr: number): number {
    return this.emu?.readIram(addr) ?? 0;
  }

  readXram(addr: number): number {
    return this.emu?.readXram(addr) ?? 0;
  }

  getInstructionCount(): number {
    return this.instructions;
  }

  getTrace(limit = 40): Array<{
    pc: number;
    opcode: number;
    acc: number;
    p0: number;
    p2: number;
    tick: number;
  }> {
    const n = Math.max(1, Math.min(200, limit | 0));
    return this.trace.slice(-n);
  }

  clearTrace(): void {
    this.trace = [];
  }

  private seedPorts(): void {
    this.emu?.setSfr(SFR.p0, 0xff);
    // Real 8051 reset stack pointer.
    this.emu?.setSfr(SFR.sp, 0x07);
    this.emu?.setSfr(SFR.p2, 0x00);
    this.emu?.setSfr(SFR.p3, 0xff);
    this.emu?.setSfr(ST841_MAP.adc.adcon1, 0x00);
    this.emu?.setSfr(ST841_MAP.adc.adcon2, 0x00);
    this.emu?.setSfr(ST841_MAP.adc.dataLow, 0x00);
    this.emu?.setSfr(ST841_MAP.adc.dataHigh, 0x00);
  }

  private syncBoardInputsToCpu(): void {
    if (!this.emu) return;
    this.serviceTimer0();
    this.serviceAdc();
    this.servicePwm();

    const p3 = this.emu.getSfr(SFR.p3);
    this.board.applyCpuPorts({
      p0: this.emu.getSfr(SFR.p0),
      p2: this.emu.getSfr(SFR.p2),
      p3,
    });

    // In RX mode the keypad / future peripherals drive P0.
    if (((p3 >> 6) & 1) === 0) {
      this.emu.setSfr(SFR.p0, this.board.readPort("P0"));
    }
  }

  private syncCpuToBoard(): void {
    if (!this.emu) return;
    this.board.applyCpuPorts({
      p0: this.emu.getSfr(SFR.p0),
      p2: this.emu.getSfr(SFR.p2),
      p3: this.emu.getSfr(SFR.p3),
    });
    this.serviceAudio();
  }

  private serviceAdc(): void {
    if (!this.emu) return;

    const adcon2 = this.emu.getSfr(ST841_MAP.adc.adcon2);
    const channel = adcon2 & 0x0f;
    const joystick = this.board.getJoystick();
    const sample = this.readAdcChannel(channel, joystick);

    this.emu.setSfr(ST841_MAP.adc.dataLow, sample & 0xff);
    this.emu.setSfr(
      ST841_MAP.adc.dataHigh,
      ((channel & 0x0f) << 4) | ((sample >> 8) & 0x0f),
    );

    // Keep lab snippets unblocked: conversion is treated as always-ready.
    const nextAdcon2 =
      (this.emu.getSfr(ST841_MAP.adc.adcon2) & ~ST841_MAP.adc.sconvMask) |
      ST841_MAP.adc.adciMask;
    this.emu.setSfr(ST841_MAP.adc.adcon2, nextAdcon2);
  }

  private serviceTimer0(): void {
    if (!this.emu) return;
    const tcon = this.emu.getSfr(SFR.tcon) & 0xff;
    const tmod = this.emu.getSfr(SFR.tmod) & 0xff;
    const tr0 = (tcon & 0x10) !== 0;
    if (!tr0) return;

    const mode = tmod & 0x03;
    if (mode !== 0x01) return; // Lab code uses 16-bit mode

    let tl0 = this.emu.getSfr(SFR.tl0) & 0xff;
    let th0 = this.emu.getSfr(SFR.th0) & 0xff;
    for (let i = 0; i < EmuBoardController.TIMER0_ACCEL; i++) {
      tl0 += 1;
      if (tl0 > 0xff) {
        tl0 = 0x00;
        th0 += 1;
        if (th0 > 0xff) {
          th0 = 0x00;
          this.emu.setSfr(SFR.tcon, (tcon | 0x20) & 0xff); // TF0=1
        }
      }
    }
    this.emu.setSfr(SFR.tl0, tl0 & 0xff);
    this.emu.setSfr(SFR.th0, th0 & 0xff);
  }

  private readAdcChannel(
    channel: number,
    joystick: { x: number; y: number },
  ): number {
    switch (channel & 0x0f) {
      case ST841_MAP.adc.xChannel:
        return mapJoystickToLabLevel(selectLabJoystickAxis(joystick.x, joystick.y));
      case ST841_MAP.adc.yChannel:
        return mapJoystickToLabLevel(selectLabJoystickAxis(joystick.y, joystick.x));
      case 0x00:
        return joystick.x & 0x0fff;
      case 0x01:
        return joystick.y & 0x0fff;
      case 0x0b:
        return 0;
      case 0x0c:
        return 0x0fff;
      default:
        return 0x0800;
    }
  }

  private pushTrace(entry: {
    pc: number;
    opcode: number;
    acc: number;
    p0: number;
    p2: number;
    tick: number;
  }): void {
    this.trace.push(entry);
    if (this.trace.length > 400) {
      this.trace.splice(0, this.trace.length - 400);
    }
  }

  private servicePwm(): void {
    if (!this.emu) return;

    const motor = this.board.extraDevices.motor;
    if (!motor || typeof motor.setPwmState !== "function") return;

    const pwmcon = this.emu.getSfr(SFR.pwmcon) & 0xff;
    const pwm0 =
      ((this.emu.getSfr(SFR.pwm0h) & 0xff) << 8) |
      (this.emu.getSfr(SFR.pwm0l) & 0xff);
    const pwm1 =
      ((this.emu.getSfr(SFR.pwm1h) & 0xff) << 8) |
      (this.emu.getSfr(SFR.pwm1l) & 0xff);

    const singleOutputMasked = ((pwmcon >> 7) & 0x01) === 1;
    const mode = (pwmcon >> 4) & 0x07;
    const cdiv = (pwmcon >> 2) & 0x03;
    const csel = pwmcon & 0x03;

    const sourceClock = selectPwmClock(csel);
    const divider = [1, 4, 16, 64][cdiv] ?? 1;
    const countClock = sourceClock / divider;
    const periodCounts = Math.max(0, pwm1 + 1);
    const compareCounts = Math.max(0, Math.min(pwm0 + 1, periodCounts));
    const duty =
      periodCounts > 0 ? Math.max(0, Math.min(1, compareCounts / periodCounts)) : 0;
    const frequencyHz = periodCounts > 0 ? countClock / periodCounts : 0;

    motor.setPwmState({
      active: !singleOutputMasked && mode === 1 && periodCounts > 0 && duty > 0,
      mode,
      duty,
      frequencyHz,
      periodCounts,
      compareCounts,
      sourceLabel: pwmClockLabel(csel),
      dividerLabel: `/ ${divider}`,
    });
  }

  private serviceAudio(): void {
    if (!this.emu) return;

    const audio = this.board.extraDevices.audio;
    if (!audio || typeof audio.setState !== "function") return;

    const p3 = this.emu.getSfr(SFR.p3) & 0xff;
    const dac0 =
      ((this.emu.getSfr(0xfa) & 0x0f) << 8) |
      (this.emu.getSfr(0xf9) & 0xff);
    const dac1 =
      ((this.emu.getSfr(0xfc) & 0x0f) << 8) |
      (this.emu.getSfr(0xfb) & 0xff);

    audio.setState({
      daccon: this.emu.getSfr(0xfd) & 0xff,
      dac0,
      dac1,
      p34: ((p3 >> 4) & 1) as 0 | 1,
      p35: ((p3 >> 5) & 1) as 0 | 1,
      tick: this.instructions,
    });
  }
}

function mapJoystickToLabLevel(value: number): number {
  // Lab 6 snippets compare THx against sparse values:
  // 01,03,05,07,09,0B,0C,0E,0F.
  // Map joystick to these stable buckets so indicator logic reacts reliably.
  const levels = [0x01, 0x03, 0x05, 0x07, 0x09, 0x0b, 0x0c, 0x0e, 0x0f];
  const clamped = Math.max(0, Math.min(4095, value | 0));
  const idx = Math.round((clamped / 4095) * (levels.length - 1));
  return ((levels[idx] & 0x0f) << 8) | 0x80;
}

function selectLabJoystickAxis(primary: number, alternate: number): number {
  const primaryOffset = Math.abs((primary | 0) - 2048);
  const alternateOffset = Math.abs((alternate | 0) - 2048);
  // Many course snippets hard-code ADC6 or ADC7, but users may move the stick
  // mostly along the other axis. If the requested axis is near center while the
  // other one is clearly displaced, mirror the dominant movement so both styles
  // of methodology code remain responsive in the simulator.
  if (primaryOffset < 280 && alternateOffset > 420) {
    return alternate;
  }
  return primary;
}

function selectPwmClock(csel: number): number {
  switch (csel & 0x03) {
    case 0x00:
      return 11_059_200 / 15;
    case 0x01:
      return 11_059_200;
    case 0x02:
      return 11_059_200;
    case 0x03:
      return 11_059_200;
    default:
      return 11_059_200;
  }
}

function pwmClockLabel(csel: number): string {
  switch (csel & 0x03) {
    case 0x00:
      return "fXTAL / 15";
    case 0x01:
      return "fXTAL";
    case 0x02:
      return "T0 input";
    case 0x03:
      return "fVCO / fOSC";
    default:
      return "fXTAL";
  }
}
