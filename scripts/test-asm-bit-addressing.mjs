// Numeric bit addressing (`20h.0`, `0D0h.3`) and full opcode coverage.
//
// A51 lets any bit operand be written as `byte.bit`. Only the symbolic form
// (P1.0, ACC.7) used to work: a numeric base was mis-parsed, with `.0` treated
// as a local-label reference, so the whole bit-addressable RAM area 20h..2Fh
// was unreachable through its natural syntax.

import assert from "node:assert/strict";
import { compileAsm } from "../web/ui/asmCompiler.js";

let checks = 0;

function bytesOf(source) {
  const result = compileAsm(`ORG 0\n${source}\nEND`);
  const errors = (result.diagnostics ?? []).filter((entry) => entry.level === "error");
  assert.deepEqual(errors.map((entry) => entry.message), [], `${source} must assemble`);
  // `bytes` alternates address/value; take the values.
  const out = [];
  for (let index = 1; index < Object.keys(result.bytes).length; index += 2) out.push(result.bytes[index]);
  return out;
}

function expectBytes(source, expected) {
  assert.deepEqual(
    bytesOf(source).slice(0, expected.length),
    expected,
    `${source} should assemble to ${expected.map((b) => b.toString(16)).join(" ")}`,
  );
  checks += 1;
}

function expectError(source, pattern, label) {
  const messages = (compileAsm(`ORG 0\n${source}\nEND`).diagnostics ?? [])
    .filter((entry) => entry.level === "error")
    .map((entry) => entry.message);
  assert.ok(
    messages.some((message) => pattern.test(message)),
    `${label}: expected ${pattern}, got ${JSON.stringify(messages)}`,
  );
  checks += 1;
}

// --- Bit-addressable internal RAM 20h..2Fh maps to bits 00h..7Fh ------------
expectBytes("SETB 20h.0", [0xd2, 0x00]);
expectBytes("SETB 20h.7", [0xd2, 0x07]);
expectBytes("SETB 21h.0", [0xd2, 0x08]);
expectBytes("CLR 21h.3", [0xc2, 0x0b]);
expectBytes("SETB 2Fh.7", [0xd2, 0x7f]);
expectBytes("CPL 25h.5", [0xb2, 0x2d]);
// The same bit reached numerically must encode identically.
expectBytes("SETB 00h", [0xd2, 0x00]);
expectBytes("SETB 7Fh", [0xd2, 0x7f]);

// --- Carry/bit instructions over a numeric base -----------------------------
expectBytes("MOV C,20h.0", [0xa2, 0x00]);
expectBytes("MOV 20h.0,C", [0x92, 0x00]);
expectBytes("ANL C,20h.0", [0x82, 0x00]);
expectBytes("ANL C,/22h.4", [0xb0, 0x14]);
expectBytes("ORL C,20h.0", [0x72, 0x00]);
expectBytes("ORL C,/20h.0", [0xa0, 0x00]);
expectBytes("JB 20h.1,$", [0x20, 0x01]);
expectBytes("JNB 20h.0,$", [0x30, 0x00]);
expectBytes("JBC 20h.0,$", [0x10, 0x00]);

// --- Bit-addressable SFRs (address divisible by 8) --------------------------
expectBytes("SETB 0D0h.0", [0xd2, 0xd0]); // PSW.0
expectBytes("SETB 0A8h.7", [0xd2, 0xaf]); // IE.7 (EA)
expectBytes("SETB 0E0h.7", [0xd2, 0xe7]); // ACC.7
// Symbolic forms must keep working and agree with the numeric ones.
expectBytes("SETB ACC.7", [0xd2, 0xe7]);
expectBytes("SETB P1.0", [0xd2, 0x90]);

// --- Non-bit-addressable bases are rejected with a useful message -----------
expectError("SETB 30h.0", /not bit addressable/i, "RAM above 2Fh");
expectError("SETB 0D1h.0", /not bit addressable/i, "SFR not divisible by 8");
expectError("SETB 20h.9", /bit index must be 0\.\.7/i, "bit index out of range");

// --- Local labels must still work (the parsing fix touched that path) -------
{
  const result = compileAsm("MAIN:\n.loop: SJMP .loop\nEND");
  assert.deepEqual(
    (result.diagnostics ?? []).filter((entry) => entry.level === "error").map((entry) => entry.message),
    [],
    "local labels must still resolve",
  );
  checks += 1;
}
expectError("SJMP .missing", /local label/i, "orphan local label still reported");

// --- Every AJMP/ACALL page opcode ------------------------------------------
for (let page = 0; page < 8; page++) {
  const target = (page << 8) | 0x40;
  expectBytes(`AJMP T\nORG ${target}\nT: NOP`, [(page << 5) | 0x01, 0x40]);
  expectBytes(`ACALL T\nORG ${target}\nT: NOP`, [(page << 5) | 0x11, 0x40]);
}

console.log(`ASM bit-addressing tests passed (${checks} assertions)`);
