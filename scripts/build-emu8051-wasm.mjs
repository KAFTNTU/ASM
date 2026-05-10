import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const clang = path.join(root, "tools", "wasi-sdk", "bin", "clang.exe");
const outDir = path.join(root, "public");
const outWasm = path.join(outDir, "emu8051.wasm");

const wrapper = path.join(root, "wasm", "emu8051_wrapper.c");
const core = path.join(root, "vendor", "emu8051", "core.c");
const opcodes = path.join(root, "vendor", "emu8051", "opcodes.c");
const disasm = path.join(root, "vendor", "emu8051", "disasm.c");

if (!existsSync(clang)) {
  console.error(`Missing wasi-sdk clang: ${clang}`);
  console.error(
    "Download wasi-sdk and place it at tools/wasi-sdk, then re-run this script.",
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const args = [
  wrapper,
  core,
  opcodes,
  disasm,
  "-O2",
  "--target=wasm32-unknown-wasip1",
  "-Wl,--no-entry",
  "-Wl,--strip-all",
  "-Wl,--export-memory",
  "-Wl,--export=emu_create",
  "-Wl,--export=emu_destroy",
  "-Wl,--export=emu_reset",
  "-Wl,--export=emu_tick",
  "-Wl,--export=emu_get_pc",
  "-Wl,--export=emu_get_sfr",
  "-Wl,--export=emu_set_sfr",
  "-Wl,--export=emu_write_code",
  "-Wl,--export=emu_read_code",
  "-o",
  outWasm,
];

const res = spawnSync(clang, args, { cwd: root, stdio: "inherit" });
if (res.status !== 0) process.exit(res.status ?? 1);

console.log(`OK: ${outWasm}`);
