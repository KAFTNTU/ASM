import type { AsmDiagnostic } from "./asmCompiler";

export type CTranspileResult = {
  ok: boolean;
  asm: string;
  diagnostics: AsmDiagnostic[];
};

type RegisterName = "p0" | "p1" | "p2" | "p3" | "a" | "acc" | "b";
const REGISTER_SET = new Set<RegisterName>(["p0", "p1", "p2", "p3", "a", "acc", "b"]);

export function transpileCToAsm(source: string): CTranspileResult {
  const diagnostics: AsmDiagnostic[] = [];
  const text = stripComments(source).replace(/\r/g, "");
  const sbitMap = parseSbits(text);
  const mainBody = extractMainBody(text);

  if (!mainBody) {
    diagnostics.push({ level: "error", message: "C: не знайдено тіло main()." });
    return { ok: false, asm: "", diagnostics };
  }

  const emitted: string[] = [];
  let needDelay = false;
  let needWrite = false;

  emitted.push("org 0x0000");
  emitted.push("start:");

  const statements = splitStatements(mainBody.body);
  for (const statement of statements) {
    const chunk = transpileStatement(statement, mainBody.lineOffset, sbitMap, diagnostics);
    emitted.push(...chunk.code);
    needDelay ||= chunk.needDelay;
    needWrite ||= chunk.needWrite;
  }

  emitted.push("sjmp start");

  if (needWrite) {
    emitted.push("write:");
    emitted.push("setb p3.6");
    emitted.push("mov p0,r7");
    emitted.push("mov p2,r6");
    emitted.push("nop");
    emitted.push("mov p2,#0");
    emitted.push("ret");
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
  }

  emitted.push("end");

  if (!diagnostics.some((item) => item.level === "error")) {
    diagnostics.push({ level: "hint", message: "C transpiled to ASM." });
  }

  return {
    ok: diagnostics.every((item) => item.level !== "error"),
    asm: emitted.join("\n"),
    diagnostics,
  };
}

function transpileStatement(
  statement: ParsedStatement,
  lineOffset: number,
  sbitMap: Map<string, string>,
  diagnostics: AsmDiagnostic[],
): { code: string[]; needDelay: boolean; needWrite: boolean } {
  const raw = statement.text.trim();
  if (!raw) return { code: [], needDelay: false, needWrite: false };
  const line = lineOffset + statement.line;

  if (/^while\s*\(\s*1\s*\)\s*\{[\s\S]*\}$/i.test(raw)) {
    const body = raw.replace(/^while\s*\(\s*1\s*\)\s*\{([\s\S]*)\}$/i, "$1");
    const inner = splitStatements(body);
    const out: string[] = ["loop:"];
    let needDelay = false;
    let needWrite = false;
    for (const stmt of inner) {
      const translated = transpileStatement(stmt, lineOffset + statement.line, sbitMap, diagnostics);
      out.push(...translated.code);
      needDelay ||= translated.needDelay;
      needWrite ||= translated.needWrite;
    }
    out.push("sjmp loop");
    return { code: out, needDelay, needWrite };
  }

  const writeCall = /^write\s*\((.+),(.+)\)\s*;?$/i.exec(raw);
  if (writeCall) {
    const digit = normalizeNumber(writeCall[1]);
    const value = normalizeNumber(writeCall[2]);
    if (!digit || !value) {
      diagnostics.push({ level: "error", line, message: `Unsupported write(...) args: ${raw}` });
      return { code: [], needDelay: false, needWrite: false };
    }
    return {
      code: [`mov r7,#${value}`, `mov r6,#${digit}`, "call write"],
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

  const setBit = /^([A-Za-z_]\w*)\s*=\s*(0|1)\s*;?$/.exec(raw);
  if (setBit) {
    const name = setBit[1].toLowerCase();
    const bit = sbitMap.get(name);
    if (bit) {
      return {
        code: [setBit[2] === "1" ? `setb ${bit}` : `clr ${bit}`],
        needDelay: false,
        needWrite: false,
      };
    }
  }

  const assign = /^([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;?$/.exec(raw);
  if (assign) {
    const left = assign[1].toLowerCase();
    const right = assign[2].trim();
    if (REGISTER_SET.has(left as RegisterName)) {
      const rhsReg = right.toLowerCase();
      if (REGISTER_SET.has(rhsReg as RegisterName)) {
        return { code: [`mov ${left},${rhsReg}`], needDelay: false, needWrite: false };
      }
      const imm = normalizeNumber(right);
      if (imm) return { code: [`mov ${left},#${imm}`], needDelay: false, needWrite: false };
    }
  }

  if (/^(for|if|switch|do)\b/i.test(raw)) {
    diagnostics.push({ level: "warning", line, message: `C block skipped: ${raw.slice(0, 40)}...` });
    return { code: [], needDelay: false, needWrite: false };
  }

  diagnostics.push({ level: "warning", line, message: `C line not translated: ${raw}` });
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

function extractMainBody(source: string): { body: string; lineOffset: number } | null {
  const match = /void\s+main\s*\([^)]*\)\s*\{/i.exec(source);
  if (!match || match.index == null) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const ch = source[index];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    index += 1;
  }
  if (depth !== 0) return null;
  const body = source.slice(start, index - 1);
  const lineOffset = source.slice(0, start).split("\n").length - 1;
  return { body, lineOffset };
}

type ParsedStatement = { text: string; line: number };

function splitStatements(source: string): ParsedStatement[] {
  const list: ParsedStatement[] = [];
  let depth = 0;
  let current = "";
  let line = 1;
  let statementLine = 1;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    current += ch;
    if (ch === "\n") line += 1;
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if ((ch === ";" && depth === 0) || (ch === "}" && depth === 0)) {
      const text = current.trim();
      if (text) list.push({ text, line: statementLine });
      current = "";
      statementLine = line;
    }
  }

  const tail = current.trim();
  if (tail) list.push({ text: tail, line: statementLine });
  return list;
}

function normalizeNumber(raw: string): string | null {
  const text = raw.trim().replace(/u$/i, "");
  if (/^0x[0-9a-f]+$/i.test(text)) return text.toLowerCase();
  if (/^\d+$/.test(text)) return String(Number.parseInt(text, 10));
  if (/^0b[01]+$/i.test(text)) return `${text.slice(2)}b`;
  if (/^[01]+b$/i.test(text)) return text.toLowerCase();
  return null;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
