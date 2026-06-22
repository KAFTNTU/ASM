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
    lines.forEach((raw, index) => {
        const line = raw.trim();
        if (!line)
            return;
        if (line.includes("//")) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: "Краще замінити `//` на `;`, бо SDAS8051 надійніше обробляє ASM-коментарі саме так.",
            });
        }
        if (/^\s*call\s+[A-Za-z_.$?][\w.$?]*/i.test(line)) {
            const target = line.replace(/^\s*call\s+/i, "").split(/\s+/)[0].toLowerCase();
            if (!code.toLowerCase().includes(`${target}:`)) {
                diagnostics.push({
                    level: "warning",
                    line: index + 1,
                    message: `Підпрограму \`${target}\` не знайдено в поточному коді.`,
                });
            }
        }
    });
    if (!hasKeilOrg && !hasSdasArea) {
        diagnostics.push({
            level: "error",
            message: "Не знайдено ні `ORG`, ні `.area HOME (CODE)`. Для програми 8051 потрібна визначена точка входу.",
        });
    }
    if (!/\bEND\b|\.end\b/i.test(code)) {
        diagnostics.push({
            level: "warning",
            message: "Немає `END` / `.end`. Для лабораторних прикладів краще додати це в кінці файла.",
        });
    }
    if (!hasWritePath) {
        diagnostics.push({
            level: "hint",
            message: "У коді не видно типовий шлях запису ST841 `P0 -> P2 -> P2=0x00`. Може бракувати логіки шини й latch.",
        });
    }
    if (!hasDirControl) {
        diagnostics.push({
            level: "hint",
            message: "Не знайдено керування напрямком через `P3.6`. На цьому стенді це важливо: `1` = TX, `0` = RX.",
        });
    }
    if (hasKeilOrg && hasSdasArea) {
        diagnostics.push({
            level: "hint",
            message: "У коді змішані директиви стилю Keil (`ORG`) і SDAS (`.area`). Краще залишити один стиль.",
        });
    }
    if (diagnostics.length === 0) {
        diagnostics.push({
            level: "hint",
            message: "ASM виглядає коректно. Під час запуску симулятор зараз завантажує HEX з панелі ROM або зі зразка.",
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
            message: "Не знайдено функцію `main(...)`. Для лабораторних робіт зазвичай потрібна точка входу.",
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
                message: "Схоже, в кінці рядка пропущено `;`.",
            });
        }
    });
    if (braceBalance !== 0) {
        diagnostics.push({
            level: "error",
            message: "У C-коді не збігається кількість дужок `{}`.",
        });
    }
    if (!/\bP0\b|\bP2\b|\bP3\b|\bGPIO\b|\bADCCON/i.test(code)) {
        diagnostics.push({
            level: "hint",
            message: "Не видно доступу до портів або АЦП. Код для стенда зазвичай працює з `P0/P2/P3` або регістрами ADC.",
        });
    }
    diagnostics.push({
        level: "hint",
        message: "Перевірка C зараз дає лише синтаксичні підказки та типові шаблони ST841. Автоматична збірка `C -> HEX` ще не підключена.",
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
        return [{ level: "error", message: "Поле HEX порожнє." }];
    }
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (!line.startsWith(":")) {
            diagnostics.push({
                level: "error",
                line: index + 1,
                message: "Кожен рядок Intel HEX має починатися з `:`.",
            });
            continue;
        }
        if (line.length < 11 || line.length % 2 === 0) {
            diagnostics.push({
                level: "error",
                line: index + 1,
                message: "Схоже, цей рядок Intel HEX пошкоджений.",
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
                message: "У рядку HEX є недопустимі символи.",
            });
            continue;
        }
        const expectedLength = 11 + len * 2;
        if (line.length !== expectedLength) {
            diagnostics.push({
                level: "warning",
                line: index + 1,
                message: `Довжина рядка не відповідає полю кількості байтів (${len}).`,
            });
        }
        const allBytes = [];
        for (let i = 1; i < line.length - 1; i += 2) {
            allBytes.push(parseHex(line.slice(i, i + 2)));
        }
        if (!allBytes.some(Number.isNaN)) {
            const sum = allBytes.reduce((acc, b) => (acc + b) & 0xff, 0);
            if (sum !== 0) {
                diagnostics.push({
                    level: "error",
                    line: index + 1,
                    message: `Неправильна контрольна сума HEX-рядка (очікувалось 0x00, отримано 0x${sum.toString(16).toUpperCase().padStart(2, "0")}).`,
                });
            }
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
                message: `HEX успішно розібрано: ${parsed.length / 2} байт коду.`,
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
                message: "JS-скрипт синтаксично виглядає коректним.",
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
