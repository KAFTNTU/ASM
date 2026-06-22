import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcDir = join(root, "src");
const outDir = join(root, "web");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const files = walk(srcDir).filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

for (const file of files) {
  const rel = relative(srcDir, file);
  const outFile = join(outDir, rel.replace(/\.ts$/, ".js"));
  mkdirSync(dirname(outFile), { recursive: true });

  const source = readFileSync(file, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      removeComments: false,
    },
    fileName: file,
  }).outputText;

  const patched = patchJs(rel, transpiled);
  writeFileSync(outFile, patched, "utf8");
}

copyFileSync(join(srcDir, "style.css"), join(outDir, "style.css"));
if (existsSync(join(root, "public"))) {
  copyTree(join(root, "public"), join(outDir, "public"));
}

console.log(`Exported plain JS app to ${outDir}`);

function patchJs(relPath, code) {
  let patched = code.replace(
    /from\s+["'](\.\.?\/[^"']+)["']/g,
    (_match, specifier) => `from "${appendJsExtension(specifier)}"`,
  );

  if (relPath === join("vm", "emu8051Wasm.ts")) {
    patched = patched.replace(
      /from "@bjorn3\/browser_wasi_shim";/,
      'from "https://cdn.jsdelivr.net/npm/@bjorn3/browser_wasi_shim@0.4.2/+esm";',
    );
    patched = patched.replace(
      'const wasmUrl = "/emu8051.wasm";',
      'const wasmUrl = new URL("../../public/emu8051.wasm", import.meta.url).href;',
    );
  }

  if (relPath === join("ui", "cpuSamples.ts")) {
    patched = patched
      .replaceAll('"/samples/', '"./public/samples/')
      .replaceAll('"/sources/', '"./public/sources/');
  }

  if (relPath === join("ui", "motorPanel.ts")) {
    patched = patched
      .replace(
        /from "three";/,
        'from "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js";',
      )
      .replace(
        /from "three\/examples\/jsm\/loaders\/GLTFLoader\.js";/,
        'from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";',
      )
      .replace(
        /from "three\/examples\/jsm\/controls\/OrbitControls\.js";/,
        'from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";',
      )
      .replaceAll('"/models/28byj48.glb"', '"../public/models/28byj48.glb"');
  }

  if (relPath === "main.ts") {
    patched = patched.replace(/import\s+["']\.\/style\.css["'];?\s*/g, "");
  }

  return patched;
}

function appendJsExtension(specifier) {
  if (specifier.endsWith(".js") || specifier.endsWith(".css")) return specifier;
  return `${specifier}.js`;
}

function walk(dir) {
  const entries = [];
  for (const entry of readDirSafe(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(fullPath));
    } else {
      entries.push(fullPath);
    }
  }
  return entries;
}

function readDirSafe(dir) {
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
}

function copyTree(fromDir, toDir) {
  mkdirSync(toDir, { recursive: true });
  for (const entry of readDirSafe(fromDir)) {
    const fromPath = join(fromDir, entry.name);
    const toPath = join(toDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(fromPath, toPath);
      continue;
    }
    copyFileSync(fromPath, toPath);
  }
}
