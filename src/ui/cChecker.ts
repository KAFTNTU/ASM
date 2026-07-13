import type { AsmDiagnostic } from "./asmCompiler";

export type CCheckResult = {
  ok: boolean;
  diagnostics: AsmDiagnostic[];
};

export function checkC(source: string): CCheckResult {
  const diagnostics: AsmDiagnostic[] = [];
  const text = source.replace(/\r/g, "");
  if (!text.trim()) return { ok: true, diagnostics };

  const masked = maskCommentsAndStrings(text);
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closing = new Set(Object.values(pairs));
  const stack: Array<{ char: string; line: number }> = [];
  let line = 1;

  for (const char of masked) {
    if (char === "\n") {
      line += 1;
      continue;
    }
    if (pairs[char]) {
      stack.push({ char, line });
      continue;
    }
    if (!closing.has(char)) continue;
    const open = stack.pop();
    if (!open || pairs[open.char] !== char) {
      diagnostics.push({ level: "error", line, message: `Unexpected closing '${char}'.` });
      break;
    }
  }

  for (const open of stack.reverse()) {
    diagnostics.push({ level: "error", line: open.line, message: `Missing '${pairs[open.char]}' for '${open.char}'.` });
  }

  if (!/\bmain\s*\(/i.test(masked)) {
    diagnostics.push({ level: "warning", message: "C51: add a main() entry function." });
  }

  if (/\b(?:reti|ret)\s*;/i.test(masked)) {
    diagnostics.push({
      level: "warning",
      message: "Do not write RET/RETI as C statements; use return. The C51 interrupt generator emits RETI automatically.",
    });
  }

  if (!diagnostics.some((item) => item.level === "error")) {
    diagnostics.push({ level: "hint", message: "C51 structural check passed; full validation continues during transpilation and ASM encoding." });
  }

  return {
    ok: diagnostics.every((item) => item.level !== "error"),
    diagnostics,
  };
}

function maskCommentsAndStrings(source: string): string {
  let out = "";
  let mode: "code" | "line" | "block" | "single" | "double" = "code";
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1] ?? "";

    if (mode === "line") {
      if (char === "\n") {
        mode = "code";
        out += "\n";
      } else out += " ";
      continue;
    }
    if (mode === "block") {
      if (char === "*" && next === "/") {
        out += "  ";
        index += 1;
        mode = "code";
      } else out += char === "\n" ? "\n" : " ";
      continue;
    }
    if (mode === "single" || mode === "double") {
      const quote = mode === "single" ? "'" : '"';
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) mode = "code";
      out += char === "\n" ? "\n" : " ";
      continue;
    }

    if (char === "/" && next === "/") {
      out += "  ";
      index += 1;
      mode = "line";
    } else if (char === "/" && next === "*") {
      out += "  ";
      index += 1;
      mode = "block";
    } else if (char === "'") {
      out += " ";
      mode = "single";
    } else if (char === '"') {
      out += " ";
      mode = "double";
    } else {
      out += char;
    }
  }
  return out;
}
