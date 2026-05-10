export class AdcJoystick {
  private x = 512;
  private y = 512;

  set(x: number, y: number): void {
    this.x = clamp(x);
    this.y = clamp(y);
  }

  read(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1023, v | 0));
}

