export function checkC(source) {
    const diagnostics = [];
    const text = source.replace(/\r/g, "");
    const trimmed = text.trim();
    if (!trimmed) {
        return { ok: true, diagnostics };
    }
    const openBraces = (text.match(/\{/g) ?? []).length;
    const closeBraces = (text.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
        diagnostics.push({
            level: "error",
            message: "Unbalanced braces in C source.",
        });
    }
    const hasMain = /\b(main)\s*\(/.test(text);
    if (!hasMain) {
        diagnostics.push({
            level: "warning",
            message: "C: add `main()` entry function.",
        });
    }
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index++) {
        const row = lines[index].trim();
        if (!row)
            continue;
        if (row.startsWith("//"))
            continue;
        if (/[{}]$/.test(row))
            continue;
        if (row.startsWith("#"))
            continue;
        if (/\b(if|while|for|switch)\b.*\)\s*$/.test(row))
            continue;
        if (!row.endsWith(";")) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: "Possible missing semicolon.",
            });
        }
    }
    if (!diagnostics.some((item) => item.level === "error")) {
        diagnostics.push({
            level: "hint",
            message: "C syntax check passed (basic checker).",
        });
    }
    return {
        ok: diagnostics.every((item) => item.level !== "error"),
        diagnostics,
    };
}
