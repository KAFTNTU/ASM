import type { ScriptExample } from "./scriptRunner";

export const exampleScripts: ScriptExample[] = [
  {
    id: "lab1-led-scan",
    title: "Lab1: LED line (addr 0x07)",
    description:
      "Пише в адресу 0x07 (як у прикладі з методички) і ганяє біти (active-low).",
    code: `export async function main({ board }) {\n  let a = 0x01;\n  while (true) {\n    a = ((a >>> 1) | ((a & 1) << 7)) & 0xff; // RR A\n\n    board.writeBit('P3', 6, 1); // TX\n    board.writePort('P0', (~a) & 0xff); // active-low\n    board.writePort('P2', 0x07);\n    board.writePort('P2', 0x00); // latch pulse\n\n    await board.delay(200);\n  }\n}\n`,
  },
  {
    id: "lab2-7seg-1988",
    title: "Lab2: 7-seg static (addr 0x01..0x04)",
    description:
      "Як у прикладі з методички: почергово '1','9','8','8' (active-low сегменти).",
    code: `export async function main({ board }) {\n  const digits = [\n    { addr: 0x04, dat: 0b11001111 },\n    { addr: 0x03, dat: 0b10010000 },\n    { addr: 0x02, dat: 0b10000000 },\n    { addr: 0x01, dat: 0b10000000 },\n  ];\n\n  board.writeBit('P3', 6, 1);\n  for (const addr of [0x01, 0x02, 0x03, 0x04]) {\n    board.writePort('P0', 0xff);\n    board.writePort('P2', addr);\n    board.writePort('P2', 0x00);\n  }\n\n  while (true) {\n    for (const { addr, dat } of digits) {\n      board.writeBit('P3', 6, 1);\n      board.writePort('P0', dat);\n      board.writePort('P2', addr);\n      board.writePort('P2', 0x00);\n      await board.delay(600);\n    }\n  }\n}\n`,
  },
  {
    id: "lab3-matrix-s",
    title: "Lab3: LED matrix 5x7 (addr 0x05/0x06)",
    description:
      "DD17 addr 0x05 (rows, active-low), DD18 addr 0x06 (cols, active-high).",
    code: `export async function main({ board }) {\n  const frames = [\n    { row: 0b10111110, col: 0b00001110 },\n    { row: 0b11011101, col: 0b00010001 },\n    { row: 0b11111011, col: 0b00010000 },\n    { row: 0b11101111, col: 0b00000001 },\n    { row: 0b11011101, col: 0b00010001 },\n    { row: 0b10111110, col: 0b00001110 },\n  ];\n\n  while (true) {\n    for (const f of frames) {\n      board.writeBit('P3', 6, 1);\n      board.writePort('P0', f.row);\n      board.writePort('P2', 0x05);\n      board.writePort('P2', 0x00);\n\n      board.writePort('P0', f.col);\n      board.writePort('P2', 0x06);\n      board.writePort('P2', 0x00);\n\n      await board.delay(30);\n\n      // off\n      board.writePort('P0', 0xff);\n      board.writePort('P2', 0x05);\n      board.writePort('P2', 0x00);\n      board.writePort('P0', 0x00);\n      board.writePort('P2', 0x06);\n      board.writePort('P2', 0x00);\n    }\n  }\n}\n`,
  },
  {
    id: "lab4-keypad-led",
    title: "Lab4: Keypad scan → LED line",
    description:
      "P2=0x60/0x50/0x30 (як у прикладі), P3.6=0 (RX), читаємо P0.0..P0.3 (0=натиснуто).",
    code: `export async function main({ board }) {\n  const colAddrs = [0x60, 0x50, 0x30];\n  while (true) {\n    for (let col = 0; col < 3; col++) {\n      board.writePort('P2', colAddrs[col]);\n      board.writeBit('P3', 6, 0);\n      const p0 = board.readPort('P0');\n      const rows = (~p0) & 0x0f;\n\n      if (rows) {\n        let row = 0;\n        while (((rows >>> row) & 1) === 0) row++;\n\n        const ledIndex = col * 3 + row;\n        const mask = 1 << (ledIndex % 8);\n\n        board.writeBit('P3', 6, 1);\n        board.writePort('P0', (~mask) & 0xff);\n        board.writePort('P2', 0x07);\n        board.writePort('P2', 0x00);\n      }\n\n      await board.delay(60);\n    }\n  }\n}\n`,
  },
  {
    id: "lab5-lcd-hello",
    title: "Lab5: LCD (high-level placeholder)",
    description:
      "В PDF (text layer) не витяглось як саме LCD адресовано через CPLD, тому поки показуємо LCD як окремий пристрій.",
    code: `export async function main({ devices }) {\n  devices.lcd.clear();\n  devices.lcd.print(0, 0, 'TNTU ST841');\n  devices.lcd.print(1, 0, 'LCD OK');\n}\n`,
  },
  {
    id: "lab6-adc-joystick",
    title: "Lab6: ADC joystick (high-level)",
    description:
      "Поки high-level: читаємо X/Y і показуємо точку на матриці. Далі можна підʼєднати під ADCCON* регістри.",
    code: `export async function main({ devices }) {\n  while (true) {\n    const { x, y } = devices.adc.read();\n    const col = Math.min(4, Math.max(0, Math.round((x / 1023) * 4)));\n    const row = Math.min(6, Math.max(0, Math.round((y / 1023) * 6)));\n    devices.matrix.setPoint(row, col, true);\n    await new Promise((r) => setTimeout(r, 40));\n  }\n}\n`,
  },
];

