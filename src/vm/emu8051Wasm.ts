import { WASI, File, OpenFile, PreopenDirectory } from "@bjorn3/browser_wasi_shim";

type Exports = {
  memory: WebAssembly.Memory;
  emu_create(codeSize: number, xdataSize: number): number;
  emu_destroy(cpuPtr: number): void;
  emu_reset(cpuPtr: number, wipe: number): void;
  emu_tick(cpuPtr: number): number;
  emu_get_pc(cpuPtr: number): number;
  emu_get_sfr(cpuPtr: number, sfrAddr: number): number;
  emu_set_sfr(cpuPtr: number, sfrAddr: number, value: number): void;
  emu_write_code(cpuPtr: number, addr: number, value: number): void;
  emu_read_code(cpuPtr: number, addr: number): number;
  emu_read_iram(cpuPtr: number, addr: number): number;
  emu_read_xram(cpuPtr: number, addr: number): number;
};

export class Emu8051Wasm {
  private constructor(
    private exports: Exports,
    private cpuPtr: number,
  ) {}

  static async create(params: { codeSize?: number; xdataSize?: number } = {}) {
    const codeSize = params.codeSize ?? 64 * 1024;
    const xdataSize = params.xdataSize ?? 64 * 1024;

    // WASI is used only because the toolchain target is wasip1. We don't need real FS/stdio.
    const wasi = new WASI([], [], [
      new OpenFile(new File([])), // stdin
      new OpenFile(new File([])), // stdout
      new OpenFile(new File([])), // stderr
      new PreopenDirectory("/", new Map()),
    ]);

    const wasmUrl = "/emu8051.wasm";
    const resp = await fetch(wasmUrl);
    if (!resp.ok) throw new Error(`Failed to fetch ${wasmUrl}: ${resp.status}`);
    const wasmBytes = await resp.arrayBuffer();

    const module = await WebAssembly.compile(wasmBytes);
    const instance = (await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: wasi.wasiImport,
    })) as WebAssembly.Instance & { exports: Exports };

    wasi.initialize(instance);

    const cpuPtr = instance.exports.emu_create(codeSize, xdataSize);
    if (!cpuPtr) throw new Error("emu_create failed");

    return new Emu8051Wasm(instance.exports, cpuPtr);
  }

  destroy(): void {
    this.exports.emu_destroy(this.cpuPtr);
    this.cpuPtr = 0;
  }

  reset(wipe = true): void {
    this.exports.emu_reset(this.cpuPtr, wipe ? 1 : 0);
  }

  tick(): boolean {
    return this.exports.emu_tick(this.cpuPtr) !== 0;
  }

  getPC(): number {
    return this.exports.emu_get_pc(this.cpuPtr) & 0xffff;
  }

  getSfr(addr: number): number {
    return this.exports.emu_get_sfr(this.cpuPtr, addr & 0xff) & 0xff;
  }

  setSfr(addr: number, value: number): void {
    this.exports.emu_set_sfr(this.cpuPtr, addr & 0xff, value & 0xff);
  }

  writeCode(addr: number, value: number): void {
    this.exports.emu_write_code(this.cpuPtr, addr & 0xffff, value & 0xff);
  }

  readCode(addr: number): number {
    return this.exports.emu_read_code(this.cpuPtr, addr & 0xffff) & 0xff;
  }

  readIram(addr: number): number {
    return this.exports.emu_read_iram(this.cpuPtr, addr & 0xff) & 0xff;
  }

  readXram(addr: number): number {
    return this.exports.emu_read_xram(this.cpuPtr, addr & 0xffff) & 0xff;
  }
}

export type IntelHexByte = {
  addr: number;
  value: number;
};

export function parseIntelHex(text: string): IntelHexByte[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bytes: IntelHexByte[] = [];
  let upperBase = 0;
  for (const line of lines) {
    if (!line.startsWith(":")) continue;
    const len = parseInt(line.slice(1, 3), 16);
    const addr = parseInt(line.slice(3, 7), 16);
    const type = parseInt(line.slice(7, 9), 16);
    if (type === 1) break;
    if (type === 4) {
      upperBase = parseInt(line.slice(9, 13), 16) << 16;
      continue;
    }
    if (type !== 0) continue;
    for (let i = 0; i < len; i++) {
      const b = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
      bytes.push({ addr: (upperBase + addr + i) & 0xffff, value: b & 0xff });
    }
  }
  return bytes;
}
