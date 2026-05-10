import type { BusDevice } from "../peripheralBus";

const LCD_ROWS = 4;
const LCD_COLS = 10;
const LCD_SHOW_DOT_GRID = false;
const LCD_LINE_BASES = [0x00, 0x40, 0x0a, 0x4a] as const;
const LCD_LINE_BASES_ALT = [0x00, 0x40, 0x14, 0x54] as const;
const LCD_CHAR_MAP: Record<number, string> = {
  0xa0: "Б",
  0xa1: "Г",
  0xa2: "Е",
  0xa3: "Ж",
  0xa4: "З",
  0xa5: "И",
  0xa6: "Й",
  0xa7: "Л",
  0xa8: "П",
  0xa9: "У",
  0xaa: "Ф",
  0xab: "Ч",
  0xac: "Ш",
  0xad: "Ь",
  0xae: "Ы",
  0xaf: "Э",
  0xb0: "Ю",
  0xb1: "Я",
  0xb2: "б",
  0xb3: "в",
  0xb4: "г",
  0xb5: "ё",
  0xb6: "ж",
  0xb7: "з",
  0xb8: "и",
  0xb9: "й",
  0xba: "к",
  0xbb: "л",
  0xbc: "м",
  0xbd: "н",
  0xbe: "п",
  0xbf: "т",
  0xc0: "ч",
  0xc1: "ш",
  0xc2: "ь",
  0xc3: "ы",
  0xc4: "ъ",
  0xc5: "э",
  0xc6: "ю",
  0xc7: "я",
  0xca: "є",
  0xcb: "ґ",
  0xcd: "с",
  0xce: "ґ",
  0xcf: "€",
  0xe0: "Д",
  0xe1: "Ц",
  0xe2: "Щ",
  0xe3: "Я",
  0xe4: "ф",
  0xe5: "ц",
  0xe6: "ш",
  0xea: "є",
  0xeb: "Є",
  0xec: "и",
  0xed: "д",
  0xee: "×",
  0xef: "о",
  0xf0: "У",
  0xf1: "Ч",
  0xf2: "Ч",
  0xf3: "Ч",
  0xf4: "Н",
  0xf5: "\"",
  0xf6: "д",
  0xfd: "б",
  0xfe: "Я",
  0xff: "█",
};

Object.assign(LCD_CHAR_MAP, {
  0xa0: "Б",
  0xa1: "Г",
  0xa2: "Е",
  0xa3: "Ж",
  0xa4: "З",
  0xa5: "И",
  0xa6: "Й",
  0xa7: "Л",
  0xa8: "П",
  0xa9: "У",
  0xaa: "Ф",
  0xab: "Ч",
  0xac: "Ш",
  0xad: "Ь",
  0xae: "Ы",
  0xaf: "Э",
  0xb0: "Ю",
  0xb1: "Я",
  0xb2: "б",
  0xb3: "в",
  0xb4: "г",
  0xb5: "ё",
  0xb6: "ж",
  0xb7: "з",
  0xb8: "и",
  0xb9: "й",
  0xba: "к",
  0xbb: "л",
  0xbc: "м",
  0xbd: "н",
  0xbe: "п",
  0xbf: "т",
  0xc0: "ч",
  0xc1: "ш",
  0xc2: "ь",
  0xc3: "ы",
  0xc4: "ъ",
  0xc5: "э",
  0xc6: "ю",
  0xc7: "я",
  0xca: "є",
  0xcb: "ґ",
  0xcd: "с",
  0xce: "ґ",
  0xcf: "€",
  0xe0: "Д",
  0xe1: "Ц",
  0xe2: "Щ",
  0xe3: "Я",
  0xe4: "ф",
  0xe5: "ц",
  0xe6: "ш",
  0xea: "є",
  0xeb: "Є",
  0xec: "и",
  0xed: "д",
  0xee: "×",
  0xef: "о",
  0xf0: "У",
  0xf1: "Ч",
  0xf2: "Ч",
  0xf3: "Ч",
  0xf4: "Н",
  0xf6: "д",
  0xfd: "б",
  0xfe: "Я",
  0xff: "█",
});

Object.assign(LCD_CHAR_MAP, {
  0xa0: "\u0411",
  0xa1: "\u0413",
  0xa2: "\u0415",
  0xa3: "\u0416",
  0xa4: "\u0417",
  0xa5: "\u0418",
  0xa6: "\u0419",
  0xa7: "\u041b",
  0xa8: "\u041f",
  0xa9: "\u0423",
  0xaa: "\u0424",
  0xab: "\u0427",
  0xac: "\u0428",
  0xad: "\u042c",
  0xae: "\u042b",
  0xaf: "\u042d",
  0xb0: "\u042e",
  0xb1: "\u042f",
  0xb2: "\u0431",
  0xb3: "\u0432",
  0xb4: "\u0433",
  0xb5: "\u0451",
  0xb6: "\u0436",
  0xb7: "\u0437",
  0xb8: "\u0438",
  0xb9: "\u0439",
  0xba: "\u043a",
  0xbb: "\u043b",
  0xbc: "\u043c",
  0xbd: "\u043d",
  0xbe: "\u043f",
  0xbf: "\u0442",
  0xc0: "\u0447",
  0xc1: "\u0448",
  0xc2: "\u044c",
  0xc3: "\u044b",
  0xc4: "\u044a",
  0xc5: "\u044d",
  0xc6: "\u044e",
  0xc7: "\u044f",
  0xca: "\u0454",
  0xcb: "\u0491",
  0xcd: "\u0441",
  0xce: "\u0491",
  0xcf: "\u20ac",
  0xe0: "\u0414",
  0xe1: "\u0426",
  0xe2: "\u0429",
  0xe3: "\u042f",
  0xe4: "\u0444",
  0xe5: "\u0446",
  0xe6: "\u0448",
  0xea: "\u0454",
  0xeb: "\u0404",
  0xec: "\u0438",
  0xed: "\u0434",
  0xee: "\u00d7",
  0xef: "\u043e",
  0xf0: "\u0423",
  0xf1: "\u0427",
  0xf2: "\u0427",
  0xf3: "\u0427",
  0xf4: "\u041d",
  0xf5: "\"",
  0xf6: "\u0434",
  0xfd: "\u0431",
  0xfe: "\u042f",
  0xff: "\u2588",
});

export class Lcd16x2 implements BusDevice {
  private lines: string[] = Array.from({ length: LCD_ROWS }, () => spaces(LCD_COLS));
  private cellCodes: number[][] = Array.from({ length: LCD_ROWS }, () =>
    Array.from({ length: LCD_COLS }, () => 0x20),
  );
  private cursor = 0;
  private pendingNibble: { rs: 0 | 1; raw: number } | null = null;
  private busLog: string[] = [];

  reset(): void {
    this.lines = Array.from({ length: LCD_ROWS }, () => spaces(LCD_COLS));
    this.cellCodes = Array.from({ length: LCD_ROWS }, () =>
      Array.from({ length: LCD_COLS }, () => 0x20),
    );
    this.cursor = 0;
    this.pendingNibble = null;
    this.busLog = [];
  }

  clear(): void {
    this.reset();
  }

  print(row: 0 | 1, col: number, text: string): void {
    const c = Math.max(0, Math.min(LCD_COLS - 1, col | 0));
    const t = text.slice(0, LCD_COLS - c);
    const line = this.lines[row];
    this.lines[row] = (line.slice(0, c) + t + line.slice(c + t.length)).slice(
      0,
      LCD_COLS,
    );
  }

  write(data: number): void {
    const rs = (data & 0x01) as 0 | 1;

    if (this.pendingNibble === null) {
      this.pendingNibble = { rs, raw: data & 0xff };
      this.pushBusLog(`0x08 <- ${hexByte(data)} pending RS=${rs}`);
      return;
    }

    // ST841 lab compatibility: both pulses carry data nibble in bits 7..4.
    const byte = (this.pendingNibble.raw & 0xf0) | ((data >> 4) & 0x0f);
    const isData = this.pendingNibble.rs === 1;
    if (this.pendingNibble.rs !== rs) {
      this.pushBusLog(
        `0x08 <- ${hexByte(this.pendingNibble.raw)} + ${hexByte(data)} RS mismatch ${this.pendingNibble.rs}/${rs}`,
      );
    }
    this.pushBusLog(
      `0x08 <- ${hexByte(this.pendingNibble.raw)} + ${hexByte(data)} = ${hexByte(byte)} RS=${this.pendingNibble.rs}`,
    );
    this.pendingNibble = null;
    this.processByte(byte, isData);
  }

  writeDataByte(data: number): void {
    this.pendingNibble = null;
    this.pushBusLog(`0x09 <- ${hexByte(data)} data-byte`);
    this.processByte(data & 0xff, true);
  }

  writeCommandByte(data: number): void {
    this.pendingNibble = null;
    this.pushBusLog(`cmd-byte ${hexByte(data)}`);
    this.processByte(data & 0xff, false);
  }

  getDebugRows(): string[] {
    const out: string[] = [];
    for (let row = 0; row < LCD_ROWS; row++) {
      const codes = this.cellCodes[row].map((v) => `0x${(v & 0xff).toString(16).padStart(2, "0").toUpperCase()}`);
      const text = this.lines[row].replace(/\s/g, "·");
      out.push(`L${row + 1}: ${text}`);
      out.push(`    ${codes.join(" ")}`);
    }
    out.push("LCD BUS LOG:");
    out.push(...(this.busLog.length ? this.busLog.slice(-12) : ["    -"]));
    return out;
  }

  private processByte(byte: number, isData: boolean): void {
    if (isData) {
      this.writeCharacter(byte & 0xff);
      return;
    }
    this.executeCommand(byte & 0xff);
  }

  private executeCommand(command: number): void {
    if (command === 0x01) {
      this.clear();
      return;
    }

    if (command === 0x02) {
      this.cursor = 0;
      return;
    }

    if ((command & 0x80) !== 0) {
      this.cursor = command & 0x7f;
    }
  }

  private writeCharacter(charCode: number): void {
    const target = this.cursorToLineAndColumn(this.cursor);
    if (!target) return;

    const { row, col } = target;
    const line = this.lines[row];
    const ch = decodeLcdChar(charCode);
    this.cellCodes[row][col] = charCode & 0xff;
    this.lines[row] =
      line.slice(0, col) + ch + line.slice(col + 1);
    this.cursor += 1;
  }

  private pushBusLog(line: string): void {
    this.busLog.push(line);
    if (this.busLog.length > 80) {
      this.busLog.splice(0, this.busLog.length - 80);
    }
  }

  private cursorToLineAndColumn(
    ddramAddress: number,
  ): { row: number; col: number } | null {
    const primary = findLineByBases(ddramAddress, LCD_LINE_BASES);
    if (primary) return primary;
    const alt = findLineByBases(ddramAddress, LCD_LINE_BASES_ALT);
    if (alt) return alt;
    return null;
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.64)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x, y, 268, 184);
    ctx.strokeRect(x + 0.5, y + 0.5, 267, 183);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 14, y + 24, 238, 130);
    ctx.strokeStyle = "rgba(122,162,255,0.25)";
    ctx.strokeRect(x + 14.5, y + 24.5, 237, 129);

    const cellW = 238 / LCD_COLS;
    const cellH = 130 / LCD_ROWS;
    ctx.strokeStyle = "rgba(110,180,255,0.15)";
    for (let row = 0; row <= LCD_ROWS; row++) {
      const gy = y + 24 + row * cellH;
      ctx.beginPath();
      ctx.moveTo(x + 14, gy + 0.5);
      ctx.lineTo(x + 252, gy + 0.5);
      ctx.stroke();
    }
    for (let col = 0; col <= LCD_COLS; col++) {
      const gx = x + 14 + col * cellW;
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, y + 24);
      ctx.lineTo(gx + 0.5, y + 154);
      ctx.stroke();
    }

    if (LCD_SHOW_DOT_GRID) {
      const dotCols = 5;
      const dotRows = 8;
      const dotGap = 1.1;
      const innerPadX = 2.2;
      const innerPadY = 2.4;

      for (let row = 0; row < LCD_ROWS; row++) {
        for (let col = 0; col < LCD_COLS; col++) {
          const cellX = x + 14 + col * cellW;
          const cellY = y + 24 + row * cellH;

          ctx.fillStyle = "rgba(20,35,34,0.28)";
          ctx.fillRect(cellX + 1.2, cellY + 1.2, cellW - 2.4, cellH - 2.4);

          const availW = cellW - innerPadX * 2;
          const availH = cellH - innerPadY * 2;
          const dotW = (availW - (dotCols - 1) * dotGap) / dotCols;
          const dotH = (availH - (dotRows - 1) * dotGap) / dotRows;

          ctx.fillStyle = "rgba(80,150,120,0.12)";
          for (let dr = 0; dr < dotRows; dr++) {
            for (let dc = 0; dc < dotCols; dc++) {
              const dx = cellX + innerPadX + dc * (dotW + dotGap);
              const dy = cellY + innerPadY + dr * (dotH + dotGap);
              ctx.fillRect(dx, dy, dotW, dotH);
            }
          }
        }
      }
    }

    // Active symbols on top
    ctx.fillStyle = "rgba(165,255,205,1)";
    ctx.shadowColor = "rgba(40,255,170,0.45)";
    ctx.shadowBlur = 3;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    for (let row = 0; row < this.lines.length; row++) {
      const line = this.lines[row];
      for (let col = 0; col < LCD_COLS; col++) {
        const ch = line[col] ?? " ";
        const cx = x + 14 + col * cellW + cellW / 2;
        const cy = y + 24 + row * cellH + cellH / 2 + 0.5;
        ctx.fillText(ch, cx, cy);
      }
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}

function spaces(n: number): string {
  return " ".repeat(n);
}

function decodeLcdChar(code: number): string {
  const v = code & 0xff;
  // Always show printable ASCII directly (digits/latin/punctuation).
  if (v >= 0x20 && v <= 0x7e) return String.fromCharCode(v);
  const mapped = LCD_CHAR_MAP[v];
  if (mapped) return mapped;
  return ".";
}

function hexByte(value: number): string {
  return `0x${(value & 0xff).toString(16).padStart(2, "0").toUpperCase()}`;
}

function findLineByBases(
  ddramAddress: number,
  bases: readonly number[],
): { row: number; col: number } | null {
  for (let row = 0; row < bases.length; row++) {
    const base = bases[row];
    const col = ddramAddress - base;
    if (col >= 0 && col < LCD_COLS) {
      return { row, col };
    }
  }
  return null;
}
