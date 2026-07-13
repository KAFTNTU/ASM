import {
  ADUC841_BITS,
  ADUC841_INTERRUPTS,
  ADUC841_SFR,
  hex8,
  hex16,
} from "../mcu/aduc841";

export type CodeMode = "asm" | "c";
export type CompletionMode = CodeMode | "both";

export type CodeCompletion = {
  mode: CompletionMode;
  trigger: string;
  label: string;
  description: string;
  insertText: string;
  category: string;
  searchTerms?: readonly string[];
  priority?: number;
  dynamic?: boolean;
};

export type CompletionContext = {
  prefix: string;
  query: string;
  replaceStart: number;
  replaceEnd: number;
  directive: boolean;
};

export type CompletionResult = CompletionContext & {
  matches: CodeCompletion[];
};

type AsmForm = readonly [template: string, addressing: string];

/** Every classic MCS-51 mnemonic accepted by the built-in assembler. */
const ASM_FORMS: Readonly<Record<string, readonly AsmForm[]>> = {
  ACALL: [["ACALL label", "11-bit code address"]],
  ADD: arithmeticForms("ADD"),
  ADDC: arithmeticForms("ADDC"),
  AJMP: [["AJMP label", "11-bit code address"]],
  ANL: logicalForms("ANL", true),
  CALL: [["CALL label", "assembler alias for a long call"]],
  CJNE: [
    ["CJNE A,#0x00,label", "A, immediate, relative"],
    ["CJNE A,direct,label", "A, direct, relative"],
    ["CJNE @R0,#0x00,label", "indirect, immediate, relative"],
    ["CJNE R0,#0x00,label", "register, immediate, relative"],
  ],
  CLR: unaryForms("CLR", ["A", "C", "bit"]),
  CPL: unaryForms("CPL", ["A", "C", "bit"]),
  DA: [["DA A", "accumulator"]],
  DEC: unaryForms("DEC", ["A", "direct", "@R0", "R0"]),
  DIV: [["DIV AB", "A divided by B"]],
  DJNZ: [
    ["DJNZ R0,label", "register, relative"],
    ["DJNZ direct,label", "direct, relative"],
  ],
  INC: unaryForms("INC", ["A", "direct", "@R0", "R0", "DPTR"]),
  JB: [["JB bit,label", "bit set, relative"]],
  JBC: [["JBC bit,label", "bit set then clear, relative"]],
  JC: [["JC label", "carry set, relative"]],
  JMP: [
    ["JMP @A+DPTR", "indexed indirect code address"],
    ["JMP label", "assembler long-jump compatibility form"],
  ],
  JNB: [["JNB bit,label", "bit clear, relative"]],
  JNC: [["JNC label", "carry clear, relative"]],
  JNZ: [["JNZ label", "A is not zero, relative"]],
  JZ: [["JZ label", "A is zero, relative"]],
  LCALL: [["LCALL label", "16-bit code address"]],
  LJMP: [["LJMP label", "16-bit code address"]],
  MOV: [
    ["MOV A,#0x00", "A, immediate"],
    ["MOV A,direct", "A, direct"],
    ["MOV A,@R0", "A, indirect"],
    ["MOV A,R0", "A, register"],
    ["MOV direct,A", "direct, A"],
    ["MOV direct,#0x00", "direct, immediate"],
    ["MOV direct,direct", "direct, direct"],
    ["MOV direct,@R0", "direct, indirect"],
    ["MOV direct,R0", "direct, register"],
    ["MOV @R0,A", "indirect, A"],
    ["MOV @R0,#0x00", "indirect, immediate"],
    ["MOV @R0,direct", "indirect, direct"],
    ["MOV R0,A", "register, A"],
    ["MOV R0,#0x00", "register, immediate"],
    ["MOV R0,direct", "register, direct"],
    ["MOV DPTR,#0x0000", "DPTR, 16-bit immediate"],
    ["MOV C,bit", "carry, bit"],
    ["MOV bit,C", "bit, carry"],
  ],
  MOVC: [
    ["MOVC A,@A+DPTR", "code byte indexed by A and DPTR"],
    ["MOVC A,@A+PC", "code byte indexed by A and PC"],
  ],
  MOVX: [
    ["MOVX A,@DPTR", "A from external data via DPTR"],
    ["MOVX A,@R0", "A from external data via R0/R1"],
    ["MOVX @DPTR,A", "external data via DPTR from A"],
    ["MOVX @R0,A", "external data via R0/R1 from A"],
  ],
  MUL: [["MUL AB", "unsigned A by B"]],
  NOP: [["NOP", "no operation"]],
  ORL: logicalForms("ORL", true),
  POP: [["POP direct", "direct byte from stack"]],
  PUSH: [["PUSH direct", "direct byte onto stack"]],
  RET: [["RET", "return from subroutine"]],
  RETI: [["RETI", "return from interrupt"]],
  RL: [["RL A", "rotate A left"]],
  RLC: [["RLC A", "rotate A left through carry"]],
  RR: [["RR A", "rotate A right"]],
  RRC: [["RRC A", "rotate A right through carry"]],
  SETB: unaryForms("SETB", ["C", "bit"]),
  SJMP: [["SJMP label", "8-bit relative code address"]],
  SUBB: arithmeticForms("SUBB"),
  SWAP: [["SWAP A", "swap nibbles in A"]],
  XCH: [
    ["XCH A,direct", "A, direct"],
    ["XCH A,@R0", "A, indirect"],
    ["XCH A,R0", "A, register"],
  ],
  XCHD: [["XCHD A,@R0", "low nibbles of A and indirect RAM"]],
  XRL: logicalForms("XRL", false),
};

function arithmeticForms(mnemonic: string): AsmForm[] {
  return [
    [`${mnemonic} A,#0x00`, "A, immediate"],
    [`${mnemonic} A,direct`, "A, direct"],
    [`${mnemonic} A,@R0`, "A, indirect"],
    [`${mnemonic} A,R0`, "A, register"],
  ];
}

function logicalForms(mnemonic: string, carryForms: boolean): AsmForm[] {
  const forms: AsmForm[] = [
    [`${mnemonic} A,#0x00`, "A, immediate"],
    [`${mnemonic} A,direct`, "A, direct"],
    [`${mnemonic} A,@R0`, "A, indirect"],
    [`${mnemonic} A,R0`, "A, register"],
    [`${mnemonic} direct,A`, "direct, A"],
    [`${mnemonic} direct,#0x00`, "direct, immediate"],
  ];
  if (carryForms) {
    forms.push(
      [`${mnemonic} C,bit`, "carry, bit"],
      [`${mnemonic} C,/bit`, "carry, complemented bit"],
    );
  }
  return forms;
}

function unaryForms(mnemonic: string, operands: readonly string[]): AsmForm[] {
  return operands.map((operand) => [`${mnemonic} ${operand}`, `${operand} addressing`]);
}

export const ASM_MNEMONICS: ReadonlySet<string> = new Set(
  Object.keys(ASM_FORMS).map((name) => name.toLowerCase()),
);

type DirectiveSpec = readonly [template: string, description: string, searchTerms?: readonly string[]];

const ASM_DIRECTIVE_SPECS: readonly DirectiveSpec[] = [
  ["ORG 0x0000", "Set the code location counter"],
  ["END", "End the assembly source"],
  ["NAME EQU 0x00", "Define a constant"],
  ["NAME SET 0x00", "Define or redefine a numeric constant"],
  ["NAME DATA 0x20", "Define a direct-data address"],
  ["FLAG BIT 0x00", "Define a bit address"],
  ["SBIT FLAG = P1.0", "Define a named SFR bit"],
  ["SFR PORT = 0x80", "Define a named SFR"],
  ["SFR16 TIMER2 = 0xCC", "Define a named 16-bit SFR from its low-byte address"],
  ["DB 0x00", "Emit byte data"],
  ["DB 4 DUP(0)", "Emit a repeated byte value", ["dup", "repeat"]],
  ["DW 0x0000", "Emit 16-bit data, high byte first"],
  ["DW 2 DUP(0)", "Emit a repeated 16-bit value, high byte first", ["dup", "repeat"]],
  ["DS count", "Reserve zero-filled bytes"],
  ["BYTE 0x00", "DB-compatible byte data"],
  ["DEFB 0x00", "DB-compatible byte data"],
  ["WORD 0x0000", "DW-compatible word data"],
  ["DEFW 0x0000", "DW-compatible word data"],
  ["RESB count", "DS-compatible byte reservation", ["reserve"]],
  ["DEFS count", "DS-compatible byte reservation", ["reserve"]],
  ["NAME MACRO param1,param2\n    \nENDM", "Define a parameterized assembler macro", ["macro", "parameters"]],
  ["ENDM", "End an assembler macro definition"],
  ["LOCAL .loop", "Declare macro-local symbols", ["macro", "local"]],
  ["EXITM", "Stop the current macro expansion", ["macro", "exit"]],
  ["IF expression\n    \nENDIF", "Conditionally assemble a block", ["conditional"]],
  ["IFDEF symbol\n    \nENDIF", "Assemble a block when a symbol is defined", ["conditional", "defined"]],
  ["IFNDEF symbol\n    \nENDIF", "Assemble a block when a symbol is not defined", ["conditional", "defined"]],
  ["ELIF expression", "Continue a conditional assembly chain", ["conditional", "elseif"]],
  ["ELSE", "Fallback conditional assembly branch", ["conditional"]],
  ["ENDIF", "End a conditional assembly block", ["conditional"]],
  ["REPT count\n    \nENDR", "Repeat an assembly block", ["repeat"]],
  ["ENDR", "End a repeated assembly block", ["repeat"]],
  ["ALIGN 4", "Align the location counter to a positive boundary"],
  ["EVEN", "Align the location counter to an even address", ["align"]],
  ["USING 0", "Select register bank 0..3"],
  ["PUBLIC symbol", "Declare a public symbol"],
  ["NAME module", "Set the module name"],
  ["INCLUDE ADUC841.INC", "Include an assembler header", ["$include"]],
  ["$INCLUDE (ADUC841.INC)", "Keil-style include directive", ["include"]],
  ["$MOD841", "Select the ADuC841 register model", ["$mod"]],
  [".MODULE module", "ASxxxx module directive"],
  [".END", "ASxxxx end directive"],
];

const ASM_SYNTAX_COMPLETIONS: readonly CodeCompletion[] = [
  {
    mode: "asm",
    trigger: ".local",
    label: ".loop:",
    description: "Scoped label under the preceding non-dot label",
    insertText: ".loop:",
    category: "ASM syntax",
    searchTerms: ["local", "label", "scoped", "dot label"],
    priority: 12,
  },
];

export const ASM_DIRECTIVES: ReadonlySet<string> = new Set(
  ASM_DIRECTIVE_SPECS.flatMap(([template, , terms]) => [directiveName(template), ...(terms ?? [])])
    .map((name) => name.toLowerCase()),
);

const CORE_ASM_SYMBOLS = [
  "a", "acc", "ab", "b", "c", "dptr", "dpl", "dph", "sp", "psw",
  "r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "@r0", "@r1",
] as const;

export const C_KEYWORDS: ReadonlySet<string> = new Set(`
  auto break case continue default do else enum extern for goto if register return sizeof static
  struct switch typedef union volatile while interrupt using reentrant priority task _task alien
`.trim().split(/\s+/));

export const C_TYPE_NAMES: ReadonlySet<string> = new Set(`
  void char short int long float double signed unsigned bit sbit sfr sfr16 __sfr __sbit __sfr16
  uint8_t uint16_t uint32_t int8_t int16_t int32_t bool
`.trim().split(/\s+/));

export const C_MEMORY_QUALIFIERS: ReadonlySet<string> = new Set(`
  const data idata bdata xdata pdata far code compact small large
  __data __idata __bdata __xdata __pdata __code
`.trim().split(/\s+/));

export const C_BUILTINS: ReadonlySet<string> = new Set([
  "_nop_", "_crol_", "_cror_", "_irol_", "_iror_", "_testbit_", "delay",
]);

const CONTROL_SNIPPETS: readonly CodeCompletion[] = [
  cSnippet("if", "if statement", "if (condition) {\n    \n}"),
  cSnippet("ifelse", "if / else statement", "if (condition) {\n    \n} else {\n    \n}", ["else"]),
  cSnippet("switch", "switch statement", "switch (value) {\ncase 0:\n    break;\ndefault:\n    break;\n}"),
  cSnippet("for", "for loop", "for (i = 0; i < count; i++) {\n    \n}"),
  cSnippet("for declaration", "C99 for loop with a block-scoped counter", "for (unsigned char i = 0; i < count; i++) {\n    \n}", ["for", "c99", "counter"], "C snippet", "C99 for declaration"),
  cSnippet("while", "while loop", "while (condition) {\n    \n}"),
  cSnippet("do", "do / while loop", "do {\n    \n} while (condition);", ["dowhile"]),
  cSnippet("main", "C51 entry function", "void main(void)\n{\n    \n}"),
  cSnippet("function", "Function definition", "void function(void)\n{\n    \n}", ["void"]),
  cSnippet("prototype", "Function prototype", "void function(void);"),
  cSnippet("struct", "Structure declaration with 8-bit and 16-bit fields", "struct Name {\n    unsigned char status;\n    unsigned int value;\n};", ["layout", "member", "little endian"], "C structure", "struct Name { ... }"),
  cSnippet("xdata struct object", "Allocate one structure object in ADuC841 XDATA and access it through MOVX", "struct Name xdata object;", ["struct", "external", "xram", "movx"], "C structure", "struct Name xdata object;"),
  cSnippet("xdata struct array", "Allocate an array of structures in ADuC841 XDATA", "struct Name xdata objects[4];", ["struct", "external", "array", "movx"], "C structure", "struct Name xdata objects[4];"),
  cSnippet("xdata struct pointer", "Declare a typed XDATA structure pointer initialized with an object address", "struct Name xdata *pointer = &object;", ["struct", "pointer", "external", "dptr", "movx"], "C structure", "struct Name xdata *pointer = &object;"),
  cSnippet("struct pointer member", "Access a structure field through a typed pointer", "pointer->field;", ["struct", "pointer", "arrow", "member"], "C structure", "pointer->field;"),
  cSnippet("struct array member", "Access a field in an array of structures", "objects[index].field;", ["struct", "array", "index", "member"], "C structure", "objects[index].field;"),
  cSnippet("sizeof struct", "Get the packed byte size of a structure layout", "sizeof(struct Name);", ["struct", "size", "layout"], "C structure", "sizeof(struct Name);"),
  cSnippet("typedef", "Scalar type alias", "typedef unsigned char byte;", ["alias", "scalar"], "C snippet", "scalar typedef"),
  cSnippet("typedef chained", "Alias an existing typedef name", "typedef byte counter_t;", ["alias", "chain"], "C snippet", "chained typedef"),
  cSnippet("typedef struct", "Alias a tagged structure", "typedef struct Device Device;", ["alias", "tagged"], "C snippet", "tagged struct typedef"),
  cSnippet("array", "Internal RAM array", "unsigned char values[8];"),
  cSnippet("xdata scalar", "8-bit object allocated in ADuC841 external data memory", "unsigned char xdata value;", ["external", "xram", "movx", "scalar"]),
  cSnippet("xdata word scalar", "16-bit little-endian object allocated in external data memory", "unsigned int xdata value;", ["external", "xram", "movx", "uint16"]),
  cSnippet("xdata array", "8-bit array allocated in ADuC841 external data memory", "unsigned char xdata values[16];", ["external", "xram", "movx", "array"]),
  cSnippet("xdata word array", "16-bit little-endian array allocated in external data memory", "unsigned int xdata values[8];", ["external", "xram", "movx", "array", "uint16"]),
  cSnippet("codetable", "Constant code-memory table", "const unsigned char code table[] = {0x00};", ["array", "table"]),
  cSnippet("codewordtable", "16-bit little-endian code-memory table", "const unsigned int code table[] = {0x1234, 0x5678};", ["array", "table", "uint16", "movc"]),
  cSnippet("pointer", "Internal RAM pointer", "unsigned char data *ptr;"),
  cSnippet("xdata pointer", "16-bit external RAM pointer lowered with MOVX", "unsigned char xdata *ptr = 0x0000;", ["pointer", "external", "movx", "dptr"]),
  cSnippet("xdata word pointer", "16-bit value pointer in external RAM", "unsigned int xdata *ptr = 0x0000;", ["pointer", "external", "uint16", "movx"]),
  cSnippet("code pointer", "Read-only pointer lowered with MOVC", "const unsigned char code *ptr = table;", ["pointer", "flash", "movc", "dptr"]),
  cSnippet("pointer arithmetic", "Typed pointer step scaled by the pointee size", "ptr = ptr + 1;", ["pointer", "increment", "sizeof", "stride"]),
  cSnippet("sbit", "C51 bit declaration", "sbit FLAG = P1^0;"),
  cSnippet("sfr", "C51 SFR declaration", "sfr PORT = 0x80;"),
  cSnippet("sfr16", "C51 16-bit SFR declaration", "sfr16 TIMER2 = 0xCC;", ["timer2", "declaration"], "C declaration"),
  cSnippet("nop", "Single-cycle intrinsic", "_nop_();", ["_nop_", "intrinsic"]),
  cSnippet("crol", "Rotate an unsigned char left", "value = _crol_(value, 1);", ["_crol_", "intrinsic"]),
  cSnippet("cror", "Rotate an unsigned char right", "value = _cror_(value, 1);", ["_cror_", "intrinsic"]),
  cSnippet("irol", "Rotate an unsigned int left", "value = _irol_(value, 1);", ["_irol_", "intrinsic"]),
  cSnippet("iror", "Rotate an unsigned int right", "value = _iror_(value, 1);", ["_iror_", "intrinsic"]),
  cSnippet("testbit", "Test and clear a bit", "value = _testbit_(FLAG);", ["_testbit_", "intrinsic"]),
  cSnippet("adcresult", "Combine the 12-bit ADC result", "((ADCDATAH & 0x0F) << 8) | ADCDATAL", ["adc", "adcdata"]),
];

const PREPROCESSOR_COMPLETIONS: readonly CodeCompletion[] = [
  cSnippet("#include aduc841.h", "Built-in ADuC841 register header", "#include <ADUC841.H>", ["include", "aduc841"]),
  cSnippet("#include intrins.h", "Built-in C51 intrinsic header", "#include <intrins.h>", ["include", "intrins"]),
  cSnippet("#include stdint.h", "Built-in fixed-width integer types", "#include <stdint.h>", ["include", "uint8_t", "uint16_t"]),
  cSnippet("#include stdbool.h", "Built-in bool, true and false", "#include <stdbool.h>", ["include", "bool"]),
  cSnippet("#define", "Object-like macro", "#define NAME value", ["define", "macro"]),
  cSnippet("#define function", "Function-like macro", "#define NAME(value) ((value) + 1)", ["define", "macro", "function"]),
  cSnippet("#define multiline", "Continued function-like macro", "#define NAME(value) \\\n    ((value) + 1)", ["define", "macro", "continuation", "multiline"], "Preprocessor", "multiline #define"),
  cSnippet("#undef", "Remove a macro definition", "#undef NAME", ["undef", "macro"]),
  cSnippet("#ifdef", "Conditional block for a defined macro", "#ifdef FEATURE\n\n#endif", ["ifdef", "defined"], "Preprocessor", "#ifdef block"),
  cSnippet("#ifndef", "Conditional block for an undefined macro", "#ifndef FEATURE\n\n#endif", ["ifndef", "defined"], "Preprocessor", "#ifndef block"),
  cSnippet("#if defined", "Conditional expression block", "#if defined(FEATURE)\n\n#endif", ["if", "defined"]),
  cSnippet("#elif", "Alternative preprocessor branch", "#elif CONDITION", ["elif"]),
  cSnippet("#else", "Fallback preprocessor branch", "#else", ["else"]),
  cSnippet("#endif", "End a conditional block", "#endif", ["endif"]),
  cSnippet("#pragma", "Compiler pragma", "#pragma NAME", ["pragma"]),
  cSnippet("#warning", "Emit a compiler warning", "#warning message", ["warning"]),
  cSnippet("#error", "Emit a compiler error", "#error message", ["error"]),
];

type HardwareSpec = readonly [
  mode: CodeMode,
  trigger: string,
  label: string,
  description: string,
  insertText: string,
  searchTerms: readonly string[],
];

const HARDWARE_SPECS: readonly HardwareSpec[] = [
  [
    "c", "buswrite", "ST841 bus write (C)", "Write value to latch address; uses WR, P0 and P2",
    "WR = 1;\nP0 = value;\nP2 = (P2 & 0xF0) | (address & 0x0F);\nP2 &= 0xF0;",
    ["bus", "write", "latch", "wr", "p0", "p2"],
  ],
  [
    "asm", "buswrite", "ST841 bus write (ASM)", "A holds value and R7 holds latch address",
    "SETB WR\nMOV P0,A\nMOV A,P2\nANL A,#0xF0\nORL A,R7\nMOV P2,A\nANL P2,#0xF0",
    ["bus", "write", "latch", "wr", "p0", "p2"],
  ],
  [
    "c", "busread", "ST841 bus read (C)", "Read addressed input through P0",
    "P0 = 0xFF;\nP2 = (P2 & 0xF0) | (address & 0x0F);\nWR = 0;\nvalue = P0;\nWR = 1;\nP2 &= 0xF0;",
    ["bus", "read", "input", "wr", "p0", "p2"],
  ],
  [
    "asm", "busread", "ST841 bus read (ASM)", "R7 holds input address; result is returned in A",
    "MOV P0,#0xFF\nMOV A,P2\nANL A,#0xF0\nORL A,R7\nMOV P2,A\nCLR WR\nNOP\nMOV A,P0",
    ["bus", "read", "input", "wr", "p0", "p2"],
  ],
  [
    "c", "adcread", "read 12-bit ADC value (C)", "Start an ADuC841 ADC conversion and combine both data registers",
    "ADCCON1 = 0xAC;\nADCCON2 = channel & 0x0F;\nADCI = 0;\nSCONV = 1;\nwhile (!ADCI) { }\nresult = ((unsigned int)(ADCDATAH & 0x0F) << 8) | ADCDATAL;",
    ["adc", "conversion", "adccon", "adcdata", "sconv"],
  ],
  [
    "asm", "adcread", "read 12-bit ADC value (ASM)", "R7 selects channel; result is A high nibble and B low byte",
    "MOV ADCCON1,#0xAC\nMOV ADCCON2,R7\nCLR ADCI\nSETB SCONV\nWAIT_ADC: JNB ADCI,WAIT_ADC\nMOV B,ADCDATAL\nMOV A,ADCDATAH\nANL A,#0x0F",
    ["adc", "conversion", "adccon", "adcdata", "sconv"],
  ],
  [
    "c", "uartinit", "initialize UART mode 1 (C)", "Use timer 1 as the UART baud-rate generator",
    "SCON = 0x50;\nTMOD = (TMOD & 0x0F) | 0x20;\nTH1 = 0xFD;\nTR1 = 1;",
    ["uart", "serial", "scon", "baud", "timer1"],
  ],
  [
    "asm", "uartinit", "initialize UART mode 1 (ASM)", "Use timer 1 as the UART baud-rate generator",
    "MOV SCON,#0x50\nANL TMOD,#0x0F\nORL TMOD,#0x20\nMOV TH1,#0xFD\nSETB TR1",
    ["uart", "serial", "scon", "baud", "timer1"],
  ],
  [
    "c", "uartsend", "send one UART byte (C)", "Blocking transmit through SBUF and TI",
    "TI = 0;\nSBUF = value;\nwhile (!TI) { }\nTI = 0;",
    ["uart", "serial", "send", "transmit", "sbuf", "ti"],
  ],
  [
    "asm", "uartsend", "send one UART byte (ASM)", "A holds the byte; wait for the TI flag",
    "CLR TI\nMOV SBUF,A\nWAIT_TI: JNB TI,WAIT_TI\nCLR TI",
    ["uart", "serial", "send", "transmit", "sbuf", "ti"],
  ],
  [
    "c", "timer0init", "configure timer 0 mode 1 (C)", "Small ADuC841 timer-register setup",
    "TMOD = (TMOD & 0xF0) | 0x01;\nTH0 = 0xFC;\nTL0 = 0x18;\nET0 = 1;\nEA = 1;\nTR0 = 1;",
    ["timer", "timer0", "tmod", "th0", "tl0"],
  ],
  [
    "asm", "timer0init", "configure timer 0 mode 1 (ASM)", "Small ADuC841 timer-register setup",
    "ANL TMOD,#0xF0\nORL TMOD,#0x01\nMOV TH0,#0xFC\nMOV TL0,#0x18\nSETB ET0\nSETB EA\nSETB TR0",
    ["timer", "timer0", "tmod", "th0", "tl0"],
  ],
  [
    "c", "dac0write", "write 12-bit value to DAC0", "Split a right-aligned value across canonical DAC registers",
    "DACCON = 0x11;\nDAC0H = (value >> 8) & 0x0F;\nDAC0L = (unsigned char)value;",
    ["dac", "analog", "dac0", "daccon"],
  ],
  [
    "asm", "dac0write", "write DAC0 registers (ASM)", "A holds the high nibble and B holds the low byte",
    "MOV DACCON,#0x11\nMOV DAC0H,A\nMOV DAC0L,B",
    ["dac", "analog", "dac0", "daccon"],
  ],
  [
    "c", "pwm0write", "write PWM0 value (C)", "Write a 16-bit value to canonical PWM0 registers",
    "PWM0L = (unsigned char)value;\nPWM0H = (unsigned char)(value >> 8);",
    ["pwm", "pulse", "pwm0", "motor"],
  ],
  [
    "asm", "pwm0write", "write PWM0 registers (ASM)", "A holds the high byte and B holds the low byte",
    "MOV PWM0L,B\nMOV PWM0H,A",
    ["pwm", "pulse", "pwm0", "motor"],
  ],
];

const HARDWARE_COMPLETIONS: readonly CodeCompletion[] = HARDWARE_SPECS.map(
  ([mode, trigger, label, description, insertText, searchTerms]) => ({
    mode,
    trigger,
    label,
    description,
    insertText,
    category: "ST841 template",
    searchTerms,
    priority: 10,
  }),
);

type OperatorSpec = readonly [symbol: string, description: string, searchTerms: readonly string[]];

const C_OPERATOR_SPECS: readonly OperatorSpec[] = [
  ["+", "Addition or unary plus", ["operator", "add", "plus"]],
  ["-", "Subtraction or unary minus", ["operator", "subtract", "minus"]],
  ["*", "Multiplication or pointer dereference", ["operator", "multiply", "dereference"]],
  ["/", "Division", ["operator", "divide"]],
  ["%", "Remainder", ["operator", "modulo", "remainder"]],
  ["++", "Increment", ["operator", "increment"]],
  ["--", "Decrement", ["operator", "decrement"]],
  ["==", "Equal comparison", ["operator", "equal", "comparison"]],
  ["!=", "Not-equal comparison", ["operator", "not equal", "comparison"]],
  ["<", "Less-than comparison", ["operator", "less", "comparison"]],
  ["<=", "Less-than-or-equal comparison", ["operator", "less equal", "comparison"]],
  [">", "Greater-than comparison", ["operator", "greater", "comparison"]],
  [">=", "Greater-than-or-equal comparison", ["operator", "greater equal", "comparison"]],
  ["&&", "Logical AND", ["operator", "logical and"]],
  ["||", "Logical OR", ["operator", "logical or"]],
  ["!", "Logical NOT", ["operator", "logical not"]],
  ["&", "Bitwise AND or address-of", ["operator", "bitwise and", "address"]],
  ["|", "Bitwise OR", ["operator", "bitwise or"]],
  ["^", "Bitwise XOR", ["operator", "bitwise xor"]],
  ["~", "Bitwise complement", ["operator", "bitwise not", "complement"]],
  ["<<", "Left shift", ["operator", "shift left"]],
  [">>", "Right shift", ["operator", "shift right"]],
  ["=", "Assignment", ["operator", "assign"]],
  ["+=", "Addition assignment", ["operator", "add assign"]],
  ["-=", "Subtraction assignment", ["operator", "subtract assign"]],
  ["*=", "Multiplication assignment", ["operator", "multiply assign"]],
  ["/=", "Division assignment", ["operator", "divide assign"]],
  ["%=", "Remainder assignment", ["operator", "modulo assign"]],
  ["&=", "Bitwise-AND assignment", ["operator", "and assign"]],
  ["|=", "Bitwise-OR assignment", ["operator", "or assign"]],
  ["^=", "Bitwise-XOR assignment", ["operator", "xor assign"]],
  ["<<=", "Left-shift assignment", ["operator", "shift left assign"]],
  [">>=", "Right-shift assignment", ["operator", "shift right assign"]],
  ["condition ? yes : no", "Conditional expression", ["operator", "conditional", "ternary"]],
  [".", "Structure member", ["operator", "member", "dot"]],
  ["->", "Pointer member", ["operator", "pointer member", "arrow"]],
  ["[index]", "Array subscript", ["operator", "array", "subscript", "index"]],
];

function cSnippet(
  trigger: string,
  description: string,
  insertText: string,
  searchTerms: readonly string[] = [],
  category = trigger.startsWith("#") ? "Preprocessor" : "C snippet",
  label = insertText.split("\n", 1)[0],
): CodeCompletion {
  return {
    mode: "c",
    trigger,
    label,
    description,
    insertText,
    category,
    searchTerms,
    priority: 5,
  };
}

function directiveName(template: string): string {
  const words = template.trim().split(/\s+/);
  return /^(?:NAME|FLAG)$/i.test(words[0]) ? words[1] : words[0];
}

function buildAsmCompletions(): CodeCompletion[] {
  const instructions = Object.entries(ASM_FORMS).flatMap(([mnemonic, forms]) =>
    forms.map(([template, addressing]) => ({
      mode: "asm" as const,
      trigger: mnemonic,
      label: template,
      description: `MCS-51 ${addressing}`,
      insertText: template,
      category: "Instruction",
      searchTerms: [mnemonic, addressing, template.replace(/[^A-Za-z0-9]+/g, " ")],
      priority: 20,
    })),
  );
  const directives = ASM_DIRECTIVE_SPECS.map(([template, description, terms]) => ({
    mode: "asm" as const,
    trigger: directiveName(template),
    label: template,
    description,
    insertText: template,
    category: "Directive",
    searchTerms: terms,
    priority: 15,
  }));
  const registers = CORE_ASM_SYMBOLS.map((name) => ({
    mode: "asm" as const,
    trigger: name,
    label: name.toUpperCase(),
    description: "MCS-51 register or addressing symbol",
    insertText: name.toUpperCase(),
    category: "Register",
    priority: 30,
  }));
  return [...instructions, ...directives, ...ASM_SYNTAX_COMPLETIONS, ...registers];
}

function buildCCompletions(): CodeCompletion[] {
  const words = new Set([...C_KEYWORDS, ...C_TYPE_NAMES, ...C_MEMORY_QUALIFIERS]);
  const keywordItems = Array.from(words, (word): CodeCompletion => ({
    mode: "c",
    trigger: word,
    label: word,
    description: C_TYPE_NAMES.has(word)
      ? "C/C51 type"
      : C_MEMORY_QUALIFIERS.has(word)
        ? "C51 memory or type qualifier"
        : "C/C51 keyword",
    insertText: word,
    category: C_TYPE_NAMES.has(word)
      ? "C type"
      : C_MEMORY_QUALIFIERS.has(word)
        ? "Memory qualifier"
        : "C keyword",
    priority: 35,
  }));
  const operators = C_OPERATOR_SPECS.map(([symbol, description, searchTerms]): CodeCompletion => ({
    mode: "c",
    trigger: searchTerms.join(" "),
    label: symbol,
    description,
    insertText: symbol,
    category: "Operator",
    searchTerms,
    priority: 45,
  }));
  return [...CONTROL_SNIPPETS, ...PREPROCESSOR_COMPLETIONS, ...keywordItems, ...operators];
}

function buildAduc841Completions(): CodeCompletion[] {
  const sfrs = Object.entries(ADUC841_SFR).map(([name, address]): CodeCompletion => ({
    mode: "both",
    trigger: name,
    label: name.toUpperCase(),
    description: `ADuC841 SFR at ${hex8(address)}`,
    insertText: name.toUpperCase(),
    category: "ADuC841 SFR",
    searchTerms: ["sfr", `0x${address.toString(16)}`],
    priority: 25,
  }));

  const bits = Object.entries(ADUC841_BITS).flatMap(([name, address]): CodeCompletion[] => {
    const canonical = name.toUpperCase();
    const numbered = /^(p[0-3]|acc|b)_([0-7])$/i.exec(name);
    const common = {
      trigger: name,
      description: `ADuC841 bit at ${hex8(address)}`,
      searchTerms: ["bit", `0x${address.toString(16)}`],
      priority: 27,
    } as const;
    if (!numbered) {
      return [{ mode: "both", label: canonical, insertText: canonical, category: "ADuC841 bit", ...common }];
    }
    const asmName = `${numbered[1].toUpperCase()}.${numbered[2]}`;
    return [
      { mode: "asm", label: asmName, insertText: asmName, category: "ADuC841 bit", ...common },
      { mode: "c", label: canonical, insertText: canonical, category: "ADuC841 bit", ...common },
    ];
  });
  return [...sfrs, ...bits];
}

function buildInterruptCompletions(): CodeCompletion[] {
  return ADUC841_INTERRUPTS.map(({ number, vector, source, description }): CodeCompletion => ({
    mode: "c",
    trigger: `interrupt ${number} ${source}`,
    label: `interrupt ${number} · ${description}`,
    description: `${source}, vector ${hex16(vector)}`,
    insertText: `void isr${number}(void) interrupt ${number}\n{\n    \n}`,
    category: "Interrupt",
    searchTerms: ["isr", `isr${number}`, source, description],
    priority: 8,
  }));
}

/**
 * Compact generated catalog. It intentionally contains language constructs and
 * short statement/declaration templates only, never complete lab programs.
 */
export const CODE_COMPLETIONS: readonly CodeCompletion[] = Object.freeze([
  ...buildAsmCompletions(),
  ...buildCCompletions(),
  ...HARDWARE_COMPLETIONS,
  ...buildAduc841Completions(),
  ...buildInterruptCompletions(),
]);

const ADUC841_SFR_NAMES = Object.keys(ADUC841_SFR);
const ADUC841_BIT_NAMES = Object.keys(ADUC841_BITS);
const ASM_NUMBERED_BIT_NAMES = ADUC841_BIT_NAMES.flatMap((name) => {
  const match = /^(p[0-3]|acc|b)_([0-7])$/i.exec(name);
  return match ? [`${match[1]}.${match[2]}`] : [];
});

export const ASM_HIGHLIGHT_SYMBOLS: ReadonlySet<string> = new Set([
  ...CORE_ASM_SYMBOLS.map((name) => name.replace(/^@/, "")),
  ...ADUC841_SFR_NAMES,
  ...ADUC841_BIT_NAMES,
  ...ASM_NUMBERED_BIT_NAMES,
]);

export const C_HIGHLIGHT_SYMBOLS: ReadonlySet<string> = new Set([
  ...ADUC841_SFR_NAMES,
  ...ADUC841_BIT_NAMES,
]);

export function getCompletionContext(
  source: string,
  cursor: number,
  mode: CodeMode,
): CompletionContext | null {
  const replaceEnd = Math.max(0, Math.min(source.length, cursor));
  const before = source.slice(0, replaceEnd);

  if (mode === "c") {
    const lineStart = before.lastIndexOf("\n") + 1;
    const lineBefore = before.slice(lineStart);
    const hashOffset = lineBefore.indexOf("#");
    const partialDirective = /^\s*#\s*[A-Za-z_]*$/.test(lineBefore);
    const partialInclude = /^\s*#\s*include(?:\s*[<"][^>"]*)?$/i.test(lineBefore);
    if (hashOffset >= 0 && (partialDirective || partialInclude)) {
      const replaceStart = lineStart + hashOffset;
      const prefix = source.slice(replaceStart, replaceEnd);
      const query = normalizeSearch(prefix.replace(/^#\s*/, ""));
      return { prefix, query, replaceStart, replaceEnd, directive: true };
    }
  }

  const pattern = mode === "asm"
    ? /[A-Za-z_.$?][A-Za-z0-9_.$?]*$/
    : /[A-Za-z_][A-Za-z0-9_]*$/;
  const match = pattern.exec(before);
  if (!match) return null;
  const prefix = match[0];
  return {
    prefix,
    query: normalizeSearch(prefix),
    replaceStart: replaceEnd - prefix.length,
    replaceEnd,
    directive: false,
  };
}

export function getCodeCompletions(
  source: string,
  mode: CodeMode,
  cursor: number,
  limit?: number,
): CompletionResult | null;
export function getCodeCompletions(
  mode: CodeMode,
  source: string,
  prefix: string,
  limit?: number,
): CodeCompletion[];
export function getCodeCompletions(
  first: string,
  second: string,
  third: number | string,
  limit = 120,
): CompletionResult | CodeCompletion[] | null {
  // Prefix-only overload retained for compiler scripts and non-editor callers.
  if (typeof third === "string") {
    return rankCompletions(second, first as CodeMode, third, limit);
  }
  return getCodeCompletionResult(first, second as CodeMode, third, limit);
}

export function getCodeCompletionResult(
  source: string,
  mode: CodeMode,
  cursor: number,
  limit = 120,
): CompletionResult | null {
  const context = getCompletionContext(source, cursor, mode);
  if (!context || (!context.directive && context.query.length < 2) || !context.query) return null;

  return { ...context, matches: rankCompletions(source, mode, context.query, limit) };
}

function rankCompletions(source: string, mode: CodeMode, query: string, limit: number): CodeCompletion[] {
  const candidates = [...CODE_COMPLETIONS, ...collectDynamicCompletions(source, mode)];
  const ranked = candidates
    .filter((item) => item.mode === mode || item.mode === "both")
    .map((item, order) => ({ item, order, score: completionScore(item, query) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) =>
      left.score - right.score ||
      Number(Boolean(right.item.dynamic)) - Number(Boolean(left.item.dynamic)) ||
      left.item.label.length - right.item.label.length ||
      left.item.label.localeCompare(right.item.label) ||
      left.order - right.order,
    );

  const seen = new Set<string>();
  const matches: CodeCompletion[] = [];
  for (const { item } of ranked) {
    const key = item.insertText.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(item);
    if (matches.length >= Math.max(1, limit)) break;
  }
  return matches;
}

export function collectDynamicCompletions(source: string, mode: CodeMode): CodeCompletion[] {
  return mode === "asm" ? collectAsmSymbols(source) : collectCSymbols(source);
}

function collectAsmSymbols(source: string): CodeCompletion[] {
  const symbols: CodeCompletion[] = [];
  let macroDepth = 0;
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/(?:;|\/\/).*$/, "");
    const macroDefinition = /^\s*([A-Za-z_.$?][\w.$?]*)\s+MACRO(?:\s+.*)?$/i.exec(line);
    if (macroDefinition) {
      if (macroDepth === 0) {
        symbols.push(dynamicSymbol("asm", macroDefinition[1], "Macro", index + 1));
      }
      macroDepth += 1;
      continue;
    }
    if (/^\s*ENDM\b/i.test(line)) {
      macroDepth = Math.max(0, macroDepth - 1);
      continue;
    }
    // Macro parameters, LOCAL declarations and body labels only exist during
    // expansion, so none of them belong in the file-global completion list.
    if (macroDepth > 0) continue;

    const label = /^\s*([A-Za-z_.$?][\w.$?]*)\s*:/.exec(line);
    if (label) {
      const kind = label[1].startsWith(".") ? "Scoped label" : "Label";
      symbols.push(dynamicSymbol("asm", label[1], kind, index + 1));
    }

    const equate = /^\s*([A-Za-z_.$?][\w.$?]*)\s+(EQU|SET|DATA|BIT)\b/i.exec(line);
    if (equate) symbols.push(dynamicSymbol("asm", equate[1], equate[2].toUpperCase(), index + 1));

    const declaration = /^\s*(SFR(?:16)?|SBIT)\s+([A-Za-z_.$?][\w.$?]*)\s*=/i.exec(line);
    if (declaration) {
      symbols.push(dynamicSymbol("asm", declaration[2], declaration[1].toUpperCase(), index + 1));
    }
    const postfixDeclaration = /^\s*([A-Za-z_.$?][\w.$?]*)\s+(SFR(?:16)?|SBIT)\b/i.exec(line);
    if (postfixDeclaration) {
      symbols.push(dynamicSymbol("asm", postfixDeclaration[1], postfixDeclaration[2].toUpperCase(), index + 1));
    }
  }
  return uniqueDynamic(symbols);
}

function collectCSymbols(source: string): CodeCompletion[] {
  const symbols: CodeCompletion[] = [];
  const clean = stripCCommentsAndStrings(source);

  for (const match of clean.matchAll(/^\s*#\s*define\s+([A-Za-z_]\w*)(\s*\(([^)]*)\))?/gm)) {
    const line = lineAt(clean, match.index ?? 0);
    const functionLike = Boolean(match[2]);
    symbols.push(dynamicSymbol("c", match[1], functionLike ? "Function-like macro" : "Macro", line, functionLike));
  }

  const typedefs = collectSupportedTypedefs(clean);
  for (const [name, line] of typedefs) {
    symbols.push(dynamicSymbol("c", name, "Type alias", line));
  }

  const qualifierPattern = String.raw`(?:const|volatile|static|extern|register|signed|unsigned|data|idata|bdata|xdata|pdata|code|far|reentrant|__data|__idata|__bdata|__xdata|__pdata|__code)`;
  const builtinTypePattern = String.raw`(?:void|char|short|int|long|float|double|bit|sbit|sfr|sfr16|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|bool|_Bool|struct\s+[A-Za-z_]\w*)`;
  const aliasPattern = [...typedefs.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const baseTypePattern = aliasPattern ? `(?:${builtinTypePattern}|${aliasPattern})` : builtinTypePattern;
  const typePrefix = `(?:${qualifierPattern}\\s+)*${baseTypePattern}`;
  const functionRe = new RegExp(`\\b${typePrefix}\\s*\\**\\s*([A-Za-z_]\\w*)\\s*\\(([^(){};]*)\\)\\s*(?:interrupt\\s+\\d+)?(?:\\s+using\\s+\\d+)?\\s*(?=[;{])`, "gi");
  for (const match of clean.matchAll(functionRe)) {
    const name = match[1];
    const line = lineAt(clean, match.index ?? 0);
    symbols.push(dynamicSymbol("c", name, "Function", line, true));
    for (const parameter of splitTopLevelCsv(match[2])) {
      const paramName = /(?:\*\s*)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*$/.exec(parameter.trim())?.[1];
      if (paramName && paramName.toLowerCase() !== "void") {
        symbols.push(dynamicSymbol("c", paramName, "Parameter", line));
      }
    }
  }

  const declarationRe = new RegExp(`(?:^|[;{}])\\s*${typePrefix}\\s+([^;(){}]+);`, "gim");
  for (const match of clean.matchAll(declarationRe)) {
    const line = lineAt(clean, match.index ?? 0);
    for (const declarator of splitTopLevelCsv(match[1])) {
      const name = declaratorName(declarator);
      if (name) symbols.push(dynamicSymbol("c", name, "Variable", line));
    }
  }

  const forDeclarationRe = new RegExp(`\\bfor\\s*\\(\\s*${typePrefix}\\s+([^;]+);`, "gi");
  for (const match of clean.matchAll(forDeclarationRe)) {
    const line = lineAt(clean, match.index ?? 0);
    for (const declarator of splitTopLevelCsv(match[1])) {
      const name = declaratorName(declarator);
      if (name) symbols.push(dynamicSymbol("c", name, "Loop variable", line));
    }
  }

  return uniqueDynamic(symbols);
}

function collectSupportedTypedefs(source: string): Map<string, number> {
  const candidates = [...source.matchAll(/\btypedef\s+([^;{}]+?)\s+([A-Za-z_]\w*)\s*;/gi)]
    .map((match) => ({
      specifier: match[1].replace(/\s+/g, " ").trim(),
      name: match[2],
      line: lineAt(source, match.index ?? 0),
    }));
  const aliases = new Map<string, number>();

  // Multiple passes resolve a bounded chain such as byte -> counter_t while
  // still rejecting pointer, array, function and anonymous aggregate aliases.
  for (let pass = 0; pass <= candidates.length; pass += 1) {
    let changed = false;
    for (const candidate of candidates) {
      if (aliases.has(candidate.name) || !isSupportedTypedefSpecifier(candidate.specifier, aliases)) continue;
      aliases.set(candidate.name, candidate.line);
      changed = true;
    }
    if (!changed) break;
  }
  return aliases;
}

function isSupportedTypedefSpecifier(specifier: string, aliases: ReadonlyMap<string, number>): boolean {
  if (/[*()[\]{}]/.test(specifier)) return false;
  if (/^struct\s+[A-Za-z_]\w*$/.test(specifier)) return true;

  const qualifiers = new Set([
    "const", "volatile", "static", "extern", "register", "signed", "unsigned",
    "data", "idata", "bdata", "xdata", "pdata", "code", "far", "reentrant",
    "__data", "__idata", "__bdata", "__xdata", "__pdata", "__code",
  ]);
  const builtinTypes = new Set([
    "void", "char", "short", "int", "long", "float", "double", "bit", "sbit",
    "sfr", "sfr16", "uint8_t", "uint16_t", "uint32_t", "int8_t", "int16_t",
    "int32_t", "bool", "_Bool",
  ]);
  let typeWords = 0;
  for (const word of specifier.split(/\s+/)) {
    if (qualifiers.has(word)) continue;
    if (builtinTypes.has(word) || aliases.has(word)) {
      typeWords += 1;
      continue;
    }
    return false;
  }
  return typeWords > 0;
}

function declaratorName(declarator: string): string | undefined {
  const withoutInitializer = declarator.split("=", 1)[0].trim();
  return /(?:\*\s*)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*$/.exec(withoutInitializer)?.[1];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dynamicSymbol(
  mode: CodeMode,
  name: string,
  kind: string,
  line: number,
  call = false,
): CodeCompletion {
  const insertText = call ? `${name}()` : name;
  return {
    mode,
    trigger: name,
    label: call ? `${name}()` : name,
    description: `${kind} declared on line ${line}`,
    insertText,
    category: `Current file ${kind.toLowerCase()}`,
    searchTerms: [kind],
    priority: -15,
    dynamic: true,
  };
}

function uniqueDynamic(items: CodeCompletion[]): CodeCompletion[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mode}:${item.trigger.toLowerCase()}:${item.insertText.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function completionScore(item: CodeCompletion, rawQuery: string): number {
  const query = normalizeSearch(rawQuery);
  const trigger = normalizeSearch(item.trigger);
  const label = normalizeSearch(item.label);
  const insertion = normalizeSearch(item.insertText.split("\n", 1)[0]);
  const terms = (item.searchTerms ?? []).map(normalizeSearch);
  const fields = [trigger, label, insertion, ...terms].filter(Boolean);
  const priority = item.priority ?? 30;

  if (trigger === query || label === query) return priority;
  if (trigger.startsWith(query)) return priority + 10;
  if (label.startsWith(query) || insertion.startsWith(query)) return priority + 12;
  if (terms.some((term) => term.startsWith(query))) return priority + 14;
  if (fields.some((field) => field.split(/\s+/).some((word) => word.startsWith(query)))) return priority + 22;
  if (fields.some((field) => field.includes(query))) return priority + 35;
  return Number.POSITIVE_INFINITY;
}

function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/^#\s*/, "")
    .replace(/[<>"'(),;:{}\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCCommentsAndStrings(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    (match) => match.replace(/[^\n]/g, " "),
  );
}

function splitTopLevelCsv(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      result.push(text.slice(start, index));
      start = index + 1;
    }
  }
  result.push(text.slice(start));
  return result.filter((item) => item.trim());
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor++) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}
