import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sdccBin = resolve("C:/Program Files/SDCC/bin");
const assembler = join(sdccBin, "sdas8051.exe");
const compiler = join(sdccBin, "sdcc.exe");

const samples = [
  {
    source: join(projectRoot, "asm", "lab3_matrix_s.asm"),
    stem: join(projectRoot, "asm", "lab3_matrix_s"),
    output: join(projectRoot, "public", "samples", "lab3_matrix_s.hex"),
  },
  {
    source: join(projectRoot, "asm", "lab4_keypad_led.asm"),
    stem: join(projectRoot, "asm", "lab4_keypad_led"),
    output: join(projectRoot, "public", "samples", "lab4_keypad_led.hex"),
  },
];

const sourceCopies = [
  "lab1_minimal.asm",
  "lab2_static_1988.asm",
  "lab3_matrix_s.asm",
  "lab4_keypad_led.asm",
];

if (!existsSync(assembler) || !existsSync(compiler)) {
  throw new Error("SDCC tools were not found in C:\\Program Files\\SDCC\\bin");
}

for (const sample of samples) {
  const rel = `${sample.stem}.rel`;
  const ihx = `${sample.stem}.ihx`;

  run(assembler, ["-plosgff", sample.source], projectRoot);
  run(
    compiler,
    [
      "-mmcs51",
      "--nostdlib",
      "--code-loc",
      "0x0000",
      "--xram-loc",
      "0x0000",
      "--iram-size",
      "256",
      "-o",
      ihx,
      rel,
    ],
    projectRoot,
  );

  mkdirSync(dirname(sample.output), { recursive: true });
  copyFileSync(ihx, sample.output);
  console.log(`Built ${sample.output}`);
}

for (const filename of sourceCopies) {
  const sourcePath = join(projectRoot, "asm", filename);
  const outputPath = join(projectRoot, "public", "sources", filename);
  mkdirSync(dirname(outputPath), { recursive: true });
  copyFileSync(sourcePath, outputPath);
  console.log(`Copied ${outputPath}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
    );
  }
}
