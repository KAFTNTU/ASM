export class Keypad4x3 {
  press(_index: number): void {}
  release(_index: number): void {}
  reset(): void {}

  read(addr: number, pressedFromBoard: Set<number>): number | null {
    const col = decodeCol(addr);
    if (col == null) return null;
    return readP0ForCol(col, pressedFromBoard);
  }
}

function decodeCol(addr: number): 0 | 1 | 2 | null {
  const a = addr & 0xff;
  // From PDF text: 0xEF / 0xDF / 0xBF.
  if (a === 0xef || (a & 0xf0) === 0xe0) return 0;
  if (a === 0xdf || (a & 0xf0) === 0xd0) return 1;
  if (a === 0xbf || (a & 0xf0) === 0xb0) return 2;
  // From code sample: 0x60 / 0x50 / 0x30.
  if (a === 0x60) return 0;
  if (a === 0x50) return 1;
  if (a === 0x30) return 2;
  return null;
}

function readP0ForCol(col: 0 | 1 | 2, pressed: Set<number>): number {
  // P0.0..P0.3 = rows, active-low.
  let p0 = 0xff;
  for (let row = 0; row < 4; row++) {
    const idx = col + row * 3;
    if (pressed.has(idx)) p0 &= ~(1 << row);
  }
  return p0 & 0xff;
}
