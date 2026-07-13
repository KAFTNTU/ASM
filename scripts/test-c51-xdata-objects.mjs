import assert from "node:assert/strict";
import fs from "node:fs";
import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";
import { compileAsm } from "../web/ui/asmCompiler.js";

function errors(result) {
  return result.diagnostics.filter((item) => item.level === "error");
}

function expectSuccessfulProgram(name, source) {
  const transpiled = transpileCToAsm(source);
  assert.deepEqual(
    errors(transpiled),
    [],
    `${name}: C errors\n${errors(transpiled).map((item) => `${item.line ?? ""}: ${item.message}`).join("\n")}\n\n${transpiled.asm}`,
  );
  const assembled = compileAsm(transpiled.asm);
  assert.deepEqual(
    errors(assembled),
    [],
    `${name}: ASM errors\n${errors(assembled).map((item) => `${item.line ?? ""}: ${item.message}`).join("\n")}\n\n${transpiled.asm}`,
  );
  return { transpiled, assembled };
}

const globals = expectSuccessfulProgram("global XDATA scalars and arrays", `
unsigned char ramValue = 0xA5;
unsigned char xdata byteValue = 0x5A;
unsigned int xdata wordValue = 0x1234;
unsigned char xdata bytes[3] = { 1, 2, 3 };
unsigned int xdata words[2] = { 0x1122, 0x3344 };
unsigned int xdata *globalPointer = &words[1];
void main(void) {
  ramValue = byteValue;
  wordValue = words[1];
  bytes[2] = ramValue;
  words[0] = wordValue;
}
`).transpiled;
assert.match(globals.asm, /mov dptr,#0x1\nmov a,#0x34\nmovx @dptr,a\ninc dptr\nmov a,#0x12\nmovx @dptr,a/i, "16-bit XDATA scalar initialization must be little-endian");
assert.match(globals.asm, /mov dptr,#0x[0-9a-f]+\nmovx a,@dptr\nmov b,a\ninc dptr\nmovx a,@dptr\nxch a,b/i, "16-bit XDATA loads must use two MOVX reads");
assert.match(globals.asm, /mov dptr,#0x[0-9a-f]+\nmovx @dptr,a\ninc dptr\nmov a,b\nmovx @dptr,a/i, "16-bit XDATA stores must write low then high byte");
assert.match(globals.asm, /mov 0x[0-9a-f]+,#0x[0-9a-f]+\nmov 0x[0-9a-f]+,#0x0/i, "an xdata pointer value must remain a 16-bit object in IRAM");

const localsAndPointers = expectSuccessfulProgram("local XDATA arrays, address-of and pointer parameters", `
void copy_word(unsigned int xdata *pointer) {
  unsigned int value;
  value = pointer[1];
  pointer[0] = value;
}
void main(void) {
  unsigned char index = 1;
  unsigned char xdata bytes[3] = { 4, 5, 6 };
  unsigned int xdata words[3] = { 0x1111, 0x2233, 0x4455 };
  unsigned int xdata localWord = 0x7788;
  unsigned char xdata *bytePointer = &bytes[1];
  unsigned int xdata *wordPointer;
  unsigned char current;
  wordPointer = &words[index];
  current = bytes[index];
  bytes[index] = *bytePointer;
  words[index + 1] = localWord;
  copy_word(&words[0]);
}
`).transpiled;
assert.match(localsAndPointers.asm, /add a,#0x[0-9a-f]+\nmov dpl,a\nclr a\naddc a,#0x[0-9a-f]+\nmov dph,a\nmovx a,@dptr/i, "dynamic XDATA array reads must form a 16-bit DPTR address");
assert.match(localsAndPointers.asm, /push acc\npush b[\s\S]*?movx @dptr,a\ninc dptr\nmov a,b\nmovx @dptr,a/i, "dynamic 16-bit XDATA array stores must preserve the little-endian value while calculating DPTR");

const runtimeSource = `
unsigned char xdata flag = 0x12;
unsigned int xdata words[3] = { 0x1122, 0x3344, 0x5566 };
void copy_word(unsigned int xdata *pointer) {
  pointer[0] = pointer[1];
}
void main(void) {
  unsigned int xdata localWord = 0x7788;
  unsigned char xdata bytes[2] = { 1, 2 };
  words[2] = localWord;
  copy_word(words);
  flag = bytes[1] + 1;
  P0 = flag;
  while (1) { }
}
`;
const runtime = expectSuccessfulProgram("XDATA runtime behavior", runtimeSource);
await runRuntime(runtime.assembled.hex, {
  sfrAddress: 0x80,
  sfrValue: 0x03,
  xram: new Map([
    [0x0000, 0x03],
    [0x0001, 0x44], [0x0002, 0x33],
    [0x0005, 0x88], [0x0006, 0x77],
    [0x0007, 0x88], [0x0008, 0x77],
    [0x0009, 0x01], [0x000A, 0x02],
  ]),
});

for (const [name, source, pattern] of [
  ["pdata object", `unsigned char pdata value; void main(void) { }`, /pdata object storage is not implemented/i],
  ["far object", `unsigned int far value; void main(void) { }`, /far object storage is not implemented/i],
  ["XDATA overflow", `unsigned char xdata huge[2049]; void main(void) { }`, /exceeds ADuC841 XDATA 0x0000\.\.0x07FF/i],
  ["nonconstant global XDATA initializer", `unsigned char source; unsigned char xdata value = source; void main(void) { }`, /Global initializer for value must be a constant expression/i],
  ["floating XDATA object", `float xdata value; void main(void) { }`, /Floating-point lowering is not implemented/i],
]) {
  const result = transpileCToAsm(source);
  assert.equal(result.ok, false, `${name} must fail`);
  assert.ok(errors(result).some((item) => pattern.test(item.message)), `${name}: missing diagnostic ${pattern}`);
}

console.log("C51 XDATA object tests passed (3 positive programs + runtime + 5 negative groups)");

async function runRuntime(hex, expected) {
  const wasmBytes = fs.readFileSync(new URL("../public/emu8051.wasm", import.meta.url));
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
  assert.ok(cpu, "emu_create failed");
  try {
    emu.emu_reset(cpu, 1);
    for (const { address, value } of parseIntelHex(hex)) emu.emu_write_code(cpu, address, value);
    emu.emu_reset(cpu, 0);
    let matched = false;
    for (let tick = 0; tick < 50_000; tick++) {
      emu.emu_tick(cpu);
      if ((emu.emu_get_sfr(cpu, expected.sfrAddress) & 0xff) === expected.sfrValue) {
        matched = true;
        break;
      }
    }
    assert.ok(matched, `runtime did not reach SFR value 0x${expected.sfrValue.toString(16)}`);
    for (const [address, value] of expected.xram) {
      assert.equal(emu.emu_read_xram(cpu, address) & 0xff, value, `wrong XRAM byte at 0x${address.toString(16).padStart(4, "0")}`);
    }
  } finally {
    emu.emu_destroy(cpu);
  }
}

function parseIntelHex(text) {
  const result = [];
  let upper = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const record = [];
    for (let offset = 1; offset < line.length; offset += 2) record.push(Number.parseInt(line.slice(offset, offset + 2), 16));
    const length = record[0];
    const address = (record[1] << 8) | record[2];
    const type = record[3];
    if (type === 1) break;
    if (type === 4) {
      upper = ((record[4] << 8) | record[5]) << 16;
      continue;
    }
    assert.equal(type, 0, `unsupported Intel HEX record type ${type}`);
    for (let index = 0; index < length; index++) result.push({ address: upper + address + index, value: record[4 + index] });
  }
  return result;
}
