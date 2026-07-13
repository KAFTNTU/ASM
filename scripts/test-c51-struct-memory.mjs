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

const layout = expectSuccessfulProgram("packed nested structure layout", `
struct Inner {
  uint8_t code;
  int16_t reading;
};
struct Layout {
  unsigned char status;
  signed char delta;
  unsigned int value;
  signed int signedValue;
  uint8_t bytes[3];
  uint16_t words[2];
  struct Inner inner;
  struct Inner items[2];
};
void main(void) {
  struct Layout layout;
  unsigned int total = sizeof(struct Layout);
  unsigned int memberArray = sizeof(layout.words);
  P0 = total;
  P1 = memberArray;
}
`).transpiled;
assert.match(layout.asm, /mov a,#0x16/i, "struct Layout must have packed size 22 bytes");
assert.match(layout.asm, /mov a,#0x4/i, "sizeof a two-element uint16_t member array must be 4");

const xdataOnly = expectSuccessfulProgram("XDATA structure MOVX lowering", `
struct Sample { unsigned char status; unsigned int value; };
struct Sample xdata sample = { 1, 0x1234 };
struct Sample xdata samples[2] = { { 2, 0x3344 }, { 3, 0x5566 } };
void main(void) {
  unsigned char index = 1;
  unsigned int value;
  struct Sample xdata *pointer = &samples[index];
  sample.status = 4;
  sample.value = 0x7788;
  samples[index].status = 5;
  samples[index].value = sample.value;
  value = pointer->value;
  pointer[0].value = value;
}
`).transpiled;
assert.match(xdataOnly.asm, /movx a,@dptr/i, "XDATA structure reads must use MOVX through DPTR");
assert.match(xdataOnly.asm, /movx @dptr,a/i, "XDATA structure writes must use MOVX through DPTR");
assert.doesNotMatch(xdataOnly.asm, /movx\s+(?:a,)?@r[01]|movx\s+@r[01],a/i, "XDATA structures must never be lowered through MOVX @R0/@R1");
assert.match(xdataOnly.asm, /mov a,#0x34\nmovx @dptr,a\ninc dptr\nmov a,#0x12\nmovx @dptr,a/i, "16-bit XDATA fields must initialize low byte before high byte");

const runtimeSource = `
struct Inner { uint8_t code; int16_t reading; };
struct Packet {
  signed char flag;
  uint16_t values[2];
  struct Inner inner;
  struct Inner items[2];
};
struct Packet ramPackets[2];
struct Packet xdata xPackets[2] = {
  { 1, { 0x1122, 0x3344 }, { 5, 0x5566 }, { { 6, 0x6677 }, { 7, 0x7788 } } },
  { 2, { 0x99AA, 0xBBCC }, { 8, 0x8899 }, { { 9, 0xAABB }, { 10, 0xCCDD } } }
};
void touch(struct Packet xdata *pointer) {
  pointer->values[1] = 0x1234;
  pointer->inner.reading = pointer->values[1];
}
void main(void) {
  unsigned char index = 1;
  unsigned int value;
  struct Packet *ramPointer = &ramPackets[0];
  struct Packet xdata *xPointer = &xPackets[index];
  unsigned int xdata *fieldPointer = &xPackets[index].values[0];

  ramPackets[index].flag = 0x21;
  ramPackets[index].values[0] = 0x1357;
  value = ramPackets[index].values[0];
  ramPointer[1].inner.code = 0x31;

  xPointer->flag = 3;
  *fieldPointer = value;
  xPointer->values[index] = value;
  value = xPointer->values[index];
  xPointer[0].items[index].reading = 0x2468;
  xPointer++;
  xPointer--;
  xPointer = xPointer + 1;
  xPointer = xPointer - 1;
  touch(&xPackets[0]);

  P0 = ramPackets[index].flag;
  P1 = ramPointer[1].inner.code;
  P2 = sizeof(xPackets);
  P3 = sizeof(*xPointer);
  while (1) { }
}
`;
const runtime = expectSuccessfulProgram("RAM/XDATA structure runtime", runtimeSource);
await runRuntime(runtime.assembled.hex, {
  ports: new Map([[0x80, 0x21], [0x90, 0x31], [0xA0, 28], [0xB0, 14]]),
  xram: new Map([
    // xPackets[0]: values[1] and inner.reading changed by touch().
    [0x0000, 0x01],
    [0x0001, 0x22], [0x0002, 0x11],
    [0x0003, 0x34], [0x0004, 0x12],
    [0x0005, 0x05],
    [0x0006, 0x34], [0x0007, 0x12],
    // xPackets[1]: flag, values[0], values[1], items[1].reading.
    [0x000E, 0x03],
    [0x000F, 0x57], [0x0010, 0x13],
    [0x0011, 0x57], [0x0012, 0x13],
    [0x001A, 0x68], [0x001B, 0x24],
  ]),
});

const sizeAndAddress = expectSuccessfulProgram("sizeof and structure member addresses", `
struct Sample { unsigned char status; unsigned int value; unsigned char payload[4]; };
struct Sample xdata objects[3];
void set_word(unsigned int xdata *pointer) { *pointer = 0xABCD; }
void main(void) {
  unsigned char index = 2;
  struct Sample xdata *pointer = &objects[index];
  unsigned char arraySize = sizeof(objects);
  unsigned char elementSize = sizeof(objects[0]);
  unsigned char pointerSize = sizeof(*pointer);
  unsigned char payloadSize = sizeof(objects[0].payload);
  set_word(&objects[index].value);
  P0 = arraySize;
  P1 = elementSize;
  P2 = pointerSize;
  P3 = payloadSize;
  while (1) { }
}
`);
await runRuntime(sizeAndAddress.assembled.hex, {
  ports: new Map([[0x80, 21], [0x90, 7], [0xA0, 7], [0xB0, 4]]),
  xram: new Map([[0x000F, 0xCD], [0x0010, 0xAB]]),
});

for (const [name, source, pattern] of [
  ["IRAM structure overflow", `struct Big { unsigned char bytes[81]; }; struct Big object; void main(void) { }`, /exceeds internal RAM|Out of local variable storage/i],
  ["XDATA structure overflow", `struct Big { unsigned char bytes[1025]; }; struct Big xdata objects[2]; void main(void) { }`, /exceeds ADuC841 XDATA/i],
  ["unknown field", `struct Sample { unsigned char value; }; void main(void) { struct Sample sample; sample.missing = 1; }`, /has no field named missing/i],
  ["const structure pointer write", `struct Sample { unsigned char value; }; struct Sample xdata sample; void main(void) { const struct Sample xdata *pointer = &sample; pointer->value = 1; }`, /const\/code structure object or pointer/i],
  ["code structure pointer write", `struct Sample { unsigned char value; }; void main(void) { struct Sample code *pointer = 0x100; pointer->value = 1; }`, /const\/code structure object or pointer/i],
  ["union unsupported", `union Value { unsigned char byte; unsigned int word; }; void main(void) { union Value value; }`, /union is not implemented/i],
  ["far structure object", `struct Sample { unsigned char value; }; struct Sample far sample; void main(void) { }`, /far object storage is not implemented/i],
  ["pdata structure object", `struct Sample { unsigned char value; }; struct Sample pdata sample; void main(void) { }`, /pdata object storage is not implemented/i],
  ["nonconstant aggregate", `unsigned char source; struct Sample { unsigned char value; }; struct Sample xdata sample = { source }; void main(void) { }`, /constant integer expressions/i],
  ["scalar aggregate without braces", `struct Sample { unsigned char value; }; struct Sample xdata sample = 1; void main(void) { }`, /must be enclosed in braces/i],
  ["designated aggregate", `struct Sample { unsigned char value; }; struct Sample xdata sample = { .value = 1 }; void main(void) { }`, /designated initializers are not implemented/i],
]) {
  const result = transpileCToAsm(source);
  assert.equal(result.ok, false, `${name} must fail`);
  assert.ok(errors(result).some((item) => pattern.test(item.message)), `${name}: missing diagnostic ${pattern}\n${errors(result).map((item) => item.message).join("\n")}`);
}

console.log("C51 RAM/XDATA structure tests passed (4 positive programs, 2 WASM runtime checks, 11 negative groups)");

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
    for (let tick = 0; tick < 120_000; tick++) {
      emu.emu_tick(cpu);
      matched = [...expected.ports].every(([address, value]) => (emu.emu_get_sfr(cpu, address) & 0xff) === value);
      if (matched) break;
    }
    assert.ok(matched, `runtime did not reach expected port values: ${[...expected.ports].map(([address, value]) => `0x${address.toString(16)}=0x${value.toString(16)}`).join(", ")}`);
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
