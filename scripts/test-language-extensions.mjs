import assert from "node:assert/strict";
import { ADUC841_BITS, ADUC841_INTERRUPT_VECTORS, ADUC841_SFR } from "../web/mcu/aduc841.js";
import { compileAsm } from "../web/ui/asmCompiler.js";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";
import { getCodeCompletions } from "../web/ui/codeCompletions.js";

assert.equal(ADUC841_SFR.pwmcon, 0xae);
assert.equal(ADUC841_SFR.pwm0l, 0xb1);
assert.equal(ADUC841_SFR.dac0l, 0xf9);
assert.equal(ADUC841_SFR.daccon, 0xfd);
assert.equal(ADUC841_SFR.eadrl, 0xc6);
assert.equal(ADUC841_SFR.eadrh, 0xc7);
assert.equal(ADUC841_SFR.pllcon, 0xd7);
assert.equal(ADUC841_BITS.pre0, 0xc4);
assert.equal(ADUC841_BITS.i2cid0, 0xec);
assert.equal(ADUC841_BITS.mde, 0xee);
assert.equal(ADUC841_INTERRUPT_VECTORS.has(9), false, "ADuC841 interrupt 9 is reserved");
assert.equal(ADUC841_INTERRUPT_VECTORS.get(10), 0x0053);
assert.equal(ADUC841_INTERRUPT_VECTORS.get(11), 0x005b);

const extendedAsm = `
VALUE SET (1 SHL 3) OR 2
PORTCOPY DATA 30H
FLAG BIT 20H
SFR16 TIMER2 = 0CCH
.ORG 0100H
DEFB 'A', VALUE
DEFW 1234H
RESB 3
START:
    MOV A,#LOW(START)
    MOV B,#HIGH(START)
    INC DPTR
    CLR C
    SETB FLAG
    CPL FLAG
    END
`;
const asmResult = compileAsm(extendedAsm);
assert.deepEqual(
  asmResult.diagnostics.filter((item) => item.level === "error"),
  [],
  asmResult.diagnostics.map((item) => item.message).join("\n"),
);
assert.deepEqual(
  Array.from(asmResult.bytes).filter((_value, index) => index % 2 === 1).slice(0, 7),
  [0x41, 0x0a, 0x12, 0x34, 0x00, 0x00, 0x00],
  "ASM aliases, expressions, character constants and reserve directives must emit expected bytes",
);

const extendedC = `
#define LEVEL 2
#define BITSET(value, bit) ((value) | (1 << (bit)))
#if defined(LEVEL) && LEVEL == 1
#define START 1
#elif defined(LEVEL) && LEVEL == 2
#define START 2
#else
#define START 3
#endif
enum Mode { MODE_OFF, MODE_ON = 5, MODE_AUTO };
sbit FLAG = P1^0;
void main(void) {
  register unsigned char value = BITSET(START, 2);
  unsigned short wide = 0x1234;
  value = _crol_(value, 1);
  wide = _irol_(wide, 1);
  if (_testbit_(FLAG)) goto done;
  value = MODE_AUTO;
done:
  while (1) { }
}
`;
const cResult = transpileCToAsm(extendedC);
assert.deepEqual(
  cResult.diagnostics.filter((item) => item.level === "error"),
  [],
  cResult.diagnostics.map((item) => item.message).join("\n"),
);
assert.match(cResult.asm, /mov 0x[0-9a-f]+,#0x6/i, "Macros and enum values must be folded");
assert.match(cResult.asm, /rl a/i, "_crol_ must emit an accumulator rotate");
assert.match(cResult.asm, /__c_user_main_done:/i, "goto and C labels must be emitted");
const compiledC = compileAsm(cResult.asm);
assert.deepEqual(
  compiledC.diagnostics.filter((item) => item.level === "error"),
  [],
  compiledC.diagnostics.map((item) => item.message).join("\n"),
);

const asmSource = `MY_LABEL:\nVALUE EQU 1\nCUSTOM SFR 80H`;
const asmLabels = getCodeCompletions("asm", asmSource, "my_", 200);
assert.ok(asmLabels.some((item) => item.label === "MY_LABEL" && item.category === "Current file label"));
assert.ok(getCodeCompletions("asm", asmSource, "mov", 200).length >= 20);
assert.ok(getCodeCompletions("asm", asmSource, "resb", 200).some((item) => item.label === "RESB count"));
assert.ok(getCodeCompletions("asm", asmSource, "timer", 200).some((item) => item.category === "ST841 template"));

const cSource = `#define FEATURE 1\nunsigned char helper(unsigned char value) { return value; }\nvoid main(void) { unsigned char local = 0; }`;
assert.ok(getCodeCompletions("c", cSource, "help", 200).some((item) => item.label === "helper()"));
assert.equal(getCodeCompletions("c", cSource, "inter", 200).filter((item) => item.category === "Interrupt").length, 11);
assert.ok(getCodeCompletions("c", cSource, "if", 200).some((item) => item.insertText.startsWith("#ifdef")));
assert.ok(getCodeCompletions("c", cSource, "dac", 200).some((item) => item.insertText.includes("DAC0H")));

for (const mode of ["asm", "c"]) {
  for (const prefix of ["mov", "inter", "p0", "timer", "if", "data"]) {
    const values = getCodeCompletions(mode, cSource, prefix, 200);
    const keys = values.map((item) => `${item.label}\u0000${item.insertText}`.toLowerCase());
    assert.equal(new Set(keys).size, keys.length, `${mode}/${prefix} completions must be deduplicated`);
  }
}

console.log("Language extensions and canonical ADuC841 integration passed");
