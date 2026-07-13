import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  root,
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    target: "esnext",
    minify: false,
    lib: {
      entry: fileURLToPath(new URL("../src/ui/codeCompletions.ts", import.meta.url)),
      formats: ["es"],
    },
  },
});
const chunk = (Array.isArray(bundle) ? bundle : [bundle])
  .flatMap((output) => output.output ?? [])
  .find((item) => item.type === "chunk");
assert.ok(chunk, "Vite did not produce a completion module chunk");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`;
const completions = await import(moduleUrl);

const expectedMnemonics = `
  acall add addc ajmp anl call cjne clr cpl da dec div djnz inc jb jbc jc jmp jnb jnc jnz jz
  lcall ljmp mov movc movx mul nop orl pop push ret reti rl rlc rr rrc setb sjmp subb swap xch xchd xrl
`.trim().split(/\s+/);
for (const mnemonic of expectedMnemonics) {
  assert.ok(completions.ASM_MNEMONICS.has(mnemonic), `Missing mnemonic ${mnemonic}`);
  assert.ok(
    completions.CODE_COMPLETIONS.some((item) => item.mode === "asm" && item.trigger.toLowerCase() === mnemonic),
    `Missing completion forms for ${mnemonic}`,
  );
}

for (const directive of [
  "org", "end", "equ", "set", "data", "bit", "sbit", "sfr", "sfr16", "db", "dw", "ds", "resb",
  "macro", "endm", "local", "exitm", "if", "ifdef", "ifndef", "elif", "else", "endif", "rept", "endr",
  "align", "even",
]) {
  assert.ok(completions.ASM_DIRECTIVES.has(directive), `Missing directive ${directive}`);
}
for (const unsupported of ["CSEG", "DSEG", "XSEG", "BSEG", ".AREA CODE", "EXTERN symbol", "EXTRN CODE (symbol)"]) {
  assert.ok(
    !completions.CODE_COMPLETIONS.some((item) => item.mode === "asm" && item.insertText === unsupported),
    `Autocomplete must not insert unsupported linker/segment syntax: ${unsupported}`,
  );
}
for (const insertText of [
  "NAME MACRO param1,param2\n    \nENDM",
  "ENDM",
  "LOCAL .loop",
  "EXITM",
  "IF expression\n    \nENDIF",
  "IFDEF symbol\n    \nENDIF",
  "IFNDEF symbol\n    \nENDIF",
  "ELIF expression",
  "ELSE",
  "ENDIF",
  "REPT count\n    \nENDR",
  "ENDR",
  "DB 4 DUP(0)",
  "DW 2 DUP(0)",
  "ALIGN 4",
  "EVEN",
]) {
  assert.ok(
    completions.CODE_COMPLETIONS.some((item) => item.mode === "asm" && item.insertText === insertText),
    `Missing exact ASM completion ${JSON.stringify(insertText)}`,
  );
}
assert.ok(
  completions.CODE_COMPLETIONS.some(
    (item) => item.mode === "asm" && item.trigger === ".local" && item.insertText === ".loop:",
  ),
  "Missing scoped .local-label completion",
);
assert.ok(
  completions.CODE_COMPLETIONS.some(
    (item) => item.mode === "asm" && item.insertText === "SFR16 TIMER2 = 0xCC",
  ),
  "ASM catalog must expose the Keil-compatible low-byte SFR16 address",
);

const includeSource = "#inc";
const includeResult = completions.getCodeCompletionResult(includeSource, "c", includeSource.length, 20);
assert.equal(includeResult.replaceStart, 0, "A partial #include must replace its leading #");
assert.ok(includeResult.matches.some((item) => item.insertText === "#include <ADUC841.H>"));
assert.ok(includeResult.matches.some((item) => item.insertText === "#include <intrins.h>"));
assert.ok(includeResult.matches.some((item) => item.insertText === "#include <stdint.h>"));
assert.ok(includeResult.matches.some((item) => item.insertText === "#include <stdbool.h>"));

const headerSource = "    #include <AD";
const headerResult = completions.getCodeCompletionResult(headerSource, "c", headerSource.length, 20);
assert.equal(headerResult.replaceStart, 4, "An indented include must preserve indentation");
assert.ok(headerResult.matches.some((item) => item.insertText === "#include <ADUC841.H>"));

const asmSource = `START:\nVALUE EQU 1\nSFR CUSTOM = 80H\nFLAG SBIT P1.0`;
for (const symbol of ["START", "VALUE", "CUSTOM", "FLAG"]) {
  const matches = completions.getCodeCompletions("asm", asmSource, symbol.slice(0, 3), 100);
  assert.ok(matches.some((item) => item.insertText === symbol && item.dynamic), `Missing dynamic ASM symbol ${symbol}`);
}
assert.ok(completions.getCodeCompletions("asm", asmSource, "mov", 200).length >= 20);
assert.ok(completions.getCodeCompletions("asm", asmSource, "resb", 200).some((item) => item.label === "RESB count"));
assert.ok(completions.getCodeCompletions("asm", asmSource, "timer", 200).some((item) => item.category === "ST841 template"));

const asmMacroSource = `
COPY_BYTE MACRO source,destination
LOCAL .again
.again:
BODY_LABEL:
    MOV destination,source
ENDM
MAIN:
.loop:
    COPY_BYTE P1,P2
`;
const asmDynamic = completions.collectDynamicCompletions(asmMacroSource, "asm");
for (const symbol of ["COPY_BYTE", "MAIN", ".loop"]) {
  assert.ok(asmDynamic.some((item) => item.insertText === symbol), `Missing dynamic ASM macro/symbol ${symbol}`);
}
for (const leaked of ["source", "destination", ".again", "BODY_LABEL"]) {
  assert.ok(!asmDynamic.some((item) => item.insertText === leaked), `Macro-local name ${leaked} leaked globally`);
}
assert.ok(
  completions.getCodeCompletions("asm", asmMacroSource, "copy", 50)
    .some((item) => item.dynamic && item.insertText === "COPY_BYTE" && item.category === "Current file macro"),
  "A defined ASM macro must be offered as an invocation name without C-style parentheses",
);

const cSource = `
#define FEATURE 1
unsigned char helper(unsigned char value) {
  unsigned int local_count = value;
  return local_count;
}
`;
for (const [prefix, symbol] of [["feat", "FEATURE"], ["help", "helper()"], ["local", "local_count"]]) {
  const matches = completions.getCodeCompletions("c", cSource, prefix, 100);
  assert.ok(matches.some((item) => item.insertText === symbol && item.dynamic), `Missing dynamic C symbol ${symbol}`);
}
assert.ok(completions.getCodeCompletions("c", cSource, "if", 200).some((item) => item.label === "#ifdef block"));
assert.ok(completions.getCodeCompletions("c", cSource, "dac", 200).some((item) => item.label === "write 12-bit value to DAC0"));
assert.ok(
  completions.CODE_COMPLETIONS.some(
    (item) => item.mode === "c" && item.insertText === "sfr16 TIMER2 = 0xCC;",
  ),
  "C catalog must expose the exact Keil sfr16 TIMER2 declaration",
);

for (const insertText of [
  "typedef unsigned char byte;",
  "typedef byte counter_t;",
  "typedef struct Device Device;",
  "for (unsigned char i = 0; i < count; i++) {\n    \n}",
  "#define NAME(value) \\\n    ((value) + 1)",
]) {
  assert.ok(
    completions.CODE_COMPLETIONS.some((item) => item.mode === "c" && item.insertText === insertText),
    `Missing exact C completion ${JSON.stringify(insertText)}`,
  );
}


for (const insertText of [
  "unsigned char xdata value;",
  "unsigned int xdata value;",
  "unsigned char xdata values[16];",
  "unsigned int xdata values[8];",
  "unsigned char xdata *ptr = 0x0000;",
]) {
  assert.ok(
    completions.CODE_COMPLETIONS.some((item) => item.mode === "c" && item.insertText === insertText),
    `Missing XDATA completion ${JSON.stringify(insertText)}`,
  );
}
assert.ok(
  completions.getCodeCompletions("c", "", "xdata array", 100)
    .some((item) => item.insertText === "unsigned char xdata values[16];"),
  "XDATA array completion must be searchable by name",
);

const requiredStructCompletions = [
  "struct Name {\n    unsigned char status;\n    unsigned int value;\n};",
  "struct Name xdata object;",
  "struct Name xdata objects[4];",
  "struct Name xdata *pointer = &object;",
  "pointer->field;",
  "objects[index].field;",
  "sizeof(struct Name);",
];
for (const insertText of requiredStructCompletions) {
  const item = completions.CODE_COMPLETIONS.find(
    (candidate) => candidate.mode === "c" && candidate.insertText === insertText,
  );
  assert.ok(item, `Missing structure completion ${JSON.stringify(insertText)}`);
  assert.ok(item.label?.trim(), `Structure completion ${JSON.stringify(insertText)} must have a label`);
  assert.ok(item.description?.trim(), `Structure completion ${JSON.stringify(insertText)} must have a description`);
  assert.equal(item.category, "C structure", `Structure completion ${JSON.stringify(insertText)} must use the C structure category`);
}
assert.ok(
  completions.getCodeCompletions("c", "", "struct pointer", 100)
    .some((item) => item.insertText === "struct Name xdata *pointer = &object;"),
  "XDATA structure pointer completion must be searchable",
);

const cTypedefSource = `
typedef unsigned char byte;
typedef byte counter_t;
struct Device { unsigned char state; };
typedef struct Device Device;
typedef struct { unsigned char hidden; } Anonymous;
counter_t ticks;
Device current;
Device read_device(counter_t limit) {
  for (byte index = 0, mirror = 1; index < limit; index++) {
    current.state = mirror;
  }
  return current;
}
`;
const cDynamic = completions.collectDynamicCompletions(cTypedefSource, "c");
for (const [symbol, category] of [
  ["byte", "Current file type alias"],
  ["counter_t", "Current file type alias"],
  ["Device", "Current file type alias"],
  ["ticks", "Current file variable"],
  ["current", "Current file variable"],
  ["read_device()", "Current file function"],
  ["index", "Current file loop variable"],
  ["mirror", "Current file loop variable"],
]) {
  assert.ok(
    cDynamic.some((item) => item.insertText === symbol && item.category === category),
    `Missing dynamic C symbol ${symbol} (${category})`,
  );
}
assert.ok(
  !cDynamic.some((item) => item.insertText === "Anonymous" && item.category === "Current file type alias"),
  "Anonymous aggregate typedefs must not be advertised as supported aliases",
);
for (const [prefix, symbol] of [["count", "counter_t"], ["ticks", "ticks"], ["read", "read_device()"], ["index", "index"]]) {
  assert.ok(
    completions.getCodeCompletions("c", cTypedefSource, prefix, 100)
      .some((item) => item.insertText === symbol && item.dynamic),
    `Missing searchable typedef-backed C symbol ${symbol}`,
  );
}

const hardwareGroups = [
  ["buswrite", ["WR", "P0", "P2"]],
  ["busread", ["WR", "P0", "P2"]],
  ["adcread", ["ADCCON1", "ADCCON2", "ADCI", "SCONV", "ADCDATAH", "ADCDATAL"]],
  ["uartinit", ["SCON", "TMOD", "TH1", "TR1"]],
  ["uartsend", ["TI", "SBUF"]],
  ["timer0init", ["TMOD", "TH0", "TL0", "ET0", "EA", "TR0"]],
  ["dac0write", ["DACCON", "DAC0H", "DAC0L"]],
  ["pwm0write", ["PWM0H", "PWM0L"]],
];
for (const mode of ["asm", "c"]) {
  for (const [trigger, canonicalSymbols] of hardwareGroups) {
    const item = completions.CODE_COMPLETIONS.find(
      (candidate) => candidate.mode === mode && candidate.trigger === trigger && candidate.category === "ST841 template",
    );
    assert.ok(item, `Missing ${mode.toUpperCase()} hardware snippet ${trigger}`);
    assert.ok(item.insertText.split("\n").length <= 8, `${mode}/${trigger} must stay compact`);
    for (const symbol of canonicalSymbols) {
      assert.match(item.insertText, new RegExp(`\\b${symbol}\\b`), `${mode}/${trigger} must use canonical ${symbol}`);
    }
    assert.ok(
      completions.getCodeCompletions(mode, cSource, trigger, 50).some((candidate) => candidate.insertText === item.insertText),
      `${mode}/${trigger} must be searchable`,
    );
  }
}
for (const mode of ["asm", "c"]) {
  const dac = completions.CODE_COMPLETIONS.find((item) => item.mode === mode && item.trigger === "dac0write");
  const pwm = completions.CODE_COMPLETIONS.find((item) => item.mode === mode && item.trigger === "pwm0write");
  assert.ok(dac.insertText.indexOf("DAC0H") < dac.insertText.indexOf("DAC0L"), `${mode}/DAC must write H before L`);
  assert.ok(pwm.insertText.indexOf("PWM0L") < pwm.insertText.indexOf("PWM0H"), `${mode}/PWM must write LOW before HIGH`);
}
assert.ok(
  completions.CODE_COMPLETIONS.some(
    (item) => item.mode === "c" && item.trigger === "dac0write" &&
      item.insertText.includes("DAC0H = (value >> 8) & 0x0F;") &&
      item.insertText.includes("DAC0L = (unsigned char)value;"),
  ),
  "C DAC snippet must split a right-aligned 12-bit value",
);

const interruptItems = completions.CODE_COMPLETIONS.filter((item) => item.category === "Interrupt");
assert.deepEqual(
  interruptItems.map((item) => Number(/interrupt (\d+)/.exec(item.insertText)?.[1])),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11],
  "Interrupt completions must follow canonical ADuC841 vectors",
);

for (const mode of ["asm", "c"]) {
  for (const prefix of ["mov", "inter", "p0", "timer", "if", "data", "macro", "local", "dup", "typedef", "for", "define"]) {
    const values = completions.getCodeCompletions(mode, cSource, prefix, 200);
    const keys = values.map((item) => `${item.label}\0${item.insertText}`.toLowerCase());
    assert.equal(new Set(keys).size, keys.length, `${mode}/${prefix} completions must be deduplicated`);
  }
}

assert.ok(
  completions.CODE_COMPLETIONS.every((item) => item.insertText.split("\n").length <= 8),
  "The catalog must contain compact snippets, not full programs",
);

console.log(
  `Code completions passed: ${completions.CODE_COMPLETIONS.length} generated static items, ` +
  `${completions.ASM_MNEMONICS.size} mnemonics, ${completions.ASM_DIRECTIVES.size} directives.`,
);
