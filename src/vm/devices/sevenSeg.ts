import type { BusDevice } from "../peripheralBus";

const SEG_ON = "rgba(255,204,102,0.95)";
const SEG_OFF = "rgba(255,255,255,0.10)";

type SegState = { raw: number };

class SevenSegDigit implements BusDevice {
  constructor(private state: SegState) {}
  write(data: number): void {
    this.state.raw = data & 0xff;
  }
}

export class SevenSeg4 {
  private digits: SegState[] = [
    { raw: 0xff },
    { raw: 0xff },
    { raw: 0xff },
    { raw: 0xff },
  ];

  digit(index: number): BusDevice {
    return new SevenSegDigit(this.digits[index]);
  }

  reset(): void {
    for (const d of this.digits) d.raw = 0xff;
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.64)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x, y, 232, 104);
    ctx.strokeRect(x + 0.5, y + 0.5, 231, 103);

    for (let i = 0; i < 4; i++) {
      this.renderDigit(ctx, x + 16 + i * 53, y + 22, this.digits[i].raw);
    }
    ctx.restore();
  }

  private renderDigit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    raw: number,
  ): void {
    // MVP convention: bit0..bit6 = segments a..g, bit7 = dp, active-low.
    const seg = (n: number) => (((raw >>> n) & 1) === 0 ? SEG_ON : SEG_OFF);
    const w = 34;
    const h = 58;
    const t = 6;

    const rect = (rx: number, ry: number, rw: number, rh: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(rx, ry, rw, rh);
    };

    rect(x + t, y, w - 2 * t, t, seg(0)); // a
    rect(x + w - t, y + t, t, h / 2 - t, seg(1)); // b
    rect(x + w - t, y + h / 2, t, h / 2 - t, seg(2)); // c
    rect(x + t, y + h - t, w - 2 * t, t, seg(3)); // d
    rect(x, y + h / 2, t, h / 2 - t, seg(4)); // e
    rect(x, y + t, t, h / 2 - t, seg(5)); // f
    rect(x + t, y + h / 2 - t / 2, w - 2 * t, t, seg(6)); // g

    ctx.beginPath();
    ctx.arc(x + w - 2, y + h - 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = seg(7); // dp
    ctx.fill();
  }
}
