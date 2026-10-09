import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { parseByteInput } from "../web/ui/memoryTable.js";

const examples = [
  ["0x80", 0x80],
  ["80h", 0x80],
  ["#128", 0x80],
  ["128", 0x80],
  ["0b10000000", 0x80],
  ["10000000b", 0x80],
  ["ff", 0xff],
  ["0", 0],
];
for (const [input, expected] of examples) assert.equal(parseByteInput(input), expected, input);
for (const input of ["", "#0x80", "0x100", "256", "-1", "0b102", "12hzz"]) {
  assert.equal(parseByteInput(input), null, input);
}

const wasmPath = fileURLToPath(new URL("../public/emu8051.wasm", import.meta.url));
const wasi = new WASI([], [], [
  new OpenFile(new File([])),
  new OpenFile(new File([])),
  new OpenFile(new File([])),
  new PreopenDirectory("/", new Map()),
]);
const module = await WebAssembly.compile(readFileSync(wasmPath));
const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
wasi.initialize(instance);
const emu = instance.exports;
const cpuPtr = emu.emu_create(64 * 1024, 64 * 1024);
assert.ok(cpuPtr, "emulator allocation");
try {
  const memory = new Uint8Array(emu.memory.buffer);
  for (const addr of [0x00, 0x07, 0x20, 0x2f, 0x30, 0x7f]) {
    memory[cpuPtr + 14 + addr] = (addr ^ 0xa5) & 0xff;
    assert.equal(emu.emu_read_iram(cpuPtr, addr), (addr ^ 0xa5) & 0xff, `IRAM 0x${addr.toString(16)}`);
  }
  emu.emu_set_sfr(cpuPtr, 0x81, 0x2f);
  assert.equal(emu.emu_get_sfr(cpuPtr, 0x81), 0x2f, "SP should be directly editable");
} finally {
  emu.emu_destroy(cpuPtr);
}

console.log(`Memory input and WASM layout tests passed (${examples.length + 7 + 8} assertions)`);
