import { PeripheralBus } from "./peripheralBus";

type PortName = "P0" | "P2" | "P3";

export class Board {
  public readonly bus = new PeripheralBus();

  private ports: Record<PortName, number> = {
    P0: 0xff,
    P2: 0x00,
    P3: 0xff,
  };

  private abortSignal: AbortSignal | null = null;
  public extraDevices: Record<string, any> = {};

  private joystick = { x: 2048, y: 2048 };
  private keypadPressed = new Set<number>();

  reset(): void {
    this.ports = { P0: 0xff, P2: 0x00, P3: 0xff };
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
        return busVal == null ? 0xff : busVal & 0xff;
      }
    }

    return this.ports[name] & 0xff;
  }

  getPortRaw(name: PortName): number {
    return this.ports[name] & 0xff;
  }

  writePort(name: PortName, value: number): void {
    const v = value & 0xff;
    if (name === "P2") {
      const prev = this.ports.P2 & 0xff;
      this.ports.P2 = v;

      // ST841 latch write: P2 transition ADR -> 0 in TX mode.
      if (prev !== 0x00 && v === 0x00 && this.readBit("P3", 6) === 1) {
        this.bus.write(prev, this.ports.P0 & 0xff);
      }
      return;
    }

    this.ports[name] = v;
  }

  applyCpuPorts(ports: { p0: number; p2: number; p3: number }): void {
    // Keep write latch semantics centralized in writePort("P2", ...).
    this.ports.P3 = ports.p3 & 0xff;
    this.ports.P0 = ports.p0 & 0xff;
    this.writePort("P2", ports.p2 & 0xff);
  }

  readBit(name: PortName, bit: number): 0 | 1 {
    const v = (this.ports[name] >>> bit) & 1;
    return (v ? 1 : 0) as 0 | 1;
  }

  writeBit(name: PortName, bit: number, value: 0 | 1): void {
    const mask = 1 << bit;
    const cur = this.ports[name] & 0xff;
    this.ports[name] = value ? cur | mask : cur & ~mask;
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
    this.extraDevices.ledBar?.render(ctx, boardX + 28, boardY + 148);
    this.extraDevices.matrix?.render(ctx, boardX + 72, boardY + 256);
    this.extraDevices.lcd?.render(ctx, boardX + boardW - 306, boardY + 252);
    ctx.restore();
  }
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
