// Virtual ST841 stand: peripheral behaviour and indicator artwork.
//
// The bus devices are plain TypeScript, so they are transpiled the same way
// test-scope-recorder.mjs does it, then exercised through the real Board bus.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st841-stand-test-"));

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };

try {
  for (const relative of [
    "src/mcu/aduc841.ts",
    "src/vm/peripheralBus.ts",
    "src/vm/st841Map.ts",
    "src/vm/scopeRecorder.ts",
    "src/vm/board.ts",
    "src/vm/devices/ledBar.ts",
    "src/vm/devices/sevenSeg.ts",
    "src/vm/devices/matrix5x7.ts",
    "src/vm/devices/keypad4x3.ts",
    "src/vm/devices/lcd16x2.ts",
  ]) {
    const sourcePath = path.join(projectRoot, relative);
    let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      fileName: sourcePath,
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    output = output.replace(/from "\.\.?\/(?:[^"/]+\/)*([^"/.]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(tempDir, `${path.basename(relative, ".ts")}.mjs`), output);
  }
  const load = async (name) => import(pathToFileURL(path.join(tempDir, `${name}.mjs`)).href);

  const { Board } = await load("board");
  const { ST841_MAP } = await load("st841Map");
  const { LedBar } = await load("ledBar");
  const { SevenSeg4 } = await load("sevenSeg");
  const { Matrix5x7 } = await load("matrix5x7");
  const { Keypad4x3 } = await load("keypad4x3");
  const { Lcd16x2 } = await load("lcd16x2");

  const board = new Board();
  const ledBar = new LedBar();
  const sevenSeg = new SevenSeg4();
  const matrix = new Matrix5x7();
  const keypad = new Keypad4x3();
  const lcd = new Lcd16x2();
  board.bus.registerDevice(ST841_MAP.ledBarAddr, ledBar);
  ST841_MAP.sevenSegAddrs.forEach((addr, index) => {
    board.bus.registerDevice(addr, sevenSeg.digit(3 - index));
  });
  board.bus.registerDevice(ST841_MAP.matrixRowsAddr, matrix.rowsDevice());
  board.bus.registerDevice(ST841_MAP.matrixColsAddr, matrix.colsDevice());
  board.bus.registerDevice(ST841_MAP.lcdAddr, lcd);
  board.bus.registerReadProvider((addr, ctx) => keypad.read(addr, ctx.keypadPressed ?? new Set()));
  board.reset();

  const peek = (device) => JSON.parse(JSON.stringify(device));

  // --- LED bar is active low --------------------------------------------------
  eq(peek(ledBar).value, 0xff, "LED bar is dark after reset (active low)");
  board.bus.write(ST841_MAP.ledBarAddr, 0x00);
  eq(peek(ledBar).value, 0x00, "writing 0x00 lights every LED");
  board.bus.write(ST841_MAP.ledBarAddr, 0xfe);
  eq(peek(ledBar).value, 0xfe, "only bit 0 is driven low");

  // --- Seven-segment digit addressing ----------------------------------------
  eq(peek(sevenSeg).digits.map((d) => d.raw), [0xff, 0xff, 0xff, 0xff],
    "all digits blank after reset (active low)");
  board.bus.write(ST841_MAP.sevenSegAddrs[0], 0xc0);
  eq(peek(sevenSeg).digits.map((d) => d.raw), [0xff, 0xff, 0xff, 0xc0],
    "the first bus address drives the leftmost-written digit slot");
  board.bus.write(ST841_MAP.sevenSegAddrs[3], 0xf9);
  eq(peek(sevenSeg).digits[0].raw, 0xf9, "the fourth bus address drives digit 0");

  // --- Keypad: 4 rows x 3 columns, active low on P0.0..P0.3 -------------------
  {
    const readColumns = () => ST841_MAP.keypadColumnAddrs
      .map((addr) => keypad.read(addr, new Set(board.getPressedKeys())));
    eq(readColumns(), [0xff, 0xff, 0xff], "no key pressed leaves every row high");

    for (let key = 0; key < 12; key += 1) {
      board.keypadPress(key);
      const columns = readColumns();
      const expectedColumn = key % 3;
      const expectedRow = Math.floor(key / 3);
      columns.forEach((value, column) => {
        const low = (~value & 0x0f);
        if (column === expectedColumn) {
          eq(low, 1 << expectedRow, `key ${key} pulls row ${expectedRow} low on column ${column}`);
        } else {
          eq(low, 0, `key ${key} leaves column ${column} untouched`);
        }
      });
      board.keypadRelease(key);
    }
    eq(readColumns(), [0xff, 0xff, 0xff], "releasing restores every row");
  }

  // --- Matrix 5x7 -------------------------------------------------------------
  {
    const state = peek(matrix);
    eq(state.rowReg, 0xff, "matrix rows idle high (active low)");
    eq(state.colReg, 0x00, "matrix columns idle low (active high)");
    eq(state.glowUntil.length, 7, "matrix has seven rows");
    eq(state.glowUntil[0].length, 5, "matrix has five columns");
  }

  // --- LCD: HD44780 addressing ------------------------------------------------
  {
    const text = () => lcd.getDebugRows().filter((row) => /^L\d:/.test(row))
      .map((row) => row.slice(4));
    lcd.writeCommandByte(0x01);
    lcd.writeCommandByte(0x80);
    for (const ch of "HELLO") lcd.writeDataByte(ch.charCodeAt(0));
    eq(text()[0], "HELLO·····", "text lands at DDRAM 0x00 on line 1");

    lcd.writeCommandByte(0xc0);
    for (const ch of "WORLD") lcd.writeDataByte(ch.charCodeAt(0));
    eq(text()[1], "WORLD·····", "DDRAM 0x40 is the start of line 2");

    lcd.writeCommandByte(0x01);
    eq(text()[0], "··········", "clear-display wipes the panel");

    // Four-bit mode: two writes carrying nibbles in bits 7..4 form one byte.
    lcd.writeCommandByte(0x80);
    lcd.write(0x40 | 0x01); // high nibble of 'A' (0x41), RS=1
    lcd.write(0x10 | 0x01); // low nibble
    eq(text()[0][0], "A", "two nibble writes assemble into one character");
  }

  // --- Seven-segment artwork: segments must not overlap -----------------------
  {
    const source = fs.readFileSync(path.join(projectRoot, "src/vm/devices/sevenSeg.ts"), "utf8");
    const number = (name) => {
      const match = new RegExp(`const ${name} = ([\\d.]+);`).exec(source);
      assert.ok(match, `sevenSeg.ts defines ${name}`);
      return Number(match[1]);
    };
    const w = number("w");
    const h = number("h");
    const t = number("t");
    const gap = number("gap");
    const half = t / 2;
    const left = half;
    const right = w - half;
    const top = half;
    const middle = h / 2;
    const bottom = h - half;

    // The exact hexagons renderDigit fills: a bar of thickness t whose ends
    // taper to a point. Bounding boxes would falsely report a clash between
    // the tapered tips, so compare the real polygons.
    const horizontalBar = (x0, x1, cy) => [
      [x0, cy], [x0 + half, cy - half], [x1 - half, cy - half],
      [x1, cy], [x1 - half, cy + half], [x0 + half, cy + half],
    ];
    const verticalBar = (cx, y0, y1) => [
      [cx, y0], [cx + half, y0 + half], [cx + half, y1 - half],
      [cx, y1], [cx - half, y1 - half], [cx - half, y0 + half],
    ];
    const bars = {
      a: horizontalBar(left + gap, right - gap, top),
      b: verticalBar(right, top + gap, middle - gap),
      c: verticalBar(right, middle + gap, bottom - gap),
      d: horizontalBar(left + gap, right - gap, bottom),
      e: verticalBar(left, middle + gap, bottom - gap),
      f: verticalBar(left, top + gap, middle - gap),
      g: horizontalBar(left + gap, right - gap, middle),
    };

    // Separating-axis test for two convex polygons.
    const overlaps = (first, second) => {
      for (const polygon of [first, second]) {
        for (let index = 0; index < polygon.length; index += 1) {
          const [ax, ay] = polygon[index];
          const [bx, by] = polygon[(index + 1) % polygon.length];
          const nx = -(by - ay);
          const ny = bx - ax;
          const project = (points) => {
            const values = points.map(([px, py]) => px * nx + py * ny);
            return [Math.min(...values), Math.max(...values)];
          };
          const [min1, max1] = project(first);
          const [min2, max2] = project(second);
          if (max1 <= min2 + 1e-9 || max2 <= min1 + 1e-9) return false;
        }
      }
      return true;
    };

    // The middle bar used to run straight through the b and c columns.
    for (const [first, second] of [["g", "b"], ["g", "c"], ["g", "e"], ["g", "f"],
      ["a", "b"], ["a", "f"], ["d", "c"], ["d", "e"], ["b", "c"], ["e", "f"]]) {
      ok(!overlaps(bars[first], bars[second]),
        `segments ${first} and ${second} must not overlap`);
    }

    const boundsOf = (polygon) => ({
      x0: Math.min(...polygon.map((q) => q[0])), x1: Math.max(...polygon.map((q) => q[0])),
      y0: Math.min(...polygon.map((q) => q[1])), y1: Math.max(...polygon.map((q) => q[1])),
    });
    const boxes = Object.fromEntries(Object.entries(bars).map(([k, v]) => [k, boundsOf(v)]));

    ok(gap > 0, "adjacent segments are separated by a visible gap");
    // Uniform thickness in both directions.
    eq(boxes.a.y1 - boxes.a.y0, t, "horizontal bars are one stroke thick");
    eq(boxes.b.x1 - boxes.b.x0, t, "vertical bars are one stroke thick");
    // g exactly midway between a and d.
    eq((boxes.g.y0 + boxes.g.y1) / 2, ((boxes.a.y0 + boxes.a.y1) / 2 + (boxes.d.y0 + boxes.d.y1) / 2) / 2,
      "the middle bar is centred between the top and bottom bars");
    // The decimal point must sit outside the digit body, not on segment c.
    const dp = /ctx\.arc\(x \+ w \+ (\d+), bottom, (\d+)/.exec(source);
    ok(dp, "the decimal point is placed relative to the digit body");
    ok(Number(dp[1]) - Number(dp[2]) > 0, "the decimal point clears the digit body");

    // Four digits plus their decimal points must fit the 232 px panel.
    const pitch = 53;
    const rightmost = 16 + 3 * pitch + w + Number(dp[1]) + Number(dp[2]);
    ok(rightmost <= 232, `four digits fit inside the panel (needs ${rightmost} of 232)`);
  }

  console.log(`ST841 stand device tests: PASS (${assertions} assertions)`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
