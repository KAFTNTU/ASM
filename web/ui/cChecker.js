export function checkC(source) {
    const diagnostics = [];
    const text = source.replace(/\r/g, "");
    const checkText = stripBlockCommentsPreserveLines(text);
    const trimmed = checkText.trim();
    if (!trimmed) {
        return { ok: true, diagnostics };
    }
    const openBraces = (checkText.match(/\{/g) ?? []).length;
    const closeBraces = (checkText.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
        diagnostics.push({
            level: "error",
            message: "Unbalanced braces in C source.",
        });
    }
    const hasMain = /\b(main)\s*\(/.test(checkText);
    if (!hasMain) {
        diagnostics.push({
            level: "warning",
            message: "C: add `main()` entry function.",
        });
    }
    const lines = checkText.split("\n");
    let inInitializer = false;
    for (let index = 0; index < lines.length; index++) {
        const row = lines[index].trim();
        if (inInitializer) {
            if (/^\}\s*;/.test(row)) inInitializer = false;
            continue;
        }
        if (/=\s*\{\s*$/.test(row)) {
            inInitializer = true;
            continue;
        }
        if (!row)
            continue;
        if (row.startsWith("//"))
            continue;
        if (/[{}]$/.test(row))
            continue;
        if (row.startsWith("#"))
            continue;
        if (row.endsWith(","))
            continue;
        if (/^\}\s*else\b/.test(row))
            continue;
        if (/\b(if|while|for|switch)\b.*\)\s*$/.test(row))
            continue;
        if (/^(?:void|int|char|bit|long|uint8_t|unsigned\s+char|unsigned\s+int|signed\s+char|signed\s+int|unsigned\s+long|signed\s+long)\s+[A-Za-z_]\w*\s*\([^)]*\)\s*$/.test(row))
            continue;
        if (/^(?:const\s+)?(?:unsigned\s+char|char|uint8_t)\s+(?:code\s+)?[A-Za-z_]\w*\s*\[[^\]]*\]\s*=\s*$/.test(row))
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
function stripBlockCommentsPreserveLines(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}
