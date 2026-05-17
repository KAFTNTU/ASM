import { WASI, File, OpenFile, PreopenDirectory } from "https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/+esm";
export class Emu8051Wasm {
    constructor(exports, cpuPtr) {
        Object.defineProperty(this, "exports", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: exports
        });
        Object.defineProperty(this, "cpuPtr", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: cpuPtr
        });
    }
    static async create(params = {}) {
        const codeSize = params.codeSize ?? 64 * 1024;
        const xdataSize = params.xdataSize ?? 64 * 1024;
        // WASI is used only because the toolchain target is wasip1. We don't need real FS/stdio.
        const wasi = new WASI([], [], [
            new OpenFile(new File([])), // stdin
            new OpenFile(new File([])), // stdout
            new OpenFile(new File([])), // stderr
            new PreopenDirectory("/", new Map()),
        ]);
        const wasmUrl = new URL("../../public/emu8051.wasm", import.meta.url).href;
        const resp = await fetch(wasmUrl);
        if (!resp.ok)
            throw new Error(`Failed to fetch ${wasmUrl}: ${resp.status}`);
        const wasmBytes = await resp.arrayBuffer();
        const module = await WebAssembly.compile(wasmBytes);
        const instance = (await WebAssembly.instantiate(module, {
            wasi_snapshot_preview1: wasi.wasiImport,
        }));
        wasi.initialize(instance);
        const cpuPtr = instance.exports.emu_create(codeSize, xdataSize);
        if (!cpuPtr)
            throw new Error("emu_create failed");
        return new Emu8051Wasm(instance.exports, cpuPtr);
    }
    destroy() {
        this.exports.emu_destroy(this.cpuPtr);
        this.cpuPtr = 0;
    }
    reset(wipe = true) {
        this.exports.emu_reset(this.cpuPtr, wipe ? 1 : 0);
    }
    tick() {
        return this.exports.emu_tick(this.cpuPtr) !== 0;
    }
    getPC() {
        return this.exports.emu_get_pc(this.cpuPtr) & 0xffff;
    }
    getSfr(addr) {
        return this.exports.emu_get_sfr(this.cpuPtr, addr & 0xff) & 0xff;
    }
    setSfr(addr, value) {
        this.exports.emu_set_sfr(this.cpuPtr, addr & 0xff, value & 0xff);
    }
    writeCode(addr, value) {
        this.exports.emu_write_code(this.cpuPtr, addr & 0xffff, value & 0xff);
    }
    readCode(addr) {
        return this.exports.emu_read_code(this.cpuPtr, addr & 0xffff) & 0xff;
    }
    readIram(addr) {
        return this.exports.emu_read_iram(this.cpuPtr, addr & 0xff) & 0xff;
    }
    readXram(addr) {
        return this.exports.emu_read_xram(this.cpuPtr, addr & 0xffff) & 0xff;
    }
}
export function parseIntelHex(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const bytes = [];
    let upperBase = 0;
    for (const line of lines) {
        if (!line.startsWith(":"))
            continue;
        const len = parseInt(line.slice(1, 3), 16);
        const addr = parseInt(line.slice(3, 7), 16);
        const type = parseInt(line.slice(7, 9), 16);
        if (type === 1)
            break;
        if (type === 4) {
            upperBase = parseInt(line.slice(9, 13), 16) << 16;
            continue;
        }
        if (type !== 0)
            continue;
        for (let i = 0; i < len; i++) {
            const b = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
            bytes.push({ addr: (upperBase + addr + i) & 0xffff, value: b & 0xff });
        }
    }
    return bytes;
}
