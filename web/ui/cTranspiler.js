const REGISTER_NAMES = new Set([
    "a", "acc", "b", "p0", "p1", "p2", "p3", "sp", "dpl", "dph",
    "tl0", "th0", "tl1", "th1", "tcon", "tmod", "psw", "ie", "ip", "scon", "sbuf",
]);
const BUILTIN_RETURN_CALLS = new Set([
    "read_adc", "adc_read", "adc_high", "read_adc_high",
    "adc_low", "read_adc_low",
    "joystick_x", "joy_x", "joystick_y", "joy_y",
    "keypad_read", "key_read", "keypad_col1", "keypad_col2", "keypad_col3",
]);
// ST841 / 74HC574 seven-segment table from the lab manual.
// Bit order: PGFEDCBA, active-low: 0 lights a segment, 1 turns it off.
const DIGIT_TO_SEG = [
    0xC0, // 0
    0xF9, // 1
    0xA4, // 2
    0xB0, // 3
    0x99, // 4
    0x92, // 5
    0x82, // 6
    0xF8, // 7
    0x80, // 8
    0x98, // 9
    0x88, // A
    0x83, // b
    0xC6, // C
    0xA1, // d
    0x86, // E
    0x8E, // F
];
export function transpileCToAsm(source) {
    const diagnostics = [];
    const text = stripComments(source).replace(/\r/g, "");
    const ctx = {
        diagnostics,
        constants: parseDefines(text),
        sfr: parseSfr(text),
        sbit: parseSbits(text),
        vars: new Map(),
        functions: parseFunctions(text),
        labels: 0,
        needDelay: false,
        needWrite: false,
        needReadAdc: false,
        needReadAdcLow: false,
        needKeypadRead: false,
        needLcd: false,
        needLedOn: false,
        needSegDigit: false,
    };
    if (!ctx.functions.has("main")) {
        diagnostics.push({ level: "error", message: "C: не знайдено main(). Потрібно `void main(){...}` або `int main(){...}`." });
        return { ok: false, asm: "", diagnostics };
    }
    const emitted = [];
    emitted.push("org 0x0000");
    emitted.push("c_start:");
    emitted.push("mov sp,#0x2f");
    emitted.push("call main");
    emitted.push("c_stop:");
    emitted.push("sjmp c_stop");
    emitted.push("");
    emitFunction("main", ctx, emitted, new Set());
    for (const name of ctx.functions.keys()) {
        if (name !== "main")
            emitFunction(name, ctx, emitted, new Set());
    }
    if (ctx.needWrite || ctx.needLcd || ctx.needLedOn || ctx.needSegDigit)
        emitWriteRoutine(emitted);
    if (ctx.needReadAdc)
        emitReadAdcRoutine(emitted);
    if (ctx.needReadAdcLow)
        emitReadAdcLowRoutine(emitted);
    if (ctx.needKeypadRead)
        emitKeypadReadRoutine(emitted);
    if (ctx.needLcd)
        emitLcdRoutine(emitted);
    if (ctx.needLedOn)
        emitLedOnRoutine(emitted);
    if (ctx.needSegDigit)
        emitSegDigitRoutine(emitted);
    if (ctx.needDelay)
        emitDelayRoutine(emitted);
    emitted.push("end");
    if (!diagnostics.some((item) => item.level === "error")) {
        diagnostics.push({
            level: "hint",
            message: "C ST841 subset: LED/7seg/matrix/LCD/keypad/ADC/joystick/bus helpers, variables, functions, if/else, while, for.",
        });
    }
    return { ok: diagnostics.every((item) => item.level !== "error"), asm: emitted.join("\n"), diagnostics };
}
function emitFunction(name, ctx, out, seen) {
    if (seen.has(name))
        return;
    const fn = ctx.functions.get(name);
    if (!fn)
        return;
    seen.add(name);
    out.push(`${sanitizeLabel(name)}:`);
    emitStatements(splitStatements(fn.body), fn.lineOffset, ctx, out);
    out.push("ret");
    out.push("");
}
function emitStatements(stmts, lineOffset, ctx, out) {
    for (const stmt of stmts)
        emitStatement(stmt, lineOffset, ctx, out);
}
function emitStatement(statement, lineOffset, ctx, out) {
    const raw = trimOuter(statement.text.trim());
    if (!raw)
        return;
    const line = lineOffset + statement.line;
    const whileOne = /^while\s*\(\s*(?:1|true)\s*\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (whileOne) {
        const label = nextLabel(ctx, "while");
        out.push(`${label}:`);
        emitStatements(splitStatements(whileOne[1]), lineOffset + statement.line, ctx, out);
        emitLongJump(label, out);
        return;
    }
    const whileCond = /^while\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (whileCond) {
        const start = nextLabel(ctx, "while");
        const end = nextLabel(ctx, "wend");
        out.push(`${start}:`);
        emitConditionJumpFalse(whileCond[1], end, line, ctx, out);
        emitStatements(splitStatements(whileCond[2]), lineOffset + statement.line, ctx, out);
        emitLongJump(start, out);
        out.push(`${end}:`);
        return;
    }
    const forCount = /^for\s*\(\s*(?:unsigned\s+char\s+|unsigned\s+int\s+|int\s+|uint8_t\s+|char\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*\1\s*<\s*([^;]+);\s*\1\s*\+\+\s*\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (forCount) {
        const varName = forCount[1];
        const start = parseValue(forCount[2], ctx);
        const end = parseValue(forCount[3], ctx);
        if (start == null || end == null || end <= start || end - start > 255) {
            ctx.diagnostics.push({ level: "warning", line, message: `C for-loop skipped або занадто великий: ${raw.slice(0, 70)}` });
            return;
        }
        const loop = nextLabel(ctx, "for");
        const counter = allocVar(varName, ctx).addr;
        out.push(`mov ${hexByte(counter)},#${hexByte(end - start)}`);
        out.push(`${loop}:`);
        emitStatements(splitStatements(forCount[4]), lineOffset + statement.line, ctx, out);
        const again = nextLabel(ctx, "foragain");
        const done = nextLabel(ctx, "forend");
        out.push(`djnz ${hexByte(counter)},${again}`);
        emitLongJump(done, out);
        out.push(`${again}:`);
        emitLongJump(loop, out);
        out.push(`${done}:`);
        return;
    }
    const ifMatch = /^if\s*\(([^)]*)\)\s*\{([\s\S]*?)\}(?:\s*else\s*\{([\s\S]*)\})?$/i.exec(raw);
    if (ifMatch) {
        const elseLabel = nextLabel(ctx, "else");
        const endLabel = nextLabel(ctx, "endif");
        emitConditionJumpFalse(ifMatch[1], elseLabel, line, ctx, out);
        emitStatements(splitStatements(ifMatch[2]), lineOffset + statement.line, ctx, out);
        emitLongJump(endLabel, out);
        out.push(`${elseLabel}:`);
        if (ifMatch[3])
            emitStatements(splitStatements(ifMatch[3]), lineOffset + statement.line, ctx, out);
        out.push(`${endLabel}:`);
        return;
    }
    if (/^return\s*;?$/i.test(raw)) {
        out.push("ret");
        return;
    }
    const declaration = /^(?:volatile\s+)?(?:unsigned\s+char|uint8_t|char|int|unsigned\s+int)\s+(.+);?$/i.exec(raw);
    if (declaration) {
        for (const part of splitCommaSafe(declaration[1])) {
            const m = /^([A-Za-z_]\w*)(?:\s*=\s*(.+))?$/.exec(part.trim());
            if (!m)
                continue;
            const variable = allocVar(m[1], ctx);
            if (m[2] != null)
                emitAssignToAddr(variable.addr, m[2], line, ctx, out);
        }
        return;
    }
    const call = /^([A-Za-z_]\w*)\s*\((.*)\)\s*;?$/i.exec(raw);
    if (call) {
        emitCall(call[1], call[2], line, ctx, out);
        return;
    }
    const inc = /^([A-Za-z_]\w*)\s*(\+\+|--)\s*;?$/i.exec(raw);
    if (inc) {
        const target = resolveTarget(inc[1], ctx);
        if (target)
            out.push(`${inc[2] === "++" ? "inc" : "dec"} ${target}`);
        else
            ctx.diagnostics.push({ level: "warning", line, message: `C increment target unknown: ${raw}` });
        return;
    }
    const compound = /^([A-Za-z_]\w*)\s*([+\-&|^])=\s*(.+)\s*;?$/i.exec(raw);
    if (compound) {
        emitCompoundAssign(compound[1], compound[2], compound[3], line, ctx, out);
        return;
    }
    const assign = /^([A-Za-z_]\w*)\s*=\s*(.+)\s*;?$/i.exec(raw);
    if (assign) {
        emitAssignment(assign[1], assign[2], line, ctx, out);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C line not translated: ${raw}` });
}
function emitCall(nameRaw, argsRaw, line, ctx, out) {
    const name = nameRaw.toLowerCase();
    const args = splitCommaSafe(argsRaw);
    if (name === "delay" || name === "sleep") {
        ctx.needDelay = true;
        out.push("call delay");
        return;
    }
    if (name === "delay_ms") {
        const n = parseValue(args[0] ?? "1", ctx) ?? 1;
        ctx.needDelay = true;
        for (let i = 0; i < Math.max(1, Math.min(n, 20)); i++)
            out.push("call delay");
        return;
    }
    if (name === "_nop_" || name === "nop") {
        out.push("nop");
        return;
    }
    if (name === "write" || name === "st_write" || name === "bus_write") {
        emitBusWrite(args, line, ctx, out);
        return;
    }
    if (name === "led" || name === "leds" || name === "led_line" || name === "led_bar") {
        emitBusWrite(["0x07", args[0] ?? "0xff"], line, ctx, out);
        return;
    }
    if (name === "led_off" || name === "leds_off") {
        emitBusWrite(["0x07", "0xff"], line, ctx, out);
        return;
    }
    if (name === "led_all" || name === "leds_all") {
        emitBusWrite(["0x07", "0x00"], line, ctx, out);
        return;
    }
    if (name === "led_on") {
        emitLoadA(args[0] ?? "1", line, ctx, out);
        out.push("call led_on");
        ctx.needLedOn = true;
        return;
    }
    if (name === "seg" || name === "sevenseg" || name === "seven_seg") {
        emitSevenSegRaw(args, line, ctx, out);
        return;
    }
    if (name === "seg_digit" || name === "sevenseg_digit" || name === "digit") {
        emitSevenSegDigit(args, line, ctx, out);
        return;
    }
    if (name === "seg_clear" || name === "sevenseg_clear") {
        for (let a = 1; a <= 4; a++)
            emitBusWrite([hexByte(a), "0xff"], line, ctx, out);
        return;
    }
    if (name === "matrix" || name === "matrix_write") {
        emitBusWrite(["0x05", args[0] ?? "0"], line, ctx, out);
        emitBusWrite(["0x06", args[1] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "matrix_rows") {
        emitBusWrite(["0x05", args[0] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "matrix_cols") {
        emitBusWrite(["0x06", args[0] ?? "0"], line, ctx, out);
        return;
    }
    if (name === "lcd_cmd" || name === "lcd_command") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("mov r5,#0x00");
        out.push("call lcd_write_byte");
        ctx.needLcd = true;
        return;
    }
    if (name === "lcd_data" || name === "lcd_char" || name === "lcd_putc") {
        emitLoadA(args[0] ?? "' '", line, ctx, out);
        out.push("mov r5,#0x01");
        out.push("call lcd_write_byte");
        ctx.needLcd = true;
        return;
    }
    if (name === "lcd_clear") {
        emitLiteralLcdCommand(0x01, ctx, out);
        return;
    }
    if (name === "lcd_home") {
        emitLiteralLcdCommand(0x02, ctx, out);
        return;
    }
    if (name === "lcd_init") {
        for (const cmd of [0x28, 0x0c, 0x06, 0x01])
            emitLiteralLcdCommand(cmd, ctx, out);
        return;
    }
    if (name === "lcd_line") {
        const lineNo = parseValue(args[0] ?? "1", ctx) ?? 1;
        const addr = [0x80, 0xc0, 0x94, 0xd4][Math.max(0, Math.min(3, lineNo - 1))];
        emitLiteralLcdCommand(addr, ctx, out);
        return;
    }
    if (name === "lcd_puts" || name === "lcd_print") {
        const text = parseStringLiteral(args[0] ?? "");
        if (text == null) {
            ctx.diagnostics.push({ level: "warning", line, message: `${nameRaw}(...) підтримує поки тільки рядок у лапках.` });
            return;
        }
        for (const ch of text.slice(0, 64))
            emitLiteralLcdData(ch.charCodeAt(0), ctx, out);
        return;
    }
    if (BUILTIN_RETURN_CALLS.has(name)) {
        emitReturnCallToA(name, args, line, ctx, out);
        return;
    }
    if (ctx.functions.has(name)) {
        out.push(`call ${sanitizeLabel(name)}`);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C function not known: ${nameRaw}()` });
}
function emitBusWrite(args, line, ctx, out) {
    if (args.length < 2) {
        ctx.diagnostics.push({ level: "error", line, message: "write(addr,data) потребує 2 аргументи." });
        return;
    }
    emitLoadA(args[1], line, ctx, out);
    out.push("mov r7,a");
    emitLoadA(args[0], line, ctx, out);
    out.push("mov r6,a");
    out.push("call write");
    ctx.needWrite = true;
}
function emitSevenSegRaw(args, line, ctx, out) {
    const pos = parseValue(args[0] ?? "1", ctx);
    if (pos == null || pos < 1 || pos > 4) {
        ctx.diagnostics.push({ level: "warning", line, message: "sevenseg(pos,value): pos має бути 1..4." });
        return;
    }
    emitBusWrite([hexByte(5 - pos), args[1] ?? "0xff"], line, ctx, out);
}
function emitSevenSegDigit(args, line, ctx, out) {
    const pos = parseValue(args[0] ?? "1", ctx);
    if (pos == null || pos < 1 || pos > 4) {
        ctx.diagnostics.push({ level: "warning", line, message: "seg_digit(pos,digit): pos має бути 1..4." });
        return;
    }
    emitLoadA(args[1] ?? "0", line, ctx, out);
    out.push("call seg_digit_to_pattern");
    out.push("mov r7,a");
    out.push(`mov r6,#${hexByte(5 - pos)}`);
    out.push("call write");
    ctx.needSegDigit = true;
}
function emitReturnCallToA(name, args, line, ctx, out) {
    if (name === "read_adc" || name === "adc_read" || name === "adc_high" || name === "read_adc_high") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "adc_low" || name === "read_adc_low") {
        emitLoadA(args[0] ?? "0", line, ctx, out);
        out.push("call read_adc_low");
        ctx.needReadAdcLow = true;
        return;
    }
    if (name === "joystick_x" || name === "joy_x") {
        out.push("mov a,#0x06");
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "joystick_y" || name === "joy_y") {
        out.push("mov a,#0x07");
        out.push("call read_adc");
        ctx.needReadAdc = true;
        return;
    }
    if (name === "keypad_read" || name === "key_read") {
        emitLoadA(args[0] ?? "0x60", line, ctx, out);
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col1") {
        out.push("mov a,#0x60");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col2") {
        out.push("mov a,#0x50");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
    if (name === "keypad_col3") {
        out.push("mov a,#0x30");
        out.push("call keypad_read");
        ctx.needKeypadRead = true;
        return;
    }
}
function emitAssignment(leftRaw, rightRaw, line, ctx, out) {
    const left = leftRaw.trim();
    const leftLower = left.toLowerCase();
    const bit = ctx.sbit.get(leftLower);
    if (bit) {
        const v = parseValue(rightRaw, ctx);
        if (v === 0 || v === 1)
            out.push(v ? `setb ${bit}` : `clr ${bit}`);
        else
            ctx.diagnostics.push({ level: "warning", line, message: `sbit ${left}=... підтримує тільки 0 або 1.` });
        return;
    }
    const rhsClean = rightRaw.trim().replace(/;$/, "");
    const fnCall = /^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(rhsClean);
    if (fnCall && BUILTIN_RETURN_CALLS.has(fnCall[1].toLowerCase())) {
        emitReturnCallToA(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
        out.push(`mov ${target},a`);
        return;
    }
    const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
    emitLoadA(rightRaw, line, ctx, out);
    out.push(`mov ${target},a`);
}
function emitAssignToAddr(addr, expr, line, ctx, out) {
    emitLoadA(expr, line, ctx, out);
    out.push(`mov ${hexByte(addr)},a`);
}
function emitCompoundAssign(left, op, right, line, ctx, out) {
    const target = resolveTarget(left, ctx) ?? hexByte(allocVar(left, ctx).addr);
    out.push(`mov a,${target}`);
    const imm = parseValue(right, ctx);
    const rightTarget = resolveTarget(right, ctx);
    if (imm == null && !rightTarget) {
        ctx.diagnostics.push({ level: "warning", line, message: `C compound assignment unsupported RHS: ${right}` });
        return;
    }
    const operand = imm != null ? `#${hexByte(imm)}` : rightTarget;
    if (op === "+")
        out.push(`add a,${operand}`);
    else if (op === "-") {
        out.push("clr c");
        out.push(`subb a,${operand}`);
    }
    else if (op === "&")
        out.push(`anl a,${operand}`);
    else if (op === "|")
        out.push(`orl a,${operand}`);
    else if (op === "^")
        out.push(`xrl a,${operand}`);
    out.push(`mov ${target},a`);
}
function emitLoadA(exprRaw, line, ctx, out) {
    const expr = exprRaw.trim().replace(/;$/, "");
    const constVal = parseValue(expr, ctx);
    if (constVal != null) {
        out.push(`mov a,#${hexByte(constVal)}`);
        return;
    }
    const fnCall = /^([A-Za-z_]\w*)\s*\((.*)\)$/i.exec(expr);
    if (fnCall && BUILTIN_RETURN_CALLS.has(fnCall[1].toLowerCase())) {
        emitReturnCallToA(fnCall[1].toLowerCase(), splitCommaSafe(fnCall[2]), line, ctx, out);
        return;
    }
    const binary = /^(.+?)\s*(<<|>>|[+\-&|^])\s*(.+)$/.exec(expr);
    if (binary) {
        emitLoadA(binary[1], line, ctx, out);
        const imm = parseValue(binary[3], ctx);
        const target = resolveTarget(binary[3], ctx);
        const operand = imm != null ? `#${hexByte(imm)}` : target;
        if (!operand) {
            ctx.diagnostics.push({ level: "warning", line, message: `C expression RHS unsupported: ${expr}` });
            return;
        }
        if (binary[2] === "+")
            out.push(`add a,${operand}`);
        else if (binary[2] === "-") {
            out.push("clr c");
            out.push(`subb a,${operand}`);
        }
        else if (binary[2] === "&")
            out.push(`anl a,${operand}`);
        else if (binary[2] === "|")
            out.push(`orl a,${operand}`);
        else if (binary[2] === "^")
            out.push(`xrl a,${operand}`);
        else
            ctx.diagnostics.push({ level: "warning", line, message: `C shift expression is constant-only in this compiler: ${expr}` });
        return;
    }
    const target = resolveTarget(expr, ctx);
    if (target) {
        out.push(`mov a,${target}`);
        return;
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C expression not translated, using 0: ${expr}` });
    out.push("mov a,#0");
}
function emitConditionJumpFalse(condRaw, falseLabel, line, ctx, out) {
    const cond = condRaw.trim();
    const bit = ctx.sbit.get(cond.toLowerCase());
    if (bit) {
        const pass = nextLabel(ctx, "bitpass");
        out.push(`jb ${bit},${pass}`);
        emitLongJump(falseLabel, out);
        out.push(`${pass}:`);
        return;
    }
    const notBit = /^!\s*([A-Za-z_]\w*)$/.exec(cond);
    if (notBit) {
        const b = ctx.sbit.get(notBit[1].toLowerCase());
        if (b) {
            const pass = nextLabel(ctx, "bitpass");
            out.push(`jnb ${b},${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
            return;
        }
    }
    const cmp = /^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/.exec(cond);
    if (cmp) {
        emitLoadA(cmp[1], line, ctx, out);
        const imm = parseValue(cmp[3], ctx);
        const target = resolveTarget(cmp[3], ctx);
        const operand = imm != null ? `#${hexByte(imm)}` : target;
        if (!operand) {
            ctx.diagnostics.push({ level: "warning", line, message: `C compare RHS unsupported: ${cond}` });
            emitLongJump(falseLabel, out);
            return;
        }
        const op = cmp[2];
        if (op === "==") {
            const neq = nextLabel(ctx, "cmpneq");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${neq}`);
            emitLongJump(pass, out);
            out.push(`${neq}:`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "!=") {
            const pass = nextLabel(ctx, "cmpnepass");
            out.push(`cjne a,${operand},${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "<") {
            const cmpLabel = nextLabel(ctx, "cmplt");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(falseLabel, out);
            out.push(`${cmpLabel}:`);
            out.push(`jc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === ">=") {
            const cmpLabel = nextLabel(ctx, "cmpge");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(pass, out);
            out.push(`${cmpLabel}:`);
            out.push(`jnc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === ">") {
            const cmpLabel = nextLabel(ctx, "cmpgt");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(falseLabel, out);
            out.push(`${cmpLabel}:`);
            out.push(`jnc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        else if (op === "<=") {
            const cmpLabel = nextLabel(ctx, "cmple");
            const pass = nextLabel(ctx, "cmppass");
            out.push(`cjne a,${operand},${cmpLabel}`);
            emitLongJump(pass, out);
            out.push(`${cmpLabel}:`);
            out.push(`jc ${pass}`);
            emitLongJump(falseLabel, out);
            out.push(`${pass}:`);
        }
        return;
    }
    emitLoadA(cond, line, ctx, out);
    const pass = nextLabel(ctx, "nzpass");
    out.push(`jnz ${pass}`);
    emitLongJump(falseLabel, out);
    out.push(`${pass}:`);
}
function emitLongJump(label, out) {
    out.push(`ljmp ${label}`);
}
function resolveTarget(nameRaw, ctx) {
    const name = nameRaw.trim().toLowerCase();
    if (REGISTER_NAMES.has(name))
        return name === "acc" ? "a" : name;
    const sfr = ctx.sfr.get(name);
    if (sfr)
        return sfr;
    const variable = ctx.vars.get(name);
    if (variable)
        return hexByte(variable.addr);
    const num = parseValue(nameRaw, ctx);
    if (num != null && num >= 0x80 && num <= 0xff)
        return hexByte(num);
    return null;
}
function allocVar(nameRaw, ctx) {
    const name = nameRaw.toLowerCase();
    const existing = ctx.vars.get(name);
    if (existing)
        return existing;
    const addr = 0x20 + ctx.vars.size;
    const info = { name, addr };
    ctx.vars.set(name, info);
    return info;
}
function emitWriteRoutine(out) {
    out.push("write:");
    out.push("setb p3.6");
    out.push("mov p0,r7");
    out.push("mov p2,r6");
    out.push("nop");
    out.push("mov p2,#0x00");
    out.push("ret");
    out.push("");
}
function emitReadAdcRoutine(out) {
    out.push("read_adc:");
    out.push("mov 0xd8,a");
    out.push("clr 0xdf");
    out.push("setb 0xdc");
    out.push("jnb 0xdf,$");
    out.push("mov a,0xda");
    out.push("anl a,#00001111b");
    out.push("ret");
    out.push("");
}
function emitReadAdcLowRoutine(out) {
    out.push("read_adc_low:");
    out.push("mov 0xd8,a");
    out.push("clr 0xdf");
    out.push("setb 0xdc");
    out.push("jnb 0xdf,$");
    out.push("mov a,0xd9");
    out.push("ret");
    out.push("");
}
function emitKeypadReadRoutine(out) {
    out.push("keypad_read:");
    out.push("clr p3.6");
    out.push("mov p2,a");
    out.push("nop");
    out.push("mov a,p0");
    out.push("anl a,#0x0f");
    out.push("ret");
    out.push("");
}
function emitLcdRoutine(out) {
    out.push("lcd_write_byte:");
    out.push("mov b,a");
    out.push("anl a,#0xf0");
    out.push("orl a,r5");
    out.push("mov r7,a");
    out.push("mov r6,#0x08");
    out.push("call write");
    out.push("mov a,b");
    out.push("swap a");
    out.push("anl a,#0xf0");
    out.push("orl a,r5");
    out.push("mov r7,a");
    out.push("mov r6,#0x08");
    out.push("call write");
    out.push("ret");
    out.push("");
}
function emitLedOnRoutine(out) {
    out.push("led_on:");
    out.push("dec a");
    out.push("anl a,#0x07");
    out.push("mov r4,a");
    out.push("mov a,#0x01");
    out.push("led_on_shift:");
    out.push("cjne r4,#0x00,led_on_do_shift");
    out.push("sjmp led_on_ready");
    out.push("led_on_do_shift:");
    out.push("rl a");
    out.push("dec r4");
    out.push("sjmp led_on_shift");
    out.push("led_on_ready:");
    out.push("cpl a");
    out.push("mov r7,a");
    out.push("mov r6,#0x07");
    out.push("call write");
    out.push("ret");
    out.push("");
}
function emitSegDigitRoutine(out) {
    out.push("seg_digit_to_pattern:");
    for (let i = 0; i < DIGIT_TO_SEG.length; i++) {
        const next = `seg_digit_${i + 1}`;
        out.push(`cjne a,#${hexByte(i)},${next}`);
        out.push(`mov a,#${hexByte(DIGIT_TO_SEG[i])}`);
        out.push("ret");
        out.push(`${next}:`);
    }
    out.push("mov a,#0x00");
    out.push("ret");
    out.push("");
}
function emitDelayRoutine(out) {
    out.push("delay:");
    out.push("mov r3,#20");
    out.push("d3:");
    out.push("mov r2,#255");
    out.push("d2:");
    out.push("mov r1,#255");
    out.push("d1:");
    out.push("djnz r1,d1");
    out.push("djnz r2,d2");
    out.push("djnz r3,d3");
    out.push("ret");
    out.push("");
}
function emitLiteralLcdCommand(value, ctx, out) {
    out.push(`mov a,#${hexByte(value)}`);
    out.push("mov r5,#0x00");
    out.push("call lcd_write_byte");
    ctx.needLcd = true;
}
function emitLiteralLcdData(value, ctx, out) {
    out.push(`mov a,#${hexByte(value)}`);
    out.push("mov r5,#0x01");
    out.push("call lcd_write_byte");
    ctx.needLcd = true;
}
function parseFunctions(source) {
    const map = new Map();
    const re = /\b(?:void|int|unsigned\s+char|unsigned\s+int|uint8_t|char)\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/gi;
    let m;
    while ((m = re.exec(source))) {
        const name = m[1].toLowerCase();
        const start = re.lastIndex;
        let depth = 1;
        let index = start;
        while (index < source.length && depth > 0) {
            const ch = source[index];
            if (ch === "{")
                depth += 1;
            else if (ch === "}")
                depth -= 1;
            index += 1;
        }
        if (depth === 0) {
            const body = source.slice(start, index - 1);
            const lineOffset = source.slice(0, start).split("\n").length - 1;
            map.set(name, { name, body, lineOffset });
            re.lastIndex = index;
        }
    }
    return map;
}
function parseDefines(source) {
    const map = new Map();
    const re = /^\s*#define\s+([A-Za-z_]\w*)\s+([^\s/]+).*$/gim;
    let m;
    while ((m = re.exec(source)))
        map.set(m[1].toLowerCase(), normalizeNumber(m[2]) ?? m[2]);
    return map;
}
function parseSfr(source) {
    const map = new Map();
    const re = /\b(?:sfr|__sfr)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi;
    let m;
    while ((m = re.exec(source))) {
        const value = normalizeNumber(m[2]);
        if (value)
            map.set(m[1].toLowerCase(), value);
    }
    const defaults = [
        ["p0", "0x80"], ["sp", "0x81"], ["dpl", "0x82"], ["dph", "0x83"], ["p1", "0x90"], ["p2", "0xa0"], ["p3", "0xb0"],
        ["psw", "0xd0"], ["acc", "0xe0"], ["b", "0xf0"], ["ie", "0xa8"], ["ip", "0xb8"], ["scon", "0x98"], ["sbuf", "0x99"],
        ["adccon1", "0xef"], ["adccon2", "0xd8"], ["adcdatal", "0xd9"], ["adcdatah", "0xda"],
        ["tcon", "0x88"], ["tmod", "0x89"], ["tl0", "0x8a"], ["tl1", "0x8b"], ["th0", "0x8c"], ["th1", "0x8d"],
    ];
    for (const [k, v] of defaults)
        if (!map.has(k.toLowerCase()))
            map.set(k.toLowerCase(), v);
    return map;
}
function parseSbits(source) {
    const map = new Map();
    const portRe = /\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*P([0-3])\s*\^\s*([0-7])\s*;/gi;
    let m;
    while ((m = portRe.exec(source)))
        map.set(m[1].toLowerCase(), `p${m[2]}.${m[3]}`);
    const bitRe = /\b(?:sbit|__sbit)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/gi;
    while ((m = bitRe.exec(source))) {
        const value = normalizeNumber(m[2]);
        if (value && !map.has(m[1].toLowerCase()))
            map.set(m[1].toLowerCase(), value);
    }
    map.set("adci", "0xdf");
    map.set("sconv", "0xdc");
    return map;
}
function splitStatements(source) {
    const list = [];
    let depth = 0;
    let parenDepth = 0;
    let current = "";
    let line = 1;
    let statementLine = 1;
    let inString = null;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const prev = source[i - 1];
        current += ch;
        if (ch === "\n")
            line += 1;
        if ((ch === '"' || ch === "'") && prev !== "\\")
            inString = inString === ch ? null : inString ?? ch;
        if (inString)
            continue;
        if (ch === "(")
            parenDepth += 1;
        if (ch === ")")
            parenDepth -= 1;
        if (ch === "{")
            depth += 1;
        if (ch === "}")
            depth -= 1;
        if ((ch === ";" && depth === 0 && parenDepth === 0) || (ch === "}" && depth === 0)) {
            if (ch === "}" && /^\s*else\b/i.test(source.slice(i + 1)))
                continue;
            const text = current.trim();
            if (text)
                list.push({ text, line: statementLine });
            current = "";
            statementLine = line;
        }
    }
    const tail = current.trim();
    if (tail)
        list.push({ text: tail, line: statementLine });
    return list;
}
function splitCommaSafe(source) {
    const out = [];
    let depth = 0;
    let cur = "";
    let inString = null;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const prev = source[i - 1];
        if ((ch === '"' || ch === "'") && prev !== "\\")
            inString = inString === ch ? null : inString ?? ch;
        if (!inString) {
            if (ch === "(")
                depth += 1;
            if (ch === ")")
                depth -= 1;
            if (ch === "," && depth === 0) {
                out.push(cur.trim());
                cur = "";
                continue;
            }
        }
        cur += ch;
    }
    if (cur.trim())
        out.push(cur.trim());
    return out;
}
function parseValue(raw, ctx) {
    const text = raw.trim().replace(/^\((.*)\)$/, "$1").replace(/;$/, "");
    const constVal = ctx.constants.get(text.toLowerCase());
    if (constVal)
        return parseValue(constVal, ctx);
    const charMatch = /^'(?:\\(.)|([^\\]))'$/.exec(text);
    if (charMatch)
        return (charMatch[1] ?? charMatch[2]).charCodeAt(0) & 0xff;
    const exprValue = parseConstantExpression(text, ctx);
    if (exprValue != null)
        return exprValue & 0xff;
    const num = normalizeNumber(text);
    if (!num)
        return null;
    if (/^0x/i.test(num))
        return Number.parseInt(num.slice(2), 16) & 0xff;
    if (/^[01]+b$/i.test(num))
        return Number.parseInt(num.slice(0, -1), 2) & 0xff;
    if (/^0b/i.test(num))
        return Number.parseInt(num.slice(2), 2) & 0xff;
    return Number.parseInt(num, 10) & 0xff;
}
function parseConstantExpression(text, ctx) {
    if (!/[+\-*/&|^~<>]/.test(text))
        return null;
    let expr = text;
    for (const [name, value] of ctx.constants) {
        expr = expr.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), value);
    }
    if (!/^[\dxa-fA-FbBoO\s()+\-*/&|^~<>]+$/.test(expr))
        return null;
    expr = expr.replace(/\b([01]+)b\b/gi, (_m, bits) => `0b${bits}`);
    try {
        const value = Function(`"use strict"; return (${expr});`)();
        return Number.isFinite(value) ? Number(value) & 0xff : null;
    }
    catch {
        return null;
    }
}
function normalizeNumber(raw) {
    const text = raw.trim().replace(/[uUlL]+$/g, "");
    if (/^0x[0-9a-f]+$/i.test(text))
        return text.toLowerCase();
    if (/^0[0-7]+$/.test(text))
        return `0x${Number.parseInt(text, 8).toString(16)}`;
    if (/^\d+$/.test(text))
        return String(Number.parseInt(text, 10));
    if (/^0b[01]+$/i.test(text))
        return `${text.slice(2)}b`;
    if (/^[01]+b$/i.test(text))
        return text.toLowerCase();
    return null;
}
function parseStringLiteral(raw) {
    const text = raw.trim();
    const match = /^"([\s\S]*)"$/.exec(text);
    if (!match)
        return null;
    return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
}
function trimOuter(text) {
    return text.replace(/^\s+|\s+$/g, "");
}
function nextLabel(ctx, prefix) {
    ctx.labels += 1;
    return `c_${prefix}_${ctx.labels}`;
}
function sanitizeLabel(name) {
    return name.toLowerCase().replace(/[^a-z0-9_$?]/g, "_");
}
function hexByte(value) {
    return "0x" + (value & 0xff).toString(16).padStart(2, "0");
}
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
