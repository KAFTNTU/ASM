import type { BusDevice } from "../peripheralBus";

class SimpleWriteDevice implements BusDevice {
  constructor(private onWrite: (data: number) => void) {}
  write(data: number): void {
    this.onWrite(data & 0xff);
  }
}

export class Matrix5x7 {
  private rowReg = 0xff; // active-low
  private colReg = 0x00; // active-high
  private forcedPoint: { row: number; col: number } | null = null;
  private glowUntil = Array.from({ length: 7 }, () => Array(5).fill(0));
  // The lab snippets often multiplex the 5x7 matrix with fairly long software delays.
  // Keep points alive a bit longer so methodology code still forms the intended symbol.
  private static readonly PERSIST_MS = 48;

  rowsDevice(): BusDevice {
    return new SimpleWriteDevice((d) => {
      this.rowReg = d;
      this.refreshGlow();
    });
  }
  colsDevice(): BusDevice {
    return new SimpleWriteDevice((d) => {
      this.colReg = d;
      this.refreshGlow();
    });
  }

  setPoint(row: number, col: number, on: boolean): void {
    if (!on) {
      this.forcedPoint = null;
      return;
    }
    this.forcedPoint = { row, col };
  }

  reset(): void {
    this.rowReg = 0xff;
    this.colReg = 0x00;
    this.forcedPoint = null;
    this.glowUntil = Array.from({ length: 7 }, () => Array(5).fill(0));
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    this.refreshGlow();
    ctx.save();
    const width = 132;
    const height = 186;
    ctx.fillStyle = "rgba(0,0,0,0.64)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    const cols = 5;
    const rows = 7;
    const padX = 20;
    const padY = 24;
    const stepX = (width - padX * 2) / (cols - 1);
    const stepY = (height - padY * 2) / (rows - 1);
    const radius = Math.min(10, stepX * 0.32, stepY * 0.32);
    const now = timeNow();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rowBit = (this.rowReg >>> r) & 1;
        const colBit = (this.colReg >>> c) & 1;
        let on = rowBit === 0 && colBit === 1;
        const persisted = this.glowUntil[r][c] > now;
        on = on || persisted;
        if (this.forcedPoint && this.forcedPoint.row === r && this.forcedPoint.col === c) {
          on = true;
        }
        const cx = x + padX + c * stepX;
        const cy = y + padY + (rows - 1 - r) * stepY;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = on ? "rgba(122,162,255,0.95)" : "rgba(255,255,255,0.10)";
        ctx.fill();
        ctx.strokeStyle = on ? "rgba(122,162,255,0.75)" : "rgba(255,255,255,0.16)";
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private refreshGlow(): void {
    const now = timeNow();
    for (let r = 0; r < 7; r++) {
      const rowBit = (this.rowReg >>> r) & 1;
      if (rowBit !== 0) continue;
      for (let c = 0; c < 5; c++) {
        const colBit = (this.colReg >>> c) & 1;
        if (colBit === 1) {
          this.glowUntil[r][c] = Math.max(
            this.glowUntil[r][c],
            now + Matrix5x7.PERSIST_MS,
          );
        }
      }
    }
  }
}

function timeNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
