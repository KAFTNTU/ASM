// Runtime verification of the 16-bit multiply / divide / modulo helpers.
//
// The previous backend lowered every `*`, `/` and `%` to the 8-bit MUL AB and
// DIV AB instructions, which discarded the high byte of both operands and
// treated signed values as unsigned. These cases execute the generated code on
// the real emu8051 core and compare against the C semantics.

import assert from "node:assert/strict";
import fs from "node:fs";
import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { compileAsm } from "../web/ui/asmCompiler.js";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";

const wasmBytes = fs.readFileSync(new URL("../public/emu8051.wasm", import.meta.url));

// Each case computes `expr` and publishes the 16-bit result via P0 (low) and
// P1 (high), so we can verify both halves.
const cases = [
  { name: "unsigned 16-bit multiply", decl: "unsigned int a = 1000, b = 3;", expr: "a * b", expected: 3000 },
  { name: "unsigned multiply with carry into high byte", decl: "unsigned int a = 300, b = 4;", expr: "a * b", expected: 1200 },
  { name: "unsigned 16-bit divide", decl: "unsigned int a = 1000, b = 3;", expr: "a / b", expected: 333 },
  { name: "unsigned divide, large operands", decl: "unsigned int a = 60000, b = 7;", expr: "a / b", expected: Math.floor(60000 / 7) },
  { name: "unsigned 16-bit modulo", decl: "unsigned int a = 1000, b = 7;", expr: "a % b", expected: 1000 % 7 },
  { name: "divide by zero yields 0xFFFF", decl: "unsigned int a = 1234, b = 0;", expr: "a / b", expected: 0xffff },
  { name: "signed divide, negative dividend", decl: "int a = -10, b = 3;", expr: "a / b", expected: -3 },
  { name: "signed divide, negative divisor", decl: "int a = 10, b = -3;", expr: "a / b", expected: -3 },
  { name: "signed divide, both negative", decl: "int a = -10, b = -3;", expr: "a / b", expected: 3 },
  { name: "signed modulo takes dividend sign", decl: "int a = -10, b = 3;", expr: "a % b", expected: -1 },
  { name: "signed modulo, positive dividend", decl: "int a = 10, b = -3;", expr: "a % b", expected: 1 },
  { name: "signed multiply", decl: "int a = -300, b = 4;", expr: "a * b", expected: -1200 },
  { name: "large unsigned multiply wraps at 16 bits", decl: "unsigned int a = 1000, b = 100;", expr: "a * b", expected: 100000 & 0xffff },
  { name: "nested unsigned division", decl: "unsigned int a = 60000, b = 1000, c = 10;", expr: "a / (b / c)", expected: 600 },
  { name: "signed compound dividend", decl: "int a = -100, b = 10, c = 3;", expr: "(a + b) / c", expected: -30 },
  { name: "signed compound operands", decl: "int a = -100, b = 10, c = 3;", expr: "(a + b) / (c + 0)", expected: -30 },
  { name: "unsigned word dominates signed word", decl: "unsigned int a = 60000; int b = 3;", expr: "a / b", expected: 20000 },
  { name: "signed byte promotes before unsigned byte division", decl: "signed char a = -10; unsigned char b = 3;", expr: "a / b", expected: -3 },
  { name: "unsigned cast controls division", decl: "int a = -1, b = 3;", expr: "(unsigned int)a / b", expected: 21845 },
  { name: "signed return value division", prefix: "int negative(void) { return -100; }", decl: "int b = 3;", expr: "negative() / b", expected: -33 },
  { name: "signed compound narrow result", decl: "int a = -100, b = 10, c = 3;", expr: "(unsigned char)((a + b) / (c + 0))", expected: 226 },
  { name: "long backend remains available", decl: "unsigned long a = 100000UL, b = 10UL;", expr: "a / b", expected: 10000 },
];

for (const item of cases) {
  const source = `
${item.prefix ?? ""}
void main(void) {
  ${item.decl}
  unsigned int r = (unsigned int)(${item.expr});
  P0 = (unsigned char)(r & 0xFF);
  P1 = (unsigned char)(r >> 8);
  while (1) { }
}
`;
  const translated = transpileCToAsm(source);
  assert.deepEqual(
    translated.diagnostics.filter((entry) => entry.level === "error"),
    [],
    `${item.name}: ${translated.diagnostics.map((entry) => entry.message).join("\n")}`,
  );
  const want = item.expected & 0xffff;
  await expectPorts(translated.asm, want & 0xff, (want >> 8) & 0xff, item.name);
}

console.log(`16-bit arithmetic runtime tests passed (${cases.length} cases)`);

async function expectPorts(source, expectedP0, expectedP1, name) {
  const compiled = compileAsm(source);
  assert.deepEqual(
    compiled.diagnostics.filter((entry) => entry.level === "error"),
    [],
    `${name}: ${compiled.diagnostics.map((entry) => entry.message).join("\n")}`,
  );

  const wasi = new WASI([], [], [
    new OpenFile(new File([])),
    new OpenFile(new File([])),
    new OpenFile(new File([])),
    new PreopenDirectory("/", new Map()),
  ]);
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
  wasi.initialize(instance);
  const emu = instance.exports;
  const cpu = emu.emu_create(64 * 1024, 64 * 1024);
  assert.ok(cpu, `${name}: emu_create failed`);
  try {
    emu.emu_reset(cpu, 1);
    for (const { address, value } of parseIntelHex(compiled.hex)) emu.emu_write_code(cpu, address, value);
    emu.emu_reset(cpu, 0);
    // Run long enough for the shift-and-add helpers to finish, then sample.
    for (let tick = 0; tick < 400_000; tick++) emu.emu_tick(cpu);
    const p0 = emu.emu_get_sfr(cpu, 0x80) & 0xff;
    const p1 = emu.emu_get_sfr(cpu, 0x90) & 0xff;
    const got = (p1 << 8) | p0;
    const want = (expectedP1 << 8) | expectedP0;
    assert.equal(got, want, `${name}: got 0x${got.toString(16)}, expected 0x${want.toString(16)}`);
  } finally {
    emu.emu_destroy(cpu);
  }
}

function parseIntelHex(text) {
  const result = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const record = [];
    for (let offset = 1; offset < line.length; offset += 2) record.push(Number.parseInt(line.slice(offset, offset + 2), 16));
    const length = record[0];
    const address = (record[1] << 8) | record[2];
    if (record[3] === 1) break;
    if (record[3] !== 0) continue;
    for (let index = 0; index < length; index++) result.push({ address: address + index, value: record[4 + index] });
  }
  return result;
}
