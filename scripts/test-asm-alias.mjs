import { compileAsm } from "../web/ui/asmCompiler.js";

const source = `DAT EQU R0
ADR EQU R1
MOV DAT,#0xA1
MOV ADR,#0x08
MOV P0,DAT
MOV P2,ADR
`;

const result = compileAsm(source);
const errors = result.diagnostics.filter((item) => item.level === "error");
if (errors.length) {
  throw new Error(`Unexpected compiler errors: ${errors.map((item) => item.message).join(" | ")}`);
}

const mem = new Map();
for (let index = 0; index < result.bytes.length; index += 2) {
  mem.set(result.bytes[index], result.bytes[index + 1]);
}

const expected = [0x78, 0xa1, 0x79, 0x08, 0x88, 0x80, 0x89, 0xa0];
for (let pc = 0; pc < expected.length; pc += 1) {
  const actual = mem.get(pc);
  if (actual !== expected[pc]) {
    throw new Error(
      `Byte mismatch at 0x${pc.toString(16).padStart(2, "0")}: expected 0x${expected[pc]
        .toString(16)
        .padStart(2, "0")}, got 0x${(actual ?? -1).toString(16)}`,
    );
  }
}

console.log("ASM alias test passed");
