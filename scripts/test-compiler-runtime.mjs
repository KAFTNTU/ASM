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

console.log("Compiler runtime tests passed in public/emu8051.wasm");

async function expectProgram(source, sfrAddress, expected, name) {
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
      if ((emu.emu_get_sfr(cpu, sfrAddress) & 0xff) === expected) {
        matched = true;
        break;
      }
    }
    const actual = emu.emu_get_sfr(cpu, sfrAddress) & 0xff;
    const pc = emu.emu_get_pc(cpu) & 0xffff;
    assert.ok(
      matched,
      `${name}: SFR 0x${sfrAddress.toString(16)} is 0x${actual.toString(16)}, expected 0x${expected.toString(16)} (PC=0x${pc.toString(16)})`,
    );
  } finally {
    emu.emu_destroy(cpu);
  }
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
