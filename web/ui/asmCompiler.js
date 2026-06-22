const DIRECT_MAP = {
    p0: 0x80,
    sp: 0x81,
    dpl: 0x82,
    dph: 0x83,
    dpp: 0x84,
    pcon: 0x87,
    p1: 0x90,
    p2: 0xa0,
    ie: 0xa8,
    p3: 0xb0,
    ip: 0xb8,
    tcon: 0x88,
    tmod: 0x89,
    tl0: 0x8a,
    tl1: 0x8b,
    th0: 0x8c,
    th1: 0x8d,
    t2con: 0xc8,
    t2mod: 0xc9,
    rcap2l: 0xca,
    rcap2h: 0xcb,
    tl2: 0xcc,
    th2: 0xcd,
    scon: 0x98,
    sbuf: 0x99,
    t3con: 0xae,
    t3fd: 0xaf,
    pwmcon: 0xd7,
    // NOTE: On ADuC841, PWM and DAC SFRs share the same physical addresses.
    // PWM registers (when DACCON.PD=0): 0xFA=PWM0L, 0xFB=PWM0H, 0xFC=PWM1L, 0xFD=PWM1H
    // DAC registers (when DACCON.PD=1): 0xFA=DAC0H, 0xFB=DAC1L, 0xFC=DAC1H, 0xFD=DACCON
    // Writing to pwm0l and dac0h writes to the SAME physical SFR 0xFA.
    // Choose the alias that matches your DACCON.PD mode.
    pwm0h: 0xfb,
    pwm0l: 0xfa,
    pwm1h: 0xfd,
    pwm1l: 0xfc,
    adccon1: 0xef,
    adccon2: 0xd8,
    adcdatal: 0xd9,
    adcdatah: 0xda,
    adccon3: 0xf5,
    adcofsl: 0xf1,
    adcofsh: 0xf2,
    adcgainl: 0xf3,
    adcgainh: 0xf4,
    dac0l: 0xf9,
    dac0h: 0xfa,
    dac1l: 0xfb,
    dac1h: 0xfc,
    daccon: 0xfd,
    psw: 0xd0,
    acc: 0xe0,
    b: 0xf0,
};
const BIT_ALIAS_MAP = {
    // SCON
    ri: 0x98,
    ti: 0x99,
    rb8: 0x9a,
    tb8: 0x9b,
    ren: 0x9c,
    sm2: 0x9d,
    sm1: 0x9e,
    sm0: 0x9f,
    // TCON
    it0: 0x88,
    ie0: 0x89,
    it1: 0x8a,
    ie1: 0x8b,
    tr0: 0x8c,
    tf0: 0x8d,
    tr1: 0x8e,
    tf1: 0x8f,
    // IE/IP
    ex0: 0xa8,
    et0: 0xa9,
    ex1: 0xaa,
    et1: 0xab,
    es: 0xac,
    et2: 0xad,
    eadc: 0xae,
    ea: 0xaf,
    px0: 0xb8,
    pt0: 0xb9,
    px1: 0xba,
    pt1: 0xbb,
    ps: 0xbc,
    pt2: 0xbd,
    padc: 0xbe,
    psi: 0xbf,
    // PSW
    p: 0xd0,
    f1: 0xd1,
    ov: 0xd2,
    rs0: 0xd3,
    rs1: 0xd4,
    f0: 0xd5,
    ac: 0xd6,
    cy: 0xd7,
    // ADC/T2
    adci: 0xdf,
    sconv: 0xdc,
    tf2: 0xcf,
    exf2: 0xce,
};
export function compileAsm(source) {
    const diagnostics = [];
    const lines = source.split(/\r?\n/);
    const labels = new Map();
    const equ = new Map();
    const parsed = [];
    let address = 0;
    for (let index = 0; index < lines.length; index++) {
        const lineNo = index + 1;
        let text = stripComment(lines[index]).trim();
        // Compatibility with pasted snippets that accidentally start with "=".
        if (text.startsWith("=")) {
            text = text.slice(1).trim();
        }
        if (!text)
            continue;
        const equMatch = /^([A-Za-z_.$?][\w.$?]*)\s+equ\s+(.+)$/i.exec(text);
        if (equMatch) {
            equ.set(equMatch[1].toLowerCase(), equMatch[2].trim());
            continue;
        }
        const dataMatch = /^([A-Za-z_.$?][\w.$?]*)\s+data\s+(.+)$/i.exec(text);
        if (dataMatch) {
            equ.set(dataMatch[1].toLowerCase(), dataMatch[2].trim());
            continue;
        }
        const bitMatchDecl = /^([A-Za-z_.$?][\w.$?]*)\s+bit\s+(.+)$/i.exec(text);
        if (bitMatchDecl) {
            equ.set(bitMatchDecl[1].toLowerCase(), bitMatchDecl[2].trim());
            continue;
        }
        const sbitMatch = /^sbit\s+([A-Za-z_.$?][\w.$?]*)\s*=\s*(.+)$/i.exec(text);
        if (sbitMatch) {
            equ.set(sbitMatch[1].toLowerCase(), sbitMatch[2].trim());
            continue;
        }
        const sfrMatch = /^sfr\s+([A-Za-z_.$?][\w.$?]*)\s*=\s*(.+)$/i.exec(text);
        if (sfrMatch) {
            equ.set(sfrMatch[1].toLowerCase(), sfrMatch[2].trim());
            continue;
        }
        const orgMatch = /^org\s+(.+)$/i.exec(text);
        if (orgMatch) {
            const value = resolveNumber(orgMatch[1], equ);
            if (value == null) {
                diagnostics.push({ level: "error", line: lineNo, message: "Invalid ORG value." });
            }
            else {
                address = value & 0xffff;
            }
            continue;
        }
        if (/^(\.module|\.area|\.end|end|cseg|dseg|xseg|bseg|using|name|public|extrn|extern)\b/i.test(text)) {
            continue;
        }
        if (/^\$?include\b/i.test(text) || /^\$mod/i.test(text)) {
            continue;
        }
        const labelMatch = /^([A-Za-z_.$?][\w.$?]*):\s*(.*)$/.exec(text);
        if (labelMatch) {
            labels.set(labelMatch[1].toLowerCase(), address);
            text = labelMatch[2].trim();
            if (!text)
                continue;
        }
        const { mnemonic, operands } = splitInstruction(text);
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
        address = (address + size) & 0xffff;
    }
    const map = new Map();
    const pcToLine = [];
    for (const entry of parsed) {
        pcToLine.push({ pc: entry.address & 0xffff, line: entry.line });
        const encoded = encodeInstruction(entry, labels, equ, diagnostics);
        if (!encoded)
            continue;
        encoded.forEach((byte, offset) => map.set((entry.address + offset) & 0xffff, byte & 0xff));
    }
    const bytes = flattenMap(map);
    const hex = toIntelHex(map);
    const loweredSource = source.toLowerCase();
    const usesPwmRegs = /\bpwm(?:con|0l|0h|1l|1h)\b/.test(loweredSource);
    const usesDacRegs = /\bdac(?:con|0l|0h|1l|1h)\b/.test(loweredSource);
    if (usesPwmRegs && usesDacRegs) {
        diagnostics.push({
            level: "warning",
            message: "PWM \u0456 DAC \u0443 ST841 \u043c\u0430\u044e\u0442\u044c \u0441\u043f\u0456\u043b\u044c\u043d\u0456 SFR-\u0430\u0434\u0440\u0435\u0441\u0438. \u042f\u043a\u0449\u043e \u0437\u043c\u0456\u0448\u0430\u0442\u0438 \u0457\u0445 \u0432 \u043e\u0434\u043d\u043e\u043c\u0443 \u043a\u043e\u0434\u0456, \u0440\u0435\u0433\u0456\u0441\u0442\u0440\u0438 \u043c\u043e\u0436\u0443\u0442\u044c \u043f\u0435\u0440\u0435\u0437\u0430\u043f\u0438\u0441\u0443\u0432\u0430\u0442\u0438 \u043e\u0434\u043d\u0435 \u043e\u0434\u043d\u043e\u0433\u043e.",
        });
    }
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
function stripComment(line) {
    const semicolon = line.indexOf(";");
    const slash = line.indexOf("//");
    let end = line.length;
    if (semicolon >= 0)
        end = Math.min(end, semicolon);
    if (slash >= 0)
        end = Math.min(end, slash);
    return line.slice(0, end);
}
function splitInstruction(text) {
    const trimmed = text.trim();
    const match = /^([^\s]+)\s*(.*)$/.exec(trimmed);
    const mnemonic = (match?.[1] ?? "").toLowerCase();
    const tail = match?.[2] ?? "";
    const operands = tail
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return { mnemonic, operands };
}
function estimateDbSize(operands) {
    let size = 0;
    for (const operand of operands) {
        const text = operand.trim();
        const stringMatch = /^(?:'([^']*)'|"([^"]*)")$/.exec(text);
        size += stringMatch ? (stringMatch[1] ?? stringMatch[2] ?? "").length : 1;
    }
    return size;
}
function estimateSize(mnemonic, operands, equ) {
    const arg0Raw = operands[0]?.trim().toLowerCase() ?? "";
    const arg1Raw = operands[1]?.trim().toLowerCase() ?? "";
    const arg0 = resolveAliasToken(arg0Raw, equ);
    const arg1 = resolveAliasToken(arg1Raw, equ);
    switch (mnemonic) {
        case "db":
            return estimateDbSize(operands);
        case "dw":
            return operands.length * 2;
        case "mov":
            if (operands.length !== 2)
                return 0;
            if (arg0 === "dptr" && arg1.startsWith("#"))
                return 3;
            if (arg0 === "c" || arg1 === "c")
                return 2;
            if (arg1.startsWith("#")) {
                return isRegisterToken(arg0) || arg0 === "a" || arg0 === "acc" ? 2 : 3;
            }
            return 2;
        case "xch":
            return operands.length === 2 ? 1 + (isRegisterToken(arg1) || arg1 === "@r0" || arg1 === "@r1" ? 0 : 1) : 0;
        case "xchd":
            return operands.length === 2 ? 1 : 0;
        case "anl":
        case "orl":
        case "xrl":
            if (operands.length !== 2)
                return 0;
            // ANL/ORL/XRL A,Rn  -> 1 byte
            if ((arg0 === "a" || arg0 === "acc") && isRegisterToken(arg1))
                return 1;
            // ANL/ORL/XRL A,<other> -> 2 bytes
            if (arg0 === "a" || arg0 === "acc" || arg0 === "c")
                return 2;
            // ANL/ORL/XRL Rn,#imm or @Ri,#imm -> lowered to 4 bytes (MOV A,x; OP A,#imm; MOV x,A)
            if ((isRegisterToken(arg0) || arg0 === "@r0" || arg0 === "@r1") && arg1.startsWith("#"))
                return 4;
            // ANL/ORL direct,#imm -> 3 bytes; direct,A -> 2 bytes
            return arg1.startsWith("#") ? 3 : 2;
        case "add":
        case "addc":
        case "subb":
            return operands.length === 2 ? 2 : 0;
        case "setb":
        case "clr":
        case "cpl":
            if (operands.length !== 1)
                return 0;
            return arg0 === "c" || arg0 === "a" || arg0 === "acc" ? 1 : 2;
        case "push":
        case "pop":
            return operands.length === 1 ? 2 : 0;
        case "dec":
        case "inc":
            if (operands.length !== 1)
                return 0;
            return isRegisterToken(arg0) || arg0 === "@r0" || arg0 === "@r1" || arg0 === "a" || arg0 === "acc" || arg0 === "dptr" ? 1 : 2;
        case "nop":
        case "da":
        case "ret":
        case "reti":
        case "rr":
        case "rl":
        case "rrc":
        case "rlc":
        case "swap":
        case "movc":
            return 1;
        case "mul":
        case "div":
            return operands.length <= 1 ? 1 : 0;
        case "movx":
            return operands.length === 2 ? 1 : 0;
        case "acall":
        case "ajmp":
            if (operands.length !== 1)
                return 0;
            return 2; // 2-byte page-relative instruction
        case "call":
        case "lcall":
        case "jmp":
        case "ljmp":
            if (operands.length !== 1)
                return 0;
            if (mnemonic === "jmp" && arg0.replace(/\s+/g, "") === "@a+dptr")
                return 1;
            return 3;
        case "sjmp":
        case "jz":
        case "jnz":
        case "jc":
        case "jnc":
            return operands.length === 1 ? 2 : 0;
        case "jb":
        case "jnb":
            return operands.length === 2 ? 6 : 0;
        case "jbc":
            return operands.length === 2 ? 8 : 0;
        case "cjne":
            if (operands.length !== 3)
                return 0;
            if (isRegisterToken(arg0) || arg0 === "a" || arg0 === "acc" || arg0 === "@r0" || arg0 === "@r1")
                return 8;
            if (arg1.startsWith("#") && resolveNumber(arg0, equ) != null)
                return 10;
            return 8;
        case "djnz":
            if (operands.length !== 2)
                return 0;
            return isRegisterToken(arg0) ? 2 : 3;
        default:
            return 0;
    }
}
function encodeInstruction(entry, labels, equ, diagnostics) {
    const hints = operandHints(entry.mnemonic, entry.operands);
    const ops = entry.operands.map((operand, index) => parseOperand(operand, labels, equ, hints[index] ?? "any", entry.address));
    if (ops.some((op) => op.type === "unknown" || ("unresolved" in op && op.unresolved))) {
        diagnostics.push({
            level: "error",
            line: entry.line,
            message: `Cannot resolve operands for ${entry.mnemonic}.`,
        });
        return null;
    }
    const fail = (message) => {
        diagnostics.push({ level: "error", line: entry.line, message });
        return null;
    };
    switch (entry.mnemonic) {
        case "db": {
            const bytes = [];
            for (const operand of entry.operands) {
                const text = operand.trim();
                const stringMatch = /^(?:'([^']*)'|"([^"]*)")$/.exec(text);
                if (stringMatch) {
                    for (const ch of stringMatch[1] ?? stringMatch[2] ?? "")
                        bytes.push(ch.charCodeAt(0) & 0xff);
                    continue;
                }
                const value = resolveValue(operand, labels, equ);
                if (value == null)
                    return fail(`Cannot resolve DB value: ${operand}`);
                bytes.push(value & 0xff);
            }
            return bytes;
        }
        case "dw": {
            const bytes = [];
            for (const operand of entry.operands) {
                const value = resolveValue(operand, labels, equ);
                if (value == null)
                    return fail(`Cannot resolve DW value: ${operand}`);
                // 8051 DW is big-endian: high byte first (matches MOVC table addressing)
                bytes.push((value >> 8) & 0xff, value & 0xff);
            }
            return bytes;
        }
        case "mov": {
            const [dst, src] = ops;
            const srcToken = (entry.operands[1] ?? "").trim();
            const srcLooksNumeric = isNumericLiteralToken(srcToken);
            if (dst.type === "reg" && src.type === "imm")
                return [0x78 + dst.value, src.value];
            if (dst.type === "indirect" && src.type === "imm")
                return [0x76 + dst.value, src.value];
            if (dst.type === "reg" && src.type === "a")
                return [0xf8 + dst.value];
            if (dst.type === "indirect" && src.type === "a")
                return [0xf6 + dst.value];
            if (dst.type === "a" && src.type === "imm")
                return [0x74, src.value];
            if (dst.type === "a" && src.type === "reg")
                return [0xe8 + src.value];
            if (dst.type === "a" && src.type === "indirect")
                return [0xe6 + src.value];
            if (dst.type === "dptr" && src.type === "imm")
                return [0x90, (src.value >> 8) & 0xff, src.value & 0xff];
            if (dst.type === "direct" && src.type === "imm")
                return [0x75, dst.value, src.value];
            // Compatibility: accept "mov p1, 0xff" as immediate write for lab snippets.
            if (dst.type === "direct" && src.type === "direct" && srcLooksNumeric) {
                return [0x75, dst.value, src.value & 0xff];
            }
            if (dst.type === "direct" && src.type === "reg")
                return [0x88 + src.value, dst.value];
            if (dst.type === "direct" && src.type === "indirect")
                return [0x86 + src.value, dst.value];
            if (dst.type === "reg" && src.type === "direct")
                return [0xa8 + dst.value, src.value];
            if (dst.type === "indirect" && src.type === "direct")
                return [0xa6 + dst.value, src.value];
            if (dst.type === "direct" && src.type === "a")
                return [0xf5, dst.value];
            if (dst.type === "a" && src.type === "direct")
                return [0xe5, src.value];
            if (dst.type === "direct" && src.type === "direct")
                return [0x85, src.value, dst.value];
            if (dst.type === "c" && src.type === "bit")
                return [0xa2, src.value];
            if (dst.type === "bit" && src.type === "c")
                return [0x92, dst.value];
            return fail("Unsupported MOV form.");
        }
        case "xch": {
            const [dst, src] = ops;
            if (dst.type !== "a")
                return fail("XCH expects A as first operand.");
            if (src.type === "reg")
                return [0xc8 + src.value];
            if (src.type === "direct")
                return [0xc5, src.value];
            if (src.type === "indirect")
                return [0xc6 + src.value];
            return fail("Unsupported XCH form.");
        }
        case "xchd": {
            const [dst, src] = ops;
            if (dst.type !== "a" || src.type !== "indirect")
                return fail("XCHD expects A,@R0 or A,@R1.");
            return [0xd6 + src.value];
        }
        case "anl":
        case "orl":
        case "xrl": {
            const [dst, src] = ops;
            const base = entry.mnemonic === "anl"
                ? { aImm: 0x54, aDir: 0x55, aInd0: 0x56, aInd1: 0x57, aReg: 0x58, dirImm: 0x53, dirA: 0x52, cBit: 0x82, cNBit: 0xb0 }
                : entry.mnemonic === "orl"
                    ? { aImm: 0x44, aDir: 0x45, aInd0: 0x46, aInd1: 0x47, aReg: 0x48, dirImm: 0x43, dirA: 0x42, cBit: 0x72, cNBit: 0xa0 }
                    : { aImm: 0x64, aDir: 0x65, aInd0: 0x66, aInd1: 0x67, aReg: 0x68, dirImm: 0x63, dirA: 0x62, cBit: -1, cNBit: -1 };
            if (dst.type === "a" && src.type === "imm")
                return [base.aImm, src.value];
            if (dst.type === "a" && src.type === "direct")
                return [base.aDir, src.value];
            if (dst.type === "a" && src.type === "indirect")
                return [src.value === 0 ? base.aInd0 : base.aInd1];
            if (dst.type === "a" && src.type === "reg")
                return [base.aReg + src.value];
            if (dst.type === "direct" && src.type === "imm")
                return [base.dirImm, dst.value, src.value];
            if (dst.type === "direct" && src.type === "a")
                return [base.dirA, dst.value];
            if (base.cBit >= 0 && dst.type === "c" && src.type === "bit")
                return [base.cBit, src.value];
            if (base.cNBit >= 0 && dst.type === "c" && src.type === "nbit")
                return [base.cNBit, src.value];
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
            if (dst.type !== "a")
                return fail(`${entry.mnemonic.toUpperCase()} expects A as first operand.`);
            const base = entry.mnemonic === "add" ? 0x20 : entry.mnemonic === "addc" ? 0x30 : 0x90;
            if (src.type === "imm")
                return [base + 0x04, src.value];
            if (src.type === "reg")
                return [base + 0x08 + src.value];
            if (src.type === "indirect")
                return [base + 0x06 + src.value];
            if (src.type === "direct")
                return [base + 0x05, src.value];
            return fail(`Unsupported ${entry.mnemonic.toUpperCase()} form.`);
        }
        case "setb": {
            const [target] = ops;
            if (target.type === "c")
                return [0xd3];
            if (target.type === "bit")
                return [0xd2, target.value];
            return fail("SETB expects C or bit.");
        }
        case "clr": {
            const [target] = ops;
            if (target.type === "a")
                return [0xe4];
            if (target.type === "c")
                return [0xc3];
            if (target.type === "bit")
                return [0xc2, target.value];
            return fail("CLR expects A, C, or bit.");
        }
        case "cpl": {
            const [target] = ops;
            if (target.type === "a")
                return [0xf4];
            if (target.type === "c")
                return [0xb3];
            if (target.type === "bit")
                return [0xb2, target.value];
            return fail("CPL expects A, C, or bit.");
        }
        case "push": {
            const [target] = ops;
            if (target.type === "direct")
                return [0xc0, target.value];
            return fail("PUSH expects direct.");
        }
        case "pop": {
            const [target] = ops;
            if (target.type === "direct")
                return [0xd0, target.value];
            return fail("POP expects direct.");
        }
        case "dec": {
            const [target] = ops;
            if (target.type === "reg")
                return [0x18 + target.value];
            if (target.type === "indirect")
                return [0x16 + target.value];
            if (target.type === "direct")
                return [0x15, target.value];
            if (target.type === "a")
                return [0x14];
            return fail("DEC supports A/register/@Ri/direct.");
        }
        case "inc": {
            const [target] = ops;
            if (target.type === "reg")
                return [0x08 + target.value];
            if (target.type === "indirect")
                return [0x06 + target.value];
            if (target.type === "direct")
                return [0x05, target.value];
            if (target.type === "a")
                return [0x04];
            if (target.type === "dptr")
                return [0xa3];
            return fail("INC supports A/DPTR/register/@Ri/direct.");
        }
        case "nop":
            return [0x00];
        case "da": {
            const [target] = ops;
            if (!entry.operands.length || target.type === "a")
                return [0xd4];
            return fail("DA expects A.");
        }
        case "ret":
            return [0x22];
        case "reti":
            return [0x32];
        case "rr": {
            const [target] = ops;
            if (target.type !== "a")
                return fail("RR expects A.");
            return [0x03];
        }
        case "rl": {
            const [target] = ops;
            if (target.type !== "a")
                return fail("RL expects A.");
            return [0x23];
        }
        case "rrc": {
            const [target] = ops;
            if (target.type !== "a")
                return fail("RRC expects A.");
            return [0x13];
        }
        case "rlc": {
            const [target] = ops;
            if (target.type !== "a")
                return fail("RLC expects A.");
            return [0x33];
        }
        case "swap": {
            const [target] = ops;
            if (target.type !== "a")
                return fail("SWAP expects A.");
            return [0xc4];
        }
        case "movc": {
            if (/^a$/i.test(entry.operands[0] ?? "") &&
                /^@a\+dptr$/i.test((entry.operands[1] ?? "").replace(/\s+/g, ""))) {
                return [0x93];
            }
            if (/^a$/i.test(entry.operands[0] ?? "") &&
                /^@a\+pc$/i.test((entry.operands[1] ?? "").replace(/\s+/g, ""))) {
                return [0x83];
            }
            return fail("Only MOVC A,@A+DPTR or MOVC A,@A+PC is supported.");
        }
        case "movx": {
            const [dst, src] = ops;
            if (dst.type === "a" && src.type === "dptrindirect")
                return [0xe0];
            if (dst.type === "dptrindirect" && src.type === "a")
                return [0xf0];
            if (dst.type === "a" && src.type === "indirect")
                return [0xe2 + src.value];
            if (dst.type === "indirect" && src.type === "a")
                return [0xf2 + dst.value];
            return fail("Unsupported MOVX form.");
        }
        case "mul": {
            if (!entry.operands.length)
                return [0xa4];
            if (/^ab$/i.test((entry.operands[0] ?? "").replace(/\s+/g, "")))
                return [0xa4];
            return fail("Only MUL AB is supported.");
        }
        case "div": {
            if (!entry.operands.length)
                return [0x84];
            if (/^ab$/i.test((entry.operands[0] ?? "").replace(/\s+/g, "")))
                return [0x84];
            return fail("Only DIV AB is supported.");
        }
        case "acall": {
            // ACALL is a 2-byte page-relative call: opcode = 0x11 | (page << 5), addr_low
            // Page = target[15:11] (upper 5 bits). Target must be within the same 2KB page as PC+2.
            const [target] = ops;
            if (target.type !== "addr")
                return fail("ACALL expects address.");
            const page = (target.value >> 8) & 0xf8; // bits [15:11] -> upper 3 bits of opcode
            const pcPage = ((entry.address + 2) >> 8) & 0xf8;
            if (page !== pcPage)
                return fail(`ACALL: target 0x${target.value.toString(16).toUpperCase()} is outside the current 2KB page (use LCALL instead).`);
            return [0x11 | (((target.value >> 8) & 0x07) << 5), target.value & 0xff];
        }
        case "call":
        case "lcall": {
            const [target] = ops;
            if (target.type !== "addr")
                return fail("LCALL expects address.");
            return [0x12, (target.value >> 8) & 0xff, target.value & 0xff];
        }
        case "jmp":
        case "ljmp": {
            const [target] = ops;
            if (entry.mnemonic === "jmp" && target.type === "codeptr")
                return [0x73];
            if (target.type !== "addr")
                return fail("JMP expects address.");
            return [0x02, (target.value >> 8) & 0xff, target.value & 0xff];
        }
        case "ajmp": {
            // AJMP is a 2-byte page-relative jump: opcode = 0x01 | (page << 5), addr_low
            const [target] = ops;
            if (target.type !== "addr")
                return fail("AJMP expects address.");
            const page = (target.value >> 8) & 0xf8;
            const pcPage = ((entry.address + 2) >> 8) & 0xf8;
            if (page !== pcPage)
                return fail(`AJMP: target 0x${target.value.toString(16).toUpperCase()} is outside the current 2KB page (use LJMP instead).`);
            return [0x01 | (((target.value >> 8) & 0x07) << 5), target.value & 0xff];
        }
        case "sjmp":
        case "jz":
        case "jnz":
        case "jc":
        case "jnc": {
            const [target] = ops;
            if (target.type !== "addr")
                return fail(`${entry.mnemonic.toUpperCase()} expects label.`);
            const rel = relativeOffset(entry.address, 2, target.value);
            if (rel == null)
                return fail(`${entry.mnemonic.toUpperCase()} target is out of range.`);
            const opcode = entry.mnemonic === "sjmp"
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
            if (target.type !== "addr" || bit.type !== "bit")
                return fail(`${entry.mnemonic.toUpperCase()} expects bit,label.`);
            if (entry.mnemonic === "jb") {
                // Long-safe form:
                //   JNB bit, +3
                //   LJMP target
                return [0x30, bit.value, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
            }
            // Long-safe form:
            //   JB bit, +3
            //   LJMP target
            return [0x20, bit.value, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
        }
        case "jbc": {
            const [bit, target] = ops;
            if (target.type !== "addr" || bit.type !== "bit")
                return fail("JBC expects bit,label.");
            // Long-safe form:
            //   JNB bit, +5
            //   CLR bit
            //   LJMP target
            return [0x30, bit.value, 0x05, 0xc2, bit.value, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
        }
        case "cjne": {
            const [left, right, target] = ops;
            if (target.type !== "addr") {
                return fail("CJNE expects two operands plus label.");
            }
            if (left.type === "a" && right.type === "imm") {
                const rel = relativeOffset(entry.address, 3, target.value);
                if (rel == null)
                    return [0xb4, right.value, 0x02, 0x80, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
                return [0xb4, right.value, rel];
            }
            if (left.type === "a" && right.type === "direct") {
                const rel = relativeOffset(entry.address, 3, target.value);
                if (rel == null)
                    return [0xb5, right.value, 0x02, 0x80, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
                return [0xb5, right.value, rel];
            }
            if (left.type === "reg" && right.type === "imm") {
                const rel = relativeOffset(entry.address, 3, target.value);
                if (rel == null)
                    return [0xb8 + left.value, right.value, 0x02, 0x80, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
                return [0xb8 + left.value, right.value, rel];
            }
            if (left.type === "indirect" && right.type === "imm") {
                const rel = relativeOffset(entry.address, 3, target.value);
                if (rel == null)
                    return [0xb6 + left.value, right.value, 0x02, 0x80, 0x03, 0x02, (target.value >> 8) & 0xff, target.value & 0xff];
                return [0xb6 + left.value, right.value, rel];
            }
            // Compatibility extension for snippets written as CJNE direct,#imm,label.
            // Real 8051 has no single opcode for this, so lower it through A.
            if (left.type === "direct" && right.type === "imm") {
                const rel = relativeOffset(entry.address + 2, 3, target.value);
                if (rel == null) {
                    return [
                        0xe5,
                        left.value,
                        0xb4,
                        right.value,
                        0x02,
                        0x80,
                        0x03,
                        0x02,
                        (target.value >> 8) & 0xff,
                        target.value & 0xff,
                    ];
                }
                return [0xe5, left.value, 0xb4, right.value, rel];
            }
            return fail("Unsupported CJNE form.");
        }
        case "djnz": {
            const [left, target] = ops;
            if (target.type !== "addr")
                return fail("DJNZ expects label.");
            if (left.type === "reg") {
                const rel = relativeOffset(entry.address, 2, target.value);
                if (rel == null)
                    return fail("DJNZ target is out of range.");
                return [0xd8 + left.value, rel];
            }
            if (left.type === "direct") {
                const rel = relativeOffset(entry.address, 3, target.value);
                if (rel == null)
                    return fail("DJNZ target is out of range.");
                return [0xd5, left.value, rel];
            }
            return fail("Unsupported DJNZ form.");
        }
        default:
            return fail(`Unsupported mnemonic: ${entry.mnemonic}`);
    }
}
function parseOperand(operand, labels, equ, hint = "any", currentAddress = 0) {
    const raw = operand.trim();
    if (!raw)
        return { type: "unknown" };
    if (/^(?:'[^']*'|"[^"]*")$/.test(raw))
        return { type: "imm", value: 0 };
    if (raw.startsWith("#")) {
        const value = resolveValue(raw.slice(1), labels, equ);
        return value == null ? { type: "unknown" } : { type: "imm", value };
    }
    const lower = raw.toLowerCase();
    const resolvedAlias = resolveAliasToken(lower, equ);
    if (resolvedAlias !== lower) {
        return parseOperand(resolvedAlias, labels, equ, hint, currentAddress);
    }
    if (lower === "$")
        return { type: "addr", value: currentAddress & 0xffff };
    if (lower === "a" || lower === "acc")
        return { type: "a" };
    if (lower === "c")
        return { type: "c" };
    if (lower === "ab")
        return { type: "ab" };
    if (lower.replace(/\s+/g, "") === "@a+dptr")
        return { type: "codeptr" };
    if (lower.replace(/\s+/g, "") === "@a+pc")
        return { type: "codeptrpc" };
    if (lower.replace(/\s+/g, "") === "@dptr")
        return { type: "dptrindirect" };
    if (lower === "dptr")
        return { type: "dptr" };
    if (lower === "@r0")
        return { type: "indirect", value: 0 };
    if (lower === "@r1")
        return { type: "indirect", value: 1 };
    if (isRegisterToken(lower))
        return { type: "reg", value: Number(lower[1]) };
    const bitMatch = /^p([0-3])\.([0-7])$/i.exec(raw);
    if (bitMatch) {
        const byteBase = [0x80, 0x90, 0xa0, 0xb0][Number(bitMatch[1])];
        return { type: "bit", value: byteBase + Number(bitMatch[2]) };
    }
    const sfrBitMatch = /^([a-z_.$?][\w.$?]*)\.([0-7])$/i.exec(raw);
    if (sfrBitMatch) {
        const baseName = sfrBitMatch[1].toLowerCase();
        const bitIndex = Number(sfrBitMatch[2]);
        const baseAddr = DIRECT_MAP[baseName];
        if (baseAddr != null && baseAddr >= 0x80 && baseAddr <= 0xff) {
            return { type: "bit", value: (baseAddr & 0xf8) + bitIndex };
        }
    }
    const nbitMatch = /^\/p([0-3])\.([0-7])$/i.exec(raw);
    if (nbitMatch) {
        const byteBase = [0x80, 0x90, 0xa0, 0xb0][Number(nbitMatch[1])];
        return { type: "nbit", value: byteBase + Number(nbitMatch[2]) };
    }
    const sfrNBitMatch = /^\/([a-z_.$?][\w.$?]*)\.([0-7])$/i.exec(raw);
    if (sfrNBitMatch) {
        const baseName = sfrNBitMatch[1].toLowerCase();
        const bitIndex = Number(sfrNBitMatch[2]);
        const baseAddr = DIRECT_MAP[baseName];
        if (baseAddr != null && baseAddr >= 0x80 && baseAddr <= 0xff) {
            return { type: "nbit", value: (baseAddr & 0xf8) + bitIndex };
        }
    }
    if (lower in BIT_ALIAS_MAP) {
        return { type: "bit", value: BIT_ALIAS_MAP[lower] };
    }
    if (lower in DIRECT_MAP) {
        return { type: "direct", value: DIRECT_MAP[lower] };
    }
    const resolvedNumber = resolveNumber(raw, equ);
    if (resolvedNumber != null) {
        if (hint === "immediate") {
            return { type: "imm", value: resolvedNumber & 0xff };
        }
        if (hint === "bit") {
            return { type: "bit", value: resolvedNumber & 0xff };
        }
        return { type: "direct", value: resolvedNumber & 0xff };
    }
    if (labels.has(lower)) {
        return { type: "addr", value: labels.get(lower) ?? 0 };
    }
    return { type: "addr", value: 0, unresolved: true };
}
function operandHints(mnemonic, operands) {
    const m = mnemonic.toLowerCase();
    // Bit operations: a bare numeric value or a BIT alias means bit address.
    // Examples:
    //   ADCI BIT 0DFH
    //   SCONV BIT 0DCH
    //   CLR ADCI       -> C2 DF
    //   SETB SCONV     -> D2 DC
    //   JNB ADCI,$     -> 30 DF FD
    if (m === "setb" || m === "cpl")
        return ["bit"];
    if (m === "clr") {
        const op = (operands[0] ?? "").trim().toLowerCase();
        return op === "a" || op === "acc" || op === "c" ? ["any"] : ["bit"];
    }
    if (m === "jb" || m === "jnb" || m === "jbc")
        return ["bit", "any"];
    if (m === "mov") {
        const left = (operands[0] ?? "").trim().toLowerCase();
        const right = (operands[1] ?? "").trim().toLowerCase();
        if (left === "c")
            return ["any", "bit"];
        if (right === "c")
            return ["bit", "any"];
    }
    if (m === "anl" || m === "orl") {
        const left = (operands[0] ?? "").trim().toLowerCase();
        if (left === "c")
            return ["any", "bit"];
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
function resolveValue(token, labels, equ) {
    const raw = token.trim();
    const lowMatch = /^(?:low|lo)\s*\((.+)\)$/i.exec(raw);
    if (lowMatch) {
        const value = resolveValue(lowMatch[1], labels, equ);
        return value == null ? null : value & 0xff;
    }
    const highMatch = /^(?:high|hi)\s*\((.+)\)$/i.exec(raw);
    if (highMatch) {
        const value = resolveValue(highMatch[1], labels, equ);
        return value == null ? null : (value >> 8) & 0xff;
    }
    const arithmeticMatch = /^(.+?)([+-])\s*(0x[0-9a-f]+|[0-9a-f]+h|[01]+b|\d+)$/i.exec(raw);
    if (arithmeticMatch) {
        const left = resolveValue(arithmeticMatch[1], labels, equ);
        const right = resolveNumber(arithmeticMatch[3], equ);
        if (left != null && right != null) {
            return arithmeticMatch[2] === "+" ? (left + right) & 0xffff : (left - right) & 0xffff;
        }
    }
    const lower = raw.toLowerCase();
    if (labels.has(lower))
        return labels.get(lower) ?? 0;
    const number = resolveNumber(raw, equ);
    if (number != null)
        return number;
    const alias = equ.get(lower);
    if (alias && alias.toLowerCase() !== lower)
        return resolveValue(alias, labels, equ);
    return null;
}
function resolveNumber(token, equ) {
    const raw = token.trim();
    const lower = raw.toLowerCase();
    if (lower in DIRECT_MAP)
        return DIRECT_MAP[lower];
    if (isRegisterToken(lower))
        return null;
    const alias = equ.get(lower);
    if (alias && alias.toLowerCase() !== lower)
        return resolveNumber(alias, equ);
    if (/^0x[0-9a-f]+$/i.test(raw))
        return Number.parseInt(raw, 16) & 0xffff;
    if (/^[0-9a-f]+h$/i.test(raw))
        return Number.parseInt(raw.slice(0, -1), 16) & 0xffff;
    if (/^[01]+b$/i.test(raw))
        return Number.parseInt(raw.slice(0, -1), 2) & 0xffff;
    if (/^\d+$/.test(raw))
        return Number.parseInt(raw, 10) & 0xffff;
    return null;
}
function resolveAliasToken(token, equ, depth = 0) {
    const raw = token.trim().toLowerCase();
    if (!raw || depth > 16)
        return raw;
    const alias = equ.get(raw);
    if (!alias)
        return raw;
    const next = alias.trim().toLowerCase();
    if (!next || next === raw)
        return raw;
    return resolveAliasToken(next, equ, depth + 1);
}
function relativeOffset(origin, size, target) {
    const diff = target - (origin + size);
    if (diff < -128 || diff > 127)
        return null;
    return diff & 0xff;
}
function flattenMap(map) {
    const bytes = [];
    [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .forEach(([addr, value]) => {
        bytes.push(addr & 0xffff, value & 0xff);
    });
    return Uint8Array.from(bytes);
}
function toIntelHex(map) {
    const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
    if (!entries.length)
        return "";
    const lines = [];
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
        lines.push(":" +
            bytes
                .concat(checksum)
                .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
                .join(""));
    }
    lines.push(":00000001FF");
    return lines.join("\n");
}
function isRegisterToken(token) {
    return /^r[0-7]$/i.test(token);
}
function isNumericLiteralToken(token) {
    const raw = token.trim().toLowerCase();
    return (/^0x[0-9a-f]+$/.test(raw) ||
        /^[0-9a-f]+h$/.test(raw) ||
        /^[01]+b$/.test(raw) ||
        /^\d+$/.test(raw));
}
