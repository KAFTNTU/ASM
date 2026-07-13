import assert from "node:assert/strict";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";
import { compileAsm } from "../web/ui/asmCompiler.js";

function errors(result) {
  return result.diagnostics.filter((item) => item.level === "error");
}

function expectSuccessfulProgram(name, source) {
  const transpiled = transpileCToAsm(source);
  assert.deepEqual(
    errors(transpiled),
    [],
    `${name}: C errors\n${errors(transpiled).map((item) => `${item.line ?? ""}: ${item.message}`).join("\n")}\n\n${transpiled.asm}`,
  );
  const assembled = compileAsm(transpiled.asm);
  assert.deepEqual(
    errors(assembled),
    [],
    `${name}: ASM errors\n${errors(assembled).map((item) => `${item.line ?? ""}: ${item.message}`).join("\n")}\n\n${transpiled.asm}`,
  );
  return transpiled;
}

const typedefAndFor = expectSuccessfulProgram("typedef aliases and C99 for declaration", `
typedef unsigned char BYTE;
typedef BYTE U8;
typedef unsigned int WORD;
struct Pair { unsigned char lo; unsigned char hi; };
typedef struct Pair Pair;

WORD widen(BYTE value) {
  return (WORD)value;
}

void consume(Pair value) {
  P0 = value.lo;
}

void main(void) {
  Pair pair;
  U8 byteSize = sizeof(BYTE);
  U8 pairSize = sizeof(Pair);
  WORD wordSize = sizeof(WORD);
  WORD result = 0;
  pair.lo = 1;
  pair.hi = 2;
  for (WORD i = 0, j = 0x1234; i < 2; ++i, j += 2) {
    result = j;
  }
  result = widen((BYTE)result);
  consume(pair);
  P1 = byteSize + pairSize + wordSize;
}
`);
assert.match(
  typedefAndFor.asm,
  /mov 0x[0-9a-f]+,#0x34\nmov 0x[0-9a-f]+,#0x12/i,
  "the second declarator in a typed for initializer must retain its 16-bit width",
);
assert.ok(!typedefAndFor.asm.includes("struct struct"), "a typedef sharing its tag name must not rewrite the struct tag");

const orderedWideSwitch = expectSuccessfulProgram("ordered 16-bit switch", `
typedef unsigned int WORD;
void main(void) {
  WORD selector = 0x1234;
  switch ((WORD)selector) {
    case 0x1111:
      P0 = 1;
      break;
    default:
      P0 = 2;
    case 0x1234:
      P1 = 3;
      break;
  }
}
`);
assert.match(orderedWideSwitch.asm, /cjne a,#0x34/i, "wide switch must compare the low byte");
assert.match(orderedWideSwitch.asm, /cjne a,#0x12/i, "wide switch must compare the high byte");
const switchClauseOrder = Array.from(
  orderedWideSwitch.asm.matchAll(/^__(case|default)_\d+:$/gm),
  (match) => match[1],
);
assert.deepEqual(switchClauseOrder, ["case", "default", "case"], "switch labels must retain case/default source order");

function makeLargeSwitch(type, count, valueScale) {
  const cases = Array.from({ length: count }, (_, index) => `
    case ${index * valueScale}: P0 = ${index & 0xff}; break;`).join("");
  return `
void main(void) {
  ${type} selector = ${Math.max(0, count - 1) * valueScale};
  switch (selector) {${cases}
    default: P0 = 255;
  }
}`;
}

const largeByteSwitch = expectSuccessfulProgram("large byte switch", makeLargeSwitch("unsigned char", 20, 1));
const largeWideSwitch = expectSuccessfulProgram("large wide switch", makeLargeSwitch("unsigned int", 14, 0x101));
assert.match(largeByteSwitch.asm, /ljmp __case_/i, "large byte switch dispatch must use long jumps");
assert.match(largeWideSwitch.asm, /ljmp __case_/i, "large wide switch dispatch must use long jumps");

const forScope = expectSuccessfulProgram("C99 for initializer scope", `
void main(void) {
  unsigned char outer = 7;
  for (unsigned int outer = 0; outer < 1; ++outer) { }
  P1 = outer;
  for (unsigned int i = 0; i < 1; ++i) { }
  unsigned char i = 9;
  P0 = sizeof(i);
}
`);
const outerAddress = /mov (0x[0-9a-f]+),#0x7/i.exec(forScope.asm)?.[1];
assert.ok(outerAddress, "outer byte variable must be allocated");
assert.match(forScope.asm, new RegExp(`mov a,${outerAddress}\\nmov p1,a`, "i"), "for initializer must not overwrite its outer namesake");
assert.match(forScope.asm, /mov a,#0x1\nmov p0,a/i, "a post-loop byte declaration must not reuse a 16-bit loop binding");

const typedefNamespaces = expectSuccessfulProgram("typedef namespaces and local shadowing", `
typedef unsigned char BYTE;
struct Sample { unsigned char BYTE; BYTE other; };
void main(void) {
  struct Sample sample;
  unsigned int BYTE = 0x1234;
  sample.BYTE = 1;
  sample.other = 2;
  BYTE = BYTE + 1;
  goto BYTE;
BYTE:
  P0 = (unsigned char)BYTE;
  P1 = sample.BYTE + sample.other;
}
`);
assert.match(typedefNamespaces.asm, /__c_user_main_byte:/i, "a C label may share a spelling with a typedef/local identifier");
assert.ok(!typedefNamespaces.asm.includes("sample.unsigned"), "member names must never be rewritten as typedefs");

const preprocessor = expectSuccessfulProgram("quote-aware continued preprocessor", `
#define NAME 9
#define PACK(value, bit) \\
  ((value) | (1U << (bit)))
#if PACK(0, 2) == 4
#define START 4
#else
#define START 1
#endif
const unsigned char code text[] = "NAME http://host/path"; // NAME must stay in the literal
void main(void) {
  unsigned char value = PACK(START, 1);
  P0 = value;
}
`);
assert.match(preprocessor.asm, /mov 0x[0-9a-f]+,#0x6/i, "continued function macro and #if expansion must be evaluated");
assert.match(preprocessor.asm, /text:\ndb 0x4e, 0x41, 0x4d, 0x45, 0x20, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f/i, "macro names and // inside a string must remain literal text");

expectSuccessfulProgram("built-in headers and skipped conditions", `
#include <ADUC841.H>
#include <intrins.h>
#include <stdint.h>
#include "stdbool.h"
#define ONE(value) (value)
#if 1
#define SELECTED 3
#elif ONE(1, 2)
#define SELECTED 9
#endif
#if 0
  #if ONE(1, 2)
    #error inactive nested condition was evaluated
  #endif
#endif
void main(void) {
  uint8_t value = SELECTED;
  bool ready = true;
  P0 = value + ready;
}
`);

const splicedComment = expectSuccessfulProgram("line splicing before comments", [
  "void main(void) {",
  "  P0 = 1; // the next physical line is still this comment \\",
  "  P1 = 2;",
  "}",
].join("\n"));
assert.match(splicedComment.asm, /mov p0,#0x1/i);
assert.doesNotMatch(splicedComment.asm, /mov p1/i, "a backslash-continued // comment must consume the next physical line");

const missingHeader = transpileCToAsm(`#include "missing-user-header.h"\nvoid main(void) { P0 = 1; }`);
assert.equal(missingHeader.ok, false);
assert.ok(errors(missingHeader).some((item) => item.line === 1 && item.message.includes("is unavailable")));

const badMacroArity = transpileCToAsm(`#define ONE(value) (value)\n\n\nvoid main(void) { P0 = ONE(1, 2); }`);
const arityErrors = errors(badMacroArity).filter((item) => item.message.includes("Macro ONE expects 1 argument"));
assert.equal(arityErrors.length, 1, "wrong-arity macros must produce one primary diagnostic");
assert.equal(arityErrors[0].line, 4, "macro diagnostics must retain their physical source line");
assert.ok(!errors(badMacroArity).some((item) => item.message.includes("Unsupported C expression")));

const invalidSwitch = transpileCToAsm(`
void main(void) {
  unsigned char selector = 1;
  switch (selector) {
    case 1: P0 = 1; break;
    case 1 + 0: P0 = 2; break;
    default: P1 = 1;
    default: P1 = 2;
    case selector: P2 = 1;
  }
}
`);
assert.equal(invalidSwitch.ok, false);
assert.ok(errors(invalidSwitch).some((item) => item.message.includes("Duplicate switch case value")));
assert.ok(errors(invalidSwitch).some((item) => item.message.includes("Duplicate default")));
assert.ok(errors(invalidSwitch).some((item) => item.message.includes("integer constant expression")));

const conflictingTypedef = transpileCToAsm(`
typedef unsigned char Value;
typedef unsigned int Value;
void main(void) { }
`);
assert.ok(errors(conflictingTypedef).some((item) => item.message.includes("Conflicting typedef")));

const cyclicTypedef = transpileCToAsm(`
typedef Second First;
typedef First Second;
void main(void) { }
`);
assert.ok(errors(cyclicTypedef).some((item) => item.message.includes("Cyclic typedef chain")));

const unsupportedTypedef = transpileCToAsm(`
typedef struct { unsigned char value; } Anonymous;
void main(void) { }
`);
assert.ok(errors(unsupportedTypedef).some((item) => item.message.includes("Unsupported typedef form")));

const unsupportedArithmetic = transpileCToAsm(`
void main(void) {
  uint32_t wide = 1;
  float ratio = 1.0f;
  unsigned char value = 1.5;
  P0 = 1L;
}
`);
assert.equal(unsupportedArithmetic.ok, false);
assert.ok(errors(unsupportedArithmetic).some((item) => item.message.includes("32-bit integer lowering")));
assert.ok(errors(unsupportedArithmetic).some((item) => item.message.includes("Floating-point lowering")));
assert.ok(errors(unsupportedArithmetic).some((item) => item.message.includes("Floating-point literals")));
assert.ok(errors(unsupportedArithmetic).some((item) => item.message.includes("long literal")));

const xdataMemory = expectSuccessfulProgram("xdata pointer MOVX lowering", `
void main(void) {
  unsigned char xdata *pointer;
  unsigned char value;
  pointer = 0x1234;
  value = *pointer;
  *pointer = 1;
}
`);
assert.match(xdataMemory.asm, /mov dpl,0x[0-9a-f]+\nmov dph,0x[0-9a-f]+\nmovx a,@dptr/i);
assert.match(xdataMemory.asm, /movx @dptr,a/i);

const typedMemory = expectSuccessfulProgram("typed arrays, pointers, and structs", `
const unsigned int code words[] = { 0x1234, 0xabcd };
unsigned int code *globalCodePointer = &words[1];
unsigned char xdata *globalXdataPointer = 0x3456;
struct Pair { unsigned char tag; unsigned int value; };
void main(void) {
  unsigned int ramWords[2] = { 0x1122, 0x3344 };
  unsigned int code *cp = words;
  unsigned int xdata *xp = 0x2000;
  struct Pair pair;
  unsigned int value;
  value = ramWords[1];
  ramWords[0] = 0x5566;
  value = *cp;
  value = *globalCodePointer;
  *globalXdataPointer = 0x5a;
  cp++;
  value = *xp;
  *xp = value;
  value = xp[1];
  xp[1] = value;
  xp = xp + 2;
  pair.value = value;
}
`);
assert.match(typedMemory.asm, /words:\ndb 0x34, 0x12, 0xcd, 0xab/i, "16-bit code tables must be emitted little-endian");
assert.match(typedMemory.asm, /movx a,@dptr\nmov b,a\ninc dptr\nmovx a,@dptr\nxch a,b/i, "16-bit xdata reads must use two MOVX accesses");
assert.match(typedMemory.asm, /movx @dptr,a\ninc dptr\nmov a,b\nmovx @dptr,a/i, "16-bit xdata writes must use two MOVX accesses");
assert.match(typedMemory.asm, /add a,#0x4/i, "xp + 2 must scale by the two-byte pointee size");

const globalPointer = expectSuccessfulProgram("global xdata pointer", `
unsigned char xdata *globalPointer;
void main(void) { globalPointer = 0x1234; P0 = globalPointer; }
`);
assert.match(globalPointer.asm, /mov 0x[0-9a-f]+,#0x34\nmov 0x[0-9a-f]+,#0x12/i);

console.log("Extended C51 correctness tests passed (9 programs + 9 negative groups)");
