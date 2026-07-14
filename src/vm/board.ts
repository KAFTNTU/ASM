import { PeripheralBus } from "./peripheralBus";
import { ScopeRecorder } from "./scopeRecorder";
import { ST841_MAP } from "./st841Map";

export type PortName = "P0" | "P1" | "P2" | "P3";

export class Board {
  public readonly bus = new PeripheralBus();
  public readonly scope = new ScopeRecorder();

  private ports: Record<PortName, number> = {
    P0: 0xff,
    P1: 0xff,
    P2: 0x00,
    P3: 0xff,
  };

  // Optional external digital drivers used by the logic-schematic editor.
  // A set mask bit means that an external circuit is actively driving that pin.
  private externalDriveMask: Record<PortName, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  private externalDriveValue: Record<PortName, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };

  private abortSignal: AbortSignal | null = null;
  public extraDevices: Record<string, any> = {};

  private joystick = { x: 2048, y: 2048 };
  private keypadPressed = new Set<number>();

  reset(): void {
    this.scope.reset();
    this.ports = { P0: 0xff, P1: 0xff, P2: 0x00, P3: 0xff };
    this.externalDriveMask = { P0: 0, P1: 0, P2: 0, P3: 0 };
    this.externalDriveValue = { P0: 0, P1: 0, P2: 0, P3: 0 };
    this.joystick = { x: 2048, y: 2048 };
    this.abortSignal = null;
    this.keypadPressed.clear();

    for (const device of Object.values(this.extraDevices)) {
      if (device && typeof device.reset === "function") {
        device.reset();
      } else if (device && typeof device.clear === "function") {
        device.clear();
      }
    }
    this.captureAllPortBits();
    this.refreshScopeDerivedSignals();
    this.scope.captureAnalog("joystick", (this.joystick.x / 4095) * 5);
    this.scope.captureDigital("motor", 0);
    this.scope.captureAnalog("audio", 0);
  }

  setSimulationCycle(cycle: number): void {
    this.scope.setCycle(cycle);
  }

  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
  }

  formatHex8(v: number): string {
    return "0x" + (v & 0xff).toString(16).padStart(2, "0").toUpperCase();
  }

  readPort(name: PortName): number {
    if (name === "P0") {
      const p36 = this.readBit("P3", 6);
      if (p36 === 0) {
        const busVal = this.bus.read(this.ports.P2, {
          joystick: this.joystick,
          keypadPressed: this.getReadableKeys(),
        });
        return this.applyExternalDrive(name, busVal == null ? 0xff : busVal & 0xff);
      }
    }

    return this.applyExternalDrive(name, this.ports[name] & 0xff);
  }

  getPortRaw(name: PortName): number {
    return this.ports[name] & 0xff;
  }

  writePort(name: PortName, value: number): void {
    const v = value & 0xff;
    const previous = this.ports[name] & 0xff;
    if (previous === v) return;

    this.ports[name] = v;
    this.captureChangedPortBits(name, previous, v);

    if (name === "P2") {
      // ST841 latch write: P2 transition ADR -> 0 in TX mode.
      if (previous !== 0x00 && v === 0x00 && this.readBit("P3", 6) === 1) {
        this.bus.write(previous, this.ports.P0 & 0xff);
      }
    }

    if (name === "P2" || name === "P3") {
      this.refreshScopeDerivedSignals();
    }
  }

  applyCpuPorts(ports: { p0: number; p1: number; p2: number; p3: number }): void {
    // Keep latch semantics and oscilloscope recording centralized in writePort().
    this.writePort("P3", ports.p3 & 0xff);
    this.writePort("P1", ports.p1 & 0xff);
    this.writePort("P0", ports.p0 & 0xff);
    this.writePort("P2", ports.p2 & 0xff);
  }

  readBit(name: PortName, bit: number): 0 | 1 {
    const v = (this.readPort(name) >>> bit) & 1;
    return (v ? 1 : 0) as 0 | 1;
  }

  setExternalDigitalDrive(name: PortName, bit: number, value: 0 | 1 | null): void {
    if (bit < 0 || bit > 7) return;
    const mask = 1 << bit;
    if (value == null) {
      this.externalDriveMask[name] &= ~mask;
    } else {
      this.externalDriveMask[name] |= mask;
      if (value) this.externalDriveValue[name] |= mask;
      else this.externalDriveValue[name] &= ~mask;
    }
    this.captureEffectivePortBit(name, bit);
  }

  getExternalDigitalDrive(name: PortName, bit: number): 0 | 1 | null {
    const mask = 1 << bit;
    if ((this.externalDriveMask[name] & mask) === 0) return null;
    return (this.externalDriveValue[name] & mask) !== 0 ? 1 : 0;
  }

  writeBit(name: PortName, bit: number, value: 0 | 1): void {
    const mask = 1 << bit;
    const cur = this.ports[name] & 0xff;
    this.writePort(name, value ? cur | mask : cur & ~mask);
  }

  async delay(ms: number): Promise<void> {
    const clamped = Math.max(0, Math.min(60_000, ms | 0));
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(resolve, clamped);
      const sig = this.abortSignal;
      if (!sig) return;
      const onAbort = () => {
        window.clearTimeout(t);
        sig.removeEventListener("abort", onAbort);
        reject(new Error("Aborted"));
      };
      if (sig.aborted) return onAbort();
      sig.addEventListener("abort", onAbort);
    });
  }

  setJoystick(x: number, y: number): void {
    this.joystick.x = clamp(x);
    this.joystick.y = clamp(y);
    this.extraDevices.adc?.set(this.joystick.x, this.joystick.y);
    this.scope.captureAnalog("joystick", (this.joystick.x / 4095) * 5);
  }

  getJoystick(): { x: number; y: number } {
    return { ...this.joystick };
  }

  keypadPress(index: number, hold = true): void {
    this.keypadPressed.add(index);
    this.extraDevices.keypad?.press(index);
    if (!hold) {
      this.keypadPressed.delete(index);
      this.extraDevices.keypad?.release(index);
    }
  }

  keypadRelease(index: number): void {
    this.keypadPressed.delete(index);
    this.extraDevices.keypad?.release(index);
  }

  getPressedKeys(): number[] {
    return Array.from(this.keypadPressed).sort((a, b) => a - b);
  }

  getKeypadBusPreview(): { col1: number; col2: number; col3: number } {
    const pressed = this.getReadableKeys();
    const ctx = { joystick: this.joystick, keypadPressed: pressed };
    const col1 = this.bus.read(0x60, ctx);
    const col2 = this.bus.read(0x50, ctx);
    const col3 = this.bus.read(0x30, ctx);
    return {
      col1: (col1 ?? 0xff) & 0xff,
      col2: (col2 ?? 0xff) & 0xff,
      col3: (col3 ?? 0xff) & 0xff,
    };
  }


  private applyExternalDrive(name: PortName, latchValue: number): number {
    const mask = this.externalDriveMask[name] & 0xff;
    const external = this.externalDriveValue[name] & 0xff;
    // 8051 GPIO is quasi-bidirectional: an externally driven low always wins;
    // a driven high cannot force a pin high while the MCU latch drives it low.
    return (latchValue & (~mask | external)) & 0xff;
  }

  private captureEffectivePortBit(name: PortName, bit: number): void {
    this.scope.captureDigital(`${name}.${bit}`, this.readBit(name, bit) === 1);
  }

  private captureAllPortBits(): void {
    for (const name of ["P0", "P1", "P2", "P3"] as PortName[]) {
      const value = this.ports[name] & 0xff;
      for (let bit = 0; bit < 8; bit += 1) {
        this.scope.captureDigital(`${name}.${bit}`, ((value >>> bit) & 1) === 1);
      }
    }
  }

  private captureChangedPortBits(name: PortName, previous: number, next: number): void {
    const changed = (previous ^ next) & 0xff;
    for (let bit = 0; bit < 8; bit += 1) {
      if (((changed >>> bit) & 1) === 0) continue;
      this.scope.captureDigital(`${name}.${bit}`, ((next >>> bit) & 1) === 1);
    }
  }

  private refreshScopeDerivedSignals(): void {
    const address = this.ports.P2 & 0xff;
    const txMode = this.readBit("P3", 6) === 1;
    const rxMode = !txMode;
    const writeSelected = txMode && address !== 0;

    // General channel is the real peripheral address/write gate, not a template.
    this.scope.captureDigital("general", writeSelected);
    this.scope.captureDigital(
      "sevenSeg",
      writeSelected && ST841_MAP.sevenSegAddrs.some((item) => item === address),
    );
    this.scope.captureDigital("ledBar", writeSelected && address === ST841_MAP.ledBarAddr);
    this.scope.captureDigital(
      "matrix",
      writeSelected && (address === ST841_MAP.matrixRowsAddr || address === ST841_MAP.matrixColsAddr),
    );
    this.scope.captureDigital("lcd", writeSelected && address === ST841_MAP.lcdAddr);
    this.scope.captureDigital("keypad", rxMode && isKeypadAddress(address));
  }

  private getReadableKeys(): Set<number> {
    return new Set(this.keypadPressed);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#101723";
    ctx.fillRect(0, 0, w, h);

    const boardX = 10;
    const boardY = 10;
    const boardW = w - 20;
    const boardH = h - 20;

    const boardFill = ctx.createLinearGradient(boardX, boardY, boardX + boardW, boardY + boardH);
    boardFill.addColorStop(0, "#245748");
    boardFill.addColorStop(0.55, "#296353");
    boardFill.addColorStop(1, "#193d34");
    ctx.fillStyle = boardFill;
    roundRect(ctx, boardX, boardY, boardW, boardH, 14, true, false);
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, boardX, boardY, boardW, boardH, 14, false, false);
    ctx.clip();
    this.extraDevices.sevenSeg?.render(ctx, boardX + boardW - 282, boardY + 34);
    this.extraDevices.ledBar?.render(ctx, boardX + 28, boardY + 154);
    this.extraDevices.matrix?.render(ctx, boardX + 72, boardY + 256);
    this.extraDevices.lcd?.render(ctx, boardX + boardW - 306, boardY + 252);
    ctx.restore();
  }
}

function isKeypadAddress(address: number): boolean {
  const value = address & 0xff;
  return (
    value === 0xef ||
    value === 0xdf ||
    value === 0xbf ||
    value === 0x60 ||
    value === 0x50 ||
    value === 0x30
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(4095, v | 0));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
  stroke: boolean,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
