import { Board } from "./board";
import { Emu8051Wasm, parseIntelHex } from "./emu8051Wasm";
import { SFR, ST841_MAP } from "./st841Map";
import { ADUC841_MACHINE_CYCLE_HZ } from "./scopeRecorder";

type CpuTraceEntry = {
  pc: number;
  opcode: number;
  acc: number;
  p0: number;
  p2: number;
  tick: number;
};

export class EmuBoardController {
  private emu: Emu8051Wasm | null = null;
  private rafId = 0;
  private running = false;
  private adcPending: { channel: number; ticksLeft: number } | null = null;
  private instructions = 0;
  private machineCycles = 0;
  private pwmScopeActive = false;
  private pwmScopeDuty = 0;
  private pwmScopeFrequencyHz = 0;
  private pwmScopeLastLevel: 0 | 1 = 0;
  private lastAudioDac0 = -1;
  private lastPwmRegisters = [-1, -1, -1, -1, -1];
  private lastAudioRegisters = [-1, -1, -1, -1, -1];
  private lastAdcConfig = -1;
  private lastAdcInputRevision = -1;
  private lastAdcLow = -1;
  private lastAdcHigh = -1;
  private batchSize = 184320;
  private speedMultiplier = 1;
  private runCycleDebt = 0;
  private lastRunFrameMs = 0;
  private portLatches = { p0: 0xff, p1: 0xff, p2: 0x00, p3: 0xff };
  private preTickEffective = { p0: 0xff, p1: 0xff, p2: 0x00, p3: 0xff };
  private static readonly TIMER0_ACCEL = 6;
  private static readonly TRACE_SAMPLE_WHILE_RUN = 64;
  private static readonly TRACE_CAPACITY = 400;
  // Keep the browser responsive: the emulator may use only a small part of
  // one animation frame and continues its remaining work on the next frame.
  // Keep each animation-frame slice below the usual 16.7 ms frame interval,
  // but give the MCU enough CPU time to sustain its real 921.6 kHz cycle rate.
  private static readonly RUN_FRAME_BUDGET_MS = 12;
  private traceEnabled = false;
  private trace: Array<CpuTraceEntry | undefined> = new Array(
    EmuBoardController.TRACE_CAPACITY,
  );
  private traceStart = 0;
  private traceCount = 0;

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
    this.board.reset();
    this.adcPending = null;
    this.instructions = 0;
    this.machineCycles = 0;
    this.pwmScopeActive = false;
    this.pwmScopeDuty = 0;
    this.pwmScopeFrequencyHz = 0;
    this.pwmScopeLastLevel = 0;
    this.lastAudioDac0 = -1;
    this.lastPwmRegisters.fill(-1);
    this.lastAudioRegisters.fill(-1);
    this.lastAdcConfig = -1;
    this.lastAdcInputRevision = -1;
    this.lastAdcLow = -1;
    this.lastAdcHigh = -1;
    this.board.setSimulationCycle(0);
    this.clearTrace();
    this.portLatches = { p0: 0xff, p1: 0xff, p2: 0x00, p3: 0xff };
    this.preTickEffective = { ...this.portLatches };
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

  step(instructions = 1, deadlineMs = Number.POSITIVE_INFINITY): number {
    if (!this.emu) return 0;
    let executed = 0;
    for (let index = 0; index < instructions; index++) {
      // Checking every 256 cycles keeps timing overhead negligible while
      // preventing a high-speed program from freezing input and SVG drawing.
      if ((index & 0xff) === 0 && performance.now() >= deadlineMs) break;
      this.board.setSimulationCycle(this.machineCycles);
      const shouldTrace = this.traceEnabled && (
        !this.running || index % EmuBoardController.TRACE_SAMPLE_WHILE_RUN === 0
      );
      // Reading PC/opcode crosses the JS/WASM boundary. Only do it when the
      // Runner trace is actually visible and this cycle is a trace candidate.
      const pc = shouldTrace ? this.emu.getPC() & 0xffff : 0;
      const opcode = shouldTrace ? this.emu.readCode(pc) & 0xff : 0;
      this.syncBoardInputsToCpu();
      const instructionStarted = this.emu.tick();
      this.machineCycles += 1;
      this.board.setSimulationCycle(this.machineCycles);
      if (instructionStarted) {
        this.instructions += 1;
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
        // Port latches and board outputs can only change when the CPU actually
        // starts an instruction. Multi-cycle instructions spend the remaining
        // ticks only advancing hardware time, so repeating the full board sync
        // there wastes a large part of the frame budget.
        this.syncCpuToBoard();
      }
      // Hardware PWM continues to advance on every machine cycle even while a
      // multi-cycle CPU instruction is waiting. Keep scope sampling exact, but
      // avoid the much heavier full board synchronization above.
      this.servicePwmScope();
      executed += 1;
    }
    return executed;
  }

  setSpeed(batchSize: number): void {
    this.speedMultiplier = Math.max(1 / 16700, Number(batchSize) / 16700);
    this.batchSize = Math.max(1, Math.min(500000, batchSize | 0));
  }

  run(batchSize = this.batchSize): void {
    if (!this.emu || this.running) return;
    this.batchSize = Math.max(1, Math.min(500000, batchSize | 0));
    this.running = true;
    this.runCycleDebt = 0;
    this.lastRunFrameMs = performance.now();

    const frame = (frameTimeMs: number) => {
      if (!this.running) return;
      // Drive x1 from elapsed wall time instead of assuming that requestAnimationFrame
      // is always exactly 60 Hz. Missed/slow frames leave a small debt that a later
      // frame can catch up, so oscilloscope time no longer drifts after a few seconds.
      const elapsedMs = Math.max(0, Math.min(100, frameTimeMs - this.lastRunFrameMs));
      this.lastRunFrameMs = frameTimeMs;
      const targetCyclesPerSecond = ADUC841_MACHINE_CYCLE_HZ * this.speedMultiplier;
      const maxDebt = targetCyclesPerSecond * 0.25;
      this.runCycleDebt = Math.min(
        maxDebt,
        this.runCycleDebt + (elapsedMs / 1000) * targetCyclesPerSecond,
      );
      const requestedCycles = Math.min(500000, Math.floor(this.runCycleDebt));
      if (requestedCycles > 0) {
        const completedCycles = this.step(
          requestedCycles,
          performance.now() + EmuBoardController.RUN_FRAME_BUDGET_MS,
        );
        this.runCycleDebt = Math.max(0, this.runCycleDebt - completedCycles);
      }
      this.rafId = window.requestAnimationFrame(frame);
    };

    this.rafId = window.requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    this.runCycleDebt = 0;
    this.lastRunFrameMs = 0;
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

  getMachineCycleCount(): number {
    return this.machineCycles;
  }

  getSimulationTimeSeconds(): number {
    return this.machineCycles / ADUC841_MACHINE_CYCLE_HZ;
  }

  getTrace(limit = 40): CpuTraceEntry[] {
    const requested = Math.max(1, Math.min(200, limit | 0));
    const count = Math.min(requested, this.traceCount);
    const result: CpuTraceEntry[] = [];
    const first =
      (this.traceStart + this.traceCount - count) % EmuBoardController.TRACE_CAPACITY;
    for (let index = 0; index < count; index += 1) {
      const entry = this.trace[(first + index) % EmuBoardController.TRACE_CAPACITY];
      if (entry) result.push(entry);
    }
    return result;
  }

  clearTrace(): void {
    this.trace.fill(undefined);
    this.traceStart = 0;
    this.traceCount = 0;
  }

  setTraceEnabled(enabled: boolean): void {
    const next = Boolean(enabled);
    if (next === this.traceEnabled) return;
    this.traceEnabled = next;
    if (!next) this.clearTrace();
  }

  private seedPorts(): void {
    this.emu?.setSfr(SFR.p0, 0xff);
    this.emu?.setSfr(SFR.p1, 0xff);
    // Real 8051 reset stack pointer.
    this.emu?.setSfr(SFR.sp, 0x07);
    this.emu?.setSfr(SFR.p2, 0x00);
    this.emu?.setSfr(SFR.p3, 0xff);
    this.portLatches = { p0: 0xff, p1: 0xff, p2: 0x00, p3: 0xff };
    this.preTickEffective = { ...this.portLatches };
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

    // Preserve MCU output latches separately from externally driven pin levels.
    this.board.applyCpuPortValues(
      this.portLatches.p0,
      this.portLatches.p1,
      this.portLatches.p2,
      this.portLatches.p3,
    );
    this.preTickEffective.p0 = this.board.readPort("P0");
    this.preTickEffective.p1 = this.board.readPort("P1");
    this.preTickEffective.p2 = this.board.readPort("P2");
    this.preTickEffective.p3 = this.board.readPort("P3");
    this.emu.setSfr(SFR.p0, this.preTickEffective.p0);
    this.emu.setSfr(SFR.p1, this.preTickEffective.p1);
    this.emu.setSfr(SFR.p2, this.preTickEffective.p2);
    this.emu.setSfr(SFR.p3, this.preTickEffective.p3);

    // In RX mode the keypad / future peripherals can additionally drive P0.
    if (((this.preTickEffective.p3 >> 6) & 1) === 0) {
      this.emu.setSfr(SFR.p0, this.board.readPort("P0"));
      this.preTickEffective.p0 = this.emu.getSfr(SFR.p0) & 0xff;
    }
  }

  private syncCpuToBoard(): void {
    if (!this.emu) return;
    const afterP0 = this.emu.getSfr(SFR.p0) & 0xff;
    const afterP1 = this.emu.getSfr(SFR.p1) & 0xff;
    const afterP2 = this.emu.getSfr(SFR.p2) & 0xff;
    const afterP3 = this.emu.getSfr(SFR.p3) & 0xff;
    // If a value still equals the externally resolved level, assume the
    // instruction did not rewrite that port and retain the previous latch.
    // A changed value is a CPU port write and becomes the new latch.
    if (afterP0 !== this.preTickEffective.p0) this.portLatches.p0 = afterP0;
    if (afterP1 !== this.preTickEffective.p1) this.portLatches.p1 = afterP1;
    if (afterP2 !== this.preTickEffective.p2) this.portLatches.p2 = afterP2;
    if (afterP3 !== this.preTickEffective.p3) this.portLatches.p3 = afterP3;
    this.emu.setSfr(SFR.p0, this.portLatches.p0);
    this.emu.setSfr(SFR.p1, this.portLatches.p1);
    this.emu.setSfr(SFR.p2, this.portLatches.p2);
    this.emu.setSfr(SFR.p3, this.portLatches.p3);
    this.board.applyCpuPortValues(
      this.portLatches.p0,
      this.portLatches.p1,
      this.portLatches.p2,
      this.portLatches.p3,
    );
    this.serviceAudio();
  }

  private serviceAdc(): void {
    if (!this.emu) return;

    const adcon2 = this.emu.getSfr(ST841_MAP.adc.adcon2) & 0xff;
    const channel = adcon2 & 0x0f;
    const inputRevision = this.board.getInputRevision();
    const config = adcon2 & ~(ST841_MAP.adc.sconvMask | ST841_MAP.adc.adciMask);
    const needsSample =
      config !== this.lastAdcConfig ||
      inputRevision !== this.lastAdcInputRevision ||
      this.lastAdcLow < 0 ||
      this.lastAdcHigh < 0;

    if (needsSample) {
      const joystick = this.board.getJoystick();
      const sample = this.readAdcChannel(channel, joystick);
      this.lastAdcLow = sample & 0xff;
      this.lastAdcHigh = ((channel & 0x0f) << 4) | ((sample >> 8) & 0x0f);
      this.lastAdcConfig = config;
      this.lastAdcInputRevision = inputRevision;
    }

    if ((this.emu.getSfr(ST841_MAP.adc.dataLow) & 0xff) !== this.lastAdcLow) {
      this.emu.setSfr(ST841_MAP.adc.dataLow, this.lastAdcLow);
    }
    if ((this.emu.getSfr(ST841_MAP.adc.dataHigh) & 0xff) !== this.lastAdcHigh) {
      this.emu.setSfr(ST841_MAP.adc.dataHigh, this.lastAdcHigh);
    }

    // Keep lab snippets unblocked: conversion is treated as always-ready.
    const nextAdcon2 =
      (this.emu.getSfr(ST841_MAP.adc.adcon2) & ~ST841_MAP.adc.sconvMask) |
      ST841_MAP.adc.adciMask;
    if (nextAdcon2 !== adcon2) this.emu.setSfr(ST841_MAP.adc.adcon2, nextAdcon2);
  }

  private serviceTimer0(): void {
    if (!this.emu) return;
    const tcon = this.emu.getSfr(SFR.tcon) & 0xff;
    const tmod = this.emu.getSfr(SFR.tmod) & 0xff;
    const tr0 = (tcon & 0x10) !== 0;
    if (!tr0) return;

    const mode = tmod & 0x03;
    if (mode !== 0x01) return; // Lab code uses 16-bit mode

    const current =
      ((this.emu.getSfr(SFR.th0) & 0xff) << 8) |
      (this.emu.getSfr(SFR.tl0) & 0xff);
    const advanced = current + EmuBoardController.TIMER0_ACCEL;
    const next = advanced & 0xffff;
    if (advanced > 0xffff) {
      this.emu.setSfr(SFR.tcon, (tcon | 0x20) & 0xff); // TF0=1
    }
    this.emu.setSfr(SFR.tl0, next & 0xff);
    this.emu.setSfr(SFR.th0, (next >> 8) & 0xff);
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

  private pushTrace(entry: CpuTraceEntry): void {
    const capacity = EmuBoardController.TRACE_CAPACITY;
    if (this.traceCount < capacity) {
      this.trace[(this.traceStart + this.traceCount) % capacity] = entry;
      this.traceCount += 1;
      return;
    }
    this.trace[this.traceStart] = entry;
    this.traceStart = (this.traceStart + 1) % capacity;
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
    const pwm0h = (pwm0 >> 8) & 0xff;
    const pwm0l = pwm0 & 0xff;
    const pwm1h = (pwm1 >> 8) & 0xff;
    const pwm1l = pwm1 & 0xff;
    if (
      this.lastPwmRegisters[0] === pwmcon &&
      this.lastPwmRegisters[1] === pwm0h &&
      this.lastPwmRegisters[2] === pwm0l &&
      this.lastPwmRegisters[3] === pwm1h &&
      this.lastPwmRegisters[4] === pwm1l
    ) {
      return;
    }
    this.lastPwmRegisters[0] = pwmcon;
    this.lastPwmRegisters[1] = pwm0h;
    this.lastPwmRegisters[2] = pwm0l;
    this.lastPwmRegisters[3] = pwm1h;
    this.lastPwmRegisters[4] = pwm1l;

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
    this.pwmScopeActive = !singleOutputMasked && mode === 1 && periodCounts > 0 && duty > 0;
    this.pwmScopeDuty = duty;
    this.pwmScopeFrequencyHz = frequencyHz;
  }

  private serviceAudio(): void {
    if (!this.emu) return;

    const audio = this.board.extraDevices.audio;
    if (!audio || typeof audio.setState !== "function") return;

    const p3 = this.emu.getSfr(SFR.p3) & 0xff;
    const dac0 =
      ((this.emu.getSfr(SFR.dac0h) & 0x0f) << 8) |
      (this.emu.getSfr(SFR.dac0l) & 0xff);
    const dac1 =
      ((this.emu.getSfr(SFR.dac1h) & 0x0f) << 8) |
      (this.emu.getSfr(SFR.dac1l) & 0xff);
    const daccon = this.emu.getSfr(SFR.daccon) & 0xff;
    const p34 = ((p3 >> 4) & 1) as 0 | 1;
    const p35 = ((p3 >> 5) & 1) as 0 | 1;
    const stateChanged =
      this.lastAudioRegisters[0] !== daccon ||
      this.lastAudioRegisters[1] !== dac0 ||
      this.lastAudioRegisters[2] !== dac1 ||
      this.lastAudioRegisters[3] !== p34 ||
      this.lastAudioRegisters[4] !== p35;

    if (stateChanged) {
      this.lastAudioRegisters[0] = daccon;
      this.lastAudioRegisters[1] = dac0;
      this.lastAudioRegisters[2] = dac1;
      this.lastAudioRegisters[3] = p34;
      this.lastAudioRegisters[4] = p35;
      audio.setState({ daccon, dac0, dac1, p34, p35, tick: this.machineCycles });
    }

    if (!this.board.scope.isRecordingEnabled()) {
      this.lastAudioDac0 = -1;
    } else if (dac0 !== this.lastAudioDac0) {
      this.lastAudioDac0 = dac0;
      this.board.scope.captureAnalog("audio", (dac0 / 4095) * 5, this.machineCycles);
    }
  }

  private servicePwmScope(): void {
    if (!this.board.scope.isRecordingEnabled()) return;
    let level: 0 | 1 = 0;
    if (this.pwmScopeActive && this.pwmScopeFrequencyHz > 0 && this.pwmScopeDuty > 0) {
      const phase = ((this.machineCycles * this.pwmScopeFrequencyHz) / ADUC841_MACHINE_CYCLE_HZ) % 1;
      level = phase < this.pwmScopeDuty ? 1 : 0;
    }
    if (level === this.pwmScopeLastLevel) return;
    this.pwmScopeLastLevel = level;
    this.board.scope.captureDigital("motor", level, this.machineCycles);
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
