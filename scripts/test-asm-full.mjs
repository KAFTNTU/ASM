import assert from "node:assert/strict";
import { compileAsm } from "../web/ui/asmCompiler.js";

function memory(result) {
  const map = new Map();
  for (const line of result.hex.split(/\r?\n/)) {
    if (!line.startsWith(":")) continue;
    const count = Number.parseInt(line.slice(1, 3), 16);
    const addr = Number.parseInt(line.slice(3, 7), 16);
    const type = Number.parseInt(line.slice(7, 9), 16);
    if (type !== 0) continue;
    for (let i = 0; i < count; i++) map.set(addr + i, Number.parseInt(line.slice(9 + i * 2, 11 + i * 2), 16));
  }
  return map;
}
function expectBytes(source, expected, origin = 0) {
  const result = compileAsm(source);
  const errors = result.diagnostics.filter((d) => d.level === "error");
  assert.deepEqual(errors, [], `compile errors for:\n${source}\n${errors.map((e) => e.message).join("\n")}`);
  const mem = memory(result);
  for (let i = 0; i < expected.length; i++) {
    assert.equal(mem.get(origin + i), expected[i], `byte ${i} for ${source}`);
  }
  assert.equal([...mem.keys()].filter((x) => x >= origin && x < origin + expected.length).length, expected.length);
}
function expectError(source, messagePattern) {
  const result = compileAsm(source);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === "error");
  assert.equal(result.ok, false, `expected compilation failure for:\n${source}`);
  assert.ok(errors.length > 0, `expected an error diagnostic for:\n${source}`);
  if (messagePattern) {
    assert.ok(
      errors.some((diagnostic) => messagePattern.test(diagnostic.message)),
      `expected ${messagePattern} for:\n${source}\n${errors.map((error) => error.message).join("\n")}`,
    );
  }
}

const cases = [
  ["mov a,#12h", [0x74,0x12]], ["mov a,30h", [0xe5,0x30]], ["mov a,@r0", [0xe6]], ["mov a,@r1", [0xe7]],
  ["mov a,r0", [0xe8]], ["mov a,r7", [0xef]], ["mov 30h,a", [0xf5,0x30]], ["mov 30h,#12h", [0x75,0x30,0x12]],
  ["mov 30h,31h", [0x85,0x31,0x30]], ["mov 30h,@r1", [0x87,0x30]], ["mov 30h,r7", [0x8f,0x30]],
  ["mov @r0,a", [0xf6]], ["mov @r1,#12h", [0x77,0x12]], ["mov @r0,30h", [0xa6,0x30]],
  ["mov r0,a", [0xf8]], ["mov r7,#12h", [0x7f,0x12]], ["mov r3,30h", [0xab,0x30]],
  ["mov dptr,#1234h", [0x90,0x12,0x34]], ["mov c,p1.2", [0xa2,0x92]], ["mov p1.2,c", [0x92,0x92]],
  ["inc a", [0x04]], ["inc 30h", [0x05,0x30]], ["inc @r1", [0x07]], ["inc r7", [0x0f]], ["inc dptr", [0xa3]],
  ["dec a", [0x14]], ["dec 30h", [0x15,0x30]], ["dec @r1", [0x17]], ["dec r7", [0x1f]],
  ["add a,#12h", [0x24,0x12]], ["add a,30h", [0x25,0x30]], ["add a,@r1", [0x27]], ["add a,r7", [0x2f]],
  ["addc a,#12h", [0x34,0x12]], ["subb a,#12h", [0x94,0x12]],
  ["orl a,#12h", [0x44,0x12]], ["orl a,30h", [0x45,0x30]], ["orl a,@r1", [0x47]], ["orl a,r7", [0x4f]],
  ["orl 30h,a", [0x42,0x30]], ["orl 30h,#12h", [0x43,0x30,0x12]], ["orl c,p1.2", [0x72,0x92]], ["orl c,/p1.2", [0xa0,0x92]],
  ["anl a,#12h", [0x54,0x12]], ["anl 30h,a", [0x52,0x30]], ["anl c,p1.2", [0x82,0x92]], ["anl c,/p1.2", [0xb0,0x92]],
  ["xrl a,#12h", [0x64,0x12]], ["xrl 30h,a", [0x62,0x30]], ["xrl 30h,#12h", [0x63,0x30,0x12]],
  ["clr a", [0xe4]], ["clr c", [0xc3]], ["clr p1.2", [0xc2,0x92]], ["cpl a", [0xf4]], ["cpl c", [0xb3]], ["cpl p1.2", [0xb2,0x92]], ["setb c", [0xd3]], ["setb p1.2", [0xd2,0x92]],
  ["rr a", [0x03]], ["rrc a", [0x13]], ["rl a", [0x23]], ["rlc a", [0x33]], ["swap a", [0xc4]], ["da a", [0xd4]],
  ["mul ab", [0xa4]], ["div ab", [0x84]], ["nop", [0x00]], ["ret", [0x22]], ["reti", [0x32]],
  ["push 30h", [0xc0,0x30]], ["pop 30h", [0xd0,0x30]],
  ["xch a,30h", [0xc5,0x30]], ["xch a,@r1", [0xc7]], ["xch a,r7", [0xcf]], ["xchd a,@r1", [0xd7]],
  ["movc a,@a+dptr", [0x93]], ["movc a,@a+pc", [0x83]], ["movx a,@dptr", [0xe0]], ["movx @dptr,a", [0xf0]], ["movx a,@r1", [0xe3]], ["movx @r1,a", [0xf3]],
  ["jmp @a+dptr", [0x73]],
];
for (const [source, bytes] of cases) expectBytes(source, bytes);

expectBytes(`org 100h\nstart: sjmp next\nnop\nnext: jz start`, [0x80,0x01,0x00,0x60,0xfb], 0x100);
expectBytes(`org 100h\nstart: jb p1.2,next\nnop\nnext: jnb p1.2,start`, [0x20,0x92,0x01,0x00,0x30,0x92,0xf9], 0x100);
expectBytes(`org 100h\nstart: jbc p1.2,next\nnop\nnext: djnz r7,start`, [0x10,0x92,0x01,0x00,0xdf,0xfa], 0x100);
expectBytes(`org 100h\nstart: djnz 30h,start`, [0xd5,0x30,0xfd], 0x100);
expectBytes(`org 100h\nstart: cjne a,#12h,start`, [0xb4,0x12,0xfd], 0x100);
expectBytes(`org 100h\nstart: cjne a,30h,start`, [0xb5,0x30,0xfd], 0x100);
expectBytes(`org 100h\nstart: cjne @r1,#12h,start`, [0xb7,0x12,0xfd], 0x100);
expectBytes(`org 100h\nstart: cjne r7,#12h,start`, [0xbf,0x12,0xfd], 0x100);
expectBytes(`org 100h\nstart: lcall target\nljmp target\ntarget: ret`, [0x12,0x01,0x06,0x02,0x01,0x06,0x22], 0x100);
expectBytes(`org 100h\nstart: acall target\najmp target\ntarget: ret`, [0x31,0x04,0x21,0x04,0x22], 0x100);
expectBytes(`org 100h\nfoo equ r3\nbar data 30h\nflag bit 92h\nsbit wr = p3.6\nsfr myp0 = 80h\nmov foo,#1\nmov bar,#2\nsetb flag\nsetb wr\nmov myp0,#3`, [0x7b,1,0x75,0x30,2,0xd2,0x92,0xd2,0xb6,0x75,0x80,3], 0x100);
expectBytes(`org 100h\ndb 1,2,"AB"\ndw 1234h`, [1,2,0x41,0x42,0x12,0x34], 0x100);
expectBytes(`org 1234h\nlabel: db low(label),high(label),1`, [0x34,0x12,0x01], 0x1234);
expectBytes(`org 100h\nhere: jnb adci,$`, [0x30,0xdf,0xfd], 0x100);

// Compatibility lowerings used by methodology snippets.
expectBytes(`anl r2,#0fh`, [0xea,0x54,0x0f,0xfa]);
expectBytes(`orl @r1,#80h`, [0xe7,0x44,0x80,0xf7]);
expectBytes(`cjne 30h,#1,target\nnop\ntarget: ret`, [0xe5,0x30,0xb4,0x01,0x01,0x00,0x22]);

// Canonical ADuC841 SFRs and bit aliases (datasheet addresses).
expectBytes(
  `mov pwmcon,#1\nmov pwm0l,#2\nmov pwm0h,#3\nmov pwm1l,#4\nmov pwm1h,#5\n` +
  `mov t3fd,#6\nmov t3con,#7\nmov spidat,#8\nmov spicon,#9\n` +
  `mov i2cdat,#10\nmov i2cadd,#11\nmov i2ccon,#12\nsetb ispi\nsetb i2ci\nanl c,/ispi`,
  [
    0x75,0xae,1, 0x75,0xb1,2, 0x75,0xb2,3, 0x75,0xb3,4, 0x75,0xb4,5,
    0x75,0x9d,6, 0x75,0x9e,7, 0x75,0xf7,8, 0x75,0xf8,9,
    0x75,0x9a,10, 0x75,0x9b,11, 0x75,0xe8,12, 0xd2,0xff, 0xd2,0xe8, 0xb0,0xff,
  ],
);

const pwmAndDac = compileAsm(`mov pwm0l,#1\nmov dac0l,#2`);
assert.deepEqual(pwmAndDac.diagnostics.filter((diagnostic) => diagnostic.level === "error"), []);
assert.deepEqual(
  pwmAndDac.diagnostics.filter((diagnostic) => diagnostic.level === "warning"),
  [],
  "PWM B1-B4 and DAC F9-FD are distinct ADuC841 SFR families",
);
expectBytes(`mov pwm0l,#1\nmov dac0l,#2`, [0x75,0xb1,1,0x75,0xf9,2]);

// Constant-expression precedence, aliases, character literals, labels and current address ($).
expectBytes(
  `BASE EQU 1234H\nMASK SET (1 SHL 7) OR (3 XOR 1)\n.ORG 0200H\n` +
  `HERE: DEFB LOW(BASE + 2*3),HIGH(BASE),'A','\\n',NOT 0 AND 0FFH,(20/3) MOD 3,(1<<4)|3,$ & 0FFH\n` +
  `DEFW BASE + (4 << 2),HERE + 2\nMOV DPTR,#(BASE + 2)\nMOV A,#HI(HERE)\nMOV B,#MASK`,
  [0x3a,0x12,0x41,0x0a,0xff,0x00,0x13,0x00,0x12,0x44,0x02,0x02,0x90,0x12,0x36,0x74,0x02,0x75,0xf0,0x82],
  0x200,
);
expectBytes(`org 1234h\ndb <($ + 2), >($ + 2), 'Z'\nmov a,#'A'`, [0x36,0x12,0x5a,0x74,0x41], 0x1234);

// DS/DEFS/RESB reserve initialized space and END terminates source parsing.
expectBytes(`.org 100h\n.byte 1\nds 2 + 1\ndb $ - 100h\ndefs 1\nresb 1\nword 1234h`, [1,0,0,0,4,0,0,0x12,0x34], 0x100);
const endedSource = compileAsm(`org 100h\ndb 1\nEND\ndb 2\nthis_is_not_an_instruction\n`);
assert.deepEqual(endedSource.diagnostics.filter((diagnostic) => diagnostic.level === "error"), []);
assert.deepEqual([...memory(endedSource).entries()], [[0x100, 1]], "END must ignore every following line");
const labelEndSource = compileAsm(`org 100h\nstop_here: END stop_here\ndb 2`);
assert.deepEqual(labelEndSource.diagnostics.filter((diagnostic) => diagnostic.level === "error"), []);
assert.deepEqual([...memory(labelEndSource).entries()], [], "label: END must terminate without emitting data");

// Invalid expressions, reserve sizes, cycles and duplicate user symbols must be diagnosed.
expectError(`db (1 + 2`, /cannot resolve db/i);
expectError(`db 10 / 0`, /cannot resolve db/i);
expectError(`ds -1`, /ds expects/i);
expectError(`ds missing_symbol`, /ds expects/i);
expectError(`db 1 << 32`, /cannot resolve db/i);
expectError(`org 1 / 0\nnop`, /invalid org/i);
expectError(`mov a,#'AB'`, /cannot resolve operands/i);
expectError(`left equ right + 1\nright equ left + 1\ndb left`, /cannot resolve db/i);
expectError(`value equ 1\nvalue: nop`, /duplicate symbol/i);
expectError(`same: nop\nsame: ret`, /duplicate symbol/i);

console.log(`Full ASM instruction and language-extension test passed (${cases.length + 34} cases)`);
