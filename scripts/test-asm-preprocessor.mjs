import assert from "node:assert/strict";
import { compileAsm } from "../web/ui/asmCompiler.js";

function memory(result) {
  const map = new Map();
  for (const record of result.hex.split(/\r?\n/)) {
    if (!record.startsWith(":")) continue;
    const count = Number.parseInt(record.slice(1, 3), 16);
    const address = Number.parseInt(record.slice(3, 7), 16);
    const type = Number.parseInt(record.slice(7, 9), 16);
    if (type !== 0) continue;
    for (let index = 0; index < count; index++) {
      map.set(address + index, Number.parseInt(record.slice(9 + index * 2, 11 + index * 2), 16));
    }
  }
  return map;
}

function expectBytes(source, expected, origin = 0) {
  const result = compileAsm(source);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === "error");
  assert.deepEqual(errors, [], `compile errors for:\n${source}\n${errors.map((error) => error.message).join("\n")}`);
  const actual = memory(result);
  assert.deepEqual(
    [...actual.entries()].filter(([address]) => address >= origin && address < origin + expected.length),
    expected.map((value, index) => [origin + index, value]),
    `unexpected bytes for:\n${source}`,
  );
  return result;
}

function expectError(source, pattern, line) {
  const result = compileAsm(source);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.level === "error");
  assert.equal(result.ok, false, `expected compilation failure for:\n${source}`);
  assert.ok(errors.some((error) => pattern.test(error.message)), `${pattern} not found in:\n${errors.map((error) => error.message).join("\n")}`);
  if (line != null) {
    assert.ok(errors.some((error) => pattern.test(error.message) && error.line === line), `expected matching error on line ${line}`);
  }
}

let positiveCases = 0;
let negativeCases = 0;
const positive = (source, expected, origin) => {
  positiveCases += 1;
  return expectBytes(source, expected, origin);
};
const negative = (source, pattern, line) => {
  negativeCases += 1;
  expectError(source, pattern, line);
};

// Parameterized and nested macros use comma-aware arguments.
positive(
  `LOAD MACRO reg,value\n  MOV reg,#value\nENDM\nLOAD R3,12H`,
  [0x7b, 0x12],
);
positive(
  `LOAD MACRO reg,value\n MOV reg,#value\nENDM\nTWICE MACRO reg,value\n LOAD reg,value\n LOAD reg,value+1\nENDM\nTWICE R0,2`,
  [0x78, 0x02, 0x78, 0x03],
);
positive(
  `EMIT MACRO value\n DB value\nENDM\nEMIT "A,B;C//D"`,
  [...Buffer.from("A,B;C//D", "ascii")],
);
positive(
  `LITERALS MACRO H,B\n DB 20H,H,101B,B\nENDM\nLITERALS 2,3`,
  [0x20, 0x02, 0x05, 0x03],
);
positive(
  `LOCAL_LITERALS MACRO\n LOCAL H,B\n DB 20H,101B\nH: NOP\nB: RET\nENDM\nLOCAL_LITERALS`,
  [0x20, 0x05, 0x00, 0x22],
);
positive(
  `SPIN MACRO reg\n LOCAL loop\n MOV reg,#2\nloop: DJNZ reg,loop\nENDM\nSPIN R7\nSPIN R6`,
  [0x7f, 0x02, 0xdf, 0xfe, 0x7e, 0x02, 0xde, 0xfe],
);
positive(
  `EMIT MACRO value\n DB value\nENDM\nstart: EMIT 2AH\nSJMP start`,
  [0x2a, 0x80, 0xfd],
);
positive(
  `CHOOSE MACRO flag\n IF flag\n  DB 1\n  EXITM\n ENDIF\n DB 2\nENDM\nCHOOSE 1\nCHOOSE 0`,
  [0x01, 0x02],
);
positive(
  `FIRST MACRO\n REPT 3\n  DB 1\n  EXITM\n ENDM\n DB 2\nENDM\nFIRST`,
  [0x01],
);

const provenance = compileAsm(`BROKEN MACRO target\n MOV target,missing_symbol\nENDM\nBROKEN A`);
assert.equal(provenance.ok, false);
assert.ok(provenance.diagnostics.some((diagnostic) => diagnostic.level === "error" && diagnostic.line === 4));
positiveCases += 1;
const mappedMacro = compileAsm(`PAIR MACRO\n NOP\n RET\nENDM\nPAIR`);
assert.deepEqual(mappedMacro.pcToLine, [{ pc: 0, line: 5 }, { pc: 1, line: 5 }]);
positiveCases += 1;

// Conditional assembly sees preceding EQU/SET declarations, macros and built-in SFR names.
positive(
  `DEBUG EQU 1\nMODE SET 1\nMODE SET MODE+1\n` +
    `IF DEFINED(DEBUG) && (MODE EQ 2)\n DB 1\nELIF MODE EQ 3\n DB 2\nELSE\n DB 3\nENDIF`,
  [0x01],
);
positive(
  `FEATURE MACRO\n NOP\nENDM\nIFDEF FEATURE\n DB 4\nENDIF\nIFNDEF MISSING\n DB 5\nENDIF\nIFDEF PWM0L\n DB 6\nENDIF`,
  [0x04, 0x05, 0x06],
);
positive(
  `IF 0\n THIS_IS_INVALID\n REPT 4\n  ALSO_INVALID\n ENDM\nELSE\n IF (3 LT 4) AND (4 GE 4) AND (1 <> 2)\n  DB 7\n ENDIF\nENDIF`,
  [0x07],
);
positive(
  `IF DEFINED(MISSING) && MISSING\n DB 1\nELSE\n DB 2\nENDIF\n` +
    `IF 1 || MISSING\n DB 3\nENDIF\n` +
    `IF 0 && (1 / 0)\n DB 4\nELSE\n DB 5\nENDIF`,
  [0x02, 0x03, 0x05],
);

// Only canonical built-in model/include directives are safe no-ops.
positive(
  `INCLUDE ADUC841.INC\n$INCLUDE (REG841.INC)\nINCLUDE "reg841.inc"\n` +
    `$MOD841\n$MODADUC841\n$MODREG841\nMOV A,#1`,
  [0x74, 0x01],
);
positive(`.MODULE TEST\nNAME TEST\nPUBLIC entry\nUSING 0\nentry: NOP`, [0x00]);

// REPT accepts either ENDM or ENDR and supports nesting and zero iterations.
positive(`COUNT EQU 3\nREPT COUNT\n NOP\nENDM`, [0x00, 0x00, 0x00]);
positive(`REPT 2\n REPT 3\n  NOP\n ENDR\nENDM`, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
positive(`REPT 0\n DB 1\nENDR\nDB 9`, [0x09]);

// DB/DW DUP is recursive; strings and the location counter retain correct sizes.
positive(
  `ORG 100H\nDB 2 DUP("AB",0),3 DUP(1)\nDW 2 DUP(1234H)`,
  [0x41, 0x42, 0x00, 0x41, 0x42, 0x00, 0x01, 0x01, 0x01, 0x12, 0x34, 0x12, 0x34],
  0x100,
);
positive(`DB 2 DUP(3 DUP('X'))`, [0x58, 0x58, 0x58, 0x58, 0x58, 0x58]);
positive(`ORG 100H\ntable: DB 3 DUP(0)\nafter: DB LOW(after)`, [0x00, 0x00, 0x00, 0x03], 0x100);
positive(`DB 0 DUP(1),9`, [0x09]);
positive(`DB "A,B;C//D","\\n"`, [...Buffer.from("A,B;C//D", "ascii"), 0x0a]);

// ALIGN emits deterministic fill bytes; EVEN is ALIGN 2 with zero fill.
positive(`ORG 101H\nALIGN 4,0AAH\nhere: DB LOW(here)`, [0xaa, 0xaa, 0xaa, 0x04], 0x101);
positive(`ORG 100H\nDB 1\nEVEN\nDB 2`, [0x01, 0x00, 0x02], 0x100);
positive(`ORG 100H\nALIGN 1\nDB 3`, [0x03], 0x100);

// Dot labels are local to the nearest preceding global label and allow forward references.
positive(
  `ORG 100H\nmain:\n.loop: DJNZ R7,.loop\nother:\n.loop: DJNZ R6,.loop\nSJMP .done\n.done: RET`,
  [0xdf, 0xfe, 0xde, 0xfe, 0x80, 0x00, 0x22],
  0x100,
);
positive(`root: SJMP .done\nNOP\n.done: RET`, [0x80, 0x01, 0x00, 0x22]);

// Structural and bounded failure cases.
negative(`M MACRO value\n MOV A,#value`, /unterminated macro/i, 1);
negative(`M MACRO value\n MOV A,#value\nENDM\nM 1,2`, /expects 1 argument/i, 4);
negative(`M MACRO\n M\nENDM\nM`, /recursive macro/i, 4);
const deepMacros = Array.from({ length: 33 }, (_, index) =>
  `M${index} MACRO\n ${index === 32 ? "NOP" : `M${index + 1}`}\nENDM`).join("\n");
negative(`${deepMacros}\nM0`, /nesting exceeds 32 levels/i);
negative(`LOCAL loop\nNOP`, /only valid inside a macro/i, 1);
negative(`EXITM\nNOP`, /only valid inside a macro/i, 1);
negative(`IF UNKNOWN\n DB 1\nENDIF`, /cannot resolve if expression/i, 1);
negative(`IFDEF (BROKEN\n DB 1\nENDIF`, /ifdef expects one symbol/i, 1);
negative(`ELSE\nDB 1`, /without a matching if/i, 1);
negative(`IF 1\nDB 1`, /unterminated if/i, 1);
negative(`IF 1\nELSE\nELIF 1\nENDIF`, /cannot appear after else/i, 3);
negative(`REPT -1\nNOP\nENDM`, /range 0\.\.65535/i, 1);
negative(`REPT 65536\nNOP\nENDM`, /range 0\.\.65535/i, 1);
negative(`REPT 1000\n REPT 1000\n ENDM\nENDM`, /preprocessing exceeded 500000 steps/i, 2);
negative(`REPT 2\nNOP`, /unterminated rept/i, 1);
negative(`DB 2 DUP()`, /at least one value/i, 1);
negative(`DB -1 DUP(0)`, /dup count/i, 1);
negative(`DB 2 DUP(1`, /unterminated dup/i, 1);
negative(`ALIGN 0\nNOP`, /align expects boundary/i, 1);
negative(`EVEN 0\nNOP`, /does not accept operands/i, 1);
negative(`.loop: NOP`, /before any global label/i, 1);
negative(`main:\n.loop: NOP\n.loop: RET`, /duplicate symbol/i, 3);
negative(`INCLUDE custom.inc\nNOP`, /only built-in aduc841\.inc and reg841\.inc/i, 1);
negative(`$INCLUDE (..\\ADUC841.INC)\nNOP`, /include file/i, 1);
negative(`$MOD51\nNOP`, /unsupported \$mod model/i, 1);
negative(`EXTRN CODE (external_symbol)\nNOP`, /requires linker support/i, 1);
negative(`EXTERN external_symbol\nNOP`, /requires linker support/i, 1);
for (const directive of ["CSEG", "DSEG", "XSEG", "BSEG", ".AREA CODE"]) {
  negative(`${directive}\nNOP`, /segment\/area selection is unavailable/i, 1);
}
negative(`IF 0 || MISSING\n DB 1\nENDIF`, /cannot resolve if expression/i, 1);
negative(`IF 1 && MISSING\n DB 1\nENDIF`, /cannot resolve if expression/i, 1);

console.log(`ASM preprocessor/directive test passed (${positiveCases} positive, ${negativeCases} negative cases)`);
