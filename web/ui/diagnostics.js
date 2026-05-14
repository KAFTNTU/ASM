import { parseIntelHex } from "../vm/emu8051Wasm.js";
export function analyzeSource(mode, code) {
    switch (mode) {
        case "asm":
            return analyzeAsm(code);
        case "c":
            return analyzeC(code);
        case "hex":
            return analyzeHex(code);
        case "js":
            return analyzeJs(code);
        default:
            return [];
    }
}
function analyzeAsm(code) {
    const diagnostics = [];
    const lines = code.split(/\r?\n/);
    const hasKeilOrg = /\bORG\b/i.test(code);
    const hasSdasArea = /\.area\b/i.test(code);
    const hasWritePath = /\bmov\s+p0\b/i.test(code) && /\bmov\s+p2\b/i.test(code);
    const hasDirControl = /\bp3\.6\b/i.test(code);
    const labelSet = new Set();
    lines.forEach((raw, index) => {
        const line = raw.trim();
        if (!line)
            return;
        const labelMatch = /^([A-Za-z_.$?][\w.$?]*):/.exec(line);
        if (labelMatch) {
            labelSet.add(labelMatch[1].toLowerCase());
        }
        if (line.includes("//")) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: "Краще замінити `//` на `;`, бо SDAS8051 стабільніше сприймає asm-коментарі саме так.",
            });
        }
        if (/^\s*call\s+[A-Za-z_.$?][\w.$?]*/i.test(line)) {
            const target = line.replace(/^\s*call\s+/i, "").split(/\s+/)[0].toLowerCase();
            if (!code.toLowerCase().includes(`${target}:`)) {
                diagnostics.push({
                    level: "warning",
                    line: index + 1,
                    message: `Підпрограма \`${target}\` не знайдена в поточному тексті.`,
                });
            }
        }
    });
    if (!hasKeilOrg && !hasSdasArea) {
        diagnostics.push({
            level: "error",
            message: "Не видно ні `ORG`, ні `.area HOME (CODE)`. Потрібна точка входу для 8051 програми.",
        });
    }
    if (!/\bEND\b|\.end\b/i.test(code)) {
        diagnostics.push({
            level: "warning",
            message: "Немає `END` / `.end`. Для прикладів з методички це бажано додати в кінець файлу.",
        });
    }
    if (!hasWritePath) {
        diagnostics.push({
            level: "hint",
            message: "У коді не видно типового ST841 запису через `P0 -> P2 -> P2=0x00`. Може не вистачати bus-latch логіки.",
        });
    }
    if (!hasDirControl) {
        diagnostics.push({
            level: "hint",
            message: "Не видно керування `P3.6`. Для стенда це важливо: `1` = TX, `0` = RX.",
        });
    }
    if (hasKeilOrg && hasSdasArea) {
        diagnostics.push({
            level: "hint",
            message: "У тексті змішані Keil-style (`ORG`) і SDAS-style (`.area`) директиви. Краще тримати один стиль.",
        });
    }
    if (diagnostics.length === 0) {
        diagnostics.push({
            level: "hint",
            message: "ASM виглядає чисто. Для запуску в рантаймі зараз використовується HEX з ROM-панелі або зразка.",
        });
    }
    return diagnostics;
}
function analyzeC(code) {
    const diagnostics = [];
    const lines = code.split(/\r?\n/);
    let braceBalance = 0;
    if (!/\bmain\s*\(/.test(code)) {
        diagnostics.push({
            level: "error",
            message: "Не знайдено `main(...)`. Для лабораторної зазвичай потрібна точка входу.",
        });
    }
    lines.forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
            return;
        }
        braceBalance += (line.match(/\{/g) ?? []).length;
        braceBalance -= (line.match(/\}/g) ?? []).length;
        const looksLikeStatement = /[=)]\s*$/.test(line) ||
            /\b(return|break|continue)\b/.test(line) ||
            /\b[A-Za-z_]\w*\s*\([^;]*\)\s*$/.test(line);
        const exempt = /[;{}:]$/.test(line) || /^#/.test(line);
        if (looksLikeStatement && !exempt) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: "Схоже, тут бракує `;` наприкінці рядка.",
            });
        }
    });
    if (braceBalance !== 0) {
        diagnostics.push({
            level: "error",
            message: "Незбалансовані `{}` у C-коді.",
        });
    }
    if (!/\bP0\b|\bP2\b|\bP3\b|\bGPIO\b|\bADCCON/i.test(code)) {
        diagnostics.push({
            level: "hint",
            message: "Не видно доступу до портів/ADC. Для стенда код зазвичай звертається до `P0/P2/P3` або ADC-регістрів.",
        });
    }
    diagnostics.push({
        level: "hint",
        message: "C-перевірка зараз дає підказки по синтаксису й ST841-патернах. Автокомпіляцію `C -> HEX` я ще не підключав.",
    });
    return diagnostics;
}
function analyzeHex(code) {
    const diagnostics = [];
    const lines = code
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length === 0) {
        return [{ level: "error", message: "HEX-поле порожнє." }];
    }
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (!line.startsWith(":")) {
            diagnostics.push({
                level: "error",
                line: index + 1,
                message: "Кожен рядок Intel HEX має починатись з `:`.",
            });
            continue;
        }
        if (line.length < 11 || line.length % 2 === 0) {
            diagnostics.push({
                level: "error",
                line: index + 1,
                message: "Схожий на пошкоджений Intel HEX рядок.",
            });
            continue;
        }
        const len = parseHex(line.slice(1, 3));
        const addrHi = parseHex(line.slice(3, 5));
        const addrLo = parseHex(line.slice(5, 7));
        const type = parseHex(line.slice(7, 9));
        if ([len, addrHi, addrLo, type].some(Number.isNaN)) {
            diagnostics.push({
                level: "error",
                line: index + 1,
                message: "HEX-рядок містить невалідні символи.",
            });
            continue;
        }
        const expectedLength = 11 + len * 2;
        if (line.length !== expectedLength) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: `Довжина рядка не збігається з полем byte-count (${len}).`,
            });
        }
    }
    try {
        const parsed = parseIntelHex(code);
        if (parsed.length === 0) {
            diagnostics.push({
                level: "error",
                message: "HEX не дав жодного байта коду.",
            });
        }
        else {
            diagnostics.push({
                level: "hint",
                message: `HEX розібрався нормально: ${parsed.length / 2} байт коду.`,
            });
        }
    }
    catch (error) {
        diagnostics.push({
            level: "error",
            message: `Помилка розбору HEX: ${String(error)}`,
        });
    }
    return diagnostics;
}
function analyzeJs(code) {
    try {
        new Function(`"use strict";\n${code}`);
        return [
            {
                level: "hint",
                message: "JS-сценарій синтаксично виглядає нормально.",
            },
        ];
    }
    catch (error) {
        const match = /<anonymous>:(\d+):(\d+)/.exec(String(error));
        return [
            {
                level: "error",
                line: match ? Math.max(1, Number(match[1]) - 1) : undefined,
                message: String(error),
            },
        ];
    }
}
function parseHex(value) {
    return Number.parseInt(value, 16);
}
