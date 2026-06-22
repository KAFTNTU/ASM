import type { AsmDiagnostic } from "./asmCompiler";

export type CTranspileResult = {
  ok: boolean;
  asm: string;
  diagnostics: AsmDiagnostic[];
};

type RegisterName =
  | "p0" | "p1" | "p2" | "p3" | "a" | "acc" | "b"
  | "pwmcon" | "pwm0l" | "pwm0h" | "pwm1l" | "pwm1h"
  | "adccon1" | "adccon2"
  | "daccon" | "dac0l" | "dac0h" | "dac1l" | "dac1h";

const REGISTER_SET = new Set<RegisterName>([
  "p0", "p1", "p2", "p3", "a", "acc", "b",
  "pwmcon", "pwm0l", "pwm0h", "pwm1l", "pwm1h",
  "adccon1", "adccon2",
  "daccon", "dac0l", "dac0h", "dac1l", "dac1h",
]);

type ParsedStatement = { text: string; line: number };
type PointerKind = "ram" | "code";
type ParamInfo = {
  name: string;
  pointer: boolean;
  structName?: string;
  pointerKind?: PointerKind;
  argOffset?: number;
  size?: number;
};
type FunctionInfo = { name: string; body: string; lineOffset: number; order: number; params: ParamInfo[] };
type ScalarVar = { name: string; addr: number };
type LocalArrayVar = { name: string; baseAddr: number; length: number };
type StructField = { name: string; offset: number; size: number; structName?: string };
type StructDef = { name: string; fields: StructField[]; size: number };
type StructVar = { name: string; structName: string; baseAddr: number };

type TranspileContext = {
  sbitMap: Map<string, string>;
  sfrMap: Map<string, string>;
  arrays: Map<string, number[]>;
  structDefs: Map<string, StructDef>;
  functions: Map<string, FunctionInfo>;
  diagnostics: AsmDiagnostic[];
  vars: Map<string, ScalarVar>;
  pointerVars: Map<string, PointerKind>;
  pointerStructTypes: Map<string, string>;
  localArrays: Map<string, LocalArrayVar>;
  structVars: Map<string, StructVar>;
  nextVarAddr: { value: number };
  labelCounter: { value: number };
};

const ARG_BASE = 0x20;
const MAX_ARGS = 8;

export function transpileCToAsm(source: string): CTranspileResult {
  const diagnostics: AsmDiagnostic[] = [];
  const text = normalizeControlFlowBodies(stripComments(source).replace(/\r/g, ""));
  const sbitMap = parseSbits(text);
  const sfrMap = parseSfrs(text);
  const arrays = parseArrays(text, diagnostics);
  const structDefs = parseStructDefs(text, diagnostics);
  const functions = extractFunctions(text, diagnostics);
  const mainFn = functions.get("main");

  if (!mainFn) {
    diagnostics.push({ level: "error", message: "C: main() body was not found." });
    return { ok: false, asm: "", diagnostics };
  }

  const emitted: string[] = [];
  let needDelay = false;
  let needWrite = false;
  const labelCounter = { value: 0 };
  const nextVarAddr = { value: 0x30 };

  for (const [name, value] of sfrMap) {
    emitted.push(`${name} data ${value}`);
  }
  if (emitted.length) emitted.push("");

  emitted.push("org 0x0000");
  emitted.push("start:");
  emitted.push("call main");
  emitted.push("sjmp start");
  emitted.push("");

  const orderedFunctions = Array.from(functions.values()).sort((a, b) => a.order - b.order);
  for (const fn of orderedFunctions) {
    emitted.push(`${fn.name}:`);
    const fnCtx: TranspileContext = {
      sbitMap,
      sfrMap,
      arrays,
      structDefs,
      functions,
      diagnostics,
      vars: new Map(),
      pointerVars: new Map(),
      pointerStructTypes: new Map(),
      localArrays: new Map(),
      structVars: new Map(),
      nextVarAddr,
      labelCounter,
    };
    bindFunctionParams(fn, fnCtx, diagnostics);
    const statements = splitStatements(fn.body);
    for (const statement of statements) {
      const chunk = transpileStatement(statement, fn.lineOffset, fnCtx);
      emitted.push(...chunk.code);
      needDelay ||= chunk.needDelay;
      needWrite ||= chunk.needWrite;
    }
    if (emitted[emitted.length - 1] !== "ret") {
      emitted.push("ret");
    }
    emitted.push("");
  }

  if (needWrite) {
    emitted.push("write:");
    emitted.push("setb p3.6");
    emitted.push("mov p0,r7");
    emitted.push("mov p2,r6");
    emitted.push("nop");
    emitted.push("mov p2,#0");
    emitted.push("ret");
    emitted.push("");
  }

  if (needDelay) {
    emitted.push("delay:");
    emitted.push("mov r3,#25");
    emitted.push("d3:");
    emitted.push("mov r2,#255");
    emitted.push("d2:");
    emitted.push("mov r1,#255");
    emitted.push("d1:");
    emitted.push("djnz r1,d1");
    emitted.push("djnz r2,d2");
    emitted.push("djnz r3,d3");
    emitted.push("ret");
    emitted.push("");
  }

  for (const [name, values] of arrays) {
    emitted.push(`${name}:`);
    emitted.push(`db ${values.map((value) => toAsmByte(value)).join(", ")}`);
    emitted.push("");
  }

  emitted.push("end");

  if (!diagnostics.some((item) => item.level === "error")) {
    diagnostics.push({ level: "hint", message: "C transpiled to ASM." });
  }

  return {
    ok: diagnostics.every((item) => item.level !== "error"),
    asm: emitted.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n"),
    diagnostics,
  };
}

function transpileStatement(
  statement: ParsedStatement,
  lineOffset: number,
  ctx: TranspileContext,
): { code: string[]; needDelay: boolean; needWrite: boolean } {
  const raw = statement.text.trim();
  const rawNoSemi = raw.replace(/;+\s*$/, "");
  if (!raw) return { code: [], needDelay: false, needWrite: false };
  const line = lineOffset + statement.line;

  if (/^sbit\b/i.test(raw) || /^sfr\b/i.test(raw)) {
    return { code: [], needDelay: false, needWrite: false };
  }

  const switchStatement = /^switch\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
  if (switchStatement) {
    return transpileSwitchStatement(switchStatement[1], switchStatement[2], statement, lineOffset, ctx, line);
  }

  const structDeclaration = /^struct\s+([A-Za-z_]\w*)\s+([\s\S]+)$/i.exec(rawNoSemi);
  if (structDeclaration) {
    const structName = structDeclaration[1].toLowerCase();
    const def = ctx.structDefs.get(structName);
    if (!def) {
      ctx.diagnostics.push({ level: "warning", line, message: `Unknown struct type: ${structDeclaration[1]}` });
      return { code: [], needDelay: false, needWrite: false };
    }
    const out: string[] = [];
    for (const decl of splitCsv(structDeclaration[2])) {
      const item = decl.trim();
      const pointerMatch = /^\*\s*([A-Za-z_]\w*)$/.exec(item);
      if (pointerMatch) {
        const variable = ensureVar(ctx, pointerMatch[1].toLowerCase(), line);
        ctx.pointerVars.set(pointerMatch[1].toLowerCase(), "ram");
        ctx.pointerStructTypes.set(pointerMatch[1].toLowerCase(), structName);
        out.push(`mov ${variableTarget(variable)},#0x0`);
        continue;
      }
      const scalar = /^([A-Za-z_]\w*)$/.exec(item);
      if (!scalar) {
        ctx.diagnostics.push({ level: "warning", line, message: `Unsupported struct declaration: ${item}` });
        continue;
      }
      const baseAddr = allocateBlock(ctx, def.size, line);
      const varName = scalar[1].toLowerCase();
      ctx.structVars.set(varName, { name: varName, structName, baseAddr });
      for (const field of def.fields) {
        for (let i = 0; i < field.size; i++) {
          const target = toAsmByte(baseAddr + field.offset + i);
          out.push(`mov ${target},#0x0`);
        }
      }
    }
    return { code: out, needDelay: false, needWrite: false };
  }

  const declaration = /^(?:unsigned\s+)?(?:char|int)\s+([\s\S]+)$/.exec(rawNoSemi);
  if (declaration && !/^for\b/i.test(raw)) {
    const declarators = splitCsv(declaration[1]);
    const out: string[] = [];
    for (const item of declarators) {
      const part = item.trim();
      if (!part) continue;
      const localArray = /^([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\](?:\s*=\s*\{([\s\S]*)\})?$/.exec(part);
      if (localArray) {
        const name = localArray[1].toLowerCase();
        const length = Number(localArray[2]) || 1;
        const baseAddr = allocateBlock(ctx, length, line);
        ctx.localArrays.set(name, { name, baseAddr, length });
        const values = localArray[3] ? splitCsv(localArray[3]).map((token) => tryEvalConst(token) ?? 0) : [];
        for (let i = 0; i < length; i++) {
          out.push(`mov ${toAsmByte(baseAddr + i)},#${toAsmByte8(values[i] ?? 0)}`);
        }
        continue;
      }
      const codePointerDecl = /^code\s*\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
      if (codePointerDecl) {
        const name = codePointerDecl[1].toLowerCase();
        const base = allocateBlock(ctx, 2, line);
        ctx.vars.set(name, { name, addr: base });
        ctx.pointerVars.set(name, "code");
        if (codePointerDecl[2]) {
          const codeExpr = codePointerImmediate(codePointerDecl[2], ctx);
          if (codeExpr) {
            out.push(`mov ${toAsmByte(base)},#${codeExpr.low}`, `mov ${toAsmByte(base + 1)},#${codeExpr.high}`);
          } else {
            const addr = resolveAddressExpression(codePointerDecl[2], ctx) ?? 0;
            out.push(`mov ${toAsmByte(base)},#${toAsmByte8(addr)}`, `mov ${toAsmByte(base + 1)},#0x0`);
          }
        } else {
          out.push(`mov ${toAsmByte(base)},#0x0`, `mov ${toAsmByte(base + 1)},#0x0`);
        }
        continue;
      }
      const pointerDecl = /^\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
      if (pointerDecl) {
        const name = pointerDecl[1].toLowerCase();
        const variable = ensureVar(ctx, name, line);
        ctx.pointerVars.set(name, "ram");
        if (pointerDecl[2]) {
          out.push(...emitAssignToTarget(variableTarget(variable), pointerDecl[2], ctx, line));
        } else {
          out.push(`mov ${variableTarget(variable)},#0x0`);
        }
        continue;
      }
      const match = /^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
      if (!match) {
        ctx.diagnostics.push({ level: "warning", line, message: `Unsupported declaration: ${part}` });
        continue;
      }
      const name = match[1].toLowerCase();
      const variable = ensureVar(ctx, name, line);
      if (match[2]) {
        out.push(...emitAssignToTarget(variableTarget(variable), match[2], ctx, line));
      }
    }
    return { code: out, needDelay: false, needWrite: false };
  }

  const whileLoop = /^while\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
  if (whileLoop) {
    const loopLabel = nextLabel(ctx, "while");
    const endLabel = nextLabel(ctx, "wend");
    const bodyStatements = splitStatements(whileLoop[2]);
    const out: string[] = [`${loopLabel}:`];
    out.push(...emitConditionFalseJump(whileLoop[1], endLabel, ctx, line));
    let needDelay = false;
    let needWrite = false;
    for (const stmt of bodyStatements) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(`ljmp ${loopLabel}`);
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
  }

  const forLoop = /^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
  if (forLoop) {
    const out: string[] = [];
    let needDelay = false;
    let needWrite = false;
    const initStmt = forLoop[1].trim();
    if (initStmt) {
      const translated = transpileStatement({ text: `${initStmt};`, line: statement.line }, lineOffset, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    const loopLabel = nextLabel(ctx, "for");
    const endLabel = nextLabel(ctx, "fend");
    out.push(`${loopLabel}:`);
    out.push(...emitConditionFalseJump(forLoop[2], endLabel, ctx, line));
    for (const stmt of splitStatements(forLoop[4])) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    const stepStmt = forLoop[3].trim();
    if (stepStmt) {
      const translated = transpileStatement({ text: `${stepStmt};`, line: statement.line }, lineOffset, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(`ljmp ${loopLabel}`);
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
  }

  const ifStatement = parseIfStatement(raw);
  if (ifStatement?.elseBody != null) {
    const elseLabel = nextLabel(ctx, "else");
    const endLabel = nextLabel(ctx, "endif");
    const out: string[] = [];
    let needDelay = false;
    let needWrite = false;
    out.push(...emitConditionFalseJump(ifStatement.condition, elseLabel, ctx, line));
    for (const stmt of splitStatements(ifStatement.thenBody)) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(`sjmp ${endLabel}`);
    out.push(`${elseLabel}:`);
    for (const stmt of splitStatements(ifStatement.elseBody)) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
  }

  if (ifStatement) {
    const endLabel = nextLabel(ctx, "endif");
    const out: string[] = [];
    let needDelay = false;
    let needWrite = false;
    out.push(...emitConditionFalseJump(ifStatement.condition, endLabel, ctx, line));
    for (const stmt of splitStatements(ifStatement.thenBody)) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
  }

  const doWhile = /^do\s*\{([\s\S]*)\}\s*while\s*\(([^)]*)\)\s*;?$/i.exec(raw);
  if (doWhile) {
    const loopLabel = nextLabel(ctx, "do");
    const endLabel = nextLabel(ctx, "dend");
    const out: string[] = [`${loopLabel}:`];
    let needDelay = false;
    let needWrite = false;
    for (const stmt of splitStatements(doWhile[1])) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push(...emitConditionFalseJump(doWhile[2], endLabel, ctx, line));
    out.push(`ljmp ${loopLabel}`);
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
  }

  const writeCall = /^write\s*\((.+),(.+)\)\s*;?$/i.exec(raw);
  if (writeCall) {
    const digit = normalizeNumber(writeCall[1]);
    const value = normalizeNumber(writeCall[2]);
    if (!digit || !value) {
      ctx.diagnostics.push({ level: "error", line, message: `Unsupported write(...) args: ${raw}` });
      return { code: [], needDelay: false, needWrite: false };
    }
    return {
      code: [`mov r7,#${digit}`, `mov r6,#${value}`, "call write"],
      needDelay: false,
      needWrite: true,
    };
  }

  if (/^delay\s*\(\s*\)\s*;?$/i.test(raw)) {
    return { code: ["call delay"], needDelay: true, needWrite: false };
  }

  if (/^_nop_\s*\(\s*\)\s*;?$/i.test(raw)) {
    return { code: ["nop"], needDelay: false, needWrite: false };
  }

  const returnExpr = /^return\s+([\s\S]+?)\s*;?$/i.exec(raw);
  if (returnExpr) {
    return { code: [...emitExprToA(returnExpr[1], ctx, line), "ret"], needDelay: false, needWrite: false };
  }

  if (/^return\s*;?$/i.test(raw)) {
    return { code: ["ret"], needDelay: false, needWrite: false };
  }

  const functionCall = /^([A-Za-z_]\w*)\s*\(([^)]*)\)\s*;?$/.exec(raw);
  if (functionCall) {
    const callee = functionCall[1].toLowerCase();
    if (callee === "write" || callee === "delay" || callee === "_nop_") {
      // handled above
    } else if (ctx.functions.has(callee)) {
      return { code: emitFunctionCall(callee, functionCall[2], ctx, line), needDelay: false, needWrite: false };
    }
  }

  const increment = /^([A-Za-z_]\w*)\s*(\+\+|--)\s*;?$/.exec(raw) || /^(\+\+|--)([A-Za-z_]\w*)\s*;?$/.exec(raw);
  if (increment) {
    const name = (increment[1].startsWith("+") || increment[1].startsWith("-")) ? increment[2] : increment[1];
    const op = (increment[1].startsWith("+") || increment[1].startsWith("-")) ? increment[1] : increment[2];
    const target = resolveTarget(name.toLowerCase(), ctx);
    if (!target) {
      ctx.diagnostics.push({ level: "warning", line, message: `Unknown variable in increment: ${name}` });
      return { code: [], needDelay: false, needWrite: false };
    }
      if (ctx.pointerVars.get(name.toLowerCase()) === "code") {
        const nextByte = toAsmByte(Number.parseInt(target.slice(2), 16) + 1);
        const skip = nextLabel(ctx, "pincskip");
        return {
          code: op === "++"
            ? [`inc ${target}`, `mov a,${target}`, `jnz ${skip}`, `inc ${nextByte}`, `${skip}:`]
            : [`mov a,${target}`, `jnz ${skip}`, `dec ${nextByte}`, `${skip}:`, `dec ${target}`],
          needDelay: false,
          needWrite: false,
        };
      }
    return { code: [`${op === "++" ? "inc" : "dec"} ${target}`], needDelay: false, needWrite: false };
  }

  const compound = /^([A-Za-z_]\w*)\s*([|&^+\-])=\s*([\s\S]+?)\s*;?$/.exec(raw);
  if (compound) {
    const left = resolveTarget(compound[1].toLowerCase(), ctx);
    if (!left) {
      ctx.diagnostics.push({ level: "warning", line, message: `Unknown assignment target: ${compound[1]}` });
      return { code: [], needDelay: false, needWrite: false };
    }
    const out = [`mov a,${left}`, ...emitApplyBinaryToA(compound[2], compound[3], ctx, line), `mov ${left},a`];
    return { code: out, needDelay: false, needWrite: false };
  }

  const setBit = /^([A-Za-z_]\w*)\s*=\s*(0|1)\s*;?$/.exec(raw);
  if (setBit) {
    const bit = ctx.sbitMap.get(setBit[1].toLowerCase());
    if (bit) {
      return {
        code: [setBit[2] === "1" ? `setb ${bit}` : `clr ${bit}`],
        needDelay: false,
        needWrite: false,
      };
    }
  }

  const complexAssign = /^([\w\.\-\>\*\[\]\s]+?)\s*=\s*([\s\S]+?)\s*;?$/.exec(raw);
  if (complexAssign && !/^[A-Za-z_]\w*\s*=/.test(raw)) {
    const targetCode = emitStoreToLValue(complexAssign[1], complexAssign[2], ctx, line);
    if (targetCode) return { code: targetCode, needDelay: false, needWrite: false };
  }

  const assign = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+?)\s*;?$/.exec(raw);
  if (assign) {
    const leftName = assign[1].toLowerCase();
    const bit = ctx.sbitMap.get(leftName);
    if (bit) {
      const constValue = tryEvalConst(assign[2]);
      if (constValue != null) {
        return { code: [constValue ? `setb ${bit}` : `clr ${bit}`], needDelay: false, needWrite: false };
      }
      ctx.diagnostics.push({ level: "warning", line, message: `Unsupported bit assignment: ${raw}` });
      return { code: [], needDelay: false, needWrite: false };
    }

    const left = resolveOrCreateTarget(leftName, ctx, line);
    if (!left) {
      ctx.diagnostics.push({ level: "warning", line, message: `Unknown assignment target: ${assign[1]}` });
      return { code: [], needDelay: false, needWrite: false };
    }

    const out = emitAssignToTarget(left, assign[2], ctx, line);
    return { code: out, needDelay: false, needWrite: false };
  }

  ctx.diagnostics.push({ level: "warning", line, message: `C line not translated: ${raw}` });
  return { code: [], needDelay: false, needWrite: false };
}

function parseSbits(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /sbit\s+([A-Za-z_]\w*)\s*=\s*P([0-3])\^([0-7])\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    map.set(m[1].toLowerCase(), `p${m[2]}.${m[3]}`);
  }
  return map;
}

function parseSfrs(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /sfr\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const value = normalizeNumber(m[2]);
    if (value) map.set(m[1].toLowerCase(), value);
  }
  return map;
}

function parseArrays(source: string, diagnostics: AsmDiagnostic[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const re = /(?:unsigned\s+)?char\s+([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const values: number[] = [];
    for (const token of splitCsv(m[2])) {
      const value = tryEvalConst(token);
      if (value == null) {
        diagnostics.push({ level: "warning", message: `Array element could not be parsed: ${token.trim()}` });
        continue;
      }
      values.push(value & 0xff);
    }
    map.set(m[1].toLowerCase(), values);
  }
  return map;
}

function parseStructDefs(source: string, diagnostics: AsmDiagnostic[]): Map<string, StructDef> {
  const defs = new Map<string, StructDef>();
  const re = /struct\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1].toLowerCase();
    const fields: StructField[] = [];
    let offset = 0;
    for (const part of splitStatements(m[2])) {
      const line = part.text.trim().replace(/;+\s*$/, "");
      const fieldMatch = /^(?:unsigned\s+)?(?:char|int)\s+([\s\S]+)$/i.exec(line);
      const nestedMatch = /^struct\s+([A-Za-z_]\w*)\s+([\s\S]+)$/i.exec(line);
      if (nestedMatch) {
        const nestedName = nestedMatch[1].toLowerCase();
        const nestedDef = defs.get(nestedName);
        if (!nestedDef) {
          diagnostics.push({ level: "warning", message: `Unknown nested struct type: ${nestedMatch[1]}` });
          continue;
        }
        for (const decl of splitCsv(nestedMatch[2])) {
          const item = decl.trim();
          const arr = /^([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]$/.exec(item);
          if (arr) {
            const length = Number(arr[2]) || 1;
            fields.push({ name: arr[1].toLowerCase(), offset, size: nestedDef.size * length, structName: nestedName });
            offset += nestedDef.size * length;
            continue;
          }
          const scalar = /^([A-Za-z_]\w*)$/.exec(item);
          if (scalar) {
            fields.push({ name: scalar[1].toLowerCase(), offset, size: nestedDef.size, structName: nestedName });
            offset += nestedDef.size;
            continue;
          }
        }
        continue;
      }
      if (!fieldMatch) {
        diagnostics.push({ level: "warning", message: `Unsupported struct field declaration: ${line}` });
        continue;
      }
      for (const decl of splitCsv(fieldMatch[1])) {
        const item = decl.trim();
        const arr = /^([A-Za-z_]\w*)\s*\[\s*(\d+)\s*\]$/.exec(item);
        if (arr) {
          const length = Number(arr[2]) || 1;
          fields.push({ name: arr[1].toLowerCase(), offset, size: length });
          offset += length;
          continue;
        }
        const scalar = /^([A-Za-z_]\w*)$/.exec(item);
        if (scalar) {
          fields.push({ name: scalar[1].toLowerCase(), offset, size: 1 });
          offset += 1;
          continue;
        }
        diagnostics.push({ level: "warning", message: `Unsupported struct field: ${item}` });
      }
    }
    defs.set(name, { name, fields, size: offset });
  }
  return defs;
}

function extractFunctions(source: string, diagnostics: AsmDiagnostic[]): Map<string, FunctionInfo> {
  const functions = new Map<string, FunctionInfo>();
  const re = /(?:void|unsigned\s+char|char|unsigned\s+int|int|struct\s+[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gi;
  let match: RegExpExecArray | null;
  let order = 0;
  while ((match = re.exec(source))) {
    const name = match[1].toLowerCase();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = findMatchingBrace(source, bodyStart - 1);
    if (bodyEnd < 0) {
      diagnostics.push({ level: "error", message: `Function ${name} has an unbalanced body.` });
      continue;
    }
    const body = source.slice(bodyStart, bodyEnd);
    const lineOffset = source.slice(0, bodyStart).split("\n").length - 1;
    functions.set(name, { name, body, lineOffset, order: order++, params: parseParamList(match[2]) });
    re.lastIndex = bodyEnd + 1;
  }
  return functions;
}

function splitStatements(source: string): ParsedStatement[] {
  const list: ParsedStatement[] = [];
  let index = 0;
  let currentLine = 1;

  while (index < source.length) {
    const start = skipWhitespace(source, index);
    currentLine += (source.slice(index, start).match(/\n/g) ?? []).length;
    if (start >= source.length) break;

    const statement = consumeStatementLike(source, start);
    if (!statement) break;

    const text = statement.text.trim();
    if (text) list.push({ text, line: currentLine });

    currentLine += (source.slice(start, statement.end).match(/\n/g) ?? []).length;
    index = statement.end;
  }

  return list;
}

function emitAssignToTarget(target: string, expr: string, ctx: TranspileContext, line: number): string[] {
  const trimmedExpr = expr.trim();
  const constValue = tryEvalConst(trimmedExpr);
  if (constValue != null) {
    if (target === "a" || target === "acc") {
      return [`mov a,#${toAsmByte8(constValue)}`];
    }
    return [`mov ${target},#${toAsmByte8(constValue)}`];
  }
  const lowered = trimmedExpr.toLowerCase();
    const preferExpression =
      ctx.localArrays.has(lowered) ||
      resolveFieldAccess(trimmedExpr, ctx) != null ||
      trimmedExpr.startsWith("&") ||
      trimmedExpr.startsWith("*") ||
      /^\w+\s*\[/.test(trimmedExpr);
  const direct = preferExpression ? null : resolveTarget(lowered, ctx);
  if (direct) {
    if (target === "a" || target === "acc") {
      return [`mov a,${normalizeAccumulatorSource(direct)}`];
    }
    if (direct === "a" || direct === "acc") {
      return [`mov ${target},a`];
    }
    return [`mov a,${normalizeAccumulatorSource(direct)}`, `mov ${target},a`];
  }
  if (target === "a" || target === "acc") {
    return emitExprToA(expr, ctx, line);
  }
  return [...emitExprToA(expr, ctx, line), `mov ${target},a`];
}

function emitExprToA(expr: string, ctx: TranspileContext, line: number): string[] {
  const trimmed = trimOuter(expr.trim());
  const constValue = tryEvalConst(trimmed);
  if (constValue != null) return [`mov a,#${toAsmByte(constValue)}`];

  const callMatch = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/.exec(trimmed);
  if (callMatch && ctx.functions.has(callMatch[1].toLowerCase())) {
    return emitFunctionCall(callMatch[1].toLowerCase(), callMatch[2], ctx, line);
  }

  if (trimmed.startsWith("&")) {
    const addr = resolveAddressExpression(trimmed.slice(1), ctx);
    if (addr != null) return [`mov a,#${toAsmByte8(addr)}`];
  }

  if (trimmed.startsWith("*")) {
    const ptrName = trimOuter(trimmed.slice(1)).toLowerCase();
    const ptr = resolveTarget(ptrName, ctx);
    const ptrKind = ctx.pointerVars.get(ptrName);
    if (ptr && ptrKind === "ram") {
      return [`mov a,${ptr}`, "mov r0,a", "mov a,@r0"];
    }
    if (ptr && ptrKind === "code") {
      const ptrAddr = Number.parseInt(ptr.slice(2), 16);
      return [`mov dpl,${toAsmByte(ptrAddr)}`, `mov dph,${toAsmByte(ptrAddr + 1)}`, "clr a", "movc a,@a+dptr"];
    }
  }

  const fieldRef = resolveFieldAccess(trimmed, ctx);
  if (fieldRef) {
    if (fieldRef.mode === "direct") return [`mov a,${toAsmByte(fieldRef.addr)}`];
    const load = [`mov a,${fieldRef.pointerAddr}`];
    if (fieldRef.offset) load.push(`add a,#${toAsmByte8(fieldRef.offset)}`);
    load.push("mov r0,a", "mov a,@r0");
    return load;
  }

  const localArrayDirect = ctx.localArrays.get(trimmed.toLowerCase());
  if (localArrayDirect) {
    return [`mov a,#${toAsmByte8(localArrayDirect.baseAddr)}`];
  }

  const arrayMatch = /^([A-Za-z_]\w*)\s*\[\s*([\s\S]+)\s*\]$/.exec(trimmed);
  if (arrayMatch) {
    const arrayName = arrayMatch[1].toLowerCase();
    const localArray = ctx.localArrays.get(arrayName);
    if (localArray) {
      const indexConst = tryEvalConst(arrayMatch[2]);
      if (indexConst != null) {
        return [`mov a,${toAsmByte(localArray.baseAddr + (indexConst % localArray.length))}`];
      }
      return [
        ...emitExprToA(arrayMatch[2], ctx, line),
        `add a,#${toAsmByte8(localArray.baseAddr)}`,
        "mov r0,a",
        "mov a,@r0",
      ];
    }
    if (!ctx.arrays.has(arrayName)) {
      ctx.diagnostics.push({ level: "warning", line, message: `Unknown array: ${arrayMatch[1]}` });
      return ["mov a,#0"];
    }
    return [
      `mov dptr,#${arrayName}`,
      ...emitExprToA(arrayMatch[2], ctx, line),
      "movc a,@a+dptr",
    ];
  }

  if (trimmed.startsWith("~")) {
    return [...emitExprToA(trimmed.slice(1), ctx, line), "cpl a"];
  }

  for (const ops of [["|"], ["^"], ["&"], ["+", "-"]]) {
    const found = findTopLevelOperator(trimmed, ops);
    if (found) {
      return [...emitExprToA(found.left, ctx, line), ...emitApplyBinaryToA(found.op, found.right, ctx, line)];
    }
  }

  const target = resolveTarget(trimmed.toLowerCase(), ctx);
  if (target) return [`mov a,${target}`];

  ctx.diagnostics.push({ level: "warning", line, message: `Expression was simplified to 0: ${trimmed}` });
  return ["mov a,#0"];
}

function emitApplyBinaryToA(op: string, rhs: string, ctx: TranspileContext, line: number): string[] {
  const constValue = tryEvalConst(rhs);
  if (constValue != null) {
    switch (op) {
      case "&": return [`anl a,#${toAsmByte8(constValue)}`];
      case "|": return [`orl a,#${toAsmByte8(constValue)}`];
      case "^": return [`xrl a,#${toAsmByte8(constValue)}`];
      case "+": return [`add a,#${toAsmByte8(constValue)}`];
      case "-": return ["clr c", `subb a,#${toAsmByte8(constValue)}`];
    }
  }

  const target = resolveTarget(rhs.trim().toLowerCase(), ctx);
  if (target) {
    switch (op) {
      case "&": return [`anl a,${target}`];
      case "|": return [`orl a,${target}`];
      case "^": return [`xrl a,${target}`];
      case "+": return [`add a,${target}`];
      case "-": return ["clr c", `subb a,${target}`];
    }
  }

  const tmp = ensureVar(ctx, "__tmp_rhs", line);
  return [...emitExprToA(rhs, ctx, line), `mov ${variableTarget(tmp)},a`, ...emitApplyBinaryToA(op, variableTarget(tmp), ctx, line)];
}

function emitConditionFalseJump(cond: string, falseLabel: string, ctx: TranspileContext, line: number): string[] {
  const text = trimOuter(cond.trim());
  if (!text) return [];
  const constValue = tryEvalConst(text);
  if (constValue != null) return constValue ? [] : [`sjmp ${falseLabel}`];

  const bit = ctx.sbitMap.get(text.toLowerCase());
  if (bit) return [`jnb ${bit},${falseLabel}`];

  const cmp = findComparator(text);
  if (cmp) {
    const leftBit = ctx.sbitMap.get(cmp.left.toLowerCase());
    const rightConst = tryEvalConst(cmp.right);
    if (leftBit && rightConst != null && (cmp.op === "==" || cmp.op === "!=")) {
      const wantOne = rightConst !== 0;
      if ((cmp.op === "==" && wantOne) || (cmp.op === "!=" && !wantOne)) return [`jnb ${leftBit},${falseLabel}`];
      return [`jb ${leftBit},${falseLabel}`];
    }

    if (cmp.op === "==" || cmp.op === "!=") {
      const out = [...emitExprToA(cmp.left, ctx, line)];
      const noteq = nextLabel(ctx, "neq");
      if (rightConst != null) {
        out.push(`cjne a,#${toAsmByte(rightConst)},${noteq}`);
      } else {
        const rhsTarget = resolveTarget(cmp.right.toLowerCase(), ctx);
        if (rhsTarget) {
          out.push(`xrl a,${rhsTarget}`);
          out.push(cmp.op === "==" ? `jnz ${falseLabel}` : `jz ${falseLabel}`);
          return out;
        }
        out.push(...emitExprToA(cmp.right, ctx, line), "mov b,a", ...emitExprToA(cmp.left, ctx, line), "xrl a,b");
        out.push(cmp.op === "==" ? `jnz ${falseLabel}` : `jz ${falseLabel}`);
        return out;
      }
      if (cmp.op === "==") {
        out.push(`sjmp ${noteq}_ok`);
        out.push(`${noteq}:`);
        out.push(`sjmp ${falseLabel}`);
        out.push(`${noteq}_ok:`);
      } else {
        out.push(`sjmp ${noteq}_ok`);
        out.push(`sjmp ${falseLabel}`);
        out.push(`${noteq}:`);
        out.push(`${noteq}_ok:`);
      }
      return out;
    }

    const out = [...emitExprToA(cmp.left, ctx, line)];
    if (rightConst != null) {
      out.push("clr c", `subb a,#${toAsmByte(rightConst)}`);
    } else {
      const rhsTarget = resolveTarget(cmp.right.toLowerCase(), ctx);
      if (rhsTarget) {
        out.push("clr c", `subb a,${rhsTarget}`);
      } else {
        const tmp = ensureVar(ctx, "__tmp_cmp", line);
        out.push(...emitExprToA(cmp.right, ctx, line), `mov ${variableTarget(tmp)},a`, ...emitExprToA(cmp.left, ctx, line), "clr c", `subb a,${variableTarget(tmp)}`);
      }
    }
    const okLabel = nextLabel(ctx, "condok");
    switch (cmp.op) {
      case "<":
        out.push(`jnc ${falseLabel}`);
        return out;
      case ">=":
        out.push(`jc ${falseLabel}`);
        return out;
      case ">":
        out.push(`jz ${falseLabel}`);
        out.push(`jc ${falseLabel}`);
        return out;
      case "<=":
        out.push(`jz ${okLabel}`);
        out.push(`jc ${okLabel}`);
        out.push(`sjmp ${falseLabel}`);
        out.push(`${okLabel}:`);
        return out;
    }
  }

  const bitwise = /^([A-Za-z_]\w*)\s*&\s*([\s\S]+)$/.exec(text);
  if (bitwise) {
    return [...emitExprToA(bitwise[1], ctx, line), ...emitApplyBinaryToA("&", bitwise[2], ctx, line), `jz ${falseLabel}`];
  }

  return [...emitExprToA(text, ctx, line), `jz ${falseLabel}`];
}

function ensureVar(ctx: TranspileContext, name: string, line: number): ScalarVar {
  const existing = ctx.vars.get(name);
  if (existing) return existing;
  if (ctx.nextVarAddr.value > 0x7f) {
    ctx.diagnostics.push({ level: "error", line, message: "Out of local variable storage (IRAM 0x30..0x7F)." });
  }
  const variable = { name, addr: ctx.nextVarAddr.value++ };
  ctx.vars.set(name, variable);
  return variable;
}

function variableTarget(variable: ScalarVar): string {
  return toAsmByte(variable.addr);
}

function resolveTarget(name: string, ctx: TranspileContext): string | null {
  const lowered = name.trim().toLowerCase();
  const variable = ctx.vars.get(lowered);
  if (variable) return variableTarget(variable);
  if (ctx.sfrMap.has(lowered)) return lowered;
  if (REGISTER_SET.has(lowered as RegisterName)) return lowered;
  return null;
}

function resolveOrCreateTarget(name: string, ctx: TranspileContext, line: number): string | null {
  const existing = resolveTarget(name, ctx);
  if (existing) return existing;
  if (/^[A-Za-z_]\w*$/.test(name) && !ctx.functions.has(name) && !ctx.arrays.has(name)) {
    return variableTarget(ensureVar(ctx, name, line));
  }
  return null;
}

function nextLabel(ctx: TranspileContext, prefix: string): string {
  return `__${prefix}_${ctx.labelCounter.value++}`;
}

function allocateBlock(ctx: TranspileContext, length: number, line: number): number {
  const base = ctx.nextVarAddr.value;
  ctx.nextVarAddr.value += Math.max(1, length);
  if (ctx.nextVarAddr.value > 0x80) {
    ctx.diagnostics.push({ level: "error", line, message: "Out of local variable storage (IRAM 0x30..0x7F)." });
  }
  return base;
}

function bindFunctionParams(fn: FunctionInfo, ctx: TranspileContext, diagnostics: AsmDiagnostic[]): void {
  let offset = 0;
  for (const param of fn.params) {
    if (param.structName && !param.pointer) {
      const def = ctx.structDefs.get(param.structName);
      const size = Math.max(1, def?.size ?? 1);
      param.argOffset = offset;
      param.size = size;
      ctx.structVars.set(param.name, { name: param.name, structName: param.structName, baseAddr: ARG_BASE + offset });
      offset += size;
      continue;
    }

    const size = param.pointer && param.pointerKind === "code" ? 2 : 1;
    param.argOffset = offset;
    param.size = size;
    ctx.vars.set(param.name, { name: param.name, addr: ARG_BASE + offset });
    if (param.pointer) {
      ctx.pointerVars.set(param.name, param.pointerKind ?? "ram");
      if (param.structName) ctx.pointerStructTypes.set(param.name, param.structName);
    }
    offset += size;
  }
  if (offset > MAX_ARGS) {
    diagnostics.push({ level: "warning", message: `Function ${fn.name} uses more than ${MAX_ARGS} bytes of argument slots; tail args may overlap.` });
  }
}

function parseParamList(raw: string): ParamInfo[] {
  const text = raw.trim();
  if (!text || /^void$/i.test(text)) return [];
  const params: ParamInfo[] = [];
  for (const part of splitCsv(text)) {
    const item = part.trim();
    const structPtr = /^struct\s+([A-Za-z_]\w*)\s*\*\s*([A-Za-z_]\w*)$/i.exec(item);
    if (structPtr) {
      params.push({ name: structPtr[2].toLowerCase(), pointer: true, structName: structPtr[1].toLowerCase(), pointerKind: "ram" });
      continue;
    }
    const structVal = /^struct\s+([A-Za-z_]\w*)\s+([A-Za-z_]\w*)$/i.exec(item);
    if (structVal) {
      params.push({ name: structVal[2].toLowerCase(), pointer: false, structName: structVal[1].toLowerCase() });
      continue;
    }
    const codePtr = /^(?:unsigned\s+)?(?:char|int)\s+code\s*\*\s*([A-Za-z_]\w*)$/i.exec(item);
    if (codePtr) {
      params.push({ name: codePtr[1].toLowerCase(), pointer: true, pointerKind: "code" });
      continue;
    }
    const ptr = /^(?:unsigned\s+)?(?:char|int)\s*\*\s*([A-Za-z_]\w*)$/i.exec(item);
    if (ptr) {
      params.push({ name: ptr[1].toLowerCase(), pointer: true, pointerKind: "ram" });
      continue;
    }
    const scalar = /^(?:unsigned\s+)?(?:char|int)\s+([A-Za-z_]\w*)$/i.exec(item);
    if (scalar) {
      params.push({ name: scalar[1].toLowerCase(), pointer: false });
    }
  }
  return params;
}

function resolveFieldAccess(expr: string, ctx: TranspileContext): { mode: "direct"; addr: number; size: number } | { mode: "pointer"; pointerAddr: string; offset: number; size: number } | null {
  const text = expr.trim();
  if (!text.includes(".") && !text.includes("->")) return null;

  const direct = /^([A-Za-z_]\w*)\.(.+)$/.exec(text);
  if (direct) {
    let structName = "";
    let baseAddr = 0;
    const rootStruct = ctx.structVars.get(direct[1].toLowerCase());
    if (rootStruct) {
      structName = rootStruct.structName;
      baseAddr = rootStruct.baseAddr;
    } else {
      return null;
    }

    const walk = walkStructPath(structName, direct[2], ctx);
    if (!walk) return null;
    return { mode: "direct", addr: baseAddr + walk.offset, size: walk.size };
  }

  const ptr = /^([A-Za-z_]\w*)->(.+)$/.exec(text);
  if (ptr) {
    const ptrName = ptr[1].toLowerCase();
    const ptrTarget = resolveTarget(ptrName, ctx);
    if (!ptrTarget || ctx.pointerVars.get(ptrName) !== "ram") return null;
    const structName = findStructNameForPointer(ptrName, ctx);
    if (!structName) return null;
    const walk = walkStructPath(structName, ptr[2], ctx);
    if (!walk) return null;
    return { mode: "pointer", pointerAddr: ptrTarget, offset: walk.offset, size: walk.size };
  }

  return null;
}

function resolveAddressExpression(expr: string, ctx: TranspileContext): number | null {
  const text = trimOuter(expr.trim());
  const direct = resolveTarget(text.toLowerCase(), ctx);
  if (direct?.startsWith("0x")) return Number.parseInt(direct, 16);
  const structVar = ctx.structVars.get(text.toLowerCase());
  if (structVar) return structVar.baseAddr;
  const field = resolveFieldAccess(text, ctx);
  if (field?.mode === "direct") return field.addr;
  const localArr = ctx.localArrays.get(text.toLowerCase());
  if (localArr) return localArr.baseAddr;
  const idx = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
  if (idx) {
    const local = ctx.localArrays.get(idx[1].toLowerCase());
    const constIndex = tryEvalConst(idx[2]);
    if (local && constIndex != null) return local.baseAddr + (constIndex % local.length);
  }
  return null;
}

function emitStoreToLValue(lhs: string, rhs: string, ctx: TranspileContext, line: number): string[] | null {
  const field = resolveFieldAccess(lhs, ctx);
  if (field) {
    if (field.mode === "direct") {
      return emitAssignToTarget(toAsmByte(field.addr), rhs, ctx, line);
    }
    const out = [...emitExprToA(rhs, ctx, line), "mov b,a", `mov a,${field.pointerAddr}`];
    if (field.offset) out.push(`add a,#${toAsmByte8(field.offset)}`);
    out.push("mov r0,a", "mov a,b", "mov @r0,a");
    return out;
  }

  const ptrDeref = /^\*\s*([A-Za-z_]\w*)$/.exec(trimOuter(lhs));
  if (ptrDeref) {
    const ptrName = ptrDeref[1].toLowerCase();
    const ptr = resolveTarget(ptrName, ctx);
    if (ptr && ctx.pointerVars.get(ptrName) === "ram") {
      return [...emitExprToA(rhs, ctx, line), "mov b,a", `mov a,${ptr}`, "mov r0,a", "mov a,b", "mov @r0,a"];
    }
  }

  const localArr = /^([A-Za-z_]\w*)\s*\[\s*([\s\S]+)\s*\]$/.exec(trimOuter(lhs));
  if (localArr) {
    const arr = ctx.localArrays.get(localArr[1].toLowerCase());
    if (arr) {
      const idxConst = tryEvalConst(localArr[2]);
      if (idxConst != null) {
        return emitAssignToTarget(toAsmByte(arr.baseAddr + (idxConst % arr.length)), rhs, ctx, line);
      }
      return [
        ...emitExprToA(rhs, ctx, line),
        "mov b,a",
        ...emitExprToA(localArr[2], ctx, line),
        `add a,#${toAsmByte8(arr.baseAddr)}`,
        "mov r0,a",
        "mov a,b",
        "mov @r0,a",
      ];
    }
  }
  return null;
}

function emitFunctionCall(name: string, rawArgs: string, ctx: TranspileContext, line: number): string[] {
  const fn = ctx.functions.get(name);
  if (!fn) return ["mov a,#0"];
  const out: string[] = [];
  const argItems = rawArgs.trim() ? splitCsv(rawArgs).map((item) => item.trim()) : [];
  if (argItems.length > fn.params.length) {
    ctx.diagnostics.push({ level: "warning", line, message: `Too many arguments for ${name}()` });
  }

  for (let i = 0; i < Math.min(argItems.length, fn.params.length); i++) {
    const param = fn.params[i];
    const arg = argItems[i];
    const base = ARG_BASE + (param.argOffset ?? i);

    if (param.structName && !param.pointer) {
      const structValue = resolveStructValue(arg, ctx);
      if (!structValue) {
        ctx.diagnostics.push({ level: "warning", line, message: `Struct argument expected for ${param.name}: ${arg}` });
        continue;
      }
      for (let j = 0; j < structValue.size; j++) {
        out.push(`mov a,${toAsmByte(structValue.baseAddr + j)}`, `mov ${toAsmByte(base + j)},a`);
      }
      continue;
    }

    if (param.pointer && param.pointerKind === "code") {
      const codeExpr = codePointerImmediate(arg, ctx);
      if (codeExpr) {
        out.push(`mov ${toAsmByte(base)},#${codeExpr.low}`, `mov ${toAsmByte(base + 1)},#${codeExpr.high}`);
        continue;
      }
      const addr = resolveAddressExpression(arg, ctx);
      if (addr != null) {
        out.push(`mov ${toAsmByte(base)},#${toAsmByte8(addr)}`, `mov ${toAsmByte(base + 1)},#0x0`);
      }
      continue;
    }

    out.push(...emitAssignToTarget(toAsmByte(base), arg, ctx, line));
  }

  out.push(`call ${name}`);
  return out;
}

function transpileSwitchStatement(
  switchExpr: string,
  body: string,
  statement: ParsedStatement,
  lineOffset: number,
  ctx: TranspileContext,
  line: number,
): { code: string[]; needDelay: boolean; needWrite: boolean } {
  const tmp = ensureVar(ctx, "__switch", line);
  const endLabel = nextLabel(ctx, "switch_end");
  const out = [...emitExprToA(switchExpr, ctx, line), `mov ${variableTarget(tmp)},a`];
  const parsed = parseSwitchCases(body, line);
  let needDelay = false;
  let needWrite = false;
  const labels = parsed.cases.map(() => nextLabel(ctx, "case"));
  const defaultLabel = parsed.defaultBody ? nextLabel(ctx, "default") : endLabel;

  parsed.cases.forEach((item, index) => {
    out.push(`mov a,${variableTarget(tmp)}`);
    out.push(`cjne a,#${toAsmByte8(item.value)},${labels[index]}_next`);
    out.push(`sjmp ${labels[index]}`);
    out.push(`${labels[index]}_next:`);
  });
  out.push(`sjmp ${defaultLabel}`);

  parsed.cases.forEach((item, index) => {
    out.push(`${labels[index]}:`);
    for (const stmt of splitStatements(item.body)) {
      if (/^break\s*;?$/i.test(stmt.text.trim())) {
        out.push(`sjmp ${endLabel}`);
        continue;
      }
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
  });

  if (parsed.defaultBody) {
    out.push(`${defaultLabel}:`);
    for (const stmt of splitStatements(parsed.defaultBody)) {
      if (/^break\s*;?$/i.test(stmt.text.trim())) {
        out.push(`sjmp ${endLabel}`);
        continue;
      }
      const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
  }

  out.push(`${endLabel}:`);
  return { code: out, needDelay, needWrite };
}

function parseSwitchCases(body: string, line: number): { cases: Array<{ value: number; body: string }>; defaultBody: string } {
  const cases: Array<{ value: number; body: string }> = [];
  let defaultBody = "";
  const marker = /(?:case\s+([^:]+)|default)\s*:/gi;
  const matches: Array<{ value: string | null; index: number; full: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(body))) {
    matches.push({ value: m[1] ?? null, index: m.index, full: m[0] });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const start = current.index + current.full.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const chunk = body.slice(start, end).trim();
    if (current.value == null) {
      defaultBody = chunk;
    } else {
      cases.push({ value: tryEvalConst(current.value) ?? 0, body: chunk });
    }
  }
  return { cases, defaultBody };
}

function walkStructPath(structName: string, path: string, ctx: TranspileContext): { offset: number; size: number } | null {
  let currentStruct = ctx.structDefs.get(structName);
  if (!currentStruct) return null;
  let offset = 0;
  const parts = path.split(".");
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx].trim();
    const match = /^([A-Za-z_]\w*)(?:\[(\d+)\])?$/.exec(part);
    if (!match) return null;
    const field = currentStruct.fields.find((item) => item.name === match[1].toLowerCase());
    if (!field) return null;
    const index = match[2] ? Number(match[2]) : 0;
    if (index >= field.size) return null;
    offset += field.offset + index;
    if (idx === parts.length - 1) return { offset, size: 1 };
    const nested = field.structName ? ctx.structDefs.get(field.structName) : null;
    if (!nested) return null;
    currentStruct = nested;
  }
  return null;
}

function findStructNameForPointer(ptrName: string, ctx: TranspileContext): string | null {
  return ctx.pointerStructTypes.get(ptrName) ?? null;
}

function resolveStructValue(expr: string, ctx: TranspileContext): (StructVar & { size: number }) | null {
  const text = expr.trim().toLowerCase();
  const value = ctx.structVars.get(text);
  if (!value) return null;
  const def = ctx.structDefs.get(value.structName);
  return { ...value, size: def?.size ?? 1 };
}

function codePointerImmediate(expr: string, ctx: TranspileContext): { low: string; high: string } | null {
  const text = trimOuter(expr.trim());
  const arrayIndex = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
  if (arrayIndex && ctx.arrays.has(arrayIndex[1].toLowerCase())) {
    const offset = tryEvalConst(arrayIndex[2]) ?? 0;
    const label = `${arrayIndex[1]}+${offset & 0xffff}`;
    return { low: `low(${label})`, high: `high(${label})` };
  }
  if (ctx.arrays.has(text.toLowerCase())) {
    return { low: `low(${text})`, high: `high(${text})` };
  }
  return null;
}

function normalizeNumber(raw: string): string | null {
  const value = tryEvalConst(raw);
  if (value == null) return null;
  return toAsmByte8(value);
}

function tryEvalConst(raw: string): number | null {
  let expr = trimOuter(raw.trim());
  if (!expr) return null;
  expr = expr.replace(/\b([0-9A-F]+)h\b/gi, (_, hex) => `0x${hex}`);
  expr = expr.replace(/\b([01]+)b\b/gi, (_, bits) => `0b${bits}`);
  if (!/^[0-9a-fxobA-F\s()+\-~<>&|^]+$/.test(expr)) return null;
  try {
    const value = Function(`return ((${expr}))`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return value & 0xffff;
  } catch {
    return null;
  }
}

function toAsmByte(value: number): string {
  if (value < 0) value = (value + 0x10000) & 0xffff;
  if (value <= 0xff) return `0x${(value & 0xff).toString(16)}`;
  return `0x${(value & 0xffff).toString(16)}`;
}

function toAsmByte8(value: number): string {
  return `0x${(value & 0xff).toString(16)}`;
}

function normalizeAccumulatorSource(source: string): string {
  return source === "acc" ? "a" : source;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function normalizeControlFlowBodies(source: string): string {
  let i = 0;
  let out = "";
  while (i < source.length) {
    const control = consumeControlStatement(source, i);
    if (control) {
      out += control.text;
      i = control.end;
      continue;
    }
    if (source[i] === "{") {
      const end = findMatchingParenLike(source, i, "{", "}");
      if (end < 0) {
        out += source[i++];
        continue;
      }
      out += `{${normalizeControlFlowBodies(source.slice(i + 1, end))}}`;
      i = end + 1;
      continue;
    }
    out += source[i++];
  }
  return out;
}

function consumeControlStatement(source: string, start: number): { text: string; end: number } | null {
  const index = skipWhitespace(source, start);
  if (startsWithWord(source, index, "do")) {
    let cursor = index + 2;
    const body = consumeStatementLike(source, cursor);
    if (!body) return null;
    cursor = skipWhitespace(source, body.end);
    if (!startsWithWord(source, cursor, "while")) return null;
    const whileStart = cursor;
    cursor = skipWhitespace(source, cursor + 5);
    if (source[cursor] !== "(") return null;
    const condEnd = findMatchingParenLike(source, cursor, "(", ")");
    if (condEnd < 0) return null;
    cursor = condEnd + 1;
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === ";") cursor += 1;
    const prefix = source.slice(start, index);
    const bodyText = wrapAsBlockIfNeeded(body.text);
    const condText = source.slice(whileStart, cursor);
    return { text: `${prefix}do ${bodyText} ${condText}`, end: cursor };
  }

  for (const keyword of ["if", "for", "while", "switch"] as const) {
    if (!startsWithWord(source, index, keyword)) continue;
    let cursor = skipWhitespace(source, index + keyword.length);
    if (source[cursor] !== "(") return null;
    const condEnd = findMatchingParenLike(source, cursor, "(", ")");
    if (condEnd < 0) return null;
    const header = source.slice(index, condEnd + 1);
    const body = consumeStatementLike(source, condEnd + 1);
    if (!body) return null;
    let text = `${source.slice(start, index)}${header} ${wrapAsBlockIfNeeded(body.text)}`;
    let end = body.end;

    if (keyword === "if") {
      const elseIndex = skipWhitespace(source, end);
      if (startsWithWord(source, elseIndex, "else")) {
        const elseBody = consumeStatementLike(source, elseIndex + 4);
        if (elseBody) {
          text += ` else ${wrapAsBlockIfNeeded(elseBody.text)}`;
          end = elseBody.end;
        }
      }
    }

    return { text, end };
  }

  return null;
}

function consumeStatementLike(source: string, start: number): { text: string; end: number } | null {
  const index = skipWhitespace(source, start);
  if (index >= source.length) return null;

  const control = consumeControlStatement(source, index);
  if (control) return control;

  if (source[index] === "{") {
    const end = findMatchingParenLike(source, index, "{", "}");
    if (end < 0) return null;
    return {
      text: `{${normalizeControlFlowBodies(source.slice(index + 1, end))}}`,
      end: end + 1,
    };
  }

  let depthParen = 0;
  let depthBracket = 0;
  for (let i = index; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket -= 1;
    else if (ch === ";" && depthParen === 0 && depthBracket === 0) {
      return { text: source.slice(index, i + 1), end: i + 1 };
    }
  }
  return { text: source.slice(index), end: source.length };
}

function wrapAsBlockIfNeeded(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "{ }";
  if (trimmed.startsWith("{")) return trimmed;
  return `{ ${trimmed} }`;
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function startsWithWord(source: string, index: number, word: string): boolean {
  if (!source.startsWith(word, index)) return false;
  const before = index > 0 ? source[index - 1] : "";
  const after = index + word.length < source.length ? source[index + word.length] : "";
  if (before && /[A-Za-z0-9_]/.test(before)) return false;
  if (after && /[A-Za-z0-9_]/.test(after)) return false;
  return true;
}

function parseIfStatement(raw: string): { condition: string; thenBody: string; elseBody?: string } | null {
  const start = skipWhitespace(raw, 0);
  if (!startsWithWord(raw, start, "if")) return null;
  let cursor = skipWhitespace(raw, start + 2);
  if (raw[cursor] !== "(") return null;
  const condEnd = findMatchingParenLike(raw, cursor, "(", ")");
  if (condEnd < 0) return null;
  const condition = raw.slice(cursor + 1, condEnd).trim();

  cursor = skipWhitespace(raw, condEnd + 1);
  if (raw[cursor] !== "{") return null;
  const thenEnd = findMatchingParenLike(raw, cursor, "{", "}");
  if (thenEnd < 0) return null;
  const thenBody = raw.slice(cursor + 1, thenEnd);

  cursor = skipWhitespace(raw, thenEnd + 1);
  if (!startsWithWord(raw, cursor, "else")) {
    if (raw.slice(cursor).trim()) return null;
    return { condition, thenBody };
  }

  cursor = skipWhitespace(raw, cursor + 4);
  if (raw[cursor] !== "{") return null;
  const elseEnd = findMatchingParenLike(raw, cursor, "{", "}");
  if (elseEnd < 0) return null;
  if (raw.slice(elseEnd + 1).trim()) return null;

  return {
    condition,
    thenBody,
    elseBody: raw.slice(cursor + 1, elseEnd),
  };
}

function splitCsv(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  for (const ch of text) {
    if (ch === "(") depthParen += 1;
    if (ch === ")") depthParen -= 1;
    if (ch === "[") depthBracket += 1;
    if (ch === "]") depthBracket -= 1;
    if (ch === "{") depthBrace += 1;
    if (ch === "}") depthBrace -= 1;
    if (ch === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out;
}

function trimOuter(text: string): string {
  let out = text.trim();
  while (out.startsWith("(") && out.endsWith(")") && isWrapped(out)) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

function isWrapped(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && i < text.length - 1) return false;
  }
  return true;
}

function findTopLevelOperator(text: string, operators: string[]): { left: string; op: string; right: string } | null {
  let depthParen = 0;
  let depthBracket = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ")") depthParen += 1;
    else if (ch === "(") depthParen -= 1;
    else if (ch === "]") depthBracket += 1;
    else if (ch === "[") depthBracket -= 1;
    if (depthParen || depthBracket) continue;
    if (operators.includes(ch)) {
      if ((ch === "+" || ch === "-") && i === 0) continue;
      return { left: text.slice(0, i).trim(), op: ch, right: text.slice(i + 1).trim() };
    }
  }
  return null;
}

function findComparator(text: string): { left: string; op: string; right: string } | null {
  const ops = ["<=", ">=", "==", "!=", "<", ">"];
  let depthParen = 0;
  let depthBracket = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen -= 1;
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket -= 1;
    if (depthParen || depthBracket) continue;
    for (const op of ops) {
      if (text.startsWith(op, i)) {
        return { left: text.slice(0, i).trim(), op, right: text.slice(i + op.length).trim() };
      }
    }
  }
  return null;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingParenLike(source: string, openIndex: number, openChar: string, closeChar: string): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
