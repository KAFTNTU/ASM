import { ADUC841_BITS, ADUC841_SFR } from "../mcu/aduc841";

export type AsmDiagnostic = {
  level: "error" | "warning" | "hint";
  line?: number;
  message: string;
};

export type AsmCompileResult = {
  ok: boolean;
  hex: string;
  bytes: Uint8Array;
  pcToLine: Array<{ pc: number; line: number }>;
  diagnostics: AsmDiagnostic[];
};

type ParsedLine = {
  line: number;
  address: number;
  mnemonic: string;
  operands: string[];
  reservedSize?: number;
  fillByte?: number;
};

type OperandHint = "any" | "immediate" | "bit" | "address";

type ConstantDefinition = {
  expression: string;
  address: number;
};

type ConstantMap = Map<string, ConstantDefinition>;

type AsmSourceLine = {
  text: string;
  line: number;
  trace: string[];
};

type MacroDefinition = {
  name: string;
  parameters: string[];
  body: AsmSourceLine[];
  line: number;
};

const MAX_MACRO_DEPTH = 32;
const MAX_REPEAT_COUNT = 65_535;
const MAX_EXPANDED_LINES = 100_000;
const MAX_PREPROCESS_STEPS = 500_000;
const MAX_DATA_ITEMS = 65_536;

export function compileAsm(source: string): AsmCompileResult {
  const diagnostics: AsmDiagnostic[] = [];
  const lines = scopeLocalLabels(preprocessAsm(source, diagnostics), diagnostics);
  const labels = new Map<string, number>();
  const equ: ConstantMap = new Map();
  const userSymbols = new Map<string, { line: number; kind: string }>();
  const parsed: ParsedLine[] = [];
  let address = 0;

  const declareSymbol = (name: string, line: number, kind: string): boolean => {
    const lower = name.toLowerCase();
    const previous = userSymbols.get(lower);
    if (previous) {
      diagnostics.push({
        level: "error",
        line,
        message: `Duplicate symbol "${name}"; first defined as ${previous.kind} on line ${previous.line}.`,
      });
      return false;
    }
    userSymbols.set(lower, { line, kind });
    return true;
  };

  const declareConstant = (name: string, expression: string, line: number, kind: string) => {
    if (!declareSymbol(name, line, kind)) return;
    equ.set(name.toLowerCase(), { expression: expression.trim(), address });
  };

  for (let index = 0; index < lines.length; index++) {
    const lineNo = lines[index].line;
    let text = stripComment(lines[index].text).trim();
    // Compatibility with pasted snippets that accidentally start with "=".
    if (text.startsWith("=")) {
      text = text.slice(1).trim();
    }
    if (!text) continue;
    if (isEndDirective(text)) break;

    const equMatch = /^([A-Za-z_.$?][\w.$?]*)\s+equ\s+(.+)$/i.exec(text);
    if (equMatch) {
      declareConstant(equMatch[1], equMatch[2], lineNo, "EQU");
      continue;
    }
    const setMatch = /^([A-Za-z_.$?][\w.$?]*)\s+set\s+(.+)$/i.exec(text);
    if (setMatch) {
      const lower = setMatch[1].toLowerCase();
      const previous = userSymbols.get(lower);
      if (previous && previous.kind !== "SET") {
        declareConstant(setMatch[1], setMatch[2], lineNo, "SET");
      } else {
        if (!previous) userSymbols.set(lower, { line: lineNo, kind: "SET" });
        const resolved = resolveValue(setMatch[2], labels, equ, address);
        equ.set(lower, { expression: resolved == null ? setMatch[2].trim() : String(resolved), address });
      }
      continue;
    }
    const dataMatch = /^([A-Za-z_.$?][\w.$?]*)\s+data\s+(.+)$/i.exec(text);
    if (dataMatch) {
      declareConstant(dataMatch[1], dataMatch[2], lineNo, "DATA");
      continue;
    }
    const bitMatchDecl = /^([A-Za-z_.$?][\w.$?]*)\s+bit\s+(.+)$/i.exec(text);
    if (bitMatchDecl) {
      declareConstant(bitMatchDecl[1], bitMatchDecl[2], lineNo, "BIT");
      continue;
    }
    const sbitMatch = /^sbit\s+([A-Za-z_.$?][\w.$?]*)\s*=\s*(.+)$/i.exec(text);
    if (sbitMatch) {
      declareConstant(sbitMatch[1], sbitMatch[2], lineNo, "SBIT");
      continue;
    }
    const sfrMatch = /^sfr(?:16)?\s+([A-Za-z_.$?][\w.$?]*)\s*=\s*(.+)$/i.exec(text);
    if (sfrMatch) {
      declareConstant(sfrMatch[1], sfrMatch[2], lineNo, "SFR");
      continue;
    }
    const postfixSfrMatch = /^([A-Za-z_.$?][\w.$?]*)\s+sfr(?:16)?\s+(?:=\s*)?(.+)$/i.exec(text);
    if (postfixSfrMatch) {
      declareConstant(postfixSfrMatch[1], postfixSfrMatch[2], lineNo, "SFR");
      continue;
    }

    const orgMatch = /^\.?org\s+(.+)$/i.exec(text);
    if (orgMatch) {
      const value = resolveValue(orgMatch[1], labels, equ, address);
      if (value == null || !Number.isInteger(value) || value < 0 || value > 0xffff) {
        diagnostics.push({ level: "error", line: lineNo, message: "Invalid ORG value." });
      } else {
        address = value;
      }
      continue;
    }

    const compatibilityDirective = classifyCompatibilityDirective(text);
    if (compatibilityDirective.handled) {
      if (compatibilityDirective.error) {
        diagnostics.push({ level: "error", line: lineNo, message: compatibilityDirective.error });
      }
      continue;
    }

    const labelMatch = /^([A-Za-z_.$?][\w.$?]*):\s*(.*)$/.exec(text);
    if (labelMatch) {
      if (declareSymbol(labelMatch[1], lineNo, "label")) {
        labels.set(labelMatch[1].toLowerCase(), address);
      }
      text = labelMatch[2].trim();
      if (!text) continue;
      if (isEndDirective(text)) break;
    }

    const instruction = splitInstruction(text);
    const mnemonic = instruction.mnemonic;
    let operands = instruction.operands;
    if (mnemonic === "db" || mnemonic === "dw") {
      const expanded = expandDataOperands(operands, labels, equ, address, lineNo, diagnostics);
      if (!expanded) continue;
      operands = expanded;
      if (!operands.length) continue;
    }
    if (mnemonic === "align" || mnemonic === "even") {
      const boundaryExpression = mnemonic === "even" ? "2" : operands[0];
      const validArity = mnemonic === "even" ? operands.length === 0 : operands.length >= 1 && operands.length <= 2;
      const boundary = validArity && boundaryExpression
        ? resolveValue(boundaryExpression, labels, equ, address)
        : null;
      const fill = mnemonic === "align" && operands.length === 2
        ? resolveValue(operands[1], labels, equ, address)
        : 0;
      if (
        boundary == null || !Number.isInteger(boundary) || boundary < 1 || boundary > 0x10000 ||
        fill == null || !Number.isInteger(fill) || fill < -128 || fill > 0xff
      ) {
        diagnostics.push({
          level: "error",
          line: lineNo,
          message: mnemonic === "even"
            ? "EVEN does not accept operands."
            : "ALIGN expects boundary (1..65536) and an optional byte fill value.",
        });
        continue;
      }
      const padding = (boundary - (address % boundary)) % boundary;
      if (address + padding > 0x10000) {
        diagnostics.push({ level: "error", line: lineNo, message: "ALIGN exceeds the 16-bit code address space." });
        continue;
      }
      if (padding) {
        parsed.push({
          line: lineNo,
          address,
          mnemonic: "align",
          operands: [],
          reservedSize: padding,
          fillByte: fill & 0xff,
        });
        address += padding;
      }
      continue;
    }
    if (mnemonic === "ds") {
      const count = operands.length === 1 ? resolveValue(operands[0], labels, equ, address) : null;
      if (count == null || !Number.isInteger(count) || count < 0 || count > 0xffff) {
        diagnostics.push({
          level: "error",
          line: lineNo,
          message: "DS expects one non-negative constant expression (0..65535).",
        });
      } else {
        if (address + count > 0x10000) {
          diagnostics.push({ level: "error", line: lineNo, message: "DS exceeds the 16-bit code address space." });
        } else {
          parsed.push({ line: lineNo, address, mnemonic, operands, reservedSize: count });
          address += count;
        }
      }
      continue;
    }
    const size = estimateSize(mnemonic, operands, equ);
    if (size === 0) {
      diagnostics.push({
        level: "error",
        line: lineNo,
        message: `Unsupported instruction: ${mnemonic} ${operands.join(", ")}`.trim(),
      });
      continue;
    }

    parsed.push({
      line: lineNo,
      address,
      mnemonic,
      operands,
    });
    if (address + size > 0x10000) {
      diagnostics.push({ level: "error", line: lineNo, message: "Statement exceeds the 16-bit code address space." });
      parsed.pop();
    } else {
      address += size;
    }
  }

  const map = new Map<number, number>();
  const pcToLine: Array<{ pc: number; line: number }> = [];
  for (const entry of parsed) {
    pcToLine.push({ pc: entry.address & 0xffff, line: entry.line });
    const encoded = encodeInstruction(entry, labels, equ, diagnostics);
    if (!encoded) continue;
    encoded.forEach((byte, offset) => map.set(entry.address + offset, byte & 0xff));
  }

  const bytes = flattenMap(map);
  const hex = toIntelHex(map);
  if (bytes.length && !diagnostics.length) {
    diagnostics.push({ level: "hint", message: "ASM compiled to HEX successfully." });
  }

  return {
    ok: diagnostics.every((item) => item.level !== "error"),
    hex,
    bytes,
    pcToLine,
    diagnostics,
  };
}

const BUILTIN_ASM_INCLUDES = new Set(["aduc841.inc", "reg841.inc"]);
const BUILTIN_ASM_MODELS = new Set(["$mod841", "$modaduc841", "$modreg841"]);

function classifyCompatibilityDirective(text: string): { handled: boolean; error?: string } {
  const includeMatch = /^\$?include\b(.*)$/i.exec(text);
  if (includeMatch) {
    const target = parseCompatibilityIncludeTarget(includeMatch[1]);
    if (target && BUILTIN_ASM_INCLUDES.has(target.toLowerCase())) return { handled: true };
    return {
      handled: true,
      error: target
        ? `INCLUDE file "${target}" is unavailable; only built-in ADUC841.INC and REG841.INC are supported.`
        : "INCLUDE expects one built-in file name: ADUC841.INC or REG841.INC.",
    };
  }

  if (/^\$mod/i.test(text)) {
    const normalized = text.replace(/\s+/g, "").toLowerCase();
    if (BUILTIN_ASM_MODELS.has(normalized)) return { handled: true };
    return {
      handled: true,
      error: "Unsupported $MOD model; use $MOD841, $MODADUC841, or $MODREG841.",
    };
  }

  if (/^(?:extrn|extern)\b/i.test(text)) {
    return {
      handled: true,
      error: "EXTRN/EXTERN requires linker support and is unavailable in the single-file ASM compiler.",
    };
  }

  if (/^(?:cseg|dseg|xseg|bseg)\b/i.test(text) || /^\.area\b/i.test(text)) {
    return {
      handled: true,
      error: "Segment/AREA selection is unavailable in the flat 16-bit code-image assembler.",
    };
  }

  // These directives carry only module/link visibility metadata in the supported
  // single-file workflow, so accepting them cannot change emitted machine code.
  if (/^(?:\.module|using|name|public)\b/i.test(text)) return { handled: true };
  return { handled: false };
}

function parseCompatibilityIncludeTarget(raw: string): string | null {
  let target = raw.trim();
  if (!target) return null;
  const wrappers: Record<string, string> = { "(": ")", "<": ">", '"': '"', "'": "'" };
  const closing = wrappers[target[0]];
  if (closing) {
    if (target[target.length - 1] !== closing) return null;
    target = target.slice(1, -1).trim();
  }
  if (!target || /\s/.test(target) || /[()<>"']/.test(target)) return null;
  return target;
}

type PreprocessorState = {
  diagnostics: AsmDiagnostic[];
  macros: Map<string, MacroDefinition>;
  constants: ConstantMap;
  defined: Set<string>;
  invocationId: number;
  expandedLines: number;
  steps: number;
  aborted: boolean;
};

type PreprocessorContext = {
  inMacro: boolean;
  macroStack: string[];
};

type PreprocessorResult = {
  lines: AsmSourceLine[];
  exitMacro: boolean;
  stopSource: boolean;
};

type ConditionalFrame = {
  line: number;
  parentActive: boolean;
  active: boolean;
  branchTaken: boolean;
  elseSeen: boolean;
};

function preprocessAsm(source: string, diagnostics: AsmDiagnostic[]): AsmSourceLine[] {
  const input = source.split(/\r?\n/).map((text, index) => ({ text, line: index + 1, trace: [] }));
  const state: PreprocessorState = {
    diagnostics,
    macros: new Map(),
    constants: new Map(),
    defined: new Set(),
    invocationId: 0,
    expandedLines: 0,
    steps: 0,
    aborted: false,
  };
  return processPreprocessorLines(input, state, { inMacro: false, macroStack: [] }).lines;
}

function processPreprocessorLines(
  input: AsmSourceLine[],
  state: PreprocessorState,
  context: PreprocessorContext,
): PreprocessorResult {
  const output: AsmSourceLine[] = [];
  const conditionals: ConditionalFrame[] = [];
  const currentActive = () => conditionals.length ? conditionals[conditionals.length - 1].active : true;

  const reportOpenConditionals = () => {
    for (const frame of conditionals) {
      state.diagnostics.push({ level: "error", line: frame.line, message: "Unterminated IF block; expected ENDIF." });
    }
    conditionals.length = 0;
  };

  for (let index = 0; index < input.length && !state.aborted; index++) {
    const sourceLine = input[index];
    state.steps += 1;
    if (state.steps > MAX_PREPROCESS_STEPS) {
      abortPreprocessor(state, sourceLine.line, `ASM preprocessing exceeded ${MAX_PREPROCESS_STEPS} steps.`);
      break;
    }

    const text = stripComment(sourceLine.text).trim();
    if (!text) continue;

    const ifdefMatch = /^ifdef\s*(?:\(\s*([A-Za-z_.$?][\w.$?]*)\s*\)|([A-Za-z_.$?][\w.$?]*))\s*$/i.exec(text);
    const ifndefMatch = /^ifndef\s*(?:\(\s*([A-Za-z_.$?][\w.$?]*)\s*\)|([A-Za-z_.$?][\w.$?]*))\s*$/i.exec(text);
    const ifMatch = /^if\b(.*)$/i.exec(text);
    if (/^ifdef\b/i.test(text) || /^ifndef\b/i.test(text) || ifMatch) {
      const parentActive = currentActive();
      let condition = false;
      if (parentActive) {
        if (ifdefMatch) {
          condition = isPreprocessorDefined(ifdefMatch[1] ?? ifdefMatch[2], state);
        } else if (ifndefMatch) {
          condition = !isPreprocessorDefined(ifndefMatch[1] ?? ifndefMatch[2], state);
        } else if (ifMatch && ifMatch[1].trim()) {
          const value = resolvePreprocessorValue(ifMatch[1], state);
          if (value == null) {
            state.diagnostics.push({
              level: "error",
              line: sourceLine.line,
              message: `Cannot resolve IF expression: ${ifMatch[1].trim()}`,
            });
          } else {
            condition = value !== 0;
          }
        } else {
          state.diagnostics.push({
            level: "error",
            line: sourceLine.line,
            message: /^ifndef\b/i.test(text) ? "IFNDEF expects one symbol." :
              /^ifdef\b/i.test(text) ? "IFDEF expects one symbol." : "IF expects a constant expression.",
          });
        }
      }
      conditionals.push({
        line: sourceLine.line,
        parentActive,
        active: parentActive && condition,
        branchTaken: parentActive && condition,
        elseSeen: false,
      });
      continue;
    }

    const elifMatch = /^(?:elif|elseif)\b(.*)$/i.exec(text);
    if (elifMatch) {
      const frame = conditionals[conditionals.length - 1];
      if (!frame) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "ELIF without a matching IF." });
      } else if (frame.elseSeen) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "ELIF cannot appear after ELSE." });
        frame.active = false;
      } else if (!frame.parentActive || frame.branchTaken) {
        frame.active = false;
      } else if (!elifMatch[1].trim()) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "ELIF expects a constant expression." });
        frame.active = false;
      } else {
        const value = resolvePreprocessorValue(elifMatch[1], state);
        if (value == null) {
          state.diagnostics.push({
            level: "error",
            line: sourceLine.line,
            message: `Cannot resolve ELIF expression: ${elifMatch[1].trim()}`,
          });
          frame.active = false;
        } else {
          frame.active = value !== 0;
          frame.branchTaken = frame.active;
        }
      }
      continue;
    }

    if (/^else\s*$/i.test(text)) {
      const frame = conditionals[conditionals.length - 1];
      if (!frame) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "ELSE without a matching IF." });
      } else if (frame.elseSeen) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "Duplicate ELSE in one IF block." });
        frame.active = false;
      } else {
        frame.elseSeen = true;
        frame.active = frame.parentActive && !frame.branchTaken;
        frame.branchTaken = frame.branchTaken || frame.active;
      }
      continue;
    }

    if (/^endif\s*$/i.test(text)) {
      if (!conditionals.length) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "ENDIF without a matching IF." });
      } else {
        conditionals.pop();
      }
      continue;
    }

    const macroHeader = parseMacroHeader(text);
    const repeatHeader = /^rept\b(.*)$/i.exec(text);
    if (macroHeader || repeatHeader) {
      const kind = macroHeader ? "macro" : "rept";
      const collected = collectPreprocessorBlock(input, index, kind);
      index = collected.endIndex;
      if (!collected.closed) {
        state.diagnostics.push({
          level: "error",
          line: sourceLine.line,
          message: kind === "macro" ? "Unterminated MACRO block; expected ENDM." : "Unterminated REPT block; expected ENDM or ENDR.",
        });
        continue;
      }
      if (!currentActive()) continue;

      if (macroHeader) {
        const parameters = macroHeader.parameterText ? splitOperandList(macroHeader.parameterText) : [];
        const invalidParameter = parameters.find((parameter) => !/^[A-Za-z_.$?][\w.$?]*$/.test(parameter));
        const lowerParameters = parameters.map((parameter) => parameter.toLowerCase());
        const duplicateParameter = lowerParameters.find((parameter, itemIndex) => lowerParameters.indexOf(parameter) !== itemIndex);
        const lowerName = macroHeader.name.toLowerCase();
        if (invalidParameter) {
          state.diagnostics.push({
            level: "error",
            line: sourceLine.line,
            message: `Invalid MACRO parameter name: ${invalidParameter}`,
          });
        } else if (duplicateParameter) {
          state.diagnostics.push({
            level: "error",
            line: sourceLine.line,
            message: `Duplicate MACRO parameter: ${duplicateParameter}`,
          });
        } else if (state.macros.has(lowerName) || state.defined.has(lowerName)) {
          state.diagnostics.push({ level: "error", line: sourceLine.line, message: `Duplicate MACRO name: ${macroHeader.name}` });
        } else {
          state.macros.set(lowerName, {
            name: macroHeader.name,
            parameters,
            body: collected.body,
            line: sourceLine.line,
          });
          state.defined.add(lowerName);
        }
        continue;
      }

      const countExpression = repeatHeader?.[1].trim() ?? "";
      const count = countExpression ? resolvePreprocessorValue(countExpression, state) : null;
      if (count == null || !Number.isInteger(count) || count < 0 || count > MAX_REPEAT_COUNT) {
        state.diagnostics.push({
          level: "error",
          line: sourceLine.line,
          message: `REPT expects a constant count in the range 0..${MAX_REPEAT_COUNT}.`,
        });
        continue;
      }
      if (!collected.body.length) {
        if (!chargePreprocessorSteps(state, sourceLine.line, count)) break;
        continue;
      }
      for (let repeatIndex = 0; repeatIndex < count && !state.aborted; repeatIndex++) {
        if (!chargePreprocessorSteps(state, sourceLine.line)) break;
        const repeated = processPreprocessorLines(collected.body, state, context);
        output.push(...repeated.lines);
        if (repeated.stopSource) {
          reportOpenConditionals();
          return { lines: output, exitMacro: false, stopSource: true };
        }
        if (repeated.exitMacro) {
          return { lines: output, exitMacro: true, stopSource: false };
        }
      }
      continue;
    }

    if (!currentActive()) continue;

    if (/^(?:endm|endr)\b/i.test(text)) {
      state.diagnostics.push({ level: "error", line: sourceLine.line, message: `${text.split(/\s+/)[0].toUpperCase()} without an open MACRO or REPT block.` });
      continue;
    }

    if (/^exitm\s*$/i.test(text)) {
      if (!context.inMacro) {
        state.diagnostics.push({ level: "error", line: sourceLine.line, message: "EXITM is only valid inside a MACRO expansion." });
        continue;
      }
      return { lines: output, exitMacro: true, stopSource: false };
    }

    if (/^local\b/i.test(text)) {
      state.diagnostics.push({ level: "error", line: sourceLine.line, message: "LOCAL is only valid inside a MACRO definition." });
      continue;
    }

    const invocation = parseMacroInvocation(text, state.macros);
    if (invocation) {
      const definition = invocation.definition;
      const lowerName = definition.name.toLowerCase();
      if (context.macroStack.includes(lowerName) || context.macroStack.length >= MAX_MACRO_DEPTH) {
        state.diagnostics.push({
          level: "error",
          line: sourceLine.line,
          message: context.macroStack.includes(lowerName)
            ? `Recursive MACRO invocation is not allowed: ${definition.name}`
            : `MACRO nesting exceeds ${MAX_MACRO_DEPTH} levels.`,
        });
        continue;
      }
      if (invocation.arguments.length !== definition.parameters.length) {
        state.diagnostics.push({
          level: "error",
          line: sourceLine.line,
          message: `MACRO ${definition.name} expects ${definition.parameters.length} argument(s), got ${invocation.arguments.length}.`,
        });
        continue;
      }

      if (invocation.label) {
        const labelLine = { ...sourceLine, text: `${invocation.label}:` };
        recordPreprocessorSymbols(labelLine, state);
        if (!emitPreprocessedLine(output, labelLine, state)) break;
      }
      const instantiated = instantiateMacro(definition, invocation.arguments, sourceLine, state);
      const expanded = processPreprocessorLines(instantiated, state, {
        inMacro: true,
        macroStack: [...context.macroStack, lowerName],
      });
      output.push(...expanded.lines);
      if (expanded.stopSource) {
        reportOpenConditionals();
        return { lines: output, exitMacro: false, stopSource: true };
      }
      // EXITM terminates only the macro which owns it; the caller continues.
      continue;
    }

    recordPreprocessorSymbols(sourceLine, state);
    if (!emitPreprocessedLine(output, sourceLine, state)) break;
    if (isEndDirective(text)) {
      reportOpenConditionals();
      return { lines: output, exitMacro: false, stopSource: true };
    }
  }

  reportOpenConditionals();
  return { lines: output, exitMacro: false, stopSource: false };
}

function abortPreprocessor(state: PreprocessorState, line: number, message: string) {
  if (state.aborted) return;
  state.aborted = true;
  state.diagnostics.push({ level: "error", line, message });
}

function chargePreprocessorSteps(state: PreprocessorState, line: number, count = 1): boolean {
  state.steps += count;
  if (state.steps <= MAX_PREPROCESS_STEPS) return true;
  abortPreprocessor(state, line, `ASM preprocessing exceeded ${MAX_PREPROCESS_STEPS} steps.`);
  return false;
}

function emitPreprocessedLine(output: AsmSourceLine[], line: AsmSourceLine, state: PreprocessorState): boolean {
  if (state.expandedLines >= MAX_EXPANDED_LINES) {
    abortPreprocessor(state, line.line, `ASM preprocessing exceeds ${MAX_EXPANDED_LINES} emitted lines.`);
    return false;
  }
  state.expandedLines += 1;
  output.push(line);
  return true;
}

function parseMacroHeader(text: string): { name: string; parameterText: string } | null {
  const match = /^([A-Za-z_.$?][\w.$?]*)\s+macro\b(.*)$/i.exec(text);
  return match ? { name: match[1], parameterText: match[2].trim() } : null;
}

function collectPreprocessorBlock(
  input: AsmSourceLine[],
  startIndex: number,
  initialKind: "macro" | "rept",
): { body: AsmSourceLine[]; endIndex: number; closed: boolean } {
  const body: AsmSourceLine[] = [];
  const stack: Array<"macro" | "rept"> = [initialKind];
  for (let index = startIndex + 1; index < input.length; index++) {
    const text = stripComment(input[index].text).trim();
    if (parseMacroHeader(text)) {
      stack.push("macro");
      body.push(input[index]);
      continue;
    }
    if (/^rept\b/i.test(text)) {
      stack.push("rept");
      body.push(input[index]);
      continue;
    }
    if (/^endm(?:\s+.*)?$/i.test(text)) {
      stack.pop();
      if (!stack.length) return { body, endIndex: index, closed: true };
      body.push(input[index]);
      continue;
    }
    if (/^endr(?:\s+.*)?$/i.test(text) && stack[stack.length - 1] === "rept") {
      stack.pop();
      if (!stack.length) return { body, endIndex: index, closed: true };
      body.push(input[index]);
      continue;
    }
    body.push(input[index]);
  }
  return { body, endIndex: input.length - 1, closed: false };
}

function parseMacroInvocation(
  text: string,
  macros: Map<string, MacroDefinition>,
): { definition: MacroDefinition; arguments: string[]; label?: string } | null {
  const labelMatch = /^([A-Za-z_.$?][\w.$?]*):\s*(.*)$/.exec(text);
  const statement = labelMatch ? labelMatch[2].trim() : text;
  const match = /^([A-Za-z_.$?][\w.$?]*)\b(.*)$/.exec(statement);
  if (!match) return null;
  const definition = macros.get(match[1].toLowerCase());
  if (!definition) return null;
  const argumentText = match[2].trim();
  return {
    definition,
    arguments: argumentText ? splitOperandList(argumentText) : [],
    label: labelMatch?.[1],
  };
}

function instantiateMacro(
  definition: MacroDefinition,
  args: string[],
  invocation: AsmSourceLine,
  state: PreprocessorState,
): AsmSourceLine[] {
  const replacements = new Map<string, string>();
  definition.parameters.forEach((parameter, index) => replacements.set(parameter.toLowerCase(), args[index]));
  const parameterized = definition.body.map((line) => ({
    ...line,
    text: substituteAsmIdentifiers(line.text, (identifier) => replacements.get(identifier.toLowerCase()) ?? identifier),
  }));

  const invocationId = ++state.invocationId;
  const localReplacements = new Map<string, string>();
  const body: AsmSourceLine[] = [];
  for (const line of parameterized) {
    const text = stripComment(line.text).trim();
    const localMatch = /^local\b(.*)$/i.exec(text);
    if (!localMatch) {
      body.push(line);
      continue;
    }
    const names = splitOperandList(localMatch[1].trim());
    if (!names.length) {
      state.diagnostics.push({ level: "error", line: invocation.line, message: "LOCAL expects one or more comma-separated names." });
      continue;
    }
    for (const name of names) {
      if (!/^[A-Za-z_.$?][\w.$?]*$/.test(name)) {
        state.diagnostics.push({ level: "error", line: invocation.line, message: `Invalid LOCAL name: ${name}` });
        continue;
      }
      const lower = name.toLowerCase();
      if (localReplacements.has(lower)) {
        state.diagnostics.push({ level: "error", line: invocation.line, message: `Duplicate LOCAL name: ${name}` });
        continue;
      }
      const safeName = name.replace(/[^A-Za-z0-9_]/g, "_");
      localReplacements.set(lower, `__asm_macro_${invocationId}_${safeName}`);
    }
  }

  return body.map((line) => ({
    text: substituteAsmIdentifiers(line.text, (identifier) =>
      localReplacements.get(identifier.toLowerCase()) ?? identifier),
    line: invocation.line,
    trace: [...line.trace, `MACRO ${definition.name} defined at line ${definition.line}`],
  }));
}

function recordPreprocessorSymbols(line: AsmSourceLine, state: PreprocessorState) {
  let text = stripComment(line.text).trim();
  const labelMatch = /^([A-Za-z_.$?][\w.$?]*):\s*(.*)$/.exec(text);
  if (labelMatch) {
    state.defined.add(labelMatch[1].toLowerCase());
    text = labelMatch[2].trim();
  }
  if (!text) return;

  const constantMatch = /^([A-Za-z_.$?][\w.$?]*)\s+(equ|set|data|bit)\s+(.+)$/i.exec(text);
  const prefixMatch = /^(sbit|sfr16|sfr)\s+([A-Za-z_.$?][\w.$?]*)\s*=\s*(.+)$/i.exec(text);
  const postfixMatch = /^([A-Za-z_.$?][\w.$?]*)\s+(sfr16|sfr)\s+(?:=\s*)?(.+)$/i.exec(text);
  const name = constantMatch?.[1] ?? prefixMatch?.[2] ?? postfixMatch?.[1];
  const expression = constantMatch?.[3] ?? prefixMatch?.[3] ?? postfixMatch?.[3];
  if (!name || !expression) return;
  const lower = name.toLowerCase();
  state.defined.add(lower);
  if (constantMatch?.[2].toLowerCase() === "set") {
    const value = resolvePreprocessorValue(expression, state);
    state.constants.set(lower, { expression: value == null ? expression.trim() : String(value), address: 0 });
  } else {
    state.constants.set(lower, { expression: expression.trim(), address: 0 });
  }
}

function isPreprocessorDefined(name: string, state: PreprocessorState): boolean {
  const lower = name.toLowerCase();
  return state.defined.has(lower) || state.macros.has(lower) || lower in ADUC841_SFR || lower in ADUC841_BITS;
}

function resolvePreprocessorValue(
  expression: string,
  state: PreprocessorState,
  resolving: ReadonlySet<string> = new Set(),
): number | null {
  return evaluateAsmExpression(
    expression,
    (name) => {
      const lower = name.toLowerCase();
      const definition = state.constants.get(lower);
      if (definition) {
        if (resolving.has(lower)) return null;
        const next = new Set(resolving);
        next.add(lower);
        return resolvePreprocessorValue(definition.expression, state, next);
      }
      if (lower in ADUC841_SFR) return ADUC841_SFR[lower as keyof typeof ADUC841_SFR];
      if (lower in ADUC841_BITS) return ADUC841_BITS[lower];
      return null;
    },
    (name) => isPreprocessorDefined(name, state),
  );
}

function substituteAsmIdentifiers(text: string, replace: (identifier: string, index: number) => string): string {
  let output = "";
  let index = 0;
  let quote = "";
  let escaped = false;
  while (index < text.length) {
    const char = text[index];
    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      index += 1;
      continue;
    }
    if (char === ";" || (char === "/" && text[index + 1] === "/")) {
      output += text.slice(index);
      break;
    }
    if (/\d/.test(char)) {
      const numeric = /^(?:0x[0-9a-f]+|0b[01]+|[0-9a-f]+h|[01]+b|\d+)/i.exec(text.slice(index));
      if (numeric) {
        output += numeric[0];
        index += numeric[0].length;
        continue;
      }
    }
    if (/[A-Za-z_.$?]/.test(char)) {
      let end = index + 1;
      while (end < text.length && /[\w.$?]/.test(text[end])) end += 1;
      const identifier = text.slice(index, end);
      output += /^(?:[0-9a-f]+h|[01]+b)$/i.test(identifier) ? identifier : replace(identifier, index);
      index = end;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function scopeLocalLabels(lines: AsmSourceLine[], diagnostics: AsmDiagnostic[]): AsmSourceLine[] {
  const dottedDirectives = new Set([
    "org", "end", "db", "dw", "ds", "byte", "defb", "word", "defw", "defs", "resb", "align", "even", "module", "area",
  ]);
  let currentScope: string | null = null;
  return lines.map((line) => {
    const code = stripComment(line.text);
    const labelMatch = /^(\s*)([A-Za-z_.$?][\w.$?]*):/.exec(code);
    const label = labelMatch?.[2];
    const labelStart = labelMatch ? labelMatch[1].length : -1;
    if (label && !label.startsWith(".") && !label.toLowerCase().startsWith("__asm_macro_")) {
      currentScope = label;
    }
    const effectiveScope = currentScope ?? "__asm_file";
    let reportedOrphan = false;
    if (label?.startsWith(".") && !currentScope) {
      diagnostics.push({ level: "error", line: line.line, message: `Local label ${label} appears before any global label.` });
      reportedOrphan = true;
    }

    const statementStart = labelMatch ? labelMatch[0].length : 0;
    const statementTail = code.slice(statementStart);
    const mnemonicOffset = statementTail.search(/\S/);
    const mnemonicStart = mnemonicOffset < 0 ? -1 : statementStart + mnemonicOffset;
    const rewritten = substituteAsmIdentifiers(line.text, (identifier, index) => {
      if (!identifier.startsWith(".")) return identifier;
      if (index === mnemonicStart && dottedDirectives.has(identifier.slice(1).toLowerCase())) return identifier;
      if (!currentScope && !reportedOrphan) {
        diagnostics.push({ level: "error", line: line.line, message: `Local label reference ${identifier} appears before any global label.` });
        reportedOrphan = true;
      }
      if (index === labelStart || identifier.startsWith(".")) return `${effectiveScope}${identifier}`;
      return identifier;
    });
    return { ...line, text: rewritten };
  });
}

function stripComment(line: string): string {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ";" || (char === "/" && line[index + 1] === "/")) {
      return line.slice(0, index);
    }
  }
  return line;
}

function decodeDataString(text: string): string | null {
  const quote = text[0];
  if (text.length < 2 || (quote !== "'" && quote !== '"') || text[text.length - 1] !== quote) {
    return null;
  }
  return decodeEscapedText(text.slice(1, -1));
}

function decodeEscapedText(text: string): string | null {
  let result = "";
  const simpleEscapes: Record<string, string> = {
    "0": "\0",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
    "'": "'",
    '"': '"',
  };
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== "\\") {
      result += text[index];
      continue;
    }
    const escaped = text[++index];
    if (escaped == null) return null;
    if (escaped === "x") {
      const digits = text.slice(index + 1, index + 3);
      if (!/^[0-9a-f]{2}$/i.test(digits)) return null;
      result += String.fromCharCode(Number.parseInt(digits, 16));
      index += 2;
      continue;
    }
    if (escaped === "u") {
      const digits = text.slice(index + 1, index + 5);
      if (!/^[0-9a-f]{4}$/i.test(digits)) return null;
      result += String.fromCharCode(Number.parseInt(digits, 16));
      index += 4;
      continue;
    }
    result += simpleEscapes[escaped] ?? escaped;
  }
  return result;
}

function isEndDirective(text: string): boolean {
  return /^(?:\.end|end)(?:\s+.*)?$/i.test(text.trim());
}

function splitInstruction(text: string): { mnemonic: string; operands: string[] } {
  const trimmed = text.trim();
  const match = /^([^\s]+)\s*(.*)$/.exec(trimmed);
  const rawMnemonic = (match?.[1] ?? "").toLowerCase().replace(/^\./, "");
  const mnemonicAliases: Record<string, string> = {
    byte: "db",
    defb: "db",
    word: "dw",
    defw: "dw",
    defs: "ds",
    resb: "ds",
  };
  const mnemonic = mnemonicAliases[rawMnemonic] ?? rawMnemonic;
  const tail = match?.[2] ?? "";
  return { mnemonic, operands: splitOperandList(tail) };
}

function splitOperandList(tail: string): string[] {
  const operands: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index <= tail.length; index++) {
    const char = tail[index] ?? ",";
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;
    if (char === "," && depth === 0) {
      const operand = tail.slice(start, index).trim();
      if (operand) operands.push(operand);
      start = index + 1;
    }
  }
  if (start < tail.length) {
    const operand = tail.slice(start).trim();
    if (operand) operands.push(operand);
  }
  return operands;
}

type DupParseResult =
  | { found: false }
  | { found: true; count: string; body: string; error?: string };

function parseDupOperand(operand: string): DupParseResult {
  let quote = "";
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < operand.length;) {
    const char = operand[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      index += 1;
      continue;
    }
    if (char === "(") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth < 0) return { found: true, count: "", body: "", error: "Unexpected ')' in DUP expression." };
      index += 1;
      continue;
    }
    if (/[A-Za-z_.$?]/.test(char)) {
      let end = index + 1;
      while (end < operand.length && /[\w.$?]/.test(operand[end])) end += 1;
      const word = operand.slice(index, end);
      if (depth === 0 && word.toLowerCase() === "dup") {
        const count = operand.slice(0, index).trim();
        const suffix = operand.slice(end).trim();
        if (!count) return { found: true, count, body: "", error: "DUP requires a repeat count." };
        if (!suffix.startsWith("(")) return { found: true, count, body: "", error: "DUP requires a parenthesized value list." };
        let innerQuote = "";
        let innerEscaped = false;
        let innerDepth = 0;
        let closing = -1;
        for (let suffixIndex = 0; suffixIndex < suffix.length; suffixIndex++) {
          const suffixChar = suffix[suffixIndex];
          if (innerQuote) {
            if (innerEscaped) innerEscaped = false;
            else if (suffixChar === "\\") innerEscaped = true;
            else if (suffixChar === innerQuote) innerQuote = "";
            continue;
          }
          if (suffixChar === "'" || suffixChar === '"') {
            innerQuote = suffixChar;
            continue;
          }
          if (suffixChar === "(") innerDepth += 1;
          else if (suffixChar === ")") {
            innerDepth -= 1;
            if (innerDepth === 0) {
              closing = suffixIndex;
              break;
            }
          }
        }
        if (closing < 0) return { found: true, count, body: "", error: "Unterminated DUP value list." };
        if (suffix.slice(closing + 1).trim()) {
          return { found: true, count, body: "", error: "Unexpected text after DUP value list." };
        }
        return { found: true, count, body: suffix.slice(1, closing) };
      }
      index = end;
      continue;
    }
    index += 1;
  }
  return { found: false };
}

function expandDataOperands(
  operands: string[],
  labels: Map<string, number>,
  equ: ConstantMap,
  currentAddress: number,
  line: number,
  diagnostics: AsmDiagnostic[],
): string[] | null {
  const fail = (message: string): null => {
    diagnostics.push({ level: "error", line, message });
    return null;
  };
  const expandOne = (operand: string, depth = 0): string[] | null => {
    if (depth > 32) return fail("DUP nesting exceeds 32 levels.");
    const parsed = parseDupOperand(operand);
    if (!parsed.found) return [operand];
    if (parsed.error) return fail(parsed.error);
    const count = resolveValue(parsed.count, labels, equ, currentAddress);
    if (count == null || !Number.isInteger(count) || count < 0 || count > MAX_REPEAT_COUNT) {
      return fail(`DUP count must be a constant in the range 0..${MAX_REPEAT_COUNT}.`);
    }
    const bodyOperands = splitOperandList(parsed.body);
    if (!bodyOperands.length) return fail("DUP requires at least one value.");
    const expandedBody: string[] = [];
    for (const bodyOperand of bodyOperands) {
      const nested = expandOne(bodyOperand, depth + 1);
      if (!nested) return null;
      expandedBody.push(...nested);
      if (expandedBody.length > MAX_DATA_ITEMS) return fail(`DUP expands past ${MAX_DATA_ITEMS} data items.`);
    }
    if (expandedBody.length * count > MAX_DATA_ITEMS) {
      return fail(`DUP expands past ${MAX_DATA_ITEMS} data items.`);
    }
    const result: string[] = [];
    for (let repeat = 0; repeat < count; repeat++) result.push(...expandedBody);
    return result;
  };

  const result: string[] = [];
  for (const operand of operands) {
    const expanded = expandOne(operand);
    if (!expanded) return null;
    result.push(...expanded);
    if (result.length > MAX_DATA_ITEMS) return fail(`Data directive expands past ${MAX_DATA_ITEMS} items.`);
  }
  return result;
}

function estimateDbSize(operands: string[]): number {
  let size = 0;
  for (const operand of operands) {
    const value = decodeDataString(operand.trim());
    size += value == null ? 1 : Array.from(value).length;
  }
  return size;
}

function estimateSize(mnemonic: string, operands: string[], equ: ConstantMap): number {
  const arg0 = resolveAliasToken(operands[0]?.trim().toLowerCase() ?? "", equ);
  const arg1 = resolveAliasToken(operands[1]?.trim().toLowerCase() ?? "", equ);
  const isA = (value: string) => value === "a" || value === "acc";
  const isIndirect = (value: string) => value === "@r0" || value === "@r1";

  switch (mnemonic) {
    case "db": return estimateDbSize(operands);
    case "dw": return operands.length * 2;
    case "mov":
      if (operands.length !== 2) return 0;
      if (arg0 === "dptr" && arg1.startsWith("#")) return 3;
      if (arg0 === "c" || arg1 === "c") return 2;
      if (isA(arg0)) return isRegisterToken(arg1) || isIndirect(arg1) ? 1 : 2;
      if (isRegisterToken(arg0) || isIndirect(arg0)) {
        if (isA(arg1)) return 1;
        return 2;
      }
      if (arg1.startsWith("#")) return 3;
      // MOV direct,direct is the only non-immediate direct destination form that is 3 bytes.
      if (!isRegisterToken(arg0) && !isIndirect(arg0) && !isA(arg0) &&
          !isRegisterToken(arg1) && !isIndirect(arg1) && !isA(arg1)) return 3;
      return 2;
    case "xch":
      if (operands.length !== 2 || !isA(arg0)) return 0;
      return isRegisterToken(arg1) || isIndirect(arg1) ? 1 : 2;
    case "xchd": return operands.length === 2 ? 1 : 0;
    case "anl":
    case "orl":
    case "xrl":
      if (operands.length !== 2) return 0;
      if (isA(arg0)) return isRegisterToken(arg1) || isIndirect(arg1) ? 1 : 2;
      if (arg0 === "c") return 2;
      if ((isRegisterToken(arg0) || isIndirect(arg0)) && arg1.startsWith("#")) return 4;
      return arg1.startsWith("#") ? 3 : 2;
    case "add":
    case "addc":
    case "subb":
      if (operands.length !== 2 || !isA(arg0)) return 0;
      return isRegisterToken(arg1) || isIndirect(arg1) ? 1 : 2;
    case "setb":
    case "clr":
    case "cpl":
      if (operands.length !== 1) return 0;
      return arg0 === "c" || isA(arg0) ? 1 : 2;
    case "push":
    case "pop": return operands.length === 1 ? 2 : 0;
    case "dec":
    case "inc":
      if (operands.length !== 1) return 0;
      return isRegisterToken(arg0) || isIndirect(arg0) || isA(arg0) || arg0 === "dptr" ? 1 : 2;
    case "nop":
    case "da":
    case "ret":
    case "reti":
    case "rr":
    case "rl":
    case "rrc":
    case "rlc":
    case "swap":
    case "movc": return 1;
    case "mul":
    case "div": return operands.length <= 1 ? 1 : 0;
    case "movx": return operands.length === 2 ? 1 : 0;
    case "acall":
    case "ajmp": return operands.length === 1 ? 2 : 0;
    case "call":
    case "lcall":
    case "ljmp": return operands.length === 1 ? 3 : 0;
    case "jmp":
      if (operands.length !== 1) return 0;
      return arg0.replace(/\s+/g, "") === "@a+dptr" ? 1 : 3;
    case "sjmp":
    case "jz":
    case "jnz":
    case "jc":
    case "jnc": return operands.length === 1 ? 2 : 0;
    case "jb":
    case "jnb":
    case "jbc": return operands.length === 2 ? 3 : 0;
    case "cjne":
      if (operands.length !== 3) return 0;
      // Standard forms are 3 bytes. direct,#imm,label is accepted as a 5-byte compatibility lowering.
      return !isA(arg0) && !isRegisterToken(arg0) && !isIndirect(arg0) && arg1.startsWith("#") ? 5 : 3;
    case "djnz":
      if (operands.length !== 2) return 0;
      return isRegisterToken(arg0) ? 2 : 3;
    default: return 0;
  }
}

function encodeInstruction(
  entry: ParsedLine,
  labels: Map<string, number>,
  equ: ConstantMap,
  diagnostics: AsmDiagnostic[],
): number[] | null {
  const failEarly = (message: string) => {
    diagnostics.push({ level: "error", line: entry.line, message });
    return null;
  };
  // Data directives may contain strings and label expressions that are not instruction operands.
  if (entry.mnemonic === "db") {
    const bytes: number[] = [];
    for (const operand of entry.operands) {
      const text = operand.trim();
      const stringValue = decodeDataString(text);
      if (stringValue != null) {
        for (const character of stringValue) bytes.push((character.codePointAt(0) ?? 0) & 0xff);
        continue;
      }
      const value = resolveValue(operand, labels, equ, entry.address);
      if (value == null) return failEarly(`Cannot resolve DB value: ${operand}`);
      bytes.push(value & 0xff);
    }
    return bytes;
  }
  if (entry.mnemonic === "dw") {
    const bytes: number[] = [];
    for (const operand of entry.operands) {
      const value = resolveValue(operand, labels, equ, entry.address);
      if (value == null) return failEarly(`Cannot resolve DW value: ${operand}`);
      bytes.push((value >> 8) & 0xff, value & 0xff);
    }
    return bytes;
  }
  if (entry.mnemonic === "ds") {
    const count = entry.reservedSize ?? resolveValue(entry.operands[0] ?? "", labels, equ, entry.address);
    if (count == null || !Number.isInteger(count) || count < 0 || count > 0xffff) {
      return failEarly("Invalid DS size.");
    }
    return Array.from({ length: count }, () => 0);
  }
  if (entry.mnemonic === "align") {
    return Array.from({ length: entry.reservedSize ?? 0 }, () => entry.fillByte ?? 0);
  }

  const hints = operandHints(entry.mnemonic, entry.operands);
  const ops = entry.operands.map((operand, index) =>
    parseOperand(operand, labels, equ, hints[index] ?? "any", entry.address),
  );
  if (ops.some((op) => op.type === "unknown" || ("unresolved" in op && op.unresolved))) {
    diagnostics.push({
      level: "error",
      line: entry.line,
      message: `Cannot resolve operands for ${entry.mnemonic}.`,
    });
    return null;
  }

  const fail = (message: string) => {
    diagnostics.push({ level: "error", line: entry.line, message });
    return null;
  };

  switch (entry.mnemonic) {
    case "db": {
      const bytes: number[] = [];
      for (const operand of entry.operands) {
        const text = operand.trim();
        const stringValue = decodeDataString(text);
        if (stringValue != null) {
          for (const character of stringValue) bytes.push((character.codePointAt(0) ?? 0) & 0xff);
          continue;
        }
        const value = resolveValue(operand, labels, equ, entry.address);
        if (value == null) return fail(`Cannot resolve DB value: ${operand}`);
        bytes.push(value & 0xff);
      }
      return bytes;
    }
    case "dw": {
      const bytes: number[] = [];
      for (const operand of entry.operands) {
        const value = resolveValue(operand, labels, equ, entry.address);
        if (value == null) return fail(`Cannot resolve DW value: ${operand}`);
        // 8051 DW is big-endian: high byte first (matches MOVC table addressing)
        bytes.push((value >> 8) & 0xff, value & 0xff);
      }
      return bytes;
    }
    case "mov": {
      const [dst, src] = ops;
      if (dst.type === "reg" && src.type === "imm") return [0x78 + dst.value, src.value];
      if (dst.type === "indirect" && src.type === "imm") return [0x76 + dst.value, src.value];
      if (dst.type === "reg" && src.type === "a") return [0xf8 + dst.value];
      if (dst.type === "indirect" && src.type === "a") return [0xf6 + dst.value];
      if (dst.type === "a" && src.type === "imm") return [0x74, src.value];
      if (dst.type === "a" && src.type === "reg") return [0xe8 + src.value];
      if (dst.type === "a" && src.type === "indirect") return [0xe6 + src.value];
      if (dst.type === "dptr" && src.type === "imm") return [0x90, (src.value >> 8) & 0xff, src.value & 0xff];
      if (dst.type === "direct" && src.type === "imm") return [0x75, dst.value, src.value];
      if (dst.type === "direct" && src.type === "reg") return [0x88 + src.value, dst.value];
      if (dst.type === "direct" && src.type === "indirect") return [0x86 + src.value, dst.value];
      if (dst.type === "reg" && src.type === "direct") return [0xa8 + dst.value, src.value];
      if (dst.type === "indirect" && src.type === "direct") return [0xa6 + dst.value, src.value];
      if (dst.type === "direct" && src.type === "a") return [0xf5, dst.value];
      if (dst.type === "a" && src.type === "direct") return [0xe5, src.value];
      if (dst.type === "direct" && src.type === "direct") return [0x85, src.value, dst.value];
      if (dst.type === "c" && src.type === "bit") return [0xa2, src.value];
      if (dst.type === "bit" && src.type === "c") return [0x92, dst.value];
      return fail("Unsupported MOV form.");
    }
    case "xch": {
      const [dst, src] = ops;
      if (dst.type !== "a") return fail("XCH expects A as first operand.");
      if (src.type === "reg") return [0xc8 + src.value];
      if (src.type === "direct") return [0xc5, src.value];
      if (src.type === "indirect") return [0xc6 + src.value];
      return fail("Unsupported XCH form.");
    }
    case "xchd": {
      const [dst, src] = ops;
      if (dst.type !== "a" || src.type !== "indirect") return fail("XCHD expects A,@R0 or A,@R1.");
      return [0xd6 + src.value];
    }
    case "anl":
    case "orl":
    case "xrl": {
      const [dst, src] = ops;
      const base =
        entry.mnemonic === "anl"
          ? { aImm: 0x54, aDir: 0x55, aInd0: 0x56, aInd1: 0x57, aReg: 0x58, dirImm: 0x53, dirA: 0x52, cBit: 0x82, cNBit: 0xb0 }
          : entry.mnemonic === "orl"
            ? { aImm: 0x44, aDir: 0x45, aInd0: 0x46, aInd1: 0x47, aReg: 0x48, dirImm: 0x43, dirA: 0x42, cBit: 0x72, cNBit: 0xa0 }
            : { aImm: 0x64, aDir: 0x65, aInd0: 0x66, aInd1: 0x67, aReg: 0x68, dirImm: 0x63, dirA: 0x62, cBit: -1, cNBit: -1 };
      if (dst.type === "a" && src.type === "imm") return [base.aImm, src.value];
      if (dst.type === "a" && src.type === "direct") return [base.aDir, src.value];
      if (dst.type === "a" && src.type === "indirect") return [src.value === 0 ? base.aInd0 : base.aInd1];
      if (dst.type === "a" && src.type === "reg") return [base.aReg + src.value];
      if (dst.type === "direct" && src.type === "imm") return [base.dirImm, dst.value, src.value];
      if (dst.type === "direct" && src.type === "a") return [base.dirA, dst.value];
      if (base.cBit >= 0 && dst.type === "c" && src.type === "bit") return [base.cBit, src.value];
      if (base.cNBit >= 0 && dst.type === "c" && src.type === "nbit") return [base.cNBit, src.value];
      // Compatibility extension:
      // 8051 has no ANL/ORL/XRL Rn,#imm (or @Ri,#imm), so we lower it through A.
      //   MOV A,Rn/@Ri ; OP A,#imm ; MOV Rn/@Ri,A
      if (src.type === "imm" && dst.type === "reg") {
        const movATarget = 0xe8 + dst.value;
        const opAImm = base.aImm;
        const movTargetA = 0xf8 + dst.value;
        return [movATarget, opAImm, src.value, movTargetA];
      }
      if (src.type === "imm" && dst.type === "indirect") {
        const movATarget = 0xe6 + dst.value;
        const opAImm = base.aImm;
        const movTargetA = 0xf6 + dst.value;
        return [movATarget, opAImm, src.value, movTargetA];
      }
      return fail(`Unsupported ${entry.mnemonic.toUpperCase()} form.`);
    }
    case "add":
    case "addc":
    case "subb": {
      const [dst, src] = ops;
      if (dst.type !== "a") return fail(`${entry.mnemonic.toUpperCase()} expects A as first operand.`);
      const base = entry.mnemonic === "add" ? 0x20 : entry.mnemonic === "addc" ? 0x30 : 0x90;
      if (src.type === "imm") return [base + 0x04, src.value];
      if (src.type === "reg") return [base + 0x08 + src.value];
      if (src.type === "indirect") return [base + 0x06 + src.value];
      if (src.type === "direct") return [base + 0x05, src.value];
      return fail(`Unsupported ${entry.mnemonic.toUpperCase()} form.`);
    }
    case "setb": {
      const [target] = ops;
      if (target.type === "c") return [0xd3];
      if (target.type === "bit") return [0xd2, target.value];
      return fail("SETB expects C or bit.");
    }
    case "clr": {
      const [target] = ops;
      if (target.type === "a") return [0xe4];
      if (target.type === "c") return [0xc3];
      if (target.type === "bit") return [0xc2, target.value];
      return fail("CLR expects A, C, or bit.");
    }
    case "cpl": {
      const [target] = ops;
      if (target.type === "a") return [0xf4];
      if (target.type === "c") return [0xb3];
      if (target.type === "bit") return [0xb2, target.value];
      return fail("CPL expects A, C, or bit.");
    }
    case "push": {
      const [target] = ops;
      if (target.type === "direct") return [0xc0, target.value];
      if (target.type === "a") return [0xc0, 0xe0];
      return fail("PUSH expects direct.");
    }
    case "pop": {
      const [target] = ops;
      if (target.type === "direct") return [0xd0, target.value];
      if (target.type === "a") return [0xd0, 0xe0];
      return fail("POP expects direct.");
    }
    case "dec": {
      const [target] = ops;
      if (target.type === "reg") return [0x18 + target.value];
      if (target.type === "indirect") return [0x16 + target.value];
      if (target.type === "direct") return [0x15, target.value];
      if (target.type === "a") return [0x14];
      return fail("DEC supports A/register/@Ri/direct.");
    }
    case "inc": {
      const [target] = ops;
      if (target.type === "reg") return [0x08 + target.value];
      if (target.type === "indirect") return [0x06 + target.value];
      if (target.type === "direct") return [0x05, target.value];
      if (target.type === "a") return [0x04];
      if (target.type === "dptr") return [0xa3];
      return fail("INC supports A/DPTR/register/@Ri/direct.");
    }
    case "nop":
      return [0x00];
    case "da": {
      const [target] = ops;
      if (!entry.operands.length || target.type === "a") return [0xd4];
      return fail("DA expects A.");
    }
    case "ret":
      return [0x22];
    case "reti":
      return [0x32];
    case "rr": {
      const [target] = ops;
      if (target.type !== "a") return fail("RR expects A.");
      return [0x03];
    }
    case "rl": {
      const [target] = ops;
      if (target.type !== "a") return fail("RL expects A.");
      return [0x23];
    }
    case "rrc": {
      const [target] = ops;
      if (target.type !== "a") return fail("RRC expects A.");
      return [0x13];
    }
    case "rlc": {
      const [target] = ops;
      if (target.type !== "a") return fail("RLC expects A.");
      return [0x33];
    }
    case "swap": {
      const [target] = ops;
      if (target.type !== "a") return fail("SWAP expects A.");
      return [0xc4];
    }
    case "movc": {
      if (
        /^a$/i.test(entry.operands[0] ?? "") &&
        /^@a\+dptr$/i.test((entry.operands[1] ?? "").replace(/\s+/g, ""))
      ) {
        return [0x93];
      }
      if (
        /^a$/i.test(entry.operands[0] ?? "") &&
        /^@a\+pc$/i.test((entry.operands[1] ?? "").replace(/\s+/g, ""))
      ) {
        return [0x83];
      }
      return fail("Only MOVC A,@A+DPTR or MOVC A,@A+PC is supported.");
    }
    case "movx": {
      const [dst, src] = ops;
      if (dst.type === "a" && src.type === "dptrindirect") return [0xe0];
      if (dst.type === "dptrindirect" && src.type === "a") return [0xf0];
      if (dst.type === "a" && src.type === "indirect") return [0xe2 + src.value];
      if (dst.type === "indirect" && src.type === "a") return [0xf2 + dst.value];
      return fail("Unsupported MOVX form.");
    }
    case "mul": {
      if (!entry.operands.length) return [0xa4];
      if (/^ab$/i.test((entry.operands[0] ?? "").replace(/\s+/g, ""))) return [0xa4];
      return fail("Only MUL AB is supported.");
    }
    case "div": {
      if (!entry.operands.length) return [0x84];
      if (/^ab$/i.test((entry.operands[0] ?? "").replace(/\s+/g, ""))) return [0x84];
      return fail("Only DIV AB is supported.");
    }
    case "acall": {
      // ACALL is a 2-byte page-relative call: opcode = 0x11 | (page << 5), addr_low
      // Page = target[15:11] (upper 5 bits). Target must be within the same 2KB page as PC+2.
      const [target] = ops;
      if (target.type !== "addr") return fail("ACALL expects address.");
      const page = (target.value >> 8) & 0xf8; // bits [15:11] -> upper 3 bits of opcode
      const pcPage = ((entry.address + 2) >> 8) & 0xf8;
      if (page !== pcPage) return fail(`ACALL: target 0x${target.value.toString(16).toUpperCase()} is outside the current 2KB page (use LCALL instead).`);
      return [0x11 | (((target.value >> 8) & 0x07) << 5), target.value & 0xff];
    }
    case "call":
    case "lcall": {
      const [target] = ops;
      if (target.type !== "addr") return fail("LCALL expects address.");
      return [0x12, (target.value >> 8) & 0xff, target.value & 0xff];
    }
    case "jmp":
    case "ljmp": {
      const [target] = ops;
      if (entry.mnemonic === "jmp" && target.type === "codeptr") return [0x73];
      if (target.type !== "addr") return fail("JMP expects address.");
      return [0x02, (target.value >> 8) & 0xff, target.value & 0xff];
    }
    case "ajmp": {
      // AJMP is a 2-byte page-relative jump: opcode = 0x01 | (page << 5), addr_low
      const [target] = ops;
      if (target.type !== "addr") return fail("AJMP expects address.");
      const page = (target.value >> 8) & 0xf8;
      const pcPage = ((entry.address + 2) >> 8) & 0xf8;
      if (page !== pcPage) return fail(`AJMP: target 0x${target.value.toString(16).toUpperCase()} is outside the current 2KB page (use LJMP instead).`);
      return [0x01 | (((target.value >> 8) & 0x07) << 5), target.value & 0xff];
    }
    case "sjmp":
    case "jz":
    case "jnz":
    case "jc":
    case "jnc": {
      const [target] = ops;
      if (target.type !== "addr") return fail(`${entry.mnemonic.toUpperCase()} expects label.`);
      const rel = relativeOffset(entry.address, 2, target.value);
      if (rel == null) return fail(`${entry.mnemonic.toUpperCase()} target is out of range.`);
      const opcode =
        entry.mnemonic === "sjmp"
          ? 0x80
          : entry.mnemonic === "jz"
            ? 0x60
            : entry.mnemonic === "jnz"
              ? 0x70
              : entry.mnemonic === "jc"
                ? 0x40
                : 0x50;
      return [opcode, rel];
    }
    case "jb":
    case "jnb": {
      const [bit, target] = ops;
      if (target.type !== "addr" || bit.type !== "bit") return fail(`${entry.mnemonic.toUpperCase()} expects bit,label.`);
      const rel = relativeOffset(entry.address, 3, target.value);
      if (rel == null) return fail(`${entry.mnemonic.toUpperCase()} target is out of range (-128..127).`);
      return [entry.mnemonic === "jb" ? 0x20 : 0x30, bit.value, rel];
    }
    case "jbc": {
      const [bit, target] = ops;
      if (target.type !== "addr" || bit.type !== "bit") return fail("JBC expects bit,label.");
      const rel = relativeOffset(entry.address, 3, target.value);
      if (rel == null) return fail("JBC target is out of range (-128..127).");
      return [0x10, bit.value, rel];
    }
    case "cjne": {
      const [left, right, target] = ops;
      if (target.type !== "addr") return fail("CJNE expects two operands plus label.");
      if (left.type === "a" && right.type === "imm") {
        const rel = relativeOffset(entry.address, 3, target.value);
        if (rel == null) return fail("CJNE target is out of range (-128..127).");
        return [0xb4, right.value, rel];
      }
      if (left.type === "a" && right.type === "direct") {
        const rel = relativeOffset(entry.address, 3, target.value);
        if (rel == null) return fail("CJNE target is out of range (-128..127).");
        return [0xb5, right.value, rel];
      }
      if (left.type === "reg" && right.type === "imm") {
        const rel = relativeOffset(entry.address, 3, target.value);
        if (rel == null) return fail("CJNE target is out of range (-128..127).");
        return [0xb8 + left.value, right.value, rel];
      }
      if (left.type === "indirect" && right.type === "imm") {
        const rel = relativeOffset(entry.address, 3, target.value);
        if (rel == null) return fail("CJNE target is out of range (-128..127).");
        return [0xb6 + left.value, right.value, rel];
      }
      // Keil-style compatibility extension: CJNE direct,#imm,label -> MOV A,direct + CJNE A,#imm,label.
      if (left.type === "direct" && right.type === "imm") {
        const rel = relativeOffset(entry.address + 2, 3, target.value);
        if (rel == null) return fail("CJNE direct compatibility target is out of range (-128..127).");
        return [0xe5, left.value, 0xb4, right.value, rel];
      }
      return fail("Unsupported CJNE form.");
    }
    case "djnz": {
      const [left, target] = ops;
      if (target.type !== "addr") return fail("DJNZ expects label.");
      if (left.type === "reg") {
        const rel = relativeOffset(entry.address, 2, target.value);
        if (rel == null) return fail("DJNZ target is out of range.");
        return [0xd8 + left.value, rel];
      }
      if (left.type === "direct") {
        const rel = relativeOffset(entry.address, 3, target.value);
        if (rel == null) return fail("DJNZ target is out of range.");
        return [0xd5, left.value, rel];
      }
      return fail("Unsupported DJNZ form.");
    }
    default:
      return fail(`Unsupported mnemonic: ${entry.mnemonic}`);
  }
}

function parseOperand(
  operand: string,
  labels: Map<string, number>,
  equ: ConstantMap,
  hint: OperandHint = "any",
  currentAddress = 0,
): Operand {
  const raw = operand.trim();
  if (!raw) return { type: "unknown" };
  if (raw.startsWith("#")) {
    const value = resolveValue(raw.slice(1), labels, equ, currentAddress);
    return value == null ? { type: "unknown" } : { type: "imm", value: value & 0xffff };
  }

  const lower = raw.toLowerCase();
  if (lower === "a" || lower === "acc") return { type: "a" };
  if (lower === "c") return { type: "c" };
  if (lower === "ab") return { type: "ab" };
  if (lower.replace(/\s+/g, "") === "@a+dptr") return { type: "codeptr" };
  if (lower.replace(/\s+/g, "") === "@a+pc") return { type: "codeptrpc" };
  if (lower.replace(/\s+/g, "") === "@dptr") return { type: "dptrindirect" };
  if (lower === "dptr") return { type: "dptr" };
  if (lower === "@r0") return { type: "indirect", value: 0 };
  if (lower === "@r1") return { type: "indirect", value: 1 };
  if (isRegisterToken(lower)) return { type: "reg", value: Number(lower[1]) };

  if (lower.startsWith("/")) {
    const positive = parseOperand(raw.slice(1), labels, equ, "bit", currentAddress);
    if (positive.type === "bit") return { type: "nbit", value: positive.value };
    return { type: "addr", value: 0, unresolved: true };
  }

  const bitMatch = /^p([0-3])\.([0-7])$/i.exec(raw);
  if (bitMatch) {
    const byteBase = [0x80, 0x90, 0xa0, 0xb0][Number(bitMatch[1])];
    return { type: "bit", value: byteBase + Number(bitMatch[2]) };
  }
  const sfrBitMatch = /^([a-z_.$?][\w.$?]*)\.([0-7])$/i.exec(raw);
  if (sfrBitMatch) {
    const baseName = sfrBitMatch[1].toLowerCase();
    const bitIndex = Number(sfrBitMatch[2]);
    const baseAddr =
      resolveValue(baseName, labels, equ, currentAddress) ??
      ADUC841_SFR[baseName as keyof typeof ADUC841_SFR];
    if (baseAddr != null && baseAddr >= 0x80 && baseAddr <= 0xff) {
      return { type: "bit", value: (baseAddr & 0xf8) + bitIndex };
    }
  }

  if (equ.has(lower)) {
    const resolvedNumber = resolveValue(raw, labels, equ, currentAddress);
    if (resolvedNumber != null) {
      if (hint === "immediate") return { type: "imm", value: resolvedNumber & 0xffff };
      if (hint === "bit") return { type: "bit", value: resolvedNumber & 0xff };
      if (hint === "address") return { type: "addr", value: resolvedNumber & 0xffff };
      return { type: "direct", value: resolvedNumber & 0xff };
    }
    const resolvedAlias = resolveAliasToken(lower, equ);
    if (resolvedAlias !== lower) {
      return parseOperand(resolvedAlias, labels, equ, hint, currentAddress);
    }
  }

  if (lower in ADUC841_BITS) {
    return { type: "bit", value: ADUC841_BITS[lower] };
  }

  if (lower in ADUC841_SFR) {
    return { type: "direct", value: ADUC841_SFR[lower as keyof typeof ADUC841_SFR] };
  }

  if (labels.has(lower)) {
    return { type: "addr", value: labels.get(lower) ?? 0 };
  }

  const resolvedNumber = resolveValue(raw, labels, equ, currentAddress);
  if (resolvedNumber != null) {
    if (hint === "immediate") {
      return { type: "imm", value: resolvedNumber & 0xffff };
    }
    if (hint === "bit") {
      return { type: "bit", value: resolvedNumber & 0xff };
    }
    if (hint === "address") {
      return { type: "addr", value: resolvedNumber & 0xffff };
    }
    return { type: "direct", value: resolvedNumber & 0xff };
  }

  const resolvedAlias = resolveAliasToken(lower, equ);
  if (resolvedAlias !== lower) {
    return parseOperand(resolvedAlias, labels, equ, hint, currentAddress);
  }

  return { type: "addr", value: 0, unresolved: true };
}

function operandHints(mnemonic: string, operands: string[]): OperandHint[] {
  const m = mnemonic.toLowerCase();

  // Bit operations: a bare numeric value or a BIT alias means bit address.
  // Examples:
  //   ADCI BIT 0DFH
  //   SCONV BIT 0DCH
  //   CLR ADCI       -> C2 DF
  //   SETB SCONV     -> D2 DC
  //   JNB ADCI,$     -> 30 DF FD
  if (m === "setb" || m === "cpl") return ["bit"];
  if (m === "clr") {
    const op = (operands[0] ?? "").trim().toLowerCase();
    return op === "a" || op === "acc" || op === "c" ? ["any"] : ["bit"];
  }
  if (m === "jb" || m === "jnb" || m === "jbc") return ["bit", "address"];
  if (["acall", "ajmp", "call", "lcall", "ljmp", "sjmp", "jz", "jnz", "jc", "jnc"].includes(m)) {
    return ["address"];
  }
  if (m === "jmp") {
    const target = (operands[0] ?? "").replace(/\s+/g, "").toLowerCase();
    return target === "@a+dptr" ? ["any"] : ["address"];
  }
  if (m === "cjne") return ["any", "any", "address"];
  if (m === "djnz") return ["any", "address"];
  if (m === "mov") {
    const left = (operands[0] ?? "").trim().toLowerCase();
    const right = (operands[1] ?? "").trim().toLowerCase();
    if (left === "c") return ["any", "bit"];
    if (right === "c") return ["bit", "any"];
  }
  if (m === "anl" || m === "orl") {
    const left = (operands[0] ?? "").trim().toLowerCase();
    if (left === "c") return ["any", "bit"];
  }

  // In real 8051 assembly, immediate operands are explicit: #value.
  // Numeric symbols from EQU/DATA without # must remain direct addresses.
  // Example:
  //   DAT EQU 0x20
  //   MOV DAT,#0x31 -> MOV direct,#imm  (75 20 31)
  //   MOV A,DAT     -> MOV A,direct     (E5 20)
  // Do not force MOV A,<number-or-equ> to immediate here.
  return operands.map(() => "any");
}

function resolveValue(
  token: string,
  labels: Map<string, number>,
  equ: ConstantMap,
  currentAddress = 0,
  resolving: ReadonlySet<string> = new Set(),
): number | null {
  return evaluateAsmExpression(token, (name) => {
    const lower = name.toLowerCase();
    if (lower === "$") return currentAddress & 0xffff;
    if (labels.has(lower)) return labels.get(lower) ?? null;
    const definition = equ.get(lower);
    if (definition) {
      if (resolving.has(lower)) return null;
      const nextResolving = new Set(resolving);
      nextResolving.add(lower);
      return resolveValue(definition.expression, labels, equ, definition.address, nextResolving);
    }
    if (lower in ADUC841_SFR) return ADUC841_SFR[lower as keyof typeof ADUC841_SFR];
    if (lower in ADUC841_BITS) return ADUC841_BITS[lower];
    return null;
  });
}

type AsmExpressionToken =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string };

function evaluateAsmExpression(
  raw: string,
  resolveName: (name: string) => number | null,
  isDefined?: (name: string) => boolean,
): number | null {
  const tokens = tokenizeAsmExpression(raw);
  if (!tokens?.length) return null;
  let index = 0;
  let suppressedEvaluation = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const parsePrimary = (): number | null => {
    const token = take();
    if (!token) return null;
    if (token.kind === "number") return token.value;
    if (token.kind === "name") return suppressedEvaluation ? 0 : resolveName(token.value);
    if (token.kind === "op" && token.value === "(") {
      const value = parseLogicalOr();
      const close = take();
      return close?.kind === "op" && close.value === ")" ? value : null;
    }
    return null;
  };

  const parseUnary = (): number | null => {
    const token = peek();
    if (token?.kind === "name" && token.value.toLowerCase() === "defined") {
      take();
      let nameToken: AsmExpressionToken | undefined;
      if (peek()?.kind === "op" && peek().value === "(") {
        take();
        nameToken = take();
        const close = take();
        if (close?.kind !== "op" || close.value !== ")") return null;
      } else {
        nameToken = take();
      }
      if (nameToken?.kind !== "name") return null;
      if (suppressedEvaluation) return 0;
      return (isDefined ? isDefined(nameToken.value) : resolveName(nameToken.value) != null) ? 1 : 0;
    }
    if (token?.kind === "name" && ["low", "lo", "high", "hi"].includes(token.value.toLowerCase())) {
      const operator = token.value.toLowerCase();
      take();
      let value: number | null;
      if (peek()?.kind === "op" && peek().value === "(") {
        take();
        value = parseLogicalOr();
        const close = take();
        if (close?.kind !== "op" || close.value !== ")") return null;
      } else {
        value = parseUnary();
      }
      if (value == null) return null;
      return operator === "low" || operator === "lo" ? value & 0xff : (value >> 8) & 0xff;
    }
    if (token?.kind === "op" && ["+", "-", "~", "!", "<", ">"].includes(token.value)) {
      const operator = token.value;
      take();
      const value = parseUnary();
      if (value == null) return null;
      if (operator === "+") return value;
      if (operator === "-") return -value;
      if (operator === "~") return ~value;
      if (operator === "!") return value === 0 ? 1 : 0;
      return operator === "<" ? value & 0xff : (value >> 8) & 0xff;
    }
    return parsePrimary();
  };

  const binary = (
    next: () => number | null,
    operators: string[],
    apply: (left: number, operator: string, right: number) => number | null,
  ): number | null => {
    let left = next();
    if (left == null) return null;
    while (true) {
      const operatorToken = peek();
      if (operatorToken?.kind !== "op" || !operators.includes(operatorToken.value)) break;
      const operator = operatorToken.value;
      take();
      const right = next();
      if (right == null) return null;
      left = suppressedEvaluation ? 0 : apply(left, operator, right);
      if (left == null || !Number.isSafeInteger(left)) return null;
    }
    return left;
  };

  const parseMul = (): number | null => binary(parseUnary, ["*", "/", "%"], (left, operator, right) => {
    if ((operator === "/" || operator === "%") && right === 0) return null;
    if (operator === "*") return left * right;
    return operator === "/" ? Math.trunc(left / right) : left % right;
  });
  const parseAdd = (): number | null =>
    binary(parseMul, ["+", "-"], (left, operator, right) => operator === "+" ? left + right : left - right);
  const parseShift = (): number | null => binary(parseAdd, ["<<", ">>"], (left, operator, right) => {
    if (right < 0 || right > 31) return null;
    return operator === "<<" ? left * 2 ** right : left >> right;
  });
  const parseRelational = (): number | null => binary(
    parseShift,
    ["<", "<=", ">", ">="],
    (left, operator, right) => {
      if (operator === "<") return left < right ? 1 : 0;
      if (operator === "<=") return left <= right ? 1 : 0;
      if (operator === ">") return left > right ? 1 : 0;
      return left >= right ? 1 : 0;
    },
  );
  const parseEquality = (): number | null => binary(
    parseRelational,
    ["=", "==", "!=", "<>"],
    (left, operator, right) => operator === "=" || operator === "=="
      ? (left === right ? 1 : 0)
      : (left !== right ? 1 : 0),
  );
  const parseAnd = (): number | null => binary(parseEquality, ["&"], (left, _operator, right) => left & right);
  const parseXor = (): number | null => binary(parseAnd, ["^"], (left, _operator, right) => left ^ right);
  const parseOr = (): number | null => binary(parseXor, ["|"], (left, _operator, right) => left | right);
  const parseLogicalAnd = (): number | null => {
    let left = parseOr();
    if (left == null) return null;
    while (peek()?.kind === "op" && peek().value === "&&") {
      take();
      const shortCircuit = suppressedEvaluation === 0 && left === 0;
      if (shortCircuit) suppressedEvaluation += 1;
      const right = parseOr();
      if (shortCircuit) suppressedEvaluation -= 1;
      if (right == null) return null;
      left = suppressedEvaluation ? 0 : left !== 0 && right !== 0 ? 1 : 0;
    }
    return left;
  };
  const parseLogicalOr = (): number | null => {
    let left = parseLogicalAnd();
    if (left == null) return null;
    while (peek()?.kind === "op" && peek().value === "||") {
      take();
      const shortCircuit = suppressedEvaluation === 0 && left !== 0;
      if (shortCircuit) suppressedEvaluation += 1;
      const right = parseLogicalAnd();
      if (shortCircuit) suppressedEvaluation -= 1;
      if (right == null) return null;
      left = suppressedEvaluation ? 0 : left !== 0 || right !== 0 ? 1 : 0;
    }
    return left;
  };

  const value = parseLogicalOr();
  return value != null && index === tokens.length && Number.isSafeInteger(value) ? value : null;
}

function tokenizeAsmExpression(raw: string): AsmExpressionToken[] | null {
  const tokens: AsmExpressionToken[] = [];
  const wordOperators: Record<string, string> = {
    shl: "<<",
    shr: ">>",
    and: "&",
    or: "|",
    xor: "^",
    mod: "%",
    not: "~",
    eq: "==",
    ne: "!=",
    lt: "<",
    le: "<=",
    gt: ">",
    ge: ">=",
  };
  let index = 0;
  while (index < raw.length) {
    if (/\s/.test(raw[index])) {
      index += 1;
      continue;
    }
    if (raw[index] === "'") {
      let end = index + 1;
      let escaped = false;
      while (end < raw.length) {
        if (!escaped && raw[end] === "'") break;
        if (!escaped && raw[end] === "\\") escaped = true;
        else escaped = false;
        end += 1;
      }
      if (end >= raw.length) return null;
      const decoded = decodeEscapedText(raw.slice(index + 1, end));
      const characters = decoded == null ? [] : Array.from(decoded);
      if (characters.length !== 1) return null;
      tokens.push({ kind: "number", value: characters[0].codePointAt(0) ?? 0 });
      index = end + 1;
      continue;
    }
    const tail = raw.slice(index);
    const numberMatch = /^([0-9a-f]+h|0x[0-9a-f]+|0b[01]+|[01]+b|\d+)/i.exec(tail);
    if (numberMatch) {
      const text = numberMatch[1];
      const value = /^0x/i.test(text)
        ? Number.parseInt(text.slice(2), 16)
        : /^0b/i.test(text)
          ? Number.parseInt(text.slice(2), 2)
          : /h$/i.test(text)
            ? Number.parseInt(text.slice(0, -1), 16)
            : /b$/i.test(text)
              ? Number.parseInt(text.slice(0, -1), 2)
              : Number.parseInt(text, 10);
      tokens.push({ kind: "number", value });
      index += text.length;
      continue;
    }
    const nameMatch = /^([A-Za-z_.$?][\w.$?]*)/.exec(tail);
    if (nameMatch) {
      const name = nameMatch[1];
      const operator = wordOperators[name.toLowerCase()];
      tokens.push(operator ? { kind: "op", value: operator } : { kind: "name", value: name });
      index += name.length;
      continue;
    }
    const twoCharacterOperator = ["<<", ">>", "<=", ">=", "==", "!=", "<>", "&&", "||"]
      .find((candidate) => tail.startsWith(candidate));
    const operator = twoCharacterOperator ?? raw[index];
    if (["+", "-", "*", "/", "%", "&", "|", "^", "~", "!", "=", "<", ">", "(", ")", "<<", ">>", "<=", ">=", "==", "!=", "<>", "&&", "||"].includes(operator)) {
      tokens.push({ kind: "op", value: operator });
      index += operator.length;
      continue;
    }
    return null;
  }
  return tokens;
}

function resolveAliasToken(token: string, equ: ConstantMap, depth = 0): string {
  const raw = token.trim().toLowerCase();
  if (!raw || depth > 16) return raw;
  const definition = equ.get(raw);
  if (!definition) return raw;
  const next = definition.expression.trim().toLowerCase();
  if (!next || next === raw) return raw;
  return resolveAliasToken(next, equ, depth + 1);
}

function relativeOffset(origin: number, size: number, target: number): number | null {
  const diff = target - (origin + size);
  if (diff < -128 || diff > 127) return null;
  return diff & 0xff;
}

function flattenMap(map: Map<number, number>): Uint8Array {
  const bytes: number[] = [];
  [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([addr, value]) => {
      bytes.push(addr & 0xffff, value & 0xff);
    });
  return Uint8Array.from(bytes);
}

function toIntelHex(map: Map<number, number>): string {
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  if (!entries.length) return "";
  const lines: string[] = [];
  let index = 0;
  while (index < entries.length) {
    const chunk = [entries[index]];
    let nextAddr = entries[index][0] + 1;
    index += 1;
    while (index < entries.length && chunk.length < 16 && entries[index][0] === nextAddr) {
      chunk.push(entries[index]);
      nextAddr += 1;
      index += 1;
    }
    const start = chunk[0][0] & 0xffff;
    const data = chunk.map(([, value]) => value & 0xff);
    const bytes = [data.length, (start >> 8) & 0xff, start & 0xff, 0x00, ...data];
    const checksum = (~bytes.reduce((sum, value) => (sum + value) & 0xff, 0) + 1) & 0xff;
    lines.push(
      ":" +
        bytes
          .concat(checksum)
          .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
          .join(""),
    );
  }
  lines.push(":00000001FF");
  return lines.join("\n");
}

function isRegisterToken(token: string): boolean {
  return /^r[0-7]$/i.test(token);
}

function isNumericLiteralToken(token: string): boolean {
  const raw = token.trim().toLowerCase();
  return (
    /^0x[0-9a-f]+$/.test(raw) ||
    /^0b[01]+$/.test(raw) ||
    /^[0-9a-f]+h$/.test(raw) ||
    /^[01]+b$/.test(raw) ||
    /^\d+$/.test(raw)
  );
}

type Operand =
  | { type: "imm"; value: number }
  | { type: "reg"; value: number }
  | { type: "a" }
  | { type: "c" }
  | { type: "ab" }
  | { type: "codeptr" }
  | { type: "codeptrpc" }
  | { type: "dptrindirect" }
  | { type: "indirect"; value: 0 | 1 }
  | { type: "dptr" }
  | { type: "direct"; value: number }
  | { type: "bit"; value: number }
  | { type: "nbit"; value: number }
  | { type: "addr"; value: number; unresolved?: boolean }
  | { type: "unknown" };
