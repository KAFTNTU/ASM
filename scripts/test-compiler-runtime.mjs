import assert from "node:assert/strict";
import fs from "node:fs";
import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { compileAsm } from "../web/ui/asmCompiler.js";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";

const wasmBytes = fs.readFileSync(new URL("../public/emu8051.wasm", import.meta.url));

await expectProgram(
  `
STORE MACRO port,value
    MOV port,#value
ENDM
IF 1
    ORG 0
    STORE P1,0A5H
ELSE
    THIS_MUST_NOT_BE_PARSED
ENDIF
forever: SJMP forever
END
`,
  0x90,
  0xa5,
  "ASM macro/conditional program",
);

const cSource = `
typedef unsigned int WORD;
#define EXPECTED 0x1335
void main(void) {
  WORD value = 0x1234;
  for (WORD i = 0, marker = 0x0100; i < 1; i++) {
    value += 1;
    value += marker;
    marker = 0;
  }
  switch (value) {
    case 0x0035:
      P0 = 0x11;
      break;
    case EXPECTED:
      P0 = 0x5A;
      break;
    default:
      P0 = 0;
  }
  while (1) { }
}
`;
const translated = transpileCToAsm(cSource);
assert.deepEqual(
  translated.diagnostics.filter((item) => item.level === "error"),
  [],
  translated.diagnostics.map((item) => item.message).join("\n"),
);
await expectProgram(translated.asm, 0x80, 0x5a, "C51 typedef/for/16-bit switch program");

await expectProgram(
  cAsm(`void main(void) {
     unsigned int product = 300 * 2;
     unsigned int quotient = 0x1234 / 2;
     unsigned int remainder = 1000 % 300;
     P0 = product;
     P1 = product >> 8;
     P2 = quotient;
     while (1) { }
   }`, "C51 word multiply/divide runtime program"),
  { 0x80: 0x58, 0x90: 0x02, 0xa0: 0x1a },
  "C51 word multiply/divide runtime program",
);

await expectProgram(
  cAsm(`void main(void) {
     signed char dividend = -7;
     signed char divisor = 3;
     P0 = dividend / divisor;
     P1 = dividend % divisor;
     while (1) { }
   }`, "C51 signed byte division runtime program"),
  { 0x80: 0xfe, 0x90: 0xff },
  "C51 signed byte division runtime program",
);

await expectProgram(
  cAsm(`void main(void) {
     unsigned long value = 0x12345678UL;
     P0 = (unsigned char)value;
     P1 = (unsigned char)(value >> 8);
     P2 = (unsigned char)(value >> 16);
     while (1) { }
   }`, "C51 narrowing long cast runtime program"),
  { 0x80: 0x78, 0x90: 0x56, 0xa0: 0x34 },
  "C51 narrowing long cast runtime program",
);

await expectProgram(
  cAsm(`void main(void) {
     unsigned int value = 0;
     unsigned int old = value--;
     P0 = value;
     P1 = old;
     P2 = value >> 8;
     while (1) { }
   }`, "C51 word post-decrement runtime program"),
  { 0x80: 0xff, 0x90: 0x00, 0xa0: 0xff },
  "C51 word post-decrement runtime program",
);

await expectProgram(
  cAsm(`void main(void) {
     unsigned int value = 0x0100;
     P0 = (value && value > 0xff) ? 0xa5 : 0;
     while (1) { }
   }`, "C51 word truthiness runtime program"),
  0x80,
  0xa5,
  "C51 word truthiness runtime program",
);

await expectProgram(
  cAsm(`void main(void) {
     long left = -1L;
     long right = 1L;
     P0 = (left < right && right > left) ? 0x5a : 0;
     while (1) { }
   }`, "C51 long comparison/ternary runtime program"),
  0x80,
  0x5a,
  "C51 long comparison/ternary runtime program",
);

console.log("Compiler runtime tests passed in public/emu8051.wasm");

async function expectProgram(source, sfrAddress, expected, name) {
  const checks = typeof sfrAddress === "object"
    ? Object.fromEntries(Object.entries(sfrAddress).map(([address, value]) => [Number(address), value]))
    : { [sfrAddress]: expected };
  if (typeof sfrAddress === "object") name = expected;
  const compiled = compileAsm(source);
  assert.deepEqual(
    compiled.diagnostics.filter((item) => item.level === "error"),
    [],
    `${name}: ${compiled.diagnostics.map((item) => item.message).join("\n")}`,
  );

  const wasi = new WASI([], [], [
    new OpenFile(new File([])),
    new OpenFile(new File([])),
    new OpenFile(new File([])),
    new PreopenDirectory("/", new Map()),
  ]);
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  wasi.initialize(instance);
  const emu = instance.exports;
  const cpu = emu.emu_create(64 * 1024, 64 * 1024);
  assert.ok(cpu, `${name}: emu_create failed`);
  try {
    emu.emu_reset(cpu, 1);
    for (const { address, value } of parseIntelHex(compiled.hex)) {
      emu.emu_write_code(cpu, address, value);
      assert.equal(emu.emu_read_code(cpu, address), value, `${name}: ROM write failed at 0x${address.toString(16)}`);
    }
    emu.emu_reset(cpu, 0);
    let matched = false;
    for (let tick = 0; tick < 20_000; tick++) {
      // A zero result is a normal wait-state cycle, not an emulator failure.
      emu.emu_tick(cpu);
      if (Object.entries(checks).every(([address, value]) => (emu.emu_get_sfr(cpu, Number(address)) & 0xff) === value)) {
        matched = true;
        break;
      }
    }
    const actual = Object.fromEntries(Object.keys(checks).map((address) => [address, emu.emu_get_sfr(cpu, Number(address)) & 0xff]));
    const pc = emu.emu_get_pc(cpu) & 0xffff;
    assert.ok(
      matched,
      `${name}: SFR values ${JSON.stringify(actual)} do not match ${JSON.stringify(checks)} (PC=0x${pc.toString(16)})`,
    );
  } finally {
    emu.emu_destroy(cpu);
  }
}

function cAsm(source, name) {
  const translated = transpileCToAsm(source);
  const errors = translated.diagnostics.filter((item) => item.level === "error");
  assert.deepEqual(errors, [], `${name}: C errors\n${errors.map((item) => `${item.line ?? ""}: ${item.message}`).join("\n")}`);
  return translated.asm;
}

function parseIntelHex(text) {
  const result = [];
  let upper = 0;
  let sawData = false;
  let sawEof = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    assert.match(line, /^:(?:[0-9a-fA-F]{2})+$/, `Malformed Intel HEX record: ${line}`);
    const record = [];
    for (let offset = 1; offset < line.length; offset += 2) {
      record.push(Number.parseInt(line.slice(offset, offset + 2), 16));
    }
    const length = record[0];
    assert.equal(record.length, length + 5, `Wrong Intel HEX length: ${line}`);
    assert.equal(record.reduce((sum, byte) => sum + byte, 0) & 0xff, 0, `Wrong Intel HEX checksum: ${line}`);
    const address = (record[1] << 8) | record[2];
    const type = record[3];
    if (type === 1) {
      assert.equal(length, 0, "Intel HEX EOF must have an empty payload");
      sawEof = true;
      break;
    }
    if (type === 4) {
      assert.equal(length, 2, "Intel HEX type-04 record must contain two bytes");
      upper = ((record[4] << 8) | record[5]) << 16;
      assert.equal(upper, 0, "8051 code above 64 KiB is not supported");
      continue;
    }
    assert.equal(type, 0, `Unsupported Intel HEX record type ${type}`);
    sawData = true;
    for (let index = 0; index < length; index++) {
      result.push({
        address: upper + address + index,
        value: record[4 + index],
      });
    }
  }
  assert.ok(sawData, "Intel HEX contains no data records");
  assert.ok(sawEof, "Intel HEX contains no EOF record");
  return result;
}
