// Regression guards for the bugs fixed in this pass. Each block fails if the
// original defect ever comes back.

import assert from "node:assert/strict";
import { compileAsm } from "../web/ui/asmCompiler.js";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";

let checks = 0;
const errorsOf = (result) => (result.diagnostics ?? []).filter((entry) => entry.level === "error");

function expectError(result, pattern, label) {
  const messages = errorsOf(result).map((entry) => entry.message);
  assert.ok(
    messages.some((message) => pattern.test(message)),
    `${label}: expected an error matching ${pattern}, got ${JSON.stringify(messages)}`,
  );
  checks += 1;
}

function expectClean(result, label) {
  assert.deepEqual(errorsOf(result).map((entry) => entry.message), [], `${label} must compile cleanly`);
  checks += 1;
}

const W = "while (1) { }";
const c = (body) => transpileCToAsm(`void main(void) { ${body} ${W} }`);

// --- ASM: immediate operands were silently truncated ------------------------
expectError(compileAsm("MOV A,#300\nEND"), /8-bit immediate is outside/i, "MOV A,#300");
expectError(compileAsm("MOV A,#-129\nEND"), /8-bit immediate is outside/i, "MOV A,#-129");
expectError(compileAsm("MOV DPTR,#70000\nEND"), /16-bit immediate is outside/i, "MOV DPTR,#70000");
for (const source of ["MOV A,#255\nEND", "MOV A,#-128\nEND", "MOV A,#0FFh\nEND", "MOV DPTR,#0FFFFh\nEND"]) {
  expectClean(compileAsm(source), `in-range immediate: ${source.split("\n")[0]}`);
}

// --- ASM: a second ORG could silently overwrite emitted code ----------------
expectError(
  compileAsm("ORG 10h\nMOV A,#1\nORG 10h\nMOV A,#2\nEND"),
  /code overlap at address 0x0010/i,
  "overlapping ORG",
);
expectClean(compileAsm("ORG 10h\nMOV A,#1\nORG 20h\nMOV A,#2\nEND"), "non-overlapping ORG");

// --- ASM: hex literals starting with B (regression from an earlier fix) -----
{
  const result = compileAsm("MOV A,#0B1h\nEND");
  expectClean(result, "0B1h literal");
  // `bytes` is an address/value pair list, so read the operand out of the HEX.
  assert.match(result.hex, /^:0200000074B1/m, "0B1h must assemble as hex 0xB1, not binary 1");
  checks += 1;
}

// --- C51: plain `int` must be signed ----------------------------------------
{
  const result = c("int a = -10; int b = 3; P1 = (unsigned char)(a / b);");
  expectClean(result, "signed int division");
  assert.match(result.asm, /lcall __divmod16/, "signed division must use the 16-bit helper");
  assert.match(result.asm, /lcall __neg16m/, "signed division must apply sign correction");
  checks += 2;
}

// --- C51: 16-bit multiply/divide must not use the 8-bit MUL AB / DIV AB -----
for (const [label, body] of [
  ["16-bit multiply", "unsigned int a = 1000, b = 3; P1 = (unsigned char)(a * b);"],
  ["16-bit divide", "unsigned int a = 1000, b = 3; P1 = (unsigned char)(a / b);"],
  ["16-bit modulo", "unsigned int a = 1000, b = 7; P1 = (unsigned char)(a % b);"],
]) {
  const result = c(body);
  expectClean(result, label);
  assert.match(result.asm, /lcall __(?:mul16|divmod16)/, `${label} must call a 16-bit helper`);
  checks += 1;
}

// --- C51: the stack pointer must be moved off its reset value of 0x07 -------
{
  const result = c("unsigned char a = 1; P1 = a;");
  const match = /mov sp,#(0x[0-9a-f]+)/i.exec(result.asm);
  assert.ok(match, "startup code must initialise SP");
  const stackPointer = Number.parseInt(match[1], 16);
  assert.ok(stackPointer >= 0x2f, `SP must clear the register banks and variables, got 0x${stackPointer.toString(16)}`);
  checks += 2;
}

// --- C51: recursion and main/ISR sharing corrupt fixed-address locals -------
expectError(
  transpileCToAsm("int f(int n) { if (n == 0) return 0; return f(n - 1); } void main(void) { f(3); while (1) { } }"),
  /recursive function/i,
  "direct recursion",
);
expectError(
  transpileCToAsm("void g(void); void f(void) { g(); } void g(void) { f(); } void main(void) { f(); while (1) { } }"),
  /mutual recursion/i,
  "mutual recursion",
);
expectError(
  transpileCToAsm(
    "unsigned char g(unsigned char x) { return x + 1; }" +
    "void t0(void) interrupt 1 { P2 = g(1); }" +
    "void main(void) { EA = 1; while (1) { P1 = g(2); } }",
  ),
  /not reentrant/i,
  "function shared between main and an ISR",
);
expectClean(
  transpileCToAsm(
    "unsigned char g(unsigned char x) { return x + 1; }" +
    "void t0(void) interrupt 1 { P2 = 1; }" +
    "void main(void) { EA = 1; while (1) { P1 = g(2); } }",
  ),
  "ISR that shares no function",
);
expectClean(
  transpileCToAsm("unsigned char g(unsigned char x) { return x + 1; } void main(void) { P1 = g(2); while (1) { } }"),
  "plain non-recursive call",
);

// --- C51: constant array indices outside the declared bounds ----------------
expectError(c("unsigned char a[3]; a[5] = 1;"), /out of bounds for a\[3\]/i, "constant OOB write");
expectError(c("unsigned char a[3], v; v = a[7]; P1 = v;"), /out of bounds/i, "constant OOB read");
expectError(c("unsigned char a[3]; a[-1] = 1;"), /index -1 is out of bounds/i, "negative constant index");
expectError(c("unsigned char xdata a[4]; a[9] = 1;"), /out of bounds for a\[4\]/i, "xdata OOB");
expectClean(c("unsigned char a[3]; a[2] = 1; P1 = a[0];"), "in-bounds constant index");
expectClean(c("unsigned char a[3], i = 1; a[i] = 1;"), "runtime index stays unchecked");

// --- C51: statements that used to be rejected outright ----------------------
expectClean(transpileCToAsm(`void main(void) { ; ${W} }`), "null statement");
expectClean(c("unsigned char a = 1; { a = 2; P1 = a; }"), "bare compound statement");
expectClean(c("unsigned char a = 1; { unsigned char b = 2; P1 = b; } P2 = a;"), "declaration inside a block");

console.log(`Bug-fix regression tests passed (${checks} assertions)`);
