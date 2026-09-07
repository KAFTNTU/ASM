// Diagnostic-quality tests for the ASM compiler.
//
// A teaching simulator is judged as much by its error messages as by its code
// generation: "Cannot resolve operands for mov" tells a student nothing. These
// cases lock in messages that name the offending operand, suggest corrections
// for typos, and warn about interrupt mistakes that assemble cleanly but fail
// at run time.

import assert from "node:assert/strict";
import { compileAsm } from "../web/ui/asmCompiler.js";

let checks = 0;
const diagnosticsOf = (source, level) =>
  (compileAsm(source).diagnostics ?? []).filter((entry) => entry.level === level);

function expectMessage(source, level, pattern, label) {
  const messages = diagnosticsOf(source, level).map((entry) => entry.message);
  assert.ok(
    messages.some((message) => pattern.test(message)),
    `${label}: expected a ${level} matching ${pattern}, got ${JSON.stringify(messages)}`,
  );
  checks += 1;
}

function expectNo(source, level, label) {
  const messages = diagnosticsOf(source, level).map((entry) => entry.message);
  assert.deepEqual(messages, [], `${label} must produce no ${level}`);
  checks += 1;
}

// --- Unresolved operands name the symbol and suggest a fix ------------------
expectMessage("ORG 0\nSJMP NOWHERE\nEND", "error", /symbol "NOWHERE" is not defined/i, "undefined label");
expectMessage("START: NOP\nSJMP STRAT\nEND", "error", /did you mean START\?/i, "transposed label");
expectMessage("MOV A,ACCX\nEND", "error", /did you mean ACC\?/i, "typo in SFR name");
expectMessage("VAL EQU 7\nMOV A,#VLA\nEND", "error", /did you mean VAL\?/i, "transposed EQU name");
expectMessage("MOV A,#FOO+1\nEND", "error", /symbol "FOO" in "#FOO\+1" is not defined/i, "undefined name in expression");

// --- Register and bit operands get specific explanations --------------------
expectMessage("MOV R8,#1\nEND", "error", /only R0\.\.R7/i, "register out of range");
expectMessage("SETB P1.9\nEND", "error", /bit index must be 0\.\.7/i, "bit index out of range");
expectMessage("SETB P9.0\nEND", "error", /not a known SFR/i, "unknown bit base");

// --- Character literals -----------------------------------------------------
expectMessage("MOV A,#'AB'\nEND", "error", /must be exactly one/i, "multi-character literal");
expectMessage("MOV A,#''\nEND", "error", /empty character literal/i, "empty character literal");
expectNo("MOV A,#'A'\nEND", "error", "single character literal");

// --- A51 address-space symbol directives ------------------------------------
for (const [directive, source] of [
  ["DATA", "X DATA 30h\nMOV A,X\nEND"],
  ["IDATA", "Y IDATA 80h\nMOV R0,#Y\nEND"],
  ["XDATA", "Z XDATA 100h\nMOV DPTR,#Z\nEND"],
  ["CODE", "T CODE 200h\nLCALL T\nEND"],
  ["BIT", "MYB BIT P1.0\nSETB MYB\nEND"],
]) {
  expectNo(source, "error", `${directive} symbol directive`);
}
// Linker directives must still be rejected rather than parsed as definitions.
expectMessage("EXTRN CODE (external_symbol)\nNOP\nEND", "error", /./, "EXTRN stays unsupported");

// --- Interrupt handler returning with RET instead of RETI -------------------
expectMessage(
  "ORG 0Bh\nMOV A,#1\nRET\nEND",
  "warning",
  /Timer 0 vector .*use RETI/i,
  "RET inside an interrupt handler",
);
expectNo("ORG 0Bh\nMOV A,#1\nRETI\nEND", "warning", "handler that correctly uses RETI");
expectNo("ORG 0Bh\nLJMP H\nORG 100h\nH: RETI\nEND", "warning", "handler that jumps to its body");
expectNo("ORG 100h\nMOV A,#1\nRET\nEND", "warning", "ordinary subroutine using RET");

// --- Code running over the vector table -------------------------------------
expectMessage(
  "ORG 0\nDB 1,2,3,4,5,6,7,8,9,10,11,12\nEND",
  "warning",
  /extends over the External 0 \(INT0\) interrupt vector/i,
  "data overrunning a vector",
);
expectNo("ORG 0\nLJMP MAIN\nORG 100h\nMAIN: SJMP $\nEND", "warning", "standard reset jump");
expectNo("ORG 30h\nMOV A,#1\nSJMP $\nEND", "warning", "program starting past the vectors");
// A fragment without ORG has incidental addresses and must stay quiet.
expectNo("mov pwm0l,#1\nmov dac0l,#2", "warning", "snippet without ORG");

console.log(`ASM diagnostic tests passed (${checks} assertions)`);
