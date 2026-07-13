import { ADUC841_BITS, ADUC841_INTERRUPT_VECTORS, ADUC841_SFR } from "../mcu/aduc841.js";
const REGISTER_SET = new Set([...Object.keys(ADUC841_SFR), "a"]);
const BUILTIN_SBITS = new Map(Object.entries(ADUC841_BITS).map(([name, address]) => [name, formatBuiltinBitOperand(name, address)]));
const C_SCALAR_TYPE_SOURCE = "(?:_Bool|bool|bit|char|short|int|long|float|double|uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t)";
const C_TYPE_QUALIFIER_SOURCE = "(?:const|static|volatile|extern|register|auto|signed|unsigned|code|data|idata|xdata|pdata|bdata|far)";
const C_MEMORY_QUALIFIER_SOURCE = "(?:code|data|idata|xdata|pdata|bdata|far)";
const C_DECLARATION_RE = new RegExp(`^((?:(?:${C_TYPE_QUALIFIER_SOURCE}|${C_SCALAR_TYPE_SOURCE})\\s+)+)([\\s\\S]+)$`, "i");
const ARG_BASE = 0x20;
const MAX_ARGS = 8;
const XDATA_BASE = 0x0000;
const XDATA_LIMIT = 0x0800; // ADuC841 on-chip XRAM: 2 KiB.
export function transpileCToAsm(source) {
    const diagnostics = [];
    // C joins backslash-continued physical lines before removing comments.
    // Vacated lines stay blank so later diagnostic line numbers remain stable.
    const spliced = spliceContinuedLines(source.replace(/\r/g, ""));
    const uncommented = stripComments(spliced);
    const preprocessed = preprocessC(uncommented, diagnostics);
    const typedefs = expandTypedefAliases(preprocessed, diagnostics);
    const text = normalizeControlFlowBodies(typedefs.source);
    if (/\bunion\b/i.test(text))
        diagnostics.push({ level: "error", message: "union is not implemented by the browser C51 backend." });
    const sbitMap = parseSbits(text);
    const { sfrMap, sfr16Map } = parseSfrs(text, diagnostics);
    const arrays = parseArrays(text, diagnostics);
    const structDefs = parseStructDefs(text, diagnostics);
    const functions = extractFunctions(text, diagnostics);
    const mainFn = functions.get("main");
    if (!mainFn) {
        diagnostics.push({ level: "error", message: "C: main() body was not found." });
        return { ok: false, asm: "", diagnostics };
    }
    const emitted = [];
    let needDelay = false;
    const labelCounter = { value: 0 };
    const nextVarAddr = { value: 0x30 };
    const nextXdataAddr = { value: XDATA_BASE };
    const globals = parseGlobalScalars(text, functions, arrays, structDefs, nextVarAddr, nextXdataAddr, diagnostics);
    allocateFunctionParams(functions, structDefs, nextVarAddr, diagnostics);
    for (const [name, value] of sfrMap)
        emitted.push(`${name} data ${value}`);
    if (sfrMap.size)
        emitted.push("");
    // Real ADuC841 vector table. Interrupt 9 is reserved; 10 and 11 are valid.
    emitted.push("org 0x0000", "ljmp __c_start", "");
    const interruptFunctions = Array.from(functions.values())
        .filter((fn) => fn.interruptNumber != null)
        .sort((a, b) => (a.interruptNumber ?? 0) - (b.interruptNumber ?? 0));
    const usedVectors = new Set();
    for (const fn of interruptFunctions) {
        const number = fn.interruptNumber ?? -1;
        const vector = ADUC841_INTERRUPT_VECTORS.get(number);
        if (vector == null) {
            diagnostics.push({ level: "error", message: `Unsupported ADuC841 interrupt number ${number} in ${fn.name}().` });
            continue;
        }
        if (usedVectors.has(number)) {
            diagnostics.push({ level: "error", message: `More than one handler uses interrupt ${number}.` });
            continue;
        }
        usedVectors.add(number);
        emitted.push(`org ${toAsmByte(vector)}`, `ljmp ${fn.name}`, "");
    }
    emitted.push("org 0x0060", "__c_start:");
    emitted.push(...globals.initCode);
    emitted.push("lcall main", "__c_halt:", "sjmp __c_halt", "");
    const orderedFunctions = Array.from(functions.values()).sort((a, b) => a.order - b.order);
    for (const fn of orderedFunctions) {
        const returnLabel = `__return_${fn.name}_${labelCounter.value++}`;
        emitted.push(`${fn.name}:`);
        if (fn.interruptNumber != null) {
            emitted.push("push acc", "push b", "push dpl", "push dph", "push psw");
            if (fn.usingBank != null) {
                const bank = Math.max(0, Math.min(3, fn.usingBank));
                emitted.push("anl psw,#0xe7", `orl psw,#${toAsmByte8(bank << 3)}`);
            }
            else {
                for (let address = 0; address < 8; address++)
                    emitted.push(`push ${toAsmByte(address)}`);
            }
        }
        const fnCtx = {
            sbitMap,
            sfrMap,
            sfr16Map,
            arrays,
            structDefs,
            functions,
            diagnostics,
            vars: new Map(),
            globalVars: globals.vars,
            flowStack: [],
            returnLabel,
            currentFunction: fn,
            pointerVars: new Map(globals.pointerVars),
            pointerElementSizes: new Map(globals.pointerElementSizes),
            pointerStructTypes: new Map(globals.pointerStructTypes),
            pointerPointeeConst: new Map(globals.pointerPointeeConst),
            localArrays: new Map(globals.ramArrays),
            xdataVars: new Map(),
            globalXdataVars: globals.xdataVars,
            xdataArrays: new Map(globals.xdataArrays),
            structVars: new Map(globals.structVars),
            nextVarAddr,
            nextXdataAddr,
            labelCounter,
        };
        bindFunctionParams(fn, fnCtx, diagnostics);
        const statements = splitStatements(fn.body);
        for (const statement of statements) {
            const chunk = transpileStatement(statement, fn.lineOffset, fnCtx);
            emitted.push(...chunk.code);
            needDelay || (needDelay = chunk.needDelay);
        }
        emitted.push(`${returnLabel}:`);
        if (fn.interruptNumber != null) {
            if (fn.usingBank == null) {
                for (let address = 7; address >= 0; address--)
                    emitted.push(`pop ${toAsmByte(address)}`);
            }
            emitted.push("pop psw", "pop dph", "pop dpl", "pop b", "pop acc", "reti");
        }
        else {
            emitted.push("ret");
        }
        emitted.push("");
    }
    if (needDelay && !functions.has("delay")) {
        emitted.push("delay:", "mov r3,#25", "d3:", "mov r2,#255", "d2:", "mov r1,#255", "d1:", "djnz r1,d1", "djnz r2,d2", "djnz r3,d3", "ret", "");
    }
    for (const [name, array] of arrays) {
        emitted.push(`${name}:`, `db ${array.bytes.map((value) => toAsmByte(value)).join(", ")}`, "");
    }
    emitted.push("end");
    if (!diagnostics.some((item) => item.level === "error")) {
        diagnostics.push({ level: "hint", message: "C51 source transpiled to MCS-51 ASM." });
    }
    return {
        ok: diagnostics.every((item) => item.level !== "error"),
        asm: emitted.filter((line, index, arr) => !(line === "" && arr[index - 1] === "")).join("\n"),
        diagnostics,
    };
}
function transpileStatement(statement, lineOffset, ctx) {
    const raw = statement.text.trim();
    const rawNoSemi = raw.replace(/;+\s*$/, "");
    if (!raw)
        return { code: [], needDelay: false, needWrite: false };
    const line = lineOffset + statement.line;
    if (/^sbit\b/i.test(raw) || /^sfr(?:16)?\b/i.test(raw)) {
        return { code: [], needDelay: false, needWrite: false };
    }
    const userLabel = /^([A-Za-z_]\w*):$/.exec(raw);
    if (userLabel) {
        return { code: [`${cUserLabel(ctx, userLabel[1])}:`], needDelay: false, needWrite: false };
    }
    const gotoStatement = /^goto\s+([A-Za-z_]\w*)\s*;?$/i.exec(raw);
    if (gotoStatement) {
        return { code: [`ljmp ${cUserLabel(ctx, gotoStatement[1])}`], needDelay: false, needWrite: false };
    }
    if (/^break\s*;?$/i.test(raw)) {
        const flow = ctx.flowStack.at(-1);
        if (!flow)
            ctx.diagnostics.push({ level: "error", line, message: "break used outside a loop or switch." });
        return { code: flow ? [`ljmp ${flow.breakLabel}`] : [], needDelay: false, needWrite: false };
    }
    if (/^continue\s*;?$/i.test(raw)) {
        const flow = [...ctx.flowStack].reverse().find((item) => item.continueLabel);
        if (!flow?.continueLabel)
            ctx.diagnostics.push({ level: "error", line, message: "continue used outside a loop." });
        return { code: flow?.continueLabel ? [`ljmp ${flow.continueLabel}`] : [], needDelay: false, needWrite: false };
    }
    const switchStatement = parseSwitchStatementText(raw);
    if (switchStatement) {
        return transpileSwitchStatement(switchStatement.expression, switchStatement.body, statement, lineOffset, ctx, line);
    }
    const structDeclaration = parseStructDeclarationText(rawNoSemi);
    if (structDeclaration) {
        if (structDeclaration.isExtern)
            return { code: [], needDelay: false, needWrite: false };
        const def = ctx.structDefs.get(structDeclaration.structName);
        if (!def) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown struct type: ${structDeclaration.structName}` });
            return { code: [], needDelay: false, needWrite: false };
        }
        const unsupportedSpace = unsupportedObjectSpace(structDeclaration.memorySpace);
        if (unsupportedSpace) {
            ctx.diagnostics.push({ level: "error", line, message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.` });
            return { code: [], needDelay: false, needWrite: false };
        }
        const out = [];
        for (const decl of splitCsv(structDeclaration.declarators)) {
            const item = decl.trim();
            if (!item)
                continue;
            const pointerMatch = /^\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(item);
            if (pointerMatch) {
                const name = pointerMatch[1].toLowerCase();
                const kind = pointerKindFromHeader(structDeclaration.header);
                const variable = ensureVar(ctx, name, line, pointerStorageSize(kind));
                ctx.pointerVars.set(name, kind);
                ctx.pointerElementSizes.set(name, Math.max(1, def.size));
                ctx.pointerStructTypes.set(name, structDeclaration.structName);
                ctx.pointerPointeeConst.set(name, structDeclaration.isConst || kind === "code");
                if (pointerMatch[2])
                    out.push(...emitAssignToVariable(variable, pointerMatch[2], ctx, line));
                else
                    for (let byte = 0; byte < variable.size; byte++)
                        out.push(`mov ${variableTarget(variable, byte)},#0x0`);
                continue;
            }
            const array = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\](?:\s*=\s*([\s\S]+))?$/.exec(item);
            const scalar = /^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(item);
            if (!array && !scalar) {
                ctx.diagnostics.push({ level: "error", line, message: `Unsupported struct declaration: ${item}` });
                continue;
            }
            const name = (array?.[1] ?? scalar?.[1] ?? "").toLowerCase();
            const count = array ? tryEvalConst(array[2]) : 1;
            if (count == null || count <= 0) {
                ctx.diagnostics.push({ level: "error", line, message: `Structure array ${name} requires a positive constant length.` });
                continue;
            }
            const initializer = array?.[3] ?? scalar?.[2];
            const bytes = flattenStructObjectInitializer(initializer, def, count, ctx.structDefs, ctx.diagnostics, name);
            if (!bytes)
                continue;
            const total = Math.max(1, def.size * count);
            const storage = structDeclaration.memorySpace === "xdata" ? "xdata" : structDeclaration.memorySpace === "code" ? "code" : "ram";
            if (storage === "code") {
                ctx.diagnostics.push({ level: "error", line, message: `Local code structure ${name} is not supported.` });
                continue;
            }
            const baseAddr = storage === "xdata"
                ? allocateXdataBlock(ctx, total, line, `Local XDATA structure ${name}`)
                : allocateBlock(ctx, total, line);
            ctx.structVars.set(name, {
                name,
                structName: structDeclaration.structName,
                baseAddr,
                storage,
                elementCount: count,
                isConst: structDeclaration.isConst,
            });
            if (storage === "xdata")
                out.push(...emitXdataConstantBytes(baseAddr, bytes));
            else
                for (let byte = 0; byte < total; byte++)
                    out.push(`mov ${toAsmByte(baseAddr + byte)},#${toAsmByte8(bytes[byte] ?? 0)}`);
        }
        return { code: out, needDelay: false, needWrite: false };
    }
    const declaration = parseDeclarationText(rawNoSemi);
    if (declaration && !/^for\b/i.test(raw)) {
        if (declaration.isExtern)
            return { code: [], needDelay: false, needWrite: false };
        if (declaration.unsupportedReason) {
            ctx.diagnostics.push({ level: "error", line, message: declaration.unsupportedReason });
            return { code: [], needDelay: false, needWrite: false };
        }
        const declarators = splitCsv(declaration.declarators);
        const out = [];
        for (const item of declarators) {
            const part = item.trim();
            if (!part)
                continue;
            const localArray = /^([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\](?:\s*=\s*(\{[\s\S]*\}|"[\s\S]*"))?$/.exec(part);
            if (localArray) {
                const unsupportedSpace = unsupportedObjectSpace(declaration.memorySpace);
                if (unsupportedSpace) {
                    ctx.diagnostics.push({
                        level: "error",
                        line,
                        message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.`,
                    });
                    continue;
                }
                if (declaration.isCode) {
                    ctx.diagnostics.push({ level: "error", line, message: `Local code array ${localArray[1]} is not supported; declare it globally.` });
                    continue;
                }
                const values = [];
                if (localArray[3]?.trim().startsWith("\"")) {
                    for (const ch of decodeCString(localArray[3]))
                        values.push(ch.charCodeAt(0) & 0xff);
                    values.push(0);
                }
                else if (localArray[3]) {
                    for (const token of splitCsv(localArray[3].trim().slice(1, -1)))
                        values.push(tryEvalConst(token) ?? 0);
                }
                const logicalLength = (tryEvalConst(localArray[2]) ?? values.length) || 1;
                const byteLength = Math.max(1, logicalLength * declaration.size);
                const name = localArray[1].toLowerCase();
                const bytes = expandElementBytes(values, declaration.size, logicalLength);
                if (declaration.memorySpace === "xdata") {
                    const baseAddr = allocateXdataBlock(ctx, byteLength, line, `Local XDATA array ${name}`);
                    ctx.xdataArrays.set(name, { name, baseAddr, length: byteLength, elementSize: declaration.size, elementCount: logicalLength });
                    out.push(...emitXdataConstantBytes(baseAddr, bytes));
                }
                else {
                    const baseAddr = allocateBlock(ctx, byteLength, line);
                    ctx.localArrays.set(name, { name, baseAddr, length: byteLength, elementSize: declaration.size, elementCount: logicalLength });
                    for (let i = 0; i < byteLength; i++)
                        out.push(`mov ${toAsmByte(baseAddr + i)},#${toAsmByte8(bytes[i] ?? 0)}`);
                }
                continue;
            }
            const pointerDecl = /^\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
            if (pointerDecl) {
                const name = pointerDecl[1].toLowerCase();
                const kind = pointerKindFromHeader(declaration.header);
                const variable = ensureVar(ctx, name, line, pointerStorageSize(kind));
                ctx.pointerVars.set(name, kind);
                ctx.pointerElementSizes.set(name, declaration.size);
                ctx.pointerPointeeConst.set(name, declaration.isConst || kind === "code");
                if (pointerDecl[2])
                    out.push(...emitAssignToVariable(variable, pointerDecl[2], ctx, line));
                continue;
            }
            const match = /^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
            if (!match) {
                ctx.diagnostics.push({ level: "error", line, message: `Unsupported declaration: ${part}` });
                continue;
            }
            const unsupportedSpace = unsupportedObjectSpace(declaration.memorySpace);
            if (unsupportedSpace) {
                ctx.diagnostics.push({
                    level: "error",
                    line,
                    message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.`,
                });
                continue;
            }
            const name = match[1].toLowerCase();
            if (declaration.memorySpace === "xdata") {
                const addr = allocateXdataBlock(ctx, declaration.size, line, `Local XDATA variable ${name}`);
                const variable = { name, addr, size: declaration.size, isConst: declaration.isConst, signed: declaration.isSigned };
                ctx.xdataVars.set(name, variable);
                if (match[2])
                    out.push(...emitAssignToXdataVariable(variable, match[2], ctx, line));
            }
            else {
                const variable = ensureVar(ctx, name, line, declaration.size);
                variable.isConst = declaration.isConst;
                variable.signed = declaration.isSigned;
                if (match[2])
                    out.push(...emitAssignToVariable(variable, match[2], ctx, line));
            }
        }
        return { code: out, needDelay: false, needWrite: false };
    }
    const whileLoop = /^while\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (whileLoop) {
        const loopLabel = nextLabel(ctx, "while");
        const endLabel = nextLabel(ctx, "wend");
        const bodyStatements = splitStatements(whileLoop[2]);
        const out = [`${loopLabel}:`];
        out.push(...emitConditionFalseJump(whileLoop[1], endLabel, ctx, line));
        let needDelay = false;
        let needWrite = false;
        ctx.flowStack.push({ breakLabel: endLabel, continueLabel: loopLabel });
        for (const stmt of bodyStatements) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        ctx.flowStack.pop();
        out.push(`ljmp ${loopLabel}`);
        out.push(`${endLabel}:`);
        return { code: out, needDelay, needWrite };
    }
    const forLoop = /^for\s*\(([^;]*);([^;]*);([^)]*)\)\s*\{([\s\S]*)\}$/i.exec(raw);
    if (forLoop) {
        const out = [];
        let needDelay = false;
        let needWrite = false;
        const initClause = forLoop[1].trim();
        const initDeclaration = initClause ? parseDeclarationText(initClause) : null;
        const restoreForBindings = initDeclaration
            ? beginScopedDeclarationBindings(ctx, initDeclaration.declarators)
            : () => { };
        const initStatements = initDeclaration
            ? [initClause]
            : splitCsv(initClause);
        for (const initStmt of initStatements) {
            if (!initStmt.trim())
                continue;
            const translated = transpileStatement({ text: `${initStmt.trim()};`, line: statement.line }, lineOffset, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        const loopLabel = nextLabel(ctx, "for");
        const stepLabel = nextLabel(ctx, "for_step");
        const endLabel = nextLabel(ctx, "fend");
        out.push(`${loopLabel}:`);
        out.push(...emitConditionFalseJump(forLoop[2], endLabel, ctx, line));
        ctx.flowStack.push({ breakLabel: endLabel, continueLabel: stepLabel });
        for (const stmt of splitStatements(forLoop[4])) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        ctx.flowStack.pop();
        out.push(`${stepLabel}:`);
        for (const stepStmt of splitCsv(forLoop[3])) {
            if (!stepStmt.trim())
                continue;
            const translated = transpileStatement({ text: `${stepStmt.trim()};`, line: statement.line }, lineOffset, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        out.push(`ljmp ${loopLabel}`);
        out.push(`${endLabel}:`);
        restoreForBindings();
        return { code: out, needDelay, needWrite };
    }
    const ifStatement = parseIfStatement(raw);
    if (ifStatement?.elseBody != null) {
        const elseLabel = nextLabel(ctx, "else");
        const endLabel = nextLabel(ctx, "endif");
        const out = [];
        let needDelay = false;
        let needWrite = false;
        out.push(...emitConditionFalseJump(ifStatement.condition, elseLabel, ctx, line));
        for (const stmt of splitStatements(ifStatement.thenBody)) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        out.push(`sjmp ${endLabel}`);
        out.push(`${elseLabel}:`);
        for (const stmt of splitStatements(ifStatement.elseBody)) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        out.push(`${endLabel}:`);
        return { code: out, needDelay, needWrite };
    }
    if (ifStatement) {
        const endLabel = nextLabel(ctx, "endif");
        const out = [];
        let needDelay = false;
        let needWrite = false;
        out.push(...emitConditionFalseJump(ifStatement.condition, endLabel, ctx, line));
        for (const stmt of splitStatements(ifStatement.thenBody)) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        out.push(`${endLabel}:`);
        return { code: out, needDelay, needWrite };
    }
    const doWhile = /^do\s*\{([\s\S]*)\}\s*while\s*\(([^)]*)\)\s*;?$/i.exec(raw);
    if (doWhile) {
        const loopLabel = nextLabel(ctx, "do");
        const endLabel = nextLabel(ctx, "dend");
        const out = [`${loopLabel}:`];
        let needDelay = false;
        let needWrite = false;
        const conditionLabel = nextLabel(ctx, "do_condition");
        ctx.flowStack.push({ breakLabel: endLabel, continueLabel: conditionLabel });
        for (const stmt of splitStatements(doWhile[1])) {
            const translated = transpileStatement(stmt, lineOffset + statement.line, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
        ctx.flowStack.pop();
        out.push(`${conditionLabel}:`);
        out.push(...emitConditionFalseJump(doWhile[2], endLabel, ctx, line));
        out.push(`ljmp ${loopLabel}`);
        out.push(`${endLabel}:`);
        return { code: out, needDelay, needWrite };
    }
    if (/^delay\s*\(\s*\)\s*;?$/i.test(raw) && !ctx.functions.has("delay")) {
        return { code: ["call delay"], needDelay: true, needWrite: false };
    }
    if (/^_nop_\s*\(\s*\)\s*;?$/i.test(raw)) {
        return { code: ["nop"], needDelay: false, needWrite: false };
    }
    const returnExpr = /^return\s+([\s\S]+?)\s*;?$/i.exec(raw);
    if (returnExpr) {
        const valueCode = ctx.currentFunction.returnSize >= 2
            ? emitExprToWord(returnExpr[1], ctx, line)
            : emitExprToA(returnExpr[1], ctx, line);
        return { code: [...valueCode, `ljmp ${ctx.returnLabel}`], needDelay: false, needWrite: false };
    }
    if (/^return\s*;?$/i.test(raw)) {
        return { code: [`ljmp ${ctx.returnLabel}`], needDelay: false, needWrite: false };
    }
    const functionCall = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*;?$/.exec(raw);
    if (functionCall) {
        const callee = functionCall[1].toLowerCase();
        if (ctx.functions.has(callee)) {
            if (ctx.functions.get(callee)?.interruptNumber != null) {
                ctx.diagnostics.push({ level: "error", line, message: `Interrupt handler ${callee}() cannot be called as a normal function.` });
                return { code: [], needDelay: false, needWrite: false };
            }
            return { code: emitFunctionCall(callee, functionCall[2], ctx, line), needDelay: false, needWrite: false };
        }
    }
    const increment = /^([A-Za-z_]\w*)\s*(\+\+|--)\s*;?$/.exec(raw) || /^(\+\+|--)([A-Za-z_]\w*)\s*;?$/.exec(raw);
    if (increment) {
        const name = (increment[1].startsWith("+") || increment[1].startsWith("-")) ? increment[2] : increment[1];
        const op = (increment[1].startsWith("+") || increment[1].startsWith("-")) ? increment[1] : increment[2];
        const loweredName = name.toLowerCase();
        const variable = resolveVariable(loweredName, ctx);
        const xdataVariable = resolveXdataVariable(loweredName, ctx);
        const sfr16 = ctx.sfr16Map.get(loweredName);
        const target = resolveTarget(loweredName, ctx);
        if (sfr16) {
            const skip = nextLabel(ctx, "sfr16_inc_skip");
            const code = op === "++"
                ? [`inc ${sfr16.low}`, `mov a,${sfr16.low}`, `jnz ${skip}`, `inc ${sfr16.high}`, `${skip}:`]
                : [`mov a,${sfr16.low}`, `jnz ${skip}`, `dec ${sfr16.high}`, `${skip}:`, `dec ${sfr16.low}`];
            return { code, needDelay: false, needWrite: false };
        }
        if (xdataVariable) {
            if (xdataVariable.isConst) {
                ctx.diagnostics.push({ level: "error", line, message: `Cannot modify const variable ${name}.` });
                return { code: [], needDelay: false, needWrite: false };
            }
            return { code: emitXdataVariableIncDec(xdataVariable, op, ctx, line), needDelay: false, needWrite: false };
        }
        if (!target) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown variable in increment: ${name}` });
            return { code: [], needDelay: false, needWrite: false };
        }
        if (variable?.isConst) {
            ctx.diagnostics.push({ level: "error", line, message: `Cannot modify const variable ${name}.` });
            return { code: [], needDelay: false, needWrite: false };
        }
        if (ctx.pointerVars.has(loweredName) && variable) {
            return { code: emitPointerIncDec(variable, op, ctx), needDelay: false, needWrite: false };
        }
        if (variable && variable.size >= 2) {
            const skip = nextLabel(ctx, "word_inc_skip");
            const code = op === "++"
                ? [`inc ${variableTarget(variable)}`, `mov a,${variableTarget(variable)}`, `jnz ${skip}`, `inc ${variableTarget(variable, 1)}`, `${skip}:`]
                : [`mov a,${variableTarget(variable)}`, `jnz ${skip}`, `dec ${variableTarget(variable, 1)}`, `${skip}:`, `dec ${variableTarget(variable)}`];
            return { code, needDelay: false, needWrite: false };
        }
        return { code: [`${op === "++" ? "inc" : "dec"} ${target}`], needDelay: false, needWrite: false };
    }
    const compound = /^([A-Za-z_]\w*)\s*(<<|>>|[|&^+\-*/%])=\s*([\s\S]+?)\s*;?$/.exec(raw);
    if (compound) {
        const name = compound[1].toLowerCase();
        const variable = resolveVariable(name, ctx);
        if (variable) {
            if (variable.isConst)
                ctx.diagnostics.push({ level: "error", line, message: `Cannot modify const variable ${compound[1]}.` });
            return { code: variable.isConst ? [] : emitCompoundToVariable(variable, compound[2], compound[3], ctx, line), needDelay: false, needWrite: false };
        }
        const xdataVariable = resolveXdataVariable(name, ctx);
        if (xdataVariable) {
            if (xdataVariable.isConst)
                ctx.diagnostics.push({ level: "error", line, message: `Cannot modify const variable ${compound[1]}.` });
            return { code: xdataVariable.isConst ? [] : emitCompoundToXdataVariable(xdataVariable, compound[2], compound[3], ctx, line), needDelay: false, needWrite: false };
        }
        const sfr16 = ctx.sfr16Map.get(name);
        if (sfr16) {
            return {
                code: emitAssignToSfr16(sfr16, `${compound[1]} ${compound[2]} (${compound[3]})`, ctx, line),
                needDelay: false,
                needWrite: false,
            };
        }
        const left = resolveTarget(name, ctx);
        if (!left) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown assignment target: ${compound[1]}` });
            return { code: [], needDelay: false, needWrite: false };
        }
        return { code: [...emitExprToA(`${compound[1]} ${compound[2]} (${compound[3]})`, ctx, line), `mov ${left},a`], needDelay: false, needWrite: false };
    }
    const setBit = /^([A-Za-z_]\w*)\s*=\s*(0|1)\s*;?$/.exec(raw);
    if (setBit) {
        const bitName = setBit[1].toLowerCase();
        const bit = resolveVariable(bitName, ctx) ? undefined : ctx.sbitMap.get(bitName);
        if (bit) {
            return {
                code: [setBit[2] === "1" ? `setb ${bit}` : `clr ${bit}`],
                needDelay: false,
                needWrite: false,
            };
        }
    }
    const complexAssign = /^([\w\.\-\>\*\[\]\s+\/%&|^()]+?)\s*=(?!=)\s*([\s\S]+?)\s*;?$/.exec(raw);
    if (complexAssign && !/^[A-Za-z_]\w*\s*=/.test(raw)) {
        const targetCode = emitStoreToLValue(complexAssign[1], complexAssign[2], ctx, line);
        if (targetCode)
            return { code: targetCode, needDelay: false, needWrite: false };
    }
    const assign = /^([A-Za-z_]\w*)\s*=\s*([\s\S]+?)\s*;?$/.exec(raw);
    if (assign) {
        const leftName = assign[1].toLowerCase();
        const variable = resolveVariable(leftName, ctx);
        if (variable) {
            if (variable.isConst) {
                ctx.diagnostics.push({ level: "error", line, message: `Cannot assign to const variable ${assign[1]}.` });
                return { code: [], needDelay: false, needWrite: false };
            }
            return { code: emitAssignToVariable(variable, assign[2], ctx, line), needDelay: false, needWrite: false };
        }
        const xdataVariable = resolveXdataVariable(leftName, ctx);
        if (xdataVariable) {
            if (xdataVariable.isConst) {
                ctx.diagnostics.push({ level: "error", line, message: `Cannot assign to const variable ${assign[1]}.` });
                return { code: [], needDelay: false, needWrite: false };
            }
            return { code: emitAssignToXdataVariable(xdataVariable, assign[2], ctx, line), needDelay: false, needWrite: false };
        }
        const sfr16 = ctx.sfr16Map.get(leftName);
        if (sfr16) {
            return { code: emitAssignToSfr16(sfr16, assign[2], ctx, line), needDelay: false, needWrite: false };
        }
        const bit = ctx.sbitMap.get(leftName);
        if (bit) {
            const constValue = tryEvalConst(assign[2]);
            if (constValue != null) {
                return { code: [constValue ? `setb ${bit}` : `clr ${bit}`], needDelay: false, needWrite: false };
            }
            const clearLabel = nextLabel(ctx, "bit_assign_clear");
            const endLabel = nextLabel(ctx, "bit_assign_end");
            return {
                code: [...emitExprToA(assign[2], ctx, line), `jz ${clearLabel}`, `setb ${bit}`, `sjmp ${endLabel}`, `${clearLabel}:`, `clr ${bit}`, `${endLabel}:`],
                needDelay: false,
                needWrite: false,
            };
        }
        const left = resolveOrCreateTarget(leftName, ctx, line);
        if (!left) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown assignment target: ${assign[1]}` });
            return { code: [], needDelay: false, needWrite: false };
        }
        return { code: emitAssignToTarget(left, assign[2], ctx, line), needDelay: false, needWrite: false };
    }
    ctx.diagnostics.push({ level: "warning", line, message: `C line not translated: ${raw}` });
    return { code: [], needDelay: false, needWrite: false };
}
function preprocessC(source, diagnostics) {
    const macros = new Map([["NULL", "0"], ["true", "1"], ["false", "0"]]);
    const functionMacros = new Map();
    const kept = [];
    const conditions = [];
    let active = true;
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const directive = /^\s*#\s*([A-Za-z]+)\b(.*)$/.exec(line);
        if (!directive) {
            kept.push(active ? line : "");
            continue;
        }
        const directiveName = directive[1].toLowerCase();
        const tail = directive[2].trim();
        if (directiveName === "ifdef" || directiveName === "ifndef" || directiveName === "if") {
            const condition = !active
                ? false
                : directiveName === "ifdef"
                    ? macros.has(tail) || functionMacros.has(tail)
                    : directiveName === "ifndef"
                        ? !macros.has(tail) && !functionMacros.has(tail)
                        : evaluatePreprocessorCondition(tail, macros, functionMacros, diagnostics, index + 1);
            conditions.push({ parentActive: active, branchTaken: condition, currentActive: condition, inElse: false });
            active = active && condition;
            kept.push("");
            continue;
        }
        if (directiveName === "elif") {
            const frame = conditions.at(-1);
            if (!frame || frame.inElse) {
                diagnostics.push({ level: "error", line: index + 1, message: "Unexpected #elif." });
            }
            else {
                const shouldEvaluate = frame.parentActive && !frame.branchTaken;
                const condition = shouldEvaluate
                    ? evaluatePreprocessorCondition(tail, macros, functionMacros, diagnostics, index + 1)
                    : false;
                frame.currentActive = !frame.branchTaken && condition;
                frame.branchTaken || (frame.branchTaken = condition);
                active = frame.parentActive && frame.currentActive;
            }
            kept.push("");
            continue;
        }
        if (directiveName === "else") {
            const frame = conditions.at(-1);
            if (!frame || frame.inElse) {
                diagnostics.push({ level: "error", line: index + 1, message: "Unexpected or duplicate #else." });
            }
            else {
                frame.inElse = true;
                frame.currentActive = !frame.branchTaken;
                frame.branchTaken = true;
                active = frame.parentActive && frame.currentActive;
            }
            kept.push("");
            continue;
        }
        if (directiveName === "endif") {
            const frame = conditions.pop();
            if (!frame)
                diagnostics.push({ level: "error", line: index + 1, message: "Unexpected #endif." });
            active = frame?.parentActive ?? true;
            kept.push("");
            continue;
        }
        if (!active) {
            kept.push("");
            continue;
        }
        if (directiveName === "define") {
            const functionDefine = /^([A-Za-z_]\w*)\(([^)]*)\)\s*(.*)$/.exec(tail);
            const objectDefine = /^([A-Za-z_]\w*)(?:\s+(.*))?$/.exec(tail);
            if (!functionDefine && !objectDefine) {
                diagnostics.push({ level: "error", line: index + 1, message: "Invalid #define directive." });
                kept.push("");
                continue;
            }
            if (functionDefine) {
                const params = functionDefine[2].trim() ? splitCsv(functionDefine[2]).map((param) => param.trim()) : [];
                if (params.some((param) => !/^[A-Za-z_]\w*$/.test(param)) || new Set(params).size !== params.length) {
                    diagnostics.push({ level: "error", line: index + 1, message: `Invalid parameter list for macro ${functionDefine[1]}.` });
                }
                else {
                    functionMacros.set(functionDefine[1], { params, body: functionDefine[3].trim() || "1", line: index + 1 });
                    macros.delete(functionDefine[1]);
                }
            }
            else if (objectDefine) {
                macros.set(objectDefine[1], objectDefine[2]?.trim() || "1");
                functionMacros.delete(objectDefine[1]);
            }
            kept.push("");
            continue;
        }
        if (directiveName === "undef") {
            macros.delete(tail);
            functionMacros.delete(tail);
            kept.push("");
            continue;
        }
        if (directiveName === "include") {
            const include = /^(?:<([^>]+)>|"([^"]+)")$/.exec(tail);
            const header = (include?.[1] ?? include?.[2] ?? "").trim().toLowerCase();
            const builtins = new Set(["aduc841.h", "intrins.h", "stdint.h", "stdbool.h"]);
            if (!include) {
                diagnostics.push({ level: "error", line: index + 1, message: "#include expects <header.h> or \"header.h\"." });
            }
            else if (!builtins.has(header)) {
                diagnostics.push({
                    level: "error",
                    line: index + 1,
                    message: `Header ${include[0]} is unavailable; built-ins are ADUC841.H, intrins.h, stdint.h and stdbool.h.`,
                });
            }
            kept.push("");
            continue;
        }
        if (directiveName === "pragma") {
            diagnostics.push({ level: "hint", line: index + 1, message: `#pragma accepted and ignored: ${tail}` });
            kept.push("");
            continue;
        }
        if (directiveName === "warning") {
            diagnostics.push({ level: "warning", line: index + 1, message: tail || "#warning" });
            kept.push("");
            continue;
        }
        if (directiveName === "error") {
            diagnostics.push({ level: "error", line: index + 1, message: tail || "#error" });
            kept.push("");
            continue;
        }
        diagnostics.push({ level: "warning", line: index + 1, message: `Unsupported preprocessor directive ignored: ${line.trim()}` });
        kept.push("");
    }
    if (conditions.length)
        diagnostics.push({ level: "error", message: "Unclosed #if/#ifdef/#ifndef block." });
    let text = kept.join("\n");
    text = expandFunctionMacros(text, functionMacros, diagnostics);
    text = extractEnumConstants(text, macros, diagnostics);
    for (let pass = 0; pass < 4; pass++) {
        const next = expandObjectMacros(expandFunctionMacros(text, functionMacros, diagnostics), macros);
        if (next === text)
            break;
        text = next;
    }
    return text;
}
function evaluatePreprocessorCondition(expression, macros, functionMacros, diagnostics, sourceLine = 1) {
    const withDefined = expression
        .replace(/\bdefined\s*\(\s*([A-Za-z_]\w*)\s*\)/g, (_whole, name) => macros.has(name) || functionMacros.has(name) ? "1" : "0")
        .replace(/\bdefined\s+([A-Za-z_]\w*)/g, (_whole, name) => macros.has(name) || functionMacros.has(name) ? "1" : "0");
    const withFunctions = expandFunctionMacros(withDefined, functionMacros, diagnostics, sourceLine - 1);
    return (tryEvalConst(expandObjectMacros(withFunctions, macros)) ?? 0) !== 0;
}
function expandObjectMacros(source, macros) {
    let text = source;
    const entries = Array.from(macros.entries()).sort((a, b) => b[0].length - a[0].length);
    for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        for (const [name, value] of entries) {
            const next = replaceIdentifierOutsideLiterals(text, name, value);
            changed || (changed = next !== text);
            text = next;
        }
        if (!changed)
            break;
    }
    return text;
}
function expandFunctionMacros(source, macros, diagnostics, lineOffset = 0) {
    let text = source;
    for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        for (const [name, macro] of macros) {
            const expanded = expandOneFunctionMacro(text, name, macro, diagnostics, lineOffset);
            changed || (changed = expanded !== text);
            text = expanded;
        }
        if (!changed)
            break;
    }
    return text;
}
function expandOneFunctionMacro(source, name, macro, diagnostics, lineOffset = 0) {
    const invocation = new RegExp(`\\b${escapeRegExp(name)}\\b\\s*\\(`, "g");
    const codeMask = lexicalCodeMask(source);
    let cursor = 0;
    let out = "";
    let match;
    while ((match = invocation.exec(source))) {
        if (!codeMask[match.index])
            continue;
        const open = match.index + match[0].lastIndexOf("(");
        const close = findMatchingParenLike(source, open, "(", ")");
        if (close < 0)
            break;
        const rawArgs = source.slice(open + 1, close);
        const args = rawArgs.trim() ? splitCsv(rawArgs) : [];
        out += source.slice(cursor, match.index);
        if (args.length !== macro.params.length) {
            const line = lineOffset + source.slice(0, match.index).split("\n").length;
            const message = `Macro ${name} expects ${macro.params.length} argument(s), got ${args.length}.`;
            if (!diagnostics.some((item) => item.level === "error" && item.line === line && item.message === message)) {
                diagnostics.push({ level: "error", line, message });
            }
            // Keep one primary macro diagnostic and avoid misleading downstream
            // expression errors from the unexpanded invocation.
            out += "0";
        }
        else {
            let replacement = macro.body;
            for (let index = 0; index < macro.params.length; index++) {
                replacement = replaceIdentifierOutsideLiterals(replacement, macro.params[index], args[index].trim());
            }
            out += replacement;
        }
        cursor = close + 1;
        invocation.lastIndex = close + 1;
    }
    return out + source.slice(cursor);
}
function extractEnumConstants(source, macros, diagnostics) {
    const enumDefinition = /\benum(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}\s*;/gi;
    return source.replace(enumDefinition, (full, body, offset) => {
        let nextValue = 0;
        for (const rawEntry of splitCsv(body)) {
            const entry = /^\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?\s*$/.exec(rawEntry);
            if (!entry) {
                const line = source.slice(0, offset).split("\n").length;
                diagnostics.push({ level: "error", line, message: `Invalid enum constant: ${rawEntry.trim()}` });
                continue;
            }
            if (entry[2]) {
                const value = tryEvalConst(expandObjectMacros(entry[2], macros));
                if (value == null) {
                    const line = source.slice(0, offset).split("\n").length;
                    diagnostics.push({ level: "error", line, message: `Enum value for ${entry[1]} must be a constant expression.` });
                    continue;
                }
                nextValue = value;
            }
            macros.set(entry[1], String(nextValue & 0xffff));
            nextValue = (nextValue + 1) & 0xffff;
        }
        return full.replace(/[^\n]/g, " ");
    });
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function spliceContinuedLines(source) {
    const lines = source.split("\n");
    for (let index = 0; index < lines.length - 1; index++) {
        if (!/\\\s*$/.test(lines[index]))
            continue;
        let combined = lines[index];
        let end = index;
        while (end < lines.length - 1 && /\\\s*$/.test(combined)) {
            combined = combined.replace(/\\\s*$/, "") + lines[end + 1];
            end++;
        }
        lines[index] = combined;
        for (let blank = index + 1; blank <= end; blank++)
            lines[blank] = "";
    }
    return lines.join("\n");
}
function lexicalCodeMask(source) {
    const mask = Array.from({ length: source.length }, () => true);
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let index = 0; index < source.length; index++) {
        const ch = source[index];
        const next = source[index + 1] ?? "";
        if (lineComment) {
            mask[index] = false;
            if (ch === "\n")
                lineComment = false;
            continue;
        }
        if (blockComment) {
            mask[index] = false;
            if (ch === "*" && next === "/") {
                mask[index + 1] = false;
                index++;
                blockComment = false;
            }
            continue;
        }
        if (quote) {
            mask[index] = false;
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === "/" && next === "/") {
            mask[index] = false;
            mask[index + 1] = false;
            index++;
            lineComment = true;
            continue;
        }
        if (ch === "/" && next === "*") {
            mask[index] = false;
            mask[index + 1] = false;
            index++;
            blockComment = true;
            continue;
        }
        if (ch === '"' || ch === "'") {
            mask[index] = false;
            quote = ch;
        }
    }
    return mask;
}
function maskQuotedText(source) {
    const mask = lexicalCodeMask(source);
    return Array.from(source, (ch, index) => mask[index] || ch === "\n" ? ch : " ").join("");
}
function replaceIdentifierOutsideLiterals(source, name, replacement) {
    const mask = lexicalCodeMask(source);
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    return source.replace(re, (match, offset) => mask[offset] ? replacement : match);
}
function replaceTypedefIdentifier(source, name, replacement) {
    const mask = lexicalCodeMask(source);
    const shadowRanges = collectTypedefShadowRanges(source, name);
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    return source.replace(re, (match, offset) => {
        if (!mask[offset])
            return match;
        const before = source.slice(0, offset);
        const after = source.slice(offset + match.length);
        if (shadowRanges.some((range) => offset >= range.start && offset < range.end))
            return match;
        if (/\b(?:struct|union|enum)\s*$/i.test(before))
            return match;
        if (/(?:\.|->)\s*$/.test(before) || /\bgoto\s*$/i.test(before) || /^\s*:/.test(after))
            return match;
        if (isInsideAggregateBody(source, offset) && /^\s*(?:[;,:=]|\[)/.test(after))
            return match;
        return replacement;
    });
}
function collectTypedefShadowRanges(source, name) {
    const mask = lexicalCodeMask(source);
    const code = Array.from(source, (ch, index) => mask[index] || ch === "\n" ? ch : " ").join("");
    const typeToken = `(?:${C_TYPE_QUALIFIER_SOURCE}|${C_SCALAR_TYPE_SOURCE}|struct\\s+[A-Za-z_]\\w*)`;
    const declaration = new RegExp(`(?:(?:${typeToken})\\s+)+(${escapeRegExp(name)})\\b(?=\\s*(?:=|;|,|\\[|\\)))`, "gi");
    const ranges = [];
    let match;
    while ((match = declaration.exec(code))) {
        const tokenOffset = match.index + match[0].lastIndexOf(match[1]);
        const openBrace = findEnclosingCodeDelimiter(code, tokenOffset, "{", "}");
        if (openBrace >= 0 && isAggregateBodyOpen(code, openBrace))
            continue;
        const openParen = findEnclosingCodeDelimiter(code, tokenOffset, "(", ")");
        if (openParen >= 0 && /\bfor\s*$/i.test(code.slice(0, openParen))) {
            const closeParen = findMatchingParenLike(source, openParen, "(", ")");
            if (closeParen >= 0) {
                const bodyStart = skipWhitespace(source, closeParen + 1);
                const end = source[bodyStart] === "{"
                    ? findMatchingParenLike(source, bodyStart, "{", "}") + 1
                    : source.indexOf(";", bodyStart) + 1;
                if (end > tokenOffset)
                    ranges.push({ start: tokenOffset, end });
            }
            continue;
        }
        if (openBrace >= 0) {
            const closeBrace = findMatchingParenLike(source, openBrace, "{", "}");
            if (closeBrace >= 0)
                ranges.push({ start: tokenOffset, end: closeBrace + 1 });
            continue;
        }
        // A parameter name shadows the typedef throughout the following function body.
        const nextBrace = code.indexOf("{", tokenOffset);
        const nextSemicolon = code.indexOf(";", tokenOffset);
        if (nextBrace >= 0 && (nextSemicolon < 0 || nextBrace < nextSemicolon)) {
            const closeBrace = findMatchingParenLike(source, nextBrace, "{", "}");
            if (closeBrace >= 0)
                ranges.push({ start: tokenOffset, end: closeBrace + 1 });
        }
    }
    return ranges;
}
function findEnclosingCodeDelimiter(source, offset, open, close) {
    const stack = [];
    for (let index = 0; index < offset; index++) {
        if (source[index] === open)
            stack.push(index);
        else if (source[index] === close)
            stack.pop();
    }
    return stack.at(-1) ?? -1;
}
function isAggregateBodyOpen(source, openBrace) {
    const before = source.slice(0, openBrace);
    const boundary = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
    return /\b(?:struct|union)\s+(?:[A-Za-z_]\w*\s*)?$/i.test(before.slice(boundary + 1));
}
function isInsideAggregateBody(source, offset) {
    const mask = lexicalCodeMask(source);
    const code = Array.from(source, (ch, index) => mask[index] || ch === "\n" ? ch : " ").join("");
    const openBrace = findEnclosingCodeDelimiter(code, offset, "{", "}");
    return openBrace >= 0 && isAggregateBodyOpen(code, openBrace);
}
function expandTypedefAliases(source, diagnostics) {
    const spans = findTypedefSpans(source, diagnostics);
    const rawAliases = new Map();
    const chars = source.split("");
    for (const span of spans) {
        for (let index = span.start; index < span.end; index++) {
            if (chars[index] !== "\n")
                chars[index] = " ";
        }
        const body = span.text.replace(/^\s*typedef\b/i, "").replace(/;\s*$/, "").trim();
        const alias = /([A-Za-z_]\w*)\s*$/.exec(body);
        if (!alias) {
            diagnostics.push({ level: "error", line: span.line, message: "Invalid typedef declaration." });
            continue;
        }
        const name = alias[1];
        const target = body.slice(0, alias.index).trim();
        if (!target || /[{}*\[\](),]/.test(target) || /^enum\b/i.test(target)) {
            diagnostics.push({
                level: "error",
                line: span.line,
                message: `Unsupported typedef form for ${name}; only scalar aliases and 'typedef struct Tag Alias' are implemented.`,
            });
            continue;
        }
        const previous = rawAliases.get(name);
        if (previous) {
            if (normalizeTypeText(previous.target) !== normalizeTypeText(target)) {
                diagnostics.push({
                    level: "error",
                    line: span.line,
                    message: `Conflicting typedef for ${name}; first declaration is on line ${previous.line}.`,
                });
            }
            continue;
        }
        rawAliases.set(name, { name, target, line: span.line });
    }
    const resolved = new Map();
    const resolving = [];
    const invalid = new Set();
    const reportedCycles = new Set();
    const resolveAlias = (name) => {
        if (resolved.has(name))
            return resolved.get(name);
        if (invalid.has(name))
            return null;
        const cycleAt = resolving.indexOf(name);
        if (cycleAt >= 0) {
            const cycle = [...resolving.slice(cycleAt), name];
            const key = cycle.join("->");
            if (!reportedCycles.has(key)) {
                diagnostics.push({
                    level: "error",
                    line: rawAliases.get(name)?.line,
                    message: `Cyclic typedef chain: ${cycle.join(" -> ")}.`,
                });
                reportedCycles.add(key);
            }
            for (const item of cycle)
                invalid.add(item);
            return null;
        }
        const alias = rawAliases.get(name);
        if (!alias)
            return null;
        resolving.push(name);
        let target = alias.target.trim();
        const taggedStruct = /^struct\s+([A-Za-z_]\w*)$/i.exec(target);
        if (!taggedStruct) {
            const tokens = target.match(/[A-Za-z_]\w*/g) ?? [];
            for (const token of tokens) {
                if (!rawAliases.has(token))
                    continue;
                const replacement = resolveAlias(token);
                if (!replacement) {
                    invalid.add(name);
                    continue;
                }
                target = replaceIdentifierOutsideLiterals(target, token, replacement);
            }
        }
        resolving.pop();
        if (invalid.has(name))
            return null;
        if (!isSupportedTypedefTarget(target)) {
            diagnostics.push({
                level: "error",
                line: alias.line,
                message: `Unknown or unsupported typedef target for ${name}: ${alias.target}.`,
            });
            invalid.add(name);
            return null;
        }
        target = canonicalizeTypedefTarget(target);
        resolved.set(name, target);
        return target;
    };
    for (const name of rawAliases.keys())
        resolveAlias(name);
    let expanded = chars.join("");
    for (const [name, target] of resolved)
        expanded = replaceTypedefIdentifier(expanded, name, target);
    return { source: expanded, aliases: resolved };
}
function findTypedefSpans(source, diagnostics) {
    const mask = lexicalCodeMask(source);
    const spans = [];
    const re = /\btypedef\b/g;
    let match;
    while ((match = re.exec(source))) {
        if (!mask[match.index])
            continue;
        let braces = 0;
        let parens = 0;
        let brackets = 0;
        let end = -1;
        for (let index = match.index + match[0].length; index < source.length; index++) {
            if (!mask[index])
                continue;
            const ch = source[index];
            if (ch === "{")
                braces++;
            else if (ch === "}")
                braces--;
            else if (ch === "(")
                parens++;
            else if (ch === ")")
                parens--;
            else if (ch === "[")
                brackets++;
            else if (ch === "]")
                brackets--;
            else if (ch === ";" && braces === 0 && parens === 0 && brackets === 0) {
                end = index + 1;
                break;
            }
        }
        const line = source.slice(0, match.index).split("\n").length;
        if (end < 0) {
            diagnostics.push({ level: "error", line, message: "Unterminated typedef declaration." });
            break;
        }
        spans.push({ start: match.index, end, line, text: source.slice(match.index, end) });
        re.lastIndex = end;
    }
    return spans;
}
function normalizeTypeText(text) {
    return text.trim().replace(/\s+/g, " ");
}
function canonicalizeTypedefTarget(text) {
    const normalized = normalizeTypeText(text);
    if (/\b(?:signed|unsigned)\b/i.test(normalized) &&
        !/\b(?:_Bool|bool|bit|char|short|int|long|float|double|uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t)\b/i.test(normalized))
        return `${normalized} int`;
    return normalized;
}
function isSupportedTypedefTarget(target) {
    const normalized = normalizeTypeText(target);
    if (/^struct\s+[A-Za-z_]\w*$/i.test(normalized) || /^void$/i.test(normalized))
        return true;
    const allowed = new Set([
        "_bool", "bool", "bit", "char", "short", "int", "long", "float", "double",
        "uint8_t", "int8_t", "uint16_t", "int16_t", "uint32_t", "int32_t",
        "const", "volatile", "signed", "unsigned", "code", "data", "idata", "xdata", "pdata", "bdata", "far",
    ]);
    const tokens = normalized.match(/[A-Za-z_]\w*/g) ?? [];
    return tokens.length > 0 && tokens.every((token) => allowed.has(token.toLowerCase())) && scalarTypeInfo(normalized) != null;
}
function parseSbits(source) {
    const map = new Map(BUILTIN_SBITS);
    const re = /sbit\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/gi;
    let m;
    while ((m = re.exec(source))) {
        const name = m[1].toLowerCase();
        const raw = m[2].trim();
        const port = /^P([0-3])\s*\^\s*([0-7])$/i.exec(raw);
        if (port) {
            map.set(name, `p${port[1]}.${port[2]}`);
            continue;
        }
        const numeric = normalizeNumber(raw);
        if (numeric)
            map.set(name, numeric);
    }
    return map;
}
function parseSfrs(source, diagnostics) {
    const sfrMap = new Map();
    const sfr16Map = new Map();
    const re = /\b(sfr16|sfr)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/gi;
    let m;
    while ((m = re.exec(source))) {
        const name = m[2].toLowerCase();
        const value = tryEvalConst(m[3]);
        if (value == null)
            continue;
        if (m[1].toLowerCase() === "sfr16") {
            if (value < 0x80 || value > 0xfe) {
                const line = source.slice(0, m.index).split("\n").length;
                diagnostics.push({
                    level: "error",
                    line,
                    message: `sfr16 ${m[2]} requires a low-byte SFR address in 0x80..0xFE; the high byte uses the next address.`,
                });
                continue;
            }
            sfr16Map.set(name, { low: toAsmByte8(value), high: toAsmByte8(value + 1) });
            sfrMap.delete(name);
        }
        else {
            sfrMap.set(name, toAsmByte8(value));
            sfr16Map.delete(name);
        }
    }
    return { sfrMap, sfr16Map };
}
function parseArrays(source, diagnostics) {
    const map = new Map();
    const re = new RegExp(`((?:(?:${C_TYPE_QUALIFIER_SOURCE}|${C_SCALAR_TYPE_SOURCE})\\s+)+)([A-Za-z_]\\w*)\\s*\\[\\s*([^\\]]*)\\s*\\]\\s*=\\s*(\\{[\\s\\S]*?\\}|"(?:\\\\.|[^"])*")\\s*;`, "gi");
    let m;
    while ((m = re.exec(source))) {
        const header = m[1].toLowerCase();
        const type = scalarTypeInfo(header);
        if (!header.includes("code"))
            continue;
        if (type?.unsupportedReason) {
            diagnostics.push({ level: "error", message: type.unsupportedReason });
            continue;
        }
        const elementSize = Math.max(1, type?.size ?? 1);
        const name = m[2].toLowerCase();
        const initializer = m[4].trim();
        const values = [];
        if (initializer.startsWith("\"")) {
            const decoded = decodeCString(initializer);
            for (const ch of decoded)
                values.push(ch.charCodeAt(0) & 0xff);
            values.push(0);
        }
        else {
            const body = initializer.slice(1, -1);
            for (const token of splitCsv(body)) {
                const value = tryEvalConst(token);
                if (value == null) {
                    diagnostics.push({ level: "error", message: `Code array element could not be parsed: ${token.trim()}` });
                    continue;
                }
                values.push(value);
            }
        }
        const explicitLength = tryEvalConst(m[3]);
        if (explicitLength != null) {
            if (values.length > explicitLength)
                diagnostics.push({ level: "error", message: `Too many initializers for ${name}[${explicitLength}].` });
            while (values.length < explicitLength)
                values.push(0);
        }
        map.set(name, {
            name,
            bytes: expandElementBytes(values, elementSize, values.length),
            elementSize,
            elementCount: values.length,
        });
    }
    return map;
}
function expandElementBytes(values, elementSize, elementCount) {
    const bytes = [];
    for (let element = 0; element < elementCount; element++) {
        const value = values[element] ?? 0;
        for (let byte = 0; byte < elementSize; byte++)
            bytes.push((value >> (8 * byte)) & 0xff);
    }
    return bytes;
}
function decodeCString(token) {
    const body = token.trim().replace(/^"|"$/g, "");
    return body.replace(/\\(x[0-9a-fA-F]{2}|[0-7]{1,3}|n|r|t|0|\\|"|')/g, (_m, esc) => {
        if (esc === "n")
            return "\n";
        if (esc === "r")
            return "\r";
        if (esc === "t")
            return "\t";
        if (esc === "0")
            return "\0";
        if (esc === "\\")
            return "\\";
        if (esc === '"')
            return '"';
        if (esc === "'")
            return "'";
        if (esc.startsWith("x"))
            return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
        return String.fromCharCode(Number.parseInt(esc, 8));
    });
}
function parseDeclarationText(raw) {
    const match = C_DECLARATION_RE.exec(raw.trim());
    if (!match)
        return null;
    const header = match[1].trim().toLowerCase();
    const type = scalarTypeInfo(header);
    if (!type)
        return null;
    return {
        header,
        declarators: match[2].trim(),
        size: type.size,
        isExtern: /\bextern\b/.test(header),
        isConst: /\bconst\b/.test(header),
        isCode: /\bcode\b/.test(header),
        isSigned: type.signed,
        memorySpace: memorySpaceFromHeader(header),
        unsupportedReason: type.unsupportedReason,
    };
}
function parseStructDeclarationText(raw) {
    const text = raw.trim();
    if (/^typedef\b/i.test(text))
        return null;
    const match = /^((?:(?:const|static|volatile|extern|register|auto)\s+)*)struct\s+([A-Za-z_]\w*)\s+((?:(?:const|static|volatile|extern|register|auto|code|data|idata|xdata|pdata|bdata|far)\s+)*)([\s\S]+)$/i.exec(text);
    if (!match || /^\{/.test(match[4].trim()))
        return null;
    const header = `${match[1]} ${match[3]}`.trim().toLowerCase();
    return {
        structName: match[2].toLowerCase(),
        header,
        declarators: match[4].trim(),
        isExtern: /\bextern\b/.test(header),
        isConst: /\bconst\b/.test(header),
        memorySpace: memorySpaceFromHeader(header),
    };
}
function parseInitializerNode(raw) {
    const text = raw.trim();
    if (text.startsWith("{") && text.endsWith("}")) {
        const inner = text.slice(1, -1).trim();
        return inner ? splitCsv(inner).map(parseInitializerNode) : [];
    }
    return text;
}
function scalarInitializerBytes(raw, size, diagnostics, label) {
    if (raw == null)
        return Array.from({ length: size }, () => 0);
    if (Array.isArray(raw)) {
        diagnostics.push({ level: "error", message: `${label}: scalar field cannot use a nested aggregate initializer.` });
        return null;
    }
    if (/^\./.test(raw)) {
        diagnostics.push({ level: "error", message: `${label}: designated initializers are not implemented.` });
        return null;
    }
    const value = tryEvalConst(raw);
    if (value == null) {
        diagnostics.push({ level: "error", message: `${label}: structure initializers must contain constant integer expressions.` });
        return null;
    }
    return Array.from({ length: size }, (_, index) => (value >> (8 * index)) & 0xff);
}
function flattenStructInitializer(node, def, defs, diagnostics, label) {
    if (node == null)
        return Array.from({ length: def.size }, () => 0);
    if (!Array.isArray(node)) {
        diagnostics.push({ level: "error", message: `${label}: a structure initializer must be enclosed in braces.` });
        return null;
    }
    if (node.length > def.fields.length) {
        diagnostics.push({ level: "error", message: `${label}: too many values in structure initializer.` });
        return null;
    }
    const bytes = Array.from({ length: def.size }, () => 0);
    for (let fieldIndex = 0; fieldIndex < def.fields.length; fieldIndex++) {
        const field = def.fields[fieldIndex];
        const fieldNode = node[fieldIndex];
        if (field.structName) {
            const nested = defs.get(field.structName);
            if (!nested) {
                diagnostics.push({ level: "error", message: `${label}: unknown nested structure ${field.structName}.` });
                return null;
            }
            if (field.elementCount === 1) {
                const nestedBytes = flattenStructInitializer(fieldNode, nested, defs, diagnostics, `${label}.${field.name}`);
                if (!nestedBytes)
                    return null;
                bytes.splice(field.offset, nestedBytes.length, ...nestedBytes);
            }
            else {
                const list = fieldNode == null ? [] : Array.isArray(fieldNode) ? fieldNode : null;
                if (!list) {
                    diagnostics.push({ level: "error", message: `${label}.${field.name}: an array field requires braces.` });
                    return null;
                }
                if (list.length > field.elementCount) {
                    diagnostics.push({ level: "error", message: `${label}.${field.name}: too many array initializers.` });
                    return null;
                }
                for (let index = 0; index < field.elementCount; index++) {
                    const nestedBytes = flattenStructInitializer(list[index], nested, defs, diagnostics, `${label}.${field.name}[${index}]`);
                    if (!nestedBytes)
                        return null;
                    bytes.splice(field.offset + index * field.elementSize, nestedBytes.length, ...nestedBytes);
                }
            }
            continue;
        }
        if (field.elementCount === 1) {
            const scalar = scalarInitializerBytes(fieldNode, field.elementSize, diagnostics, `${label}.${field.name}`);
            if (!scalar)
                return null;
            bytes.splice(field.offset, scalar.length, ...scalar);
            continue;
        }
        const list = fieldNode == null ? [] : Array.isArray(fieldNode) ? fieldNode : null;
        if (!list) {
            diagnostics.push({ level: "error", message: `${label}.${field.name}: an array field requires braces.` });
            return null;
        }
        if (list.length > field.elementCount) {
            diagnostics.push({ level: "error", message: `${label}.${field.name}: too many array initializers.` });
            return null;
        }
        for (let index = 0; index < field.elementCount; index++) {
            const scalar = scalarInitializerBytes(list[index], field.elementSize, diagnostics, `${label}.${field.name}[${index}]`);
            if (!scalar)
                return null;
            bytes.splice(field.offset + index * field.elementSize, scalar.length, ...scalar);
        }
    }
    return bytes;
}
function flattenStructObjectInitializer(raw, def, count, defs, diagnostics, label) {
    if (!raw)
        return Array.from({ length: def.size * count }, () => 0);
    const node = parseInitializerNode(raw);
    if (count === 1)
        return flattenStructInitializer(node, def, defs, diagnostics, label);
    if (!Array.isArray(node)) {
        diagnostics.push({ level: "error", message: `${label}: an array of structures requires nested braces.` });
        return null;
    }
    if (node.length > count) {
        diagnostics.push({ level: "error", message: `${label}: too many structure array initializers.` });
        return null;
    }
    const bytes = [];
    for (let index = 0; index < count; index++) {
        const item = flattenStructInitializer(node[index], def, defs, diagnostics, `${label}[${index}]`);
        if (!item)
            return null;
        bytes.push(...item);
    }
    return bytes;
}
function scalarTypeInfo(raw) {
    const header = raw.trim().toLowerCase();
    if (/\b(?:uint8_t|int8_t)\b/.test(header))
        return { size: 1, signed: /\bint8_t\b/.test(header), category: "integer" };
    if (/\b(?:uint16_t|int16_t)\b/.test(header))
        return { size: 2, signed: /\bint16_t\b/.test(header), category: "integer" };
    if (/\b(?:uint32_t|int32_t)\b/.test(header)) {
        return {
            size: 4,
            signed: /\bint32_t\b/.test(header),
            category: "integer",
            unsupportedReason: "32-bit integer lowering is not implemented; use an 8- or 16-bit type.",
        };
    }
    if (/\b(?:_bool|bool|bit|char)\b/.test(header)) {
        return { size: 1, signed: /\bsigned\b/.test(header) && !/\bunsigned\b/.test(header), category: "integer" };
    }
    if (/\bshort\b/.test(header))
        return { size: 2, signed: !/\bunsigned\b/.test(header), category: "integer" };
    if (/\bint\b/.test(header))
        return { size: 2, signed: /\bsigned\b/.test(header) && !/\bunsigned\b/.test(header), category: "integer" };
    if (/\blong\b/.test(header)) {
        return {
            size: 4,
            signed: !/\bunsigned\b/.test(header),
            category: "integer",
            unsupportedReason: "32-bit long arithmetic is not implemented; use an 8- or 16-bit type.",
        };
    }
    if (/\b(?:float|double)\b/.test(header)) {
        return {
            size: /\bdouble\b/.test(header) ? 8 : 4,
            signed: true,
            category: "floating",
            unsupportedReason: "Floating-point lowering is not implemented.",
        };
    }
    if (/\b(?:signed|unsigned)\b/.test(header)) {
        return { size: 2, signed: /\bsigned\b/.test(header) && !/\bunsigned\b/.test(header), category: "integer" };
    }
    return null;
}
function memorySpaceFromHeader(header) {
    if (/\bxdata\b/i.test(header))
        return "xdata";
    if (/\bpdata\b/i.test(header))
        return "pdata";
    if (/\bfar\b/i.test(header))
        return "far";
    if (/\bcode\b/i.test(header))
        return "code";
    if (/\bidata\b/i.test(header))
        return "idata";
    if (/\bbdata\b/i.test(header))
        return "bdata";
    return "data";
}
function pointerKindFromHeader(header) {
    const space = memorySpaceFromHeader(header);
    return space === "data" || space === "idata" || space === "bdata" ? "ram" : space;
}
function pointerStorageSize(kind) {
    return kind === "code" || kind === "xdata" || kind === "far" ? 2 : 1;
}
function unsupportedObjectSpace(space) {
    return space === "pdata" || space === "far" ? space : null;
}
function peelLeadingScalarCasts(raw) {
    let expression = trimOuter(raw.trim());
    let outerType = null;
    for (let guard = 0; guard < 8 && expression.startsWith("("); guard++) {
        const close = findMatchingParenLike(expression, 0, "(", ")");
        if (close <= 0 || close >= expression.length - 1)
            break;
        const header = expression.slice(1, close).trim();
        if (/\b(?:static|extern|register|auto|code|data|idata|xdata|pdata|bdata|far)\b/i.test(header))
            break;
        const declaration = parseDeclarationText(`${header} __c_cast_value`);
        if (!declaration || declaration.declarators !== "__c_cast_value")
            break;
        const type = scalarTypeInfo(declaration.header);
        outerType ?? (outerType = type);
        expression = trimOuter(expression.slice(close + 1).trim());
    }
    return { expression, type: outerType };
}
function parseGlobalScalars(source, functions, codeArrays, structDefs, nextVarAddr, nextXdataAddr, diagnostics) {
    const chars = source.split("");
    for (const fn of functions.values()) {
        for (let i = fn.rangeStart; i < fn.rangeEnd && i < chars.length; i++)
            chars[i] = chars[i] === "\n" ? "\n" : " ";
    }
    const masked = chars.join("");
    const statements = extractTopLevelSemicolonStatements(masked);
    const vars = new Map();
    const ramArrays = new Map();
    const xdataVars = new Map();
    const xdataArrays = new Map();
    const structVars = new Map();
    const pointerVars = new Map();
    const pointerElementSizes = new Map();
    const pointerStructTypes = new Map();
    const pointerPointeeConst = new Map();
    const pointerInitializers = [];
    const initCode = [];
    for (const statement of statements) {
        const raw = statement.trim().replace(/;+\s*$/, "");
        if (!raw || /^(?:sbit|sfr|typedef|enum)\b/i.test(raw) || raw.includes("(") || /^struct\s+[A-Za-z_]\w*\s*\{/i.test(raw))
            continue;
        if (/^union\b/i.test(raw)) {
            diagnostics.push({ level: "error", message: "union objects are not implemented by the browser C51 backend." });
            continue;
        }
        const structDeclaration = parseStructDeclarationText(raw);
        if (structDeclaration) {
            if (structDeclaration.isExtern)
                continue;
            const def = structDefs.get(structDeclaration.structName);
            if (!def) {
                diagnostics.push({ level: "error", message: `Unknown struct type: ${structDeclaration.structName}.` });
                continue;
            }
            const unsupportedSpace = unsupportedObjectSpace(structDeclaration.memorySpace);
            if (unsupportedSpace) {
                diagnostics.push({ level: "error", message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.` });
                continue;
            }
            for (const token of splitCsv(structDeclaration.declarators)) {
                const part = token.trim();
                if (!part)
                    continue;
                const pointer = /^\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
                if (pointer) {
                    const kind = pointerKindFromHeader(structDeclaration.header);
                    const name = pointer[1].toLowerCase();
                    const size = pointerStorageSize(kind);
                    const addr = nextVarAddr.value;
                    nextVarAddr.value += size;
                    if (nextVarAddr.value > 0x80)
                        diagnostics.push({ level: "error", message: `Global pointer ${name} exceeds internal RAM 0x30..0x7F.` });
                    vars.set(name, { name, addr, size, signed: false });
                    pointerVars.set(name, kind);
                    pointerElementSizes.set(name, Math.max(1, def.size));
                    pointerStructTypes.set(name, structDeclaration.structName);
                    pointerPointeeConst.set(name, structDeclaration.isConst || kind === "code");
                    pointerInitializers.push({ name, addr, size, kind, initializer: pointer[2]?.trim(), structName: structDeclaration.structName });
                    continue;
                }
                const array = /^([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\](?:\s*=\s*([\s\S]+))?$/.exec(part);
                const scalar = /^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
                if (!array && !scalar) {
                    diagnostics.push({ level: "error", message: `Unsupported struct declaration: ${part}` });
                    continue;
                }
                const name = (array?.[1] ?? scalar?.[1] ?? "").toLowerCase();
                const parsedCount = array ? tryEvalConst(array[2]) : 1;
                if (parsedCount == null || parsedCount <= 0) {
                    diagnostics.push({ level: "error", message: `Global structure array ${name} requires a positive constant length.` });
                    continue;
                }
                const count = parsedCount;
                const initializer = array?.[3] ?? scalar?.[2];
                const total = Math.max(1, def.size * count);
                const bytes = flattenStructObjectInitializer(initializer, def, count, structDefs, diagnostics, name) ?? Array.from({ length: total }, () => 0);
                const storage = structDeclaration.memorySpace === "xdata" ? "xdata" : structDeclaration.memorySpace === "code" ? "code" : "ram";
                if (storage === "code") {
                    diagnostics.push({ level: "error", message: `Global code structure object ${name} is not implemented; use const code scalar tables.` });
                    continue;
                }
                const baseAddr = storage === "xdata"
                    ? allocateGlobalXdataBlock(nextXdataAddr, total, diagnostics, `Global XDATA structure ${name}`)
                    : nextVarAddr.value;
                if (storage === "ram") {
                    nextVarAddr.value += total;
                    if (nextVarAddr.value > 0x80)
                        diagnostics.push({ level: "error", message: `Global structure ${name} exceeds internal RAM 0x30..0x7F.` });
                }
                structVars.set(name, { name, structName: structDeclaration.structName, baseAddr, storage, elementCount: count, isConst: structDeclaration.isConst });
                if (storage === "xdata")
                    initCode.push(...emitXdataConstantBytes(baseAddr, bytes));
                else
                    for (let index = 0; index < total; index++)
                        initCode.push(`mov ${toAsmByte(baseAddr + index)},#${toAsmByte8(bytes[index] ?? 0)}`);
            }
            continue;
        }
        if (/^struct\b/i.test(raw))
            continue;
        const declaration = parseDeclarationText(raw);
        if (!declaration || declaration.isExtern)
            continue;
        if (declaration.unsupportedReason) {
            diagnostics.push({ level: "error", message: declaration.unsupportedReason });
            continue;
        }
        for (const token of splitCsv(declaration.declarators)) {
            const part = token.trim();
            if (!part)
                continue;
            const globalPointer = /^\*\s*([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
            if (globalPointer) {
                const kind = pointerKindFromHeader(declaration.header);
                const name = globalPointer[1].toLowerCase();
                const size = pointerStorageSize(kind);
                const addr = nextVarAddr.value;
                nextVarAddr.value += size;
                if (nextVarAddr.value > 0x80)
                    diagnostics.push({ level: "error", message: `Global pointer ${name} exceeds internal RAM 0x30..0x7F.` });
                vars.set(name, { name, addr, size, signed: false });
                pointerVars.set(name, kind);
                pointerElementSizes.set(name, declaration.size);
                pointerPointeeConst.set(name, declaration.isConst || kind === "code");
                pointerInitializers.push({ name, addr, size, kind, initializer: globalPointer[2]?.trim() });
                continue;
            }
            const array = /^([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\](?:\s*=\s*(\{[\s\S]*\}|"[\s\S]*"))?$/.exec(part);
            if (array) {
                if (declaration.isCode)
                    continue;
                const unsupportedSpace = unsupportedObjectSpace(declaration.memorySpace);
                if (unsupportedSpace) {
                    diagnostics.push({ level: "error", message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.` });
                    continue;
                }
                const name = array[1].toLowerCase();
                let length = tryEvalConst(array[2]) ?? 0;
                const initialValues = [];
                if (array[3]?.trim().startsWith('"')) {
                    for (const ch of decodeCString(array[3]))
                        initialValues.push(ch.charCodeAt(0) & 0xff);
                    initialValues.push(0);
                }
                else if (array[3]) {
                    for (const item of splitCsv(array[3].trim().slice(1, -1)))
                        initialValues.push(tryEvalConst(item) ?? 0);
                }
                if (!length)
                    length = Math.max(1, initialValues.length);
                const total = Math.max(1, length * declaration.size);
                const bytes = expandElementBytes(initialValues, declaration.size, length);
                if (declaration.memorySpace === "xdata") {
                    const baseAddr = allocateGlobalXdataBlock(nextXdataAddr, total, diagnostics, `Global XDATA array ${name}`);
                    xdataArrays.set(name, { name, baseAddr, length: total, elementSize: declaration.size, elementCount: length });
                    initCode.push(...emitXdataConstantBytes(baseAddr, bytes));
                }
                else {
                    const baseAddr = nextVarAddr.value;
                    nextVarAddr.value += total;
                    if (nextVarAddr.value > 0x80)
                        diagnostics.push({ level: "error", message: `Global array ${name} exceeds internal RAM 0x30..0x7F.` });
                    ramArrays.set(name, { name, baseAddr, length: total, elementSize: declaration.size, elementCount: length });
                    for (let i = 0; i < total; i++)
                        initCode.push(`mov ${toAsmByte(baseAddr + i)},#${toAsmByte8(bytes[i] ?? 0)}`);
                }
                continue;
            }
            const scalar = /^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(part);
            if (!scalar)
                continue;
            const unsupportedSpace = unsupportedObjectSpace(declaration.memorySpace);
            if (unsupportedSpace) {
                diagnostics.push({ level: "error", message: `${unsupportedSpace} object storage is not implemented by the browser C51 backend.` });
                continue;
            }
            const name = scalar[1].toLowerCase();
            const unsupportedInitializer = scalar[2] ? unsupportedArithmeticLiteral(scalar[2]) : null;
            if (unsupportedInitializer)
                diagnostics.push({ level: "error", message: `${name}: ${unsupportedInitializer}` });
            const value = scalar[2] ? tryEvalConst(scalar[2]) : 0;
            if (scalar[2] && value == null)
                diagnostics.push({ level: "error", message: `Global initializer for ${name} must be a constant expression.` });
            const numeric = value ?? 0;
            if (declaration.memorySpace === "xdata") {
                const addr = allocateGlobalXdataBlock(nextXdataAddr, declaration.size, diagnostics, `Global XDATA variable ${name}`);
                const variable = { name, addr, size: declaration.size, isConst: declaration.isConst, signed: declaration.isSigned };
                xdataVars.set(name, variable);
                initCode.push(...emitXdataConstantBytes(addr, Array.from({ length: declaration.size }, (_, i) => (numeric >> (8 * i)) & 0xff)));
            }
            else {
                const addr = nextVarAddr.value;
                nextVarAddr.value += declaration.size;
                if (nextVarAddr.value > 0x80)
                    diagnostics.push({ level: "error", message: `Global variable ${name} exceeds internal RAM 0x30..0x7F.` });
                const variable = { name, addr, size: declaration.size, isConst: declaration.isConst, signed: declaration.isSigned };
                vars.set(name, variable);
                for (let i = 0; i < declaration.size; i++)
                    initCode.push(`mov ${toAsmByte(addr + i)},#${toAsmByte8(numeric >> (8 * i))}`);
            }
        }
    }
    for (const pointer of pointerInitializers) {
        let low = "0x0";
        let high = "0x0";
        const initializer = pointer.initializer;
        if (initializer) {
            const numeric = tryEvalConst(initializer);
            const indexed = /^&?\s*([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(initializer);
            const objectName = initializer.replace(/^&\s*/, "").toLowerCase();
            if (numeric != null) {
                low = toAsmByte8(numeric);
                high = toAsmByte8(numeric >> 8);
            }
            else if (pointer.kind === "code" && indexed && codeArrays.has(indexed[1].toLowerCase())) {
                const array = codeArrays.get(indexed[1].toLowerCase());
                const offset = (tryEvalConst(indexed[2]) ?? 0) * array.elementSize;
                low = `low(${indexed[1]}+${offset})`;
                high = `high(${indexed[1]}+${offset})`;
            }
            else if (pointer.kind === "code" && codeArrays.has(objectName)) {
                low = `low(${objectName})`;
                high = `high(${objectName})`;
            }
            else {
                let address = null;
                if (indexed) {
                    const array = pointer.kind === "xdata" ? xdataArrays.get(indexed[1].toLowerCase()) : ramArrays.get(indexed[1].toLowerCase());
                    const structObject = structVars.get(indexed[1].toLowerCase());
                    const index = tryEvalConst(indexed[2]);
                    if (array && index != null)
                        address = array.baseAddr + normalizedArrayOffset(index, array);
                    else if (structObject && index != null && structObject.elementCount > 1) {
                        const def = structDefs.get(structObject.structName);
                        if (def)
                            address = structObject.baseAddr + index * def.size;
                    }
                }
                else {
                    address = xdataVars.get(objectName)?.addr
                        ?? xdataArrays.get(objectName)?.baseAddr
                        ?? vars.get(objectName)?.addr
                        ?? ramArrays.get(objectName)?.baseAddr
                        ?? structVars.get(objectName)?.baseAddr
                        ?? null;
                }
                if (address != null) {
                    low = toAsmByte8(address);
                    high = toAsmByte8(address >> 8);
                }
                else {
                    diagnostics.push({ level: "error", message: `Global pointer initializer for ${pointer.name} must name a compatible allocated object or numeric address.` });
                }
            }
        }
        initCode.push(`mov ${toAsmByte(pointer.addr)},#${low}`);
        if (pointer.size >= 2)
            initCode.push(`mov ${toAsmByte(pointer.addr + 1)},#${high}`);
    }
    return {
        vars,
        ramArrays,
        xdataVars,
        xdataArrays,
        structVars,
        pointerVars,
        pointerElementSizes,
        pointerStructTypes,
        pointerPointeeConst,
        initCode,
    };
}
function extractTopLevelSemicolonStatements(source) {
    const out = [];
    let start = 0;
    let brace = 0;
    let paren = 0;
    let bracket = 0;
    let quote = "";
    let escaped = false;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "{")
            brace++;
        else if (ch === "}")
            brace--;
        else if (ch === "(")
            paren++;
        else if (ch === ")")
            paren--;
        else if (ch === "[")
            bracket++;
        else if (ch === "]")
            bracket--;
        else if (ch === ";" && brace === 0 && paren === 0 && bracket === 0) {
            out.push(source.slice(start, i + 1));
            start = i + 1;
        }
    }
    return out;
}
function parseStructDefs(source, diagnostics) {
    const rawDefs = new Map();
    const re = /struct\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}\s*;/gi;
    let match;
    while ((match = re.exec(source)))
        rawDefs.set(match[1].toLowerCase(), match[2]);
    const defs = new Map();
    const unresolved = new Set(rawDefs.keys());
    for (let pass = 0; pass <= rawDefs.size && unresolved.size; pass++) {
        let progressed = false;
        for (const name of [...unresolved]) {
            const body = rawDefs.get(name) ?? "";
            const fields = [];
            let offset = 0;
            let blocked = false;
            let invalid = false;
            for (const part of splitStatements(body)) {
                const line = part.text.trim().replace(/;+\s*$/, "");
                if (!line)
                    continue;
                if (/^union\b/i.test(line)) {
                    diagnostics.push({ level: "error", message: `union field in struct ${name} is not implemented.` });
                    invalid = true;
                    break;
                }
                const nested = parseStructDeclarationText(line);
                if (nested) {
                    const nestedDef = defs.get(nested.structName);
                    if (!nestedDef) {
                        if (rawDefs.has(nested.structName))
                            blocked = true;
                        else {
                            diagnostics.push({ level: "error", message: `Unknown nested struct type ${nested.structName} in struct ${name}.` });
                            invalid = true;
                        }
                        break;
                    }
                    if (nested.memorySpace !== "data") {
                        diagnostics.push({ level: "error", message: `Memory-space qualifiers are not valid on embedded field ${name}.${nested.declarators}.` });
                        invalid = true;
                        break;
                    }
                    for (const rawDecl of splitCsv(nested.declarators)) {
                        const item = rawDecl.trim();
                        const array = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(item);
                        const scalar = /^([A-Za-z_]\w*)$/.exec(item);
                        if (!array && !scalar) {
                            diagnostics.push({ level: "error", message: `Unsupported nested struct field ${name}.${item}.` });
                            invalid = true;
                            break;
                        }
                        const count = array ? tryEvalConst(array[2]) : 1;
                        if (count == null || count <= 0) {
                            diagnostics.push({ level: "error", message: `Field ${name}.${array?.[1] ?? item} requires a positive constant array length.` });
                            invalid = true;
                            break;
                        }
                        const fieldName = (array?.[1] ?? scalar?.[1] ?? "").toLowerCase();
                        const size = nestedDef.size * count;
                        fields.push({
                            name: fieldName,
                            offset,
                            size,
                            elementSize: nestedDef.size,
                            elementCount: count,
                            signed: false,
                            structName: nested.structName,
                        });
                        offset += size;
                    }
                    if (invalid)
                        break;
                    continue;
                }
                const fieldDeclaration = parseDeclarationText(line);
                if (!fieldDeclaration) {
                    diagnostics.push({ level: "error", message: `Unsupported struct field declaration in ${name}: ${line}` });
                    invalid = true;
                    break;
                }
                if (fieldDeclaration.unsupportedReason) {
                    diagnostics.push({ level: "error", message: `${name}: ${fieldDeclaration.unsupportedReason}` });
                    invalid = true;
                    break;
                }
                if (fieldDeclaration.memorySpace !== "data") {
                    diagnostics.push({ level: "error", message: `Memory-space qualifiers are not valid on embedded field declaration ${name}.${fieldDeclaration.declarators}.` });
                    invalid = true;
                    break;
                }
                for (const rawDecl of splitCsv(fieldDeclaration.declarators)) {
                    const item = rawDecl.trim();
                    if (/^\*/.test(item)) {
                        diagnostics.push({ level: "error", message: `Pointer field ${name}.${item.replace(/^\*\s*/, "")} is not implemented.` });
                        invalid = true;
                        break;
                    }
                    const array = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(item);
                    const scalar = /^([A-Za-z_]\w*)$/.exec(item);
                    if (!array && !scalar) {
                        diagnostics.push({ level: "error", message: `Unsupported struct field ${name}.${item}.` });
                        invalid = true;
                        break;
                    }
                    const count = array ? tryEvalConst(array[2]) : 1;
                    if (count == null || count <= 0) {
                        diagnostics.push({ level: "error", message: `Field ${name}.${array?.[1] ?? item} requires a positive constant array length.` });
                        invalid = true;
                        break;
                    }
                    const fieldName = (array?.[1] ?? scalar?.[1] ?? "").toLowerCase();
                    const elementSize = Math.max(1, fieldDeclaration.size);
                    const size = elementSize * count;
                    fields.push({
                        name: fieldName,
                        offset,
                        size,
                        elementSize,
                        elementCount: count,
                        signed: fieldDeclaration.isSigned,
                    });
                    offset += size;
                }
                if (invalid)
                    break;
            }
            if (blocked)
                continue;
            unresolved.delete(name);
            progressed = true;
            if (!invalid)
                defs.set(name, { name, fields, size: offset });
        }
        if (!progressed)
            break;
    }
    for (const name of unresolved)
        diagnostics.push({ level: "error", message: `Cannot resolve nested structure layout for struct ${name}.` });
    return defs;
}
function extractFunctions(source, diagnostics) {
    const functions = new Map();
    const functionHeader = `((?:(?:${C_TYPE_QUALIFIER_SOURCE})\\s+)*(?:void|${C_SCALAR_TYPE_SOURCE}|struct\\s+[A-Za-z_]\\w*)(?:(?:\\s+${C_MEMORY_QUALIFIER_SOURCE}))*)`;
    const re = new RegExp(`${functionHeader}\\s+([A-Za-z_]\\w*)\\s*\\(([^)]*)\\)\\s*(?:interrupt\\s+(\\d+))?\\s*(?:using\\s+(\\d+))?\\s*\\{`, "gi");
    let match;
    let order = 0;
    while ((match = re.exec(source))) {
        const name = match[2].toLowerCase();
        const bodyStart = (match.index ?? 0) + match[0].length;
        const bodyEnd = findMatchingBrace(source, bodyStart - 1);
        if (bodyEnd < 0) {
            diagnostics.push({ level: "error", message: `Function ${name} has an unbalanced body.` });
            continue;
        }
        if (functions.has(name))
            diagnostics.push({ level: "error", message: `Function ${name} is defined more than once.` });
        const body = source.slice(bodyStart, bodyEnd);
        const lineOffset = source.slice(0, bodyStart).split("\n").length - 1;
        const returnHeader = match[1].toLowerCase();
        const returnType = scalarTypeInfo(returnHeader);
        const declarationLine = source.slice(0, match.index ?? 0).split("\n").length;
        if (returnType?.unsupportedReason) {
            diagnostics.push({ level: "error", line: declarationLine, message: `${name}(): ${returnType.unsupportedReason}` });
        }
        else if (/\bstruct\b/i.test(returnHeader)) {
            diagnostics.push({ level: "error", line: declarationLine, message: `Returning a struct by value from ${name}() is not implemented.` });
        }
        const returnSize = /\bvoid\b/.test(returnHeader) ? 0 : returnType?.size ?? 2;
        functions.set(name, {
            name,
            body,
            lineOffset,
            order: order++,
            params: parseParamList(match[3], diagnostics, declarationLine),
            returnSize,
            interruptNumber: match[4] == null ? undefined : Number(match[4]),
            usingBank: match[5] == null ? undefined : Number(match[5]),
            rangeStart: match.index ?? 0,
            rangeEnd: bodyEnd + 1,
        });
        re.lastIndex = bodyEnd + 1;
    }
    return functions;
}
function splitStatements(source) {
    const list = [];
    let index = 0;
    let currentLine = 1;
    while (index < source.length) {
        const start = skipWhitespace(source, index);
        currentLine += (source.slice(index, start).match(/\n/g) ?? []).length;
        if (start >= source.length)
            break;
        const statement = consumeStatementLike(source, start);
        if (!statement)
            break;
        const text = statement.text.trim();
        if (text)
            list.push({ text, line: currentLine });
        currentLine += (source.slice(start, statement.end).match(/\n/g) ?? []).length;
        index = statement.end;
    }
    return list;
}
function emitVariableIncDec(variable, op, ctx) {
    if (variable.isConst)
        return [];
    if (ctx.pointerVars.has(variable.name))
        return emitPointerIncDec(variable, op, ctx);
    if (variable.size >= 2) {
        const skip = nextLabel(ctx, "word_incdec_skip");
        return op === "++"
            ? [`inc ${variableTarget(variable)}`, `mov a,${variableTarget(variable)}`, `jnz ${skip}`, `inc ${variableTarget(variable, 1)}`, `${skip}:`]
            : [`mov a,${variableTarget(variable)}`, `jnz ${skip}`, `dec ${variableTarget(variable, 1)}`, `${skip}:`, `dec ${variableTarget(variable)}`];
    }
    return [`${op === "++" ? "inc" : "dec"} ${variableTarget(variable)}`];
}
function emitPointerIncDec(variable, op, ctx) {
    const stride = Math.max(1, ctx.pointerElementSizes.get(variable.name) ?? 1);
    if (variable.size < 2)
        return [`mov a,${variableTarget(variable)}`, `${op === "++" ? "add" : "add"} a,#${toAsmByte8(op === "++" ? stride : -stride)}`, `mov ${variableTarget(variable)},a`];
    const skip = nextLabel(ctx, "pointer_step_skip");
    if (op === "++") {
        return [`mov a,${variableTarget(variable)}`, `add a,#${toAsmByte8(stride)}`, `mov ${variableTarget(variable)},a`, `jnc ${skip}`, `inc ${variableTarget(variable, 1)}`, `${skip}:`];
    }
    return [`mov a,${variableTarget(variable)}`, `add a,#${toAsmByte8(-stride)}`, `mov ${variableTarget(variable)},a`, `jc ${skip}`, `dec ${variableTarget(variable, 1)}`, `${skip}:`];
}
function emitCompoundToVariable(variable, op, rhs, ctx, line) {
    if (variable.size >= 2) {
        const word = emitExprToWord(`${variable.name} ${op} (${rhs})`, ctx, line);
        const out = [...word, `mov ${variableTarget(variable)},a`, `mov ${variableTarget(variable, 1)},b`];
        for (let byte = 2; byte < variable.size; byte++)
            out.push(`mov ${variableTarget(variable, byte)},#0x0`);
        return out;
    }
    if (op === "<<" || op === ">>" || op === "*" || op === "/" || op === "%") {
        return [...emitExprToA(`${variable.name} ${op} (${rhs})`, ctx, line), `mov ${variableTarget(variable)},a`];
    }
    return [`mov a,${variableTarget(variable)}`, ...emitApplyBinaryToA(op, rhs, ctx, line), `mov ${variableTarget(variable)},a`];
}
function emitAssignToVariable(variable, expr, ctx, line) {
    if (variable.isConst && resolveVariable(variable.name, ctx) === variable) {
        // Initialization is allowed; later assignments are rejected in the statement handler.
    }
    const unsupportedLiteral = unsupportedArithmeticLiteral(expr);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return [];
    }
    const pointerKind = ctx.pointerVars.get(variable.name);
    if (pointerKind) {
        const immediate = pointerImmediate(expr, pointerKind, ctx);
        if (immediate) {
            return variable.size >= 2
                ? [`mov ${variableTarget(variable)},#${immediate.low}`, `mov ${variableTarget(variable, 1)},#${immediate.high}`]
                : [`mov ${variableTarget(variable)},#${immediate.low}`];
        }
        const arithmetic = new RegExp(`^${variable.name}\\s*([+\\-])\\s*(.+)$`, "i").exec(trimOuter(expr));
        const count = arithmetic ? tryEvalConst(arithmetic[2]) : null;
        if (arithmetic && count != null) {
            const signedCount = arithmetic[1] === "+" ? count : -count;
            return emitPointerAddConstant(variable, signedCount * Math.max(1, ctx.pointerElementSizes.get(variable.name) ?? 1), ctx);
        }
    }
    const constant = tryEvalConst(expr);
    if (constant != null) {
        const out = [];
        for (let i = 0; i < variable.size; i++)
            out.push(`mov ${variableTarget(variable, i)},#${toAsmByte8(constant >> (8 * i))}`);
        return out;
    }
    const sourceVar = resolveVariable(trimOuter(expr).toLowerCase(), ctx);
    if (sourceVar) {
        const out = [];
        const bytes = Math.min(variable.size, sourceVar.size);
        for (let i = 0; i < bytes; i++)
            out.push(`mov a,${variableTarget(sourceVar, i)}`, `mov ${variableTarget(variable, i)},a`);
        for (let i = bytes; i < variable.size; i++)
            out.push(`mov ${variableTarget(variable, i)},#0`);
        return out;
    }
    if (variable.size >= 2) {
        const word = emitExprToWord(expr, ctx, line);
        const out = [...word, `mov ${variableTarget(variable)},a`, `mov ${variableTarget(variable, 1)},b`];
        for (let i = 2; i < variable.size; i++)
            out.push(`mov ${variableTarget(variable, i)},#0`);
        return out;
    }
    return emitAssignToTarget(variableTarget(variable), expr, ctx, line);
}
function emitAssignToXdataVariable(variable, expr, ctx, line) {
    const unsupportedLiteral = unsupportedArithmeticLiteral(expr);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return [];
    }
    if (variable.size >= 2) {
        return [...emitExprToWord(expr, ctx, line), ...emitStoreWordToXdataAddress(variable.addr)];
    }
    return [...emitExprToA(expr, ctx, line), ...emitStoreByteToXdataAddress(variable.addr)];
}
function emitCompoundToXdataVariable(variable, op, rhs, ctx, line) {
    return emitAssignToXdataVariable(variable, `${variable.name} ${op} (${rhs})`, ctx, line);
}
function emitXdataVariableIncDec(variable, op, ctx, line) {
    return emitAssignToXdataVariable(variable, `${variable.name} ${op === "++" ? "+" : "-"} 1`, ctx, line);
}
function emitPointerAddConstant(variable, byteDelta, ctx) {
    if (variable.size < 2)
        return [`mov a,${variableTarget(variable)}`, `add a,#${toAsmByte8(byteDelta)}`, `mov ${variableTarget(variable)},a`];
    const low = byteDelta & 0xff;
    const high = (byteDelta >> 8) & 0xff;
    return [
        `mov a,${variableTarget(variable)}`,
        `add a,#${toAsmByte8(low)}`,
        `mov ${variableTarget(variable)},a`,
        `mov a,${variableTarget(variable, 1)}`,
        `addc a,#${toAsmByte8(high)}`,
        `mov ${variableTarget(variable, 1)},a`,
    ];
}
function emitExprToWord(expr, ctx, line) {
    const trimmed = trimOuter(expr.trim());
    const unsupportedLiteral = unsupportedArithmeticLiteral(trimmed);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return ["clr a", "mov b,#0x0"];
    }
    const sizeofMatch = /^sizeof\s*\(([^)]+)\)$/.exec(trimmed);
    if (sizeofMatch) {
        const size = resolveSizeofValue(sizeofMatch[1], ctx);
        if (size != null)
            return [`mov a,#${toAsmByte8(size)}`, `mov b,#${toAsmByte8(size >> 8)}`];
        ctx.diagnostics.push({ level: "error", line, message: `Cannot determine sizeof(${sizeofMatch[1]}).` });
        return ["clr a", "mov b,#0x0"];
    }
    const constant = tryEvalConst(trimmed);
    if (constant != null)
        return [`mov a,#${toAsmByte8(constant)}`, `mov b,#${toAsmByte8(constant >> 8)}`];
    const sfr16 = ctx.sfr16Map.get(trimmed.toLowerCase());
    if (sfr16)
        return [`mov a,${sfr16.low}`, `mov b,${sfr16.high}`];
    const xdataVariable = resolveXdataVariable(trimmed.toLowerCase(), ctx);
    if (xdataVariable) {
        if (xdataVariable.size >= 2)
            return emitLoadWordFromXdataAddress(xdataVariable.addr);
        const out = emitLoadByteFromXdataAddress(xdataVariable.addr);
        if (!xdataVariable.signed)
            return [...out, "mov b,#0x0"];
        const positive = nextLabel(ctx, "xdata_word_sign_positive");
        const done = nextLabel(ctx, "xdata_word_sign_done");
        return [...out, `jnb acc.7,${positive}`, "mov b,#0xff", `sjmp ${done}`, `${positive}:`, "mov b,#0x0", `${done}:`];
    }
    const xdataArrayDirect = ctx.xdataArrays.get(trimmed.toLowerCase());
    if (xdataArrayDirect)
        return [`mov a,#${toAsmByte8(xdataArrayDirect.baseAddr)}`, `mov b,#${toAsmByte8(xdataArrayDirect.baseAddr >> 8)}`];
    if (trimmed.startsWith("&")) {
        const addressCode = emitAddressExpressionToWord(trimmed.slice(1), ctx, line);
        if (addressCode)
            return addressCode;
    }
    const variable = resolveVariable(trimmed.toLowerCase(), ctx);
    if (variable) {
        if (variable.size >= 2)
            return [`mov a,${variableTarget(variable)}`, `mov b,${variableTarget(variable, 1)}`];
        if (variable.signed) {
            const positive = nextLabel(ctx, "word_sign_positive");
            const done = nextLabel(ctx, "word_sign_done");
            return [
                `mov a,${variableTarget(variable)}`,
                `jnb acc.7,${positive}`,
                "mov b,#0xff",
                `sjmp ${done}`,
                `${positive}:`,
                "mov b,#0x0",
                `${done}:`,
            ];
        }
        return [`mov a,${variableTarget(variable)}`, "mov b,#0x0"];
    }
    const dereference = /^\*\s*([A-Za-z_]\w*)$/.exec(trimmed);
    if (dereference) {
        const ptrName = dereference[1].toLowerCase();
        const pointer = resolveVariable(ptrName, ctx);
        const kind = ctx.pointerVars.get(ptrName);
        if (pointer && (ctx.pointerElementSizes.get(ptrName) ?? 1) >= 2) {
            if (kind === "ram") {
                return [`mov a,${variableTarget(pointer)}`, "mov r0,a", "mov a,@r0", "mov b,a", "inc r0", "mov a,@r0", "xch a,b"];
            }
            if (kind === "xdata") {
                return [`mov dpl,${variableTarget(pointer)}`, `mov dph,${variableTarget(pointer, 1)}`, "movx a,@dptr", "mov b,a", "inc dptr", "movx a,@dptr", "xch a,b"];
            }
            if (kind === "code") {
                return [`mov dpl,${variableTarget(pointer)}`, `mov dph,${variableTarget(pointer, 1)}`, "clr a", "movc a,@a+dptr", "mov b,a", "inc dptr", "clr a", "movc a,@a+dptr", "xch a,b"];
            }
        }
    }
    const wordArray = /^([A-Za-z_]\w*)\s*\[\s*([^\[\]]+)\s*\]$/.exec(trimmed);
    if (wordArray) {
        const name = wordArray[1].toLowerCase();
        const xdataArray = ctx.xdataArrays.get(name);
        if (xdataArray?.elementSize && xdataArray.elementSize >= 2) {
            return emitXdataArrayLoad(xdataArray, wordArray[2], true, ctx, line);
        }
        const local = ctx.localArrays.get(name);
        if (local?.elementSize && local.elementSize >= 2) {
            const constantIndex = tryEvalConst(wordArray[2]);
            if (constantIndex != null) {
                const address = local.baseAddr + normalizedArrayOffset(constantIndex, local);
                return [`mov a,${toAsmByte(address)}`, `mov b,${toAsmByte(address + 1)}`];
            }
            return [...emitScaledIndexToA(wordArray[2], local.elementSize, ctx, line), `add a,#${toAsmByte8(local.baseAddr)}`, "mov r0,a", "mov a,@r0", "mov b,a", "inc r0", "mov a,@r0", "xch a,b"];
        }
        const codeArray = ctx.arrays.get(name);
        if (codeArray && codeArray.elementSize >= 2) {
            return [`mov dptr,#${name}`, ...emitScaledIndexToA(wordArray[2], codeArray.elementSize, ctx, line), "mov r1,a", "movc a,@a+dptr", "mov b,a", "mov a,r1", "inc a", "movc a,@a+dptr", "xch a,b"];
        }
        if (ctx.pointerVars.has(name) && (ctx.pointerElementSizes.get(name) ?? 1) >= 2) {
            return emitPointerIndexLoad(name, wordArray[2], true, ctx, line);
        }
    }
    const wideStructAccess = resolveStructAccess(trimmed, ctx, line, true);
    if (wideStructAccess)
        return emitLoadStructAccess(wideStructAccess, ctx, line, true);
    const rotate16 = /^_(irol|iror)_\s*\(([\s\S]*)\)$/i.exec(trimmed);
    if (rotate16) {
        const args = splitCsv(rotate16[2]);
        const count = tryEvalConst(args[1] ?? "1");
        if (args.length !== 2 || count == null) {
            ctx.diagnostics.push({ level: "error", line, message: `${rotate16[1]} requires a value and constant rotation count.` });
            return ["clr a", "mov b,#0x0"];
        }
        return emitRotateWord(args[0], count & 15, rotate16[1].toLowerCase() === "irol" ? "left" : "right", ctx, line);
    }
    const call = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/.exec(trimmed);
    if (call && ctx.functions.has(call[1].toLowerCase())) {
        const fn = ctx.functions.get(call[1].toLowerCase());
        const out = emitFunctionCall(fn.name, call[2], ctx, line);
        if (fn.returnSize < 2)
            out.push("mov b,#0x0");
        return out;
    }
    const ternary = findTopLevelTernary(trimmed);
    if (ternary) {
        const falseLabel = nextLabel(ctx, "word_ternary_false");
        const doneLabel = nextLabel(ctx, "word_ternary_done");
        return [
            ...emitConditionFalseJump(ternary.condition, falseLabel, ctx, line),
            ...emitExprToWord(ternary.whenTrue, ctx, line),
            `sjmp ${doneLabel}`,
            `${falseLabel}:`,
            ...emitExprToWord(ternary.whenFalse, ctx, line),
            `${doneLabel}:`,
        ];
    }
    if (findTopLevelBinaryOperator(trimmed, ["||", "&&"]) || findComparator(trimmed) || trimmed.startsWith("!")) {
        return [...emitBooleanExprToA(trimmed, ctx, line), "mov b,#0x0"];
    }
    if (trimmed.startsWith("~")) {
        return [...emitExprToWord(trimmed.slice(1), ctx, line), "cpl a", "xch a,b", "cpl a", "xch a,b"];
    }
    if (trimmed.startsWith("-") && !/^-\s*(?:0[xX][0-9a-fA-F]+|\d+)/.test(trimmed)) {
        const temp = allocateWordTemp(ctx, "word_neg", line);
        const carryDone = nextLabel(ctx, "word_neg_done");
        return [
            ...emitExprToWord(trimmed.slice(1), ctx, line),
            `mov ${variableTarget(temp)},a`,
            "mov a,b",
            "cpl a",
            `mov ${variableTarget(temp, 1)},a`,
            `mov a,${variableTarget(temp)}`,
            "cpl a",
            "add a,#0x1",
            `mov ${variableTarget(temp)},a`,
            `mov a,${variableTarget(temp, 1)}`,
            "addc a,#0x0",
            "mov b,a",
            `mov a,${variableTarget(temp)}`,
            `${carryDone}:`,
        ];
    }
    if (trimmed.startsWith("+"))
        return emitExprToWord(trimmed.slice(1), ctx, line);
    const shift = findTopLevelBinaryOperator(trimmed, ["<<", ">>"]);
    if (shift)
        return emitWordShift(shift.left, shift.op, shift.right, ctx, line);
    for (const ops of [["|"], ["^"], ["&"], ["+", "-"], ["*", "/", "%"]]) {
        const found = findTopLevelBinaryOperator(trimmed, ops);
        if (!found)
            continue;
        if (found.op === "*" || found.op === "/" || found.op === "%") {
            const out = emitMulDivToA(found.left, found.op, found.right, ctx, line);
            if (found.op !== "*")
                out.push("mov b,#0x0");
            return out;
        }
        return emitWordBinary(found.left, found.op, found.right, ctx, line);
    }
    const cast = peelLeadingScalarCasts(trimmed);
    if (cast.type) {
        if (cast.type.unsupportedReason) {
            ctx.diagnostics.push({ level: "error", line, message: cast.type.unsupportedReason });
            return ["clr a", "mov b,#0x0"];
        }
        if (cast.type.size !== 1)
            return emitExprToWord(cast.expression, ctx, line);
        const out = emitExprToA(cast.expression, ctx, line);
        if (!cast.type.signed)
            return [...out, "mov b,#0x0"];
        const positive = nextLabel(ctx, "cast_sign_positive");
        const done = nextLabel(ctx, "cast_sign_done");
        return [
            ...out,
            `jnb acc.7,${positive}`,
            "mov b,#0xff",
            `sjmp ${done}`,
            `${positive}:`,
            "mov b,#0x0",
            `${done}:`,
        ];
    }
    const bitName = resolveVariable(trimmed.toLowerCase(), ctx) ? undefined : ctx.sbitMap.get(trimmed.toLowerCase());
    if (bitName)
        return [...emitExprToA(trimmed, ctx, line), "mov b,#0x0"];
    const target = resolveTarget(trimmed.toLowerCase(), ctx);
    if (target)
        return [`mov a,${normalizeAccumulatorSource(target)}`, "mov b,#0x0"];
    const arrayMatch = /^([A-Za-z_]\w*)\s*\[\s*([^\[\]]+)\s*\]$/.exec(trimmed);
    if (arrayMatch || trimmed.startsWith("*") || trimmed.startsWith("&") || resolveStructAccess(trimmed, ctx, line, false)) {
        return [...emitExprToA(trimmed, ctx, line), "mov b,#0x0"];
    }
    ctx.diagnostics.push({ level: "error", line, message: `Unsupported 16-bit C expression: ${trimmed}` });
    return ["clr a", "mov b,#0x0"];
}
function emitRotateWord(expr, count, direction, ctx, line) {
    const value = allocateWordTemp(ctx, "word_rotate", line);
    const out = [...emitExprToWord(expr, ctx, line), `mov ${variableTarget(value)},a`, `mov ${variableTarget(value, 1)},b`];
    for (let index = 0; index < count; index++) {
        const noWrap = nextLabel(ctx, "word_rotate_nowrap");
        if (direction === "left") {
            out.push(`mov a,${variableTarget(value)}`, "clr c", "rlc a", `mov ${variableTarget(value)},a`, `mov a,${variableTarget(value, 1)}`, "rlc a", `mov ${variableTarget(value, 1)},a`, `jnc ${noWrap}`, `orl ${variableTarget(value)},#0x01`, `${noWrap}:`);
        }
        else {
            out.push(`mov a,${variableTarget(value, 1)}`, "clr c", "rrc a", `mov ${variableTarget(value, 1)},a`, `mov a,${variableTarget(value)}`, "rrc a", `mov ${variableTarget(value)},a`, `jnc ${noWrap}`, `orl ${variableTarget(value, 1)},#0x80`, `${noWrap}:`);
        }
    }
    out.push(`mov a,${variableTarget(value)}`, `mov b,${variableTarget(value, 1)}`);
    return out;
}
function allocateWordTemp(ctx, prefix, line) {
    return ensureVar(ctx, `__${prefix}_${ctx.labelCounter.value++}`, line, 2);
}
function emitWordBinary(left, op, right, ctx, line) {
    const lhs = allocateWordTemp(ctx, "word_lhs", line);
    const rhs = allocateWordTemp(ctx, "word_rhs", line);
    const resultLow = allocateWordTemp(ctx, "word_result", line);
    const out = [
        ...emitExprToWord(left, ctx, line),
        `mov ${variableTarget(lhs)},a`,
        `mov ${variableTarget(lhs, 1)},b`,
        ...emitExprToWord(right, ctx, line),
        `mov ${variableTarget(rhs)},a`,
        `mov ${variableTarget(rhs, 1)},b`,
    ];
    if (op === "+" || op === "-") {
        out.push(`mov a,${variableTarget(lhs)}`);
        if (op === "-")
            out.push("clr c", `subb a,${variableTarget(rhs)}`);
        else
            out.push(`add a,${variableTarget(rhs)}`);
        out.push(`mov ${variableTarget(resultLow)},a`, `mov a,${variableTarget(lhs, 1)}`);
        out.push(op === "-" ? `subb a,${variableTarget(rhs, 1)}` : `addc a,${variableTarget(rhs, 1)}`);
        out.push("mov b,a", `mov a,${variableTarget(resultLow)}`);
        return out;
    }
    const opcode = op === "&" ? "anl" : op === "|" ? "orl" : "xrl";
    out.push(`mov a,${variableTarget(lhs)}`, `${opcode} a,${variableTarget(rhs)}`, `mov ${variableTarget(resultLow)},a`, `mov a,${variableTarget(lhs, 1)}`, `${opcode} a,${variableTarget(rhs, 1)}`, "mov b,a", `mov a,${variableTarget(resultLow)}`);
    return out;
}
function emitWordShift(left, op, right, ctx, line) {
    const value = allocateWordTemp(ctx, "word_shift", line);
    const countConst = tryEvalConst(right);
    const out = [
        ...emitExprToWord(left, ctx, line),
        `mov ${variableTarget(value)},a`,
        `mov ${variableTarget(value, 1)},b`,
    ];
    const emitOne = () => {
        if (op === "<<") {
            out.push("clr c", `mov a,${variableTarget(value)}`, "rlc a", `mov ${variableTarget(value)},a`, `mov a,${variableTarget(value, 1)}`, "rlc a", `mov ${variableTarget(value, 1)},a`);
        }
        else {
            out.push("clr c", `mov a,${variableTarget(value, 1)}`, "rrc a", `mov ${variableTarget(value, 1)},a`, `mov a,${variableTarget(value)}`, "rrc a", `mov ${variableTarget(value)},a`);
        }
    };
    if (countConst != null) {
        for (let i = 0; i < Math.min(16, countConst & 0xff); i++)
            emitOne();
    }
    else {
        const count = ensureVar(ctx, `__word_shift_count_${ctx.labelCounter.value++}`, line);
        const loop = nextLabel(ctx, "word_shift_loop");
        const done = nextLabel(ctx, "word_shift_done");
        out.push(...emitExprToA(right, ctx, line), `mov ${variableTarget(count)},a`, `${loop}:`, `mov a,${variableTarget(count)}`, `jz ${done}`);
        emitOne();
        out.push(`dec ${variableTarget(count)}`, `sjmp ${loop}`, `${done}:`);
    }
    out.push(`mov a,${variableTarget(value)}`, `mov b,${variableTarget(value, 1)}`);
    return out;
}
function emitAssignToSfr16(target, expr, ctx, line) {
    const unsupportedLiteral = unsupportedArithmeticLiteral(expr);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return [];
    }
    const constant = tryEvalConst(expr);
    if (constant != null) {
        return [`mov ${target.low},#${toAsmByte8(constant)}`, `mov ${target.high},#${toAsmByte8(constant >> 8)}`];
    }
    return [...emitExprToWord(expr, ctx, line), `mov ${target.low},a`, `mov ${target.high},b`];
}
function emitAssignToTarget(target, expr, ctx, line) {
    const trimmedExpr = expr.trim();
    const unsupportedLiteral = unsupportedArithmeticLiteral(trimmedExpr);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return [];
    }
    const constValue = tryEvalConst(trimmedExpr);
    if (constValue != null) {
        if (target === "a" || target === "acc") {
            return [`mov a,#${toAsmByte8(constValue)}`];
        }
        return [`mov ${target},#${toAsmByte8(constValue)}`];
    }
    const lowered = trimmedExpr.toLowerCase();
    const preferExpression = ctx.localArrays.has(lowered) ||
        resolveStructAccess(trimmedExpr, ctx, line, false) != null ||
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
function emitExprToA(expr, ctx, line) {
    const trimmed = trimOuter(expr.trim());
    const unsupportedLiteral = unsupportedArithmeticLiteral(trimmed);
    if (unsupportedLiteral) {
        ctx.diagnostics.push({ level: "error", line, message: unsupportedLiteral });
        return ["clr a"];
    }
    const constValue = tryEvalConst(trimmed);
    if (constValue != null)
        return [`mov a,#${toAsmByte8(constValue)}`];
    const sfr16 = ctx.sfr16Map.get(trimmed.toLowerCase());
    if (sfr16)
        return [`mov a,${sfr16.low}`];
    const directXdata = resolveXdataVariable(trimmed.toLowerCase(), ctx);
    if (directXdata)
        return emitLoadByteFromXdataAddress(directXdata.addr);
    const preInc = /^(\+\+|--)([A-Za-z_]\w*)$/.exec(trimmed);
    if (preInc) {
        const variable = resolveVariable(preInc[2].toLowerCase(), ctx);
        const xdataVariable = resolveXdataVariable(preInc[2].toLowerCase(), ctx);
        if (xdataVariable)
            return [...emitXdataVariableIncDec(xdataVariable, preInc[1], ctx, line), ...emitLoadByteFromXdataAddress(xdataVariable.addr)];
        if (!variable) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown variable ${preInc[2]} in ${preInc[1]} expression.` });
            return ["clr a"];
        }
        return [...emitVariableIncDec(variable, preInc[1], ctx), `mov a,${variableTarget(variable)}`];
    }
    const postInc = /^([A-Za-z_]\w*)(\+\+|--)$/.exec(trimmed);
    if (postInc) {
        const variable = resolveVariable(postInc[1].toLowerCase(), ctx);
        const xdataVariable = resolveXdataVariable(postInc[1].toLowerCase(), ctx);
        if (xdataVariable) {
            const old = ensureVar(ctx, "__post_xdata_value", line);
            return [...emitLoadByteFromXdataAddress(xdataVariable.addr), `mov ${variableTarget(old)},a`, ...emitXdataVariableIncDec(xdataVariable, postInc[2], ctx, line), `mov a,${variableTarget(old)}`];
        }
        if (!variable) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown variable ${postInc[1]} in ${postInc[2]} expression.` });
            return ["clr a"];
        }
        const old = ensureVar(ctx, "__post_value", line);
        return [`mov a,${variableTarget(variable)}`, `mov ${variableTarget(old)},a`, ...emitVariableIncDec(variable, postInc[2], ctx), `mov a,${variableTarget(old)}`];
    }
    const assignmentExpr = /^([A-Za-z_]\w*)\s*([+\-*/%&|^]?=)(?!=)\s*([\s\S]+)$/.exec(trimmed);
    if (assignmentExpr) {
        const variable = resolveVariable(assignmentExpr[1].toLowerCase(), ctx);
        const xdataVariable = resolveXdataVariable(assignmentExpr[1].toLowerCase(), ctx);
        if (xdataVariable) {
            const code = assignmentExpr[2] === "="
                ? emitAssignToXdataVariable(xdataVariable, assignmentExpr[3], ctx, line)
                : emitCompoundToXdataVariable(xdataVariable, assignmentExpr[2][0], assignmentExpr[3], ctx, line);
            return [...code, ...emitLoadByteFromXdataAddress(xdataVariable.addr)];
        }
        if (!variable) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown assignment target ${assignmentExpr[1]}.` });
            return ["clr a"];
        }
        if (assignmentExpr[2] === "=")
            return [...emitAssignToVariable(variable, assignmentExpr[3], ctx, line), `mov a,${variableTarget(variable)}`];
        const op = assignmentExpr[2][0];
        return [...emitCompoundToVariable(variable, op, assignmentExpr[3], ctx, line), `mov a,${variableTarget(variable)}`];
    }
    const sizeofMatch = /^sizeof\s*\(([^)]+)\)$/.exec(trimmed);
    if (sizeofMatch) {
        const size = resolveSizeofValue(sizeofMatch[1], ctx);
        if (size != null)
            return [`mov a,#${toAsmByte8(size)}`];
        ctx.diagnostics.push({ level: "error", line, message: `Cannot determine sizeof(${sizeofMatch[1]}).` });
        return ["clr a"];
    }
    const ternary = findTopLevelTernary(trimmed);
    if (ternary) {
        const falseLabel = nextLabel(ctx, "ternary_false");
        const endLabel = nextLabel(ctx, "ternary_end");
        return [
            ...emitConditionFalseJump(ternary.condition, falseLabel, ctx, line),
            ...emitExprToA(ternary.whenTrue, ctx, line),
            `sjmp ${endLabel}`,
            `${falseLabel}:`,
            ...emitExprToA(ternary.whenFalse, ctx, line),
            `${endLabel}:`,
        ];
    }
    if (findTopLevelBinaryOperator(trimmed, ["||", "&&"]) || findComparator(trimmed)) {
        return emitBooleanExprToA(trimmed, ctx, line);
    }
    const rotate8 = /^_(crol|cror)_\s*\(([\s\S]*)\)$/i.exec(trimmed);
    if (rotate8) {
        const args = splitCsv(rotate8[2]);
        const count = tryEvalConst(args[1] ?? "1");
        if (args.length !== 2 || count == null) {
            ctx.diagnostics.push({ level: "error", line, message: `${rotate8[1]} requires a value and constant rotation count.` });
            return ["clr a"];
        }
        const opcode = rotate8[1].toLowerCase() === "crol" ? "rl a" : "rr a";
        return [...emitExprToA(args[0], ctx, line), ...Array.from({ length: count & 7 }, () => opcode)];
    }
    const testBit = /^_testbit_\s*\(([\s\S]*)\)$/i.exec(trimmed);
    if (testBit) {
        const bit = ctx.sbitMap.get(testBit[1].trim().toLowerCase());
        if (!bit) {
            ctx.diagnostics.push({ level: "error", line, message: "_testbit_ requires an sbit name." });
            return ["clr a"];
        }
        const zero = nextLabel(ctx, "testbit_zero");
        const done = nextLabel(ctx, "testbit_done");
        return [`jnb ${bit},${zero}`, `clr ${bit}`, "mov a,#1", `sjmp ${done}`, `${zero}:`, "clr a", `${done}:`];
    }
    const callMatch = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/.exec(trimmed);
    if (callMatch && ctx.functions.has(callMatch[1].toLowerCase())) {
        const fn = ctx.functions.get(callMatch[1].toLowerCase());
        if (fn.interruptNumber != null) {
            ctx.diagnostics.push({ level: "error", line, message: `Interrupt handler ${fn.name}() cannot be called.` });
            return ["clr a"];
        }
        return emitFunctionCall(fn.name, callMatch[2], ctx, line);
    }
    const bitName = resolveVariable(trimmed.toLowerCase(), ctx) ? undefined : ctx.sbitMap.get(trimmed.toLowerCase());
    if (bitName) {
        const zero = nextLabel(ctx, "bit_zero");
        const end = nextLabel(ctx, "bit_end");
        return [`jnb ${bitName},${zero}`, "mov a,#1", `sjmp ${end}`, `${zero}:`, "clr a", `${end}:`];
    }
    if (trimmed.startsWith("&")) {
        const addressCode = emitAddressExpressionToWord(trimmed.slice(1), ctx, line);
        if (addressCode)
            return addressCode;
    }
    if (trimmed.startsWith("*")) {
        const ptrName = trimOuter(trimmed.slice(1)).toLowerCase();
        const ptr = resolveTarget(ptrName, ctx);
        const ptrKind = ctx.pointerVars.get(ptrName);
        if (ptrKind === "pdata" || ptrKind === "far") {
            ctx.diagnostics.push({
                level: "error",
                line,
                message: `Dereferencing a ${ptrKind} pointer is not implemented; MOVX/generic-pointer lowering is required.`,
            });
            return ["clr a"];
        }
        if (ptr && ptrKind === "ram")
            return [`mov a,${ptr}`, "mov r0,a", "mov a,@r0"];
        if (ptr && ptrKind === "xdata") {
            const variable = resolveVariable(ptrName, ctx);
            if (variable)
                return [`mov dpl,${variableTarget(variable)}`, `mov dph,${variableTarget(variable, 1)}`, "movx a,@dptr"];
        }
        if (ptr && ptrKind === "code") {
            const variable = resolveVariable(ptrName, ctx);
            if (variable)
                return [`mov dpl,${variableTarget(variable)}`, `mov dph,${variableTarget(variable, 1)}`, "clr a", "movc a,@a+dptr"];
        }
    }
    const arrowRoot = /^([A-Za-z_]\w*)\s*->/.exec(trimmed);
    if (arrowRoot) {
        const kind = ctx.pointerVars.get(arrowRoot[1].toLowerCase());
        if (kind === "pdata" || kind === "far") {
            ctx.diagnostics.push({
                level: "error",
                line,
                message: `Dereferencing a ${kind} pointer is not implemented; MOVX/generic-pointer lowering is required.`,
            });
            return ["clr a"];
        }
    }
    const structAccess = resolveStructAccess(trimmed, ctx, line, true);
    if (structAccess)
        return emitLoadStructAccess(structAccess, ctx, line, false);
    const xdataArrayDirect = ctx.xdataArrays.get(trimmed.toLowerCase());
    if (xdataArrayDirect)
        return [`mov a,#${toAsmByte8(xdataArrayDirect.baseAddr)}`];
    const localArrayDirect = ctx.localArrays.get(trimmed.toLowerCase());
    if (localArrayDirect)
        return [`mov a,#${toAsmByte8(localArrayDirect.baseAddr)}`];
    const arrayMatch = /^([A-Za-z_]\w*)\s*\[\s*([^\[\]]+)\s*\]$/.exec(trimmed);
    if (arrayMatch) {
        const arrayName = arrayMatch[1].toLowerCase();
        const xdataArray = ctx.xdataArrays.get(arrayName);
        if (xdataArray)
            return emitXdataArrayLoad(xdataArray, arrayMatch[2], false, ctx, line);
        const localArray = ctx.localArrays.get(arrayName);
        if (localArray) {
            const indexConst = tryEvalConst(arrayMatch[2]);
            if (indexConst != null)
                return [`mov a,${toAsmByte(localArray.baseAddr + normalizedArrayOffset(indexConst, localArray))}`];
            return [...emitScaledIndexToA(arrayMatch[2], localArray.elementSize, ctx, line), `add a,#${toAsmByte8(localArray.baseAddr)}`, "mov r0,a", "mov a,@r0"];
        }
        if (ctx.pointerVars.has(arrayName))
            return emitPointerIndexLoad(arrayName, arrayMatch[2], false, ctx, line);
        if (!ctx.arrays.has(arrayName)) {
            ctx.diagnostics.push({ level: "error", line, message: `Unknown array: ${arrayMatch[1]}` });
            return ["clr a"];
        }
        const codeArray = ctx.arrays.get(arrayName);
        return [`mov dptr,#${arrayName}`, ...emitScaledIndexToA(arrayMatch[2], codeArray.elementSize, ctx, line), "movc a,@a+dptr"];
    }
    if (trimmed.startsWith("!"))
        return emitBooleanExprToA(trimmed, ctx, line);
    if (trimmed.startsWith("~"))
        return [...emitExprToA(trimmed.slice(1), ctx, line), "cpl a"];
    if (trimmed.startsWith("-") && !/^-[0-9]/.test(trimmed))
        return [...emitExprToA(trimmed.slice(1), ctx, line), "cpl a", "inc a"];
    if (trimmed.startsWith("+"))
        return emitExprToA(trimmed.slice(1), ctx, line);
    const shift = findTopLevelBinaryOperator(trimmed, ["<<", ">>"]);
    if (shift)
        return emitShiftToA(shift.left, shift.op, shift.right, ctx, line);
    for (const ops of [["|"], ["^"], ["&"], ["+", "-"], ["*", "/", "%"]]) {
        const found = findTopLevelBinaryOperator(trimmed, ops);
        if (!found)
            continue;
        if (found.op === "*" || found.op === "/" || found.op === "%")
            return emitMulDivToA(found.left, found.op, found.right, ctx, line);
        return [...emitExprToA(found.left, ctx, line), ...emitApplyBinaryToA(found.op, found.right, ctx, line)];
    }
    const cast = peelLeadingScalarCasts(trimmed);
    if (cast.type) {
        if (cast.type.unsupportedReason) {
            ctx.diagnostics.push({ level: "error", line, message: cast.type.unsupportedReason });
            return ["clr a"];
        }
        return emitExprToA(cast.expression, ctx, line);
    }
    const target = resolveTarget(trimmed.toLowerCase(), ctx);
    if (target)
        return [`mov a,${normalizeAccumulatorSource(target)}`];
    ctx.diagnostics.push({ level: "error", line, message: `Unsupported C expression: ${trimmed}` });
    return ["clr a"];
}
function resolveSizeofValue(rawItem, ctx) {
    const item = trimOuter(rawItem.trim()).toLowerCase();
    const structType = /^struct\s+([A-Za-z_]\w*)$/i.exec(item);
    if (structType)
        return ctx.structDefs.get(structType[1].toLowerCase())?.size ?? null;
    const dereference = /^\*\s*([A-Za-z_]\w*)$/.exec(item);
    if (dereference && ctx.pointerVars.has(dereference[1].toLowerCase())) {
        return ctx.pointerElementSizes.get(dereference[1].toLowerCase()) ?? 1;
    }
    const indexedItem = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(item);
    if (indexedItem) {
        const name = indexedItem[1].toLowerCase();
        const object = ctx.structVars.get(name);
        if (object)
            return ctx.structDefs.get(object.structName)?.size ?? null;
        if (ctx.pointerStructTypes.has(name))
            return ctx.pointerElementSizes.get(name) ?? null;
        const ramArray = ctx.localArrays.get(name);
        if (ramArray)
            return ramArray.elementSize;
        const xdataArray = ctx.xdataArrays.get(name);
        if (xdataArray)
            return xdataArray.elementSize;
        const codeArray = ctx.arrays.get(name);
        if (codeArray)
            return codeArray.elementSize;
        if (ctx.pointerVars.has(name))
            return ctx.pointerElementSizes.get(name) ?? 1;
    }
    const access = resolveStructAccess(item, ctx, 0, false);
    if (access)
        return access.size;
    const variable = resolveVariable(item, ctx);
    const localArray = ctx.localArrays.get(item);
    const xdataVariable = resolveXdataVariable(item, ctx);
    const xdataArray = ctx.xdataArrays.get(item);
    const codeArray = ctx.arrays.get(item);
    const structObject = ctx.structVars.get(item);
    const structObjectSize = structObject
        ? (ctx.structDefs.get(structObject.structName)?.size ?? 0) * structObject.elementCount
        : null;
    return variable?.size
        ?? xdataVariable?.size
        ?? localArray?.length
        ?? xdataArray?.length
        ?? codeArray?.bytes.length
        ?? structObjectSize
        ?? (ctx.sfr16Map.has(item) ? 2 : null)
        ?? scalarTypeInfo(item)?.size
        ?? null;
}
function normalizedArrayOffset(index, array) {
    const normalized = ((index % array.elementCount) + array.elementCount) % array.elementCount;
    return normalized * array.elementSize;
}
function emitScaledIndexToA(index, elementSize, ctx, line) {
    const out = emitExprToA(index, ctx, line);
    if (elementSize === 2)
        out.push("rl a");
    else if (elementSize > 2)
        out.push("mov b,#" + toAsmByte8(elementSize), "mul ab");
    return out;
}
function emitPointerIndexLoad(name, index, word, ctx, line) {
    const pointer = resolveVariable(name, ctx);
    const kind = ctx.pointerVars.get(name);
    if (!pointer || !kind)
        return ["clr a", ...(word ? ["mov b,#0x0"] : [])];
    const stride = Math.max(1, ctx.pointerElementSizes.get(name) ?? 1);
    if (kind === "ram") {
        const out = [...emitScaledIndexToA(index, stride, ctx, line), `add a,${variableTarget(pointer)}`, "mov r0,a", "mov a,@r0"];
        if (word)
            out.push("mov b,a", "inc r0", "mov a,@r0", "xch a,b");
        return out;
    }
    if (kind === "code") {
        const out = [`mov dpl,${variableTarget(pointer)}`, `mov dph,${variableTarget(pointer, 1)}`, ...emitScaledIndexToA(index, stride, ctx, line)];
        if (word)
            out.push("mov r1,a", "movc a,@a+dptr", "mov b,a", "mov a,r1", "inc a", "movc a,@a+dptr", "xch a,b");
        else
            out.push("movc a,@a+dptr");
        return out;
    }
    if (kind === "xdata") {
        const out = [
            ...emitScaledIndexToA(index, stride, ctx, line),
            `mov r1,${variableTarget(pointer)}`,
            "add a,r1",
            "mov dpl,a",
            "clr a",
            `mov r1,${variableTarget(pointer, 1)}`,
            "addc a,r1",
            "mov dph,a",
            "movx a,@dptr",
        ];
        if (word)
            out.push("mov b,a", "inc dptr", "movx a,@dptr", "xch a,b");
        return out;
    }
    ctx.diagnostics.push({ level: "error", line, message: `Indexed access through a ${kind} pointer is not implemented.` });
    return ["clr a", ...(word ? ["mov b,#0x0"] : [])];
}
function emitBooleanExprToA(expr, ctx, line) {
    const falseLabel = nextLabel(ctx, "bool_false");
    const endLabel = nextLabel(ctx, "bool_end");
    return [...emitConditionFalseJump(expr, falseLabel, ctx, line), "mov a,#1", `sjmp ${endLabel}`, `${falseLabel}:`, "clr a", `${endLabel}:`];
}
function emitMulDivToA(left, op, right, ctx, line) {
    const lhs = ensureVar(ctx, "__arith_lhs", line);
    const out = [...emitExprToA(left, ctx, line), `mov ${variableTarget(lhs)},a`, ...emitExprToA(right, ctx, line), "mov b,a", `mov a,${variableTarget(lhs)}`];
    if (op === "*")
        out.push("mul ab");
    else {
        const nonzero = nextLabel(ctx, "div_nonzero");
        const done = nextLabel(ctx, "div_done");
        out.push("mov a,b", `jnz ${nonzero}`, "clr a", `sjmp ${done}`, `${nonzero}:`, `mov a,${variableTarget(lhs)}`, "div ab");
        if (op === "%")
            out.push("mov a,b");
        out.push(`${done}:`);
    }
    return out;
}
function emitShiftToA(left, op, right, ctx, line) {
    const count = tryEvalConst(right);
    if (count == null) {
        const counter = ensureVar(ctx, "__shift_count", line);
        const value = ensureVar(ctx, "__shift_value", line);
        const loop = nextLabel(ctx, "shift_loop");
        const done = nextLabel(ctx, "shift_done");
        const out = [...emitExprToA(left, ctx, line), `mov ${variableTarget(value)},a`, ...emitExprToA(right, ctx, line), `mov ${variableTarget(counter)},a`, `${loop}:`, `mov a,${variableTarget(counter)}`, `jz ${done}`, `mov a,${variableTarget(value)}`, "clr c", op === "<<" ? "rlc a" : "rrc a", `mov ${variableTarget(value)},a`, `dec ${variableTarget(counter)}`, `sjmp ${loop}`, `${done}:`, `mov a,${variableTarget(value)}`];
        return out;
    }
    const amount = Math.max(0, Math.min(31, count));
    const variable = resolveVariable(trimOuter(left).toLowerCase(), ctx);
    if (op === ">>" && variable && variable.size >= 2) {
        if (amount >= variable.size * 8)
            return ["clr a"];
        const low = ensureVar(ctx, "__shift_low", line);
        const high = ensureVar(ctx, "__shift_high", line);
        const out = [`mov a,${variableTarget(variable)}`, `mov ${variableTarget(low)},a`, `mov a,${variableTarget(variable, 1)}`, `mov ${variableTarget(high)},a`];
        for (let i = 0; i < amount; i++)
            out.push(`mov a,${variableTarget(high)}`, "clr c", "rrc a", `mov ${variableTarget(high)},a`, `mov a,${variableTarget(low)}`, "rrc a", `mov ${variableTarget(low)},a`);
        out.push(`mov a,${variableTarget(low)}`);
        return out;
    }
    if (amount >= 8)
        return ["clr a"];
    const out = emitExprToA(left, ctx, line);
    for (let i = 0; i < amount; i++)
        out.push("clr c", op === "<<" ? "rlc a" : "rrc a");
    return out;
}
function emitApplyBinaryToA(op, rhs, ctx, line) {
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
    const lhsTmp = ensureVar(ctx, "__tmp_lhs", line);
    const rhsTmp = ensureVar(ctx, "__tmp_rhs", line);
    const opcode = op === "&" ? "anl" : op === "|" ? "orl" : op === "^" ? "xrl" : op === "+" ? "add" : "subb";
    const out = [`mov ${variableTarget(lhsTmp)},a`, ...emitExprToA(rhs, ctx, line), `mov ${variableTarget(rhsTmp)},a`, `mov a,${variableTarget(lhsTmp)}`];
    if (op === "-")
        out.push("clr c");
    out.push(`${opcode} a,${variableTarget(rhsTmp)}`);
    return out;
}
function emitConditionFalseJump(cond, falseLabel, ctx, line) {
    const text = trimOuter(cond.trim());
    if (!text)
        return [];
    const constValue = tryEvalConst(text);
    if (constValue != null)
        return constValue ? [] : [`sjmp ${falseLabel}`];
    if (text.startsWith("!")) {
        return emitConditionTrueJump(trimOuter(text.slice(1)), falseLabel, ctx, line);
    }
    const logicalOr = findTopLevelBinaryOperator(text, ["||"]);
    if (logicalOr) {
        const trueLabel = nextLabel(ctx, "or_true");
        return [...emitConditionTrueJump(logicalOr.left, trueLabel, ctx, line), ...emitConditionFalseJump(logicalOr.right, falseLabel, ctx, line), `${trueLabel}:`];
    }
    const logicalAnd = findTopLevelBinaryOperator(text, ["&&"]);
    if (logicalAnd) {
        return [...emitConditionFalseJump(logicalAnd.left, falseLabel, ctx, line), ...emitConditionFalseJump(logicalAnd.right, falseLabel, ctx, line)];
    }
    const bit = resolveVariable(text.toLowerCase(), ctx) ? undefined : ctx.sbitMap.get(text.toLowerCase());
    if (bit)
        return [`jnb ${bit},${falseLabel}`];
    const cmp = findComparator(text);
    if (cmp) {
        const leftBit = ctx.sbitMap.get(cmp.left.toLowerCase());
        const rightConst = tryEvalConst(cmp.right);
        if (leftBit && rightConst != null && (cmp.op === "==" || cmp.op === "!=")) {
            const wantOne = rightConst !== 0;
            if ((cmp.op === "==" && wantOne) || (cmp.op === "!=" && !wantOne))
                return [`jnb ${leftBit},${falseLabel}`];
            return [`jb ${leftBit},${falseLabel}`];
        }
        const leftWide = resolveVariable(trimOuter(cmp.left).toLowerCase(), ctx);
        const rightWide = resolveVariable(trimOuter(cmp.right).toLowerCase(), ctx);
        const leftSfr16 = ctx.sfr16Map.get(trimOuter(cmp.left).toLowerCase());
        const rightSfr16 = ctx.sfr16Map.get(trimOuter(cmp.right).toLowerCase());
        if ((cmp.op === "==" || cmp.op === "!=") && (leftSfr16 || rightSfr16)) {
            return emitWordExpressionEqualityFalseJump(cmp.left, cmp.op, cmp.right, falseLabel, ctx, line);
        }
        if ((cmp.op === "==" || cmp.op === "!=") && leftWide && leftWide.size > 1 && (rightConst != null || rightWide)) {
            return emitWideEqualityFalseJump(leftWide, cmp.op, rightConst, rightWide, falseLabel, ctx);
        }
        if (cmp.op === "==" || cmp.op === "!=") {
            const out = [...emitExprToA(cmp.left, ctx, line)];
            const noteq = nextLabel(ctx, "neq");
            if (rightConst != null) {
                out.push(`cjne a,#${toAsmByte(rightConst)},${noteq}`);
            }
            else {
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
            }
            else {
                out.push(`sjmp ${noteq}_ok`);
                out.push(`sjmp ${falseLabel}`);
                out.push(`${noteq}:`);
                out.push(`${noteq}_ok:`);
            }
            return out;
        }
        const leftVar = resolveVariable(trimOuter(cmp.left).toLowerCase(), ctx);
        const rightVar = resolveVariable(trimOuter(cmp.right).toLowerCase(), ctx);
        const leftConst = tryEvalConst(cmp.left);
        const signedComparison = Boolean(leftVar?.signed || rightVar?.signed || /^\s*-/.test(cmp.left) || /^\s*-/.test(cmp.right));
        const wideComparison = Boolean((leftVar?.size ?? 0) > 1 ||
            (rightVar?.size ?? 0) > 1 ||
            ctx.sfr16Map.has(trimOuter(cmp.left).toLowerCase()) ||
            ctx.sfr16Map.has(trimOuter(cmp.right).toLowerCase()) ||
            (leftConst != null && leftConst > 0xff) ||
            (rightConst != null && rightConst > 0xff));
        if (wideComparison) {
            return emitWideRelationalFalseJump(cmp.left, cmp.op, cmp.right, signedComparison, falseLabel, ctx, line);
        }
        let out;
        if (signedComparison) {
            const lhsTmp = ensureVar(ctx, "__signed_cmp_lhs", line);
            const rhsTmp = ensureVar(ctx, "__signed_cmp_rhs", line);
            out = [
                ...emitExprToA(cmp.left, ctx, line),
                "xrl a,#0x80",
                `mov ${variableTarget(lhsTmp)},a`,
                ...emitExprToA(cmp.right, ctx, line),
                "xrl a,#0x80",
                `mov ${variableTarget(rhsTmp)},a`,
                `mov a,${variableTarget(lhsTmp)}`,
                "clr c",
                `subb a,${variableTarget(rhsTmp)}`,
            ];
        }
        else {
            out = [...emitExprToA(cmp.left, ctx, line)];
            if (rightConst != null) {
                out.push("clr c", `subb a,#${toAsmByte8(rightConst)}`);
            }
            else {
                const rhsTarget = resolveTarget(cmp.right.toLowerCase(), ctx);
                if (rhsTarget) {
                    out.push("clr c", `subb a,${rhsTarget}`);
                }
                else {
                    const tmp = ensureVar(ctx, "__tmp_cmp", line);
                    out.push(...emitExprToA(cmp.right, ctx, line), `mov ${variableTarget(tmp)},a`, ...emitExprToA(cmp.left, ctx, line), "clr c", `subb a,${variableTarget(tmp)}`);
                }
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
function emitWideRelationalFalseJump(leftExpr, op, rightExpr, signed, falseLabel, ctx, line) {
    const lhs = allocateWordTemp(ctx, "wide_rel_lhs", line);
    const rhs = allocateWordTemp(ctx, "wide_rel_rhs", line);
    const trueLabel = nextLabel(ctx, "wide_rel_true");
    const failLabel = nextLabel(ctx, "wide_rel_false");
    const out = [
        ...emitExprToWord(leftExpr, ctx, line),
        `mov ${variableTarget(lhs)},a`,
        `mov ${variableTarget(lhs, 1)},b`,
        ...emitExprToWord(rightExpr, ctx, line),
        `mov ${variableTarget(rhs)},a`,
        `mov ${variableTarget(rhs, 1)},b`,
        `mov a,${variableTarget(lhs, 1)}`,
    ];
    if (signed)
        out.push("xrl a,#0x80");
    out.push(`mov b,a`, `mov a,${variableTarget(rhs, 1)}`);
    if (signed)
        out.push("xrl a,#0x80");
    out.push("xch a,b", "clr c", "subb a,b");
    if (op === "<") {
        out.push(`jc ${trueLabel}`, `jnz ${failLabel}`);
    }
    else if (op === ">=") {
        out.push(`jc ${failLabel}`, `jnz ${trueLabel}`);
    }
    else if (op === ">") {
        out.push(`jc ${failLabel}`, `jnz ${trueLabel}`);
    }
    else {
        out.push(`jc ${trueLabel}`, `jnz ${failLabel}`);
    }
    out.push(`mov a,${variableTarget(lhs)}`, "clr c", `subb a,${variableTarget(rhs)}`);
    if (op === "<") {
        out.push(`jc ${trueLabel}`, `sjmp ${failLabel}`);
    }
    else if (op === ">=") {
        out.push(`jc ${failLabel}`, `sjmp ${trueLabel}`);
    }
    else if (op === ">") {
        out.push(`jc ${failLabel}`, `jz ${failLabel}`, `sjmp ${trueLabel}`);
    }
    else {
        out.push(`jc ${trueLabel}`, `jz ${trueLabel}`, `sjmp ${failLabel}`);
    }
    out.push(`${failLabel}:`, `ljmp ${falseLabel}`, `${trueLabel}:`);
    return out;
}
function emitWideEqualityFalseJump(left, op, rightConstant, right, falseLabel, ctx) {
    const byteCount = Math.max(left.size, right?.size ?? 0, rightConstant != null ? 2 : 0);
    const mismatchLabel = nextLabel(ctx, "wide_cmp_mismatch");
    const doneLabel = nextLabel(ctx, "wide_cmp_done");
    const out = [];
    for (let byte = 0; byte < byteCount; byte++) {
        const leftSource = byte < left.size ? variableTarget(left, byte) : null;
        const rightSource = right && byte < right.size ? variableTarget(right, byte) : null;
        const immediate = rightConstant != null ? toAsmByte8(rightConstant >> (8 * byte)) : null;
        if (leftSource)
            out.push(`mov a,${leftSource}`);
        else
            out.push("clr a");
        if (rightSource)
            out.push(`cjne a,${rightSource},${mismatchLabel}`);
        else
            out.push(`cjne a,#${immediate ?? "0x0"},${mismatchLabel}`);
    }
    if (op === "==") {
        out.push(`sjmp ${doneLabel}`, `${mismatchLabel}:`, `ljmp ${falseLabel}`, `${doneLabel}:`);
    }
    else {
        // For != the condition is false only when every compared byte is equal.
        out.push(`ljmp ${falseLabel}`, `${mismatchLabel}:`);
    }
    return out;
}
function emitWordExpressionEqualityFalseJump(leftExpr, op, rightExpr, falseLabel, ctx, line) {
    const lhs = allocateWordTemp(ctx, "sfr16_cmp_lhs", line);
    const rhs = allocateWordTemp(ctx, "sfr16_cmp_rhs", line);
    const mismatch = nextLabel(ctx, "sfr16_cmp_mismatch");
    const done = nextLabel(ctx, "sfr16_cmp_done");
    const out = [
        ...emitExprToWord(leftExpr, ctx, line),
        `mov ${variableTarget(lhs)},a`,
        `mov ${variableTarget(lhs, 1)},b`,
        ...emitExprToWord(rightExpr, ctx, line),
        `mov ${variableTarget(rhs)},a`,
        `mov ${variableTarget(rhs, 1)},b`,
        `mov a,${variableTarget(lhs)}`,
        `cjne a,${variableTarget(rhs)},${mismatch}`,
        `mov a,${variableTarget(lhs, 1)}`,
        `cjne a,${variableTarget(rhs, 1)},${mismatch}`,
    ];
    if (op === "==")
        out.push(`sjmp ${done}`, `${mismatch}:`, `ljmp ${falseLabel}`, `${done}:`);
    else
        out.push(`ljmp ${falseLabel}`, `${mismatch}:`);
    return out;
}
function emitConditionTrueJump(cond, trueLabel, ctx, line) {
    const text = trimOuter(cond.trim());
    const constant = tryEvalConst(text);
    if (constant != null)
        return constant ? [`sjmp ${trueLabel}`] : [];
    const bit = resolveVariable(text.toLowerCase(), ctx) ? undefined : ctx.sbitMap.get(text.toLowerCase());
    if (bit)
        return [`jb ${bit},${trueLabel}`];
    const falseLabel = nextLabel(ctx, "true_test_false");
    return [...emitConditionFalseJump(text, falseLabel, ctx, line), `sjmp ${trueLabel}`, `${falseLabel}:`];
}
function beginScopedDeclarationBindings(ctx, declarators) {
    const names = new Set();
    for (const raw of splitCsv(declarators)) {
        const match = /^(?:\*\s*)?([A-Za-z_]\w*)/.exec(raw.trim());
        if (match)
            names.add(match[1].toLowerCase());
    }
    const savedVars = new Map();
    const savedPointers = new Map();
    const savedPointerSizes = new Map();
    const savedPointerStructs = new Map();
    const savedPointerConsts = new Map();
    const savedArrays = new Map();
    const savedStructs = new Map();
    for (const name of names) {
        savedVars.set(name, ctx.vars.get(name) ?? null);
        savedPointers.set(name, ctx.pointerVars.get(name) ?? null);
        savedPointerSizes.set(name, ctx.pointerElementSizes.get(name) ?? null);
        savedPointerStructs.set(name, ctx.pointerStructTypes.get(name) ?? null);
        savedPointerConsts.set(name, ctx.pointerPointeeConst.get(name) ?? null);
        savedArrays.set(name, ctx.localArrays.get(name) ?? null);
        savedStructs.set(name, ctx.structVars.get(name) ?? null);
        ctx.vars.delete(name);
        ctx.pointerVars.delete(name);
        ctx.pointerElementSizes.delete(name);
        ctx.pointerStructTypes.delete(name);
        ctx.pointerPointeeConst.delete(name);
        ctx.localArrays.delete(name);
        ctx.structVars.delete(name);
    }
    return () => {
        for (const name of names) {
            restoreMapBinding(ctx.vars, name, savedVars.get(name) ?? null);
            restoreMapBinding(ctx.pointerVars, name, savedPointers.get(name) ?? null);
            restoreMapBinding(ctx.pointerElementSizes, name, savedPointerSizes.get(name) ?? null);
            restoreMapBinding(ctx.pointerStructTypes, name, savedPointerStructs.get(name) ?? null);
            restoreMapBinding(ctx.pointerPointeeConst, name, savedPointerConsts.get(name) ?? null);
            restoreMapBinding(ctx.localArrays, name, savedArrays.get(name) ?? null);
            restoreMapBinding(ctx.structVars, name, savedStructs.get(name) ?? null);
        }
    };
}
function restoreMapBinding(map, name, value) {
    if (value == null)
        map.delete(name);
    else
        map.set(name, value);
}
function ensureVar(ctx, name, line, size = 1) {
    const existing = ctx.vars.get(name);
    if (existing)
        return existing;
    const addr = allocateBlock(ctx, size, line);
    const variable = { name, addr, size };
    ctx.vars.set(name, variable);
    return variable;
}
function variableTarget(variable, byteOffset = 0) {
    return toAsmByte(variable.addr + byteOffset);
}
function resolveVariable(name, ctx) {
    const lowered = name.trim().toLowerCase();
    return ctx.vars.get(lowered) ?? ctx.globalVars.get(lowered) ?? null;
}
function resolveXdataVariable(name, ctx) {
    const lowered = name.trim().toLowerCase();
    return ctx.xdataVars.get(lowered) ?? ctx.globalXdataVars.get(lowered) ?? null;
}
function resolveXdataArrayAddress(expr, ctx) {
    const text = trimOuter(expr.trim());
    const direct = ctx.xdataArrays.get(text.toLowerCase());
    if (direct)
        return direct.baseAddr;
    const indexed = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
    if (!indexed)
        return null;
    const array = ctx.xdataArrays.get(indexed[1].toLowerCase());
    const index = tryEvalConst(indexed[2]);
    return array && index != null ? array.baseAddr + normalizedArrayOffset(index, array) : null;
}
function resolveTarget(name, ctx) {
    const lowered = name.trim().toLowerCase();
    const variable = resolveVariable(lowered, ctx);
    if (variable)
        return variableTarget(variable);
    if (/^0x[0-9a-f]+$/i.test(lowered))
        return lowered;
    if (ctx.sfrMap.has(lowered))
        return lowered;
    if (REGISTER_SET.has(lowered))
        return lowered;
    return null;
}
function resolveOrCreateTarget(name, ctx, line) {
    const existing = resolveTarget(name, ctx);
    if (existing)
        return existing;
    if (/^[A-Za-z_]\w*$/.test(name) && !ctx.functions.has(name) && !ctx.arrays.has(name)) {
        return variableTarget(ensureVar(ctx, name, line));
    }
    return null;
}
function cUserLabel(ctx, name) {
    const safe = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return `__c_user_${ctx.currentFunction.name}_${safe}`;
}
function nextLabel(ctx, prefix) {
    return `__${prefix}_${ctx.labelCounter.value++}`;
}
function allocateBlock(ctx, length, line) {
    const base = ctx.nextVarAddr.value;
    ctx.nextVarAddr.value += Math.max(1, length);
    if (ctx.nextVarAddr.value > 0x80) {
        ctx.diagnostics.push({ level: "error", line, message: "Out of local variable storage (IRAM 0x30..0x7F)." });
    }
    return base;
}
function allocateXdataBlock(ctx, length, line, label) {
    const base = ctx.nextXdataAddr.value;
    ctx.nextXdataAddr.value += Math.max(1, length);
    if (ctx.nextXdataAddr.value > XDATA_LIMIT) {
        ctx.diagnostics.push({ level: "error", line, message: `${label} exceeds ADuC841 XDATA 0x0000..0x07FF.` });
    }
    return base;
}
function allocateGlobalXdataBlock(nextXdataAddr, length, diagnostics, label) {
    const base = nextXdataAddr.value;
    nextXdataAddr.value += Math.max(1, length);
    if (nextXdataAddr.value > XDATA_LIMIT)
        diagnostics.push({ level: "error", message: `${label} exceeds ADuC841 XDATA 0x0000..0x07FF.` });
    return base;
}
function allocateFunctionParams(functions, structDefs, nextVarAddr, diagnostics) {
    for (const fn of functions.values()) {
        let offset = 0;
        for (const param of fn.params) {
            const size = param.structName && !param.pointer
                ? Math.max(1, structDefs.get(param.structName)?.size ?? 1)
                : (param.size ?? (param.pointer ? pointerStorageSize(param.pointerKind ?? "ram") : 1));
            param.argOffset = offset;
            param.size = size;
            param.argAddr = nextVarAddr.value;
            nextVarAddr.value += size;
            offset += size;
            if (nextVarAddr.value > 0x80)
                diagnostics.push({ level: "error", message: `Parameters of ${fn.name} exceed internal RAM 0x30..0x7F.` });
        }
    }
}
function bindFunctionParams(fn, ctx, diagnostics) {
    for (const param of fn.params) {
        const addr = param.argAddr;
        if (addr == null) {
            diagnostics.push({ level: "error", message: `Internal parameter allocation failed for ${fn.name}.${param.name}.` });
            continue;
        }
        const size = param.size ?? 1;
        if (param.structName && !param.pointer) {
            ctx.structVars.set(param.name, { name: param.name, structName: param.structName, baseAddr: addr, storage: "ram", elementCount: 1 });
            continue;
        }
        ctx.vars.set(param.name, { name: param.name, addr, size, signed: param.signed });
        if (param.pointer) {
            ctx.pointerVars.set(param.name, param.pointerKind ?? "ram");
            ctx.pointerElementSizes.set(param.name, param.pointeeSize ?? (param.structName ? Math.max(1, ctx.structDefs.get(param.structName)?.size ?? 1) : 1));
            if (param.structName)
                ctx.pointerStructTypes.set(param.name, param.structName);
            ctx.pointerPointeeConst.set(param.name, param.pointerPointeeConst === true || (param.pointerKind ?? "ram") === "code");
        }
    }
}
function parseParamList(raw, diagnostics, line) {
    const text = raw.trim();
    if (!text || /^void$/i.test(text))
        return [];
    const params = [];
    for (const part of splitCsv(text)) {
        const item = part.trim();
        const structDeclaration = parseStructDeclarationText(item);
        if (structDeclaration) {
            const pointer = /^\*\s*([A-Za-z_]\w*)$/.exec(structDeclaration.declarators);
            const scalarStruct = /^([A-Za-z_]\w*)$/.exec(structDeclaration.declarators);
            if (pointer) {
                const kind = pointerKindFromHeader(structDeclaration.header);
                params.push({
                    name: pointer[1].toLowerCase(),
                    pointer: true,
                    structName: structDeclaration.structName,
                    pointerKind: kind,
                    pointerPointeeConst: structDeclaration.isConst || kind === "code",
                    size: pointerStorageSize(kind),
                });
                continue;
            }
            if (scalarStruct) {
                params.push({ name: scalarStruct[1].toLowerCase(), pointer: false, structName: structDeclaration.structName });
                continue;
            }
            diagnostics.push({ level: "error", line, message: `Unsupported structure parameter: ${item}` });
            continue;
        }
        const pointer = /^(.*?)\*\s*([A-Za-z_]\w*)$/i.exec(item);
        if (pointer) {
            const header = pointer[1].toLowerCase();
            const kind = pointerKindFromHeader(header);
            const pointee = scalarTypeInfo(header);
            if (pointee?.unsupportedReason)
                diagnostics.push({ level: "error", line, message: `${pointer[2]}: ${pointee.unsupportedReason}` });
            params.push({
                name: pointer[2].toLowerCase(),
                pointer: true,
                pointerKind: kind,
                size: pointerStorageSize(kind),
                pointeeSize: Math.max(1, pointee?.size ?? 1),
                signed: false,
            });
            continue;
        }
        const scalar = /^(.*?)\b([A-Za-z_]\w*)$/i.exec(item);
        if (scalar) {
            const header = scalar[1].toLowerCase();
            const type = scalarTypeInfo(header);
            if (!type)
                continue;
            if (type.unsupportedReason)
                diagnostics.push({ level: "error", line, message: `${scalar[2]}: ${type.unsupportedReason}` });
            params.push({ name: scalar[2].toLowerCase(), pointer: false, size: type.size, signed: type.signed });
        }
    }
    return params;
}
function splitStructMemberPath(path) {
    const parts = [];
    let current = "";
    let bracketDepth = 0;
    for (const char of path) {
        if (char === "[")
            bracketDepth++;
        else if (char === "]")
            bracketDepth--;
        if (char === "." && bracketDepth === 0) {
            parts.push(current.trim());
            current = "";
        }
        else
            current += char;
    }
    if (current.trim())
        parts.push(current.trim());
    return parts;
}
function resolveStructAccess(expr, ctx, line, report = true) {
    const text = trimOuter(expr.trim());
    let rootName = "";
    let rootIndex = null;
    let memberPath = "";
    let pointerRoot = false;
    const arrow = /^([A-Za-z_]\w*)\s*->\s*([\s\S]+)$/.exec(text);
    const indexed = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\.\s*([\s\S]+)$/.exec(text);
    const direct = /^([A-Za-z_]\w*)\s*\.\s*([\s\S]+)$/.exec(text);
    if (arrow) {
        rootName = arrow[1].toLowerCase();
        memberPath = arrow[2];
        pointerRoot = true;
    }
    else if (indexed) {
        rootName = indexed[1].toLowerCase();
        rootIndex = indexed[2];
        memberPath = indexed[3];
        pointerRoot = ctx.pointerStructTypes.has(rootName);
    }
    else if (direct) {
        rootName = direct[1].toLowerCase();
        memberPath = direct[2];
    }
    else
        return null;
    let structName = "";
    let storage = "ram";
    let baseAddr;
    let pointer;
    let isConst = false;
    const terms = [];
    let constantOffset = 0;
    if (pointerRoot) {
        structName = ctx.pointerStructTypes.get(rootName) ?? "";
        const kind = ctx.pointerVars.get(rootName);
        pointer = resolveVariable(rootName, ctx) ?? undefined;
        if (!structName || !kind || !pointer)
            return null;
        if (kind === "pdata" || kind === "far") {
            if (report)
                ctx.diagnostics.push({ level: "error", line, message: `Dereferencing a ${kind} structure pointer is not implemented.` });
            return null;
        }
        storage = kind === "code" ? "code" : kind === "xdata" ? "xdata" : "ram";
        isConst = ctx.pointerPointeeConst.get(rootName) === true || storage === "code";
        if (rootIndex)
            terms.push({ expression: rootIndex, stride: Math.max(1, ctx.pointerElementSizes.get(rootName) ?? 1) });
    }
    else {
        const object = ctx.structVars.get(rootName);
        if (!object)
            return null;
        structName = object.structName;
        storage = object.storage;
        baseAddr = object.baseAddr;
        isConst = object.isConst === true || storage === "code";
        const def = ctx.structDefs.get(structName);
        if (!def)
            return null;
        if (rootIndex) {
            if (object.elementCount <= 1) {
                if (report)
                    ctx.diagnostics.push({ level: "error", line, message: `${rootName} is not an array of structures.` });
                return null;
            }
            const constant = tryEvalConst(rootIndex);
            if (constant != null) {
                if (constant < 0 || constant >= object.elementCount) {
                    if (report)
                        ctx.diagnostics.push({ level: "error", line, message: `Structure array index ${constant} is outside ${rootName}[0..${object.elementCount - 1}].` });
                    return null;
                }
                constantOffset += constant * def.size;
            }
            else
                terms.push({ expression: rootIndex, stride: def.size });
        }
        else if (object.elementCount > 1) {
            if (report)
                ctx.diagnostics.push({ level: "error", line, message: `Structure array ${rootName} requires an index before member access.` });
            return null;
        }
    }
    let current = ctx.structDefs.get(structName);
    if (!current)
        return null;
    const parts = splitStructMemberPath(memberPath);
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
        const segment = /^([A-Za-z_]\w*)(?:\s*\[\s*([^\]]+)\s*\])?$/.exec(parts[partIndex]);
        if (!segment)
            return null;
        const field = current.fields.find((candidate) => candidate.name === segment[1].toLowerCase());
        if (!field) {
            if (report)
                ctx.diagnostics.push({ level: "error", line, message: `Struct ${current.name} has no field named ${segment[1]}.` });
            return null;
        }
        constantOffset += field.offset;
        const fieldIndex = segment[2] ?? null;
        if (fieldIndex) {
            if (field.elementCount <= 1) {
                if (report)
                    ctx.diagnostics.push({ level: "error", line, message: `Field ${current.name}.${field.name} is not an array.` });
                return null;
            }
            const constant = tryEvalConst(fieldIndex);
            if (constant != null) {
                if (constant < 0 || constant >= field.elementCount) {
                    if (report)
                        ctx.diagnostics.push({ level: "error", line, message: `Field index ${constant} is outside ${current.name}.${field.name}[0..${field.elementCount - 1}].` });
                    return null;
                }
                constantOffset += constant * field.elementSize;
            }
            else
                terms.push({ expression: fieldIndex, stride: field.elementSize });
        }
        else if (field.elementCount > 1 && partIndex < parts.length - 1) {
            if (report)
                ctx.diagnostics.push({ level: "error", line, message: `Array field ${current.name}.${field.name} requires an index.` });
            return null;
        }
        const last = partIndex === parts.length - 1;
        if (last) {
            const aggregate = Boolean(field.structName) || (!fieldIndex && field.elementCount > 1);
            return {
                storage,
                size: fieldIndex ? field.elementSize : field.size,
                signed: field.signed,
                isArray: aggregate,
                isConst,
                baseAddr,
                pointer,
                constantOffset,
                terms,
            };
        }
        if (!field.structName) {
            if (report)
                ctx.diagnostics.push({ level: "error", line, message: `Scalar field ${current.name}.${field.name} has no nested members.` });
            return null;
        }
        const nested = ctx.structDefs.get(field.structName);
        if (!nested)
            return null;
        current = nested;
    }
    return null;
}
function emitScaledIndexToWord(index, stride, ctx, line) {
    const constant = tryEvalConst(index);
    if (constant != null) {
        const value = (constant * stride) & 0xffff;
        return [`mov a,#${toAsmByte8(value)}`, `mov b,#${toAsmByte8(value >> 8)}`];
    }
    if (stride <= 0xff) {
        const out = emitExprToA(index, ctx, line);
        if (stride === 1)
            return [...out, "mov b,#0x0"];
        return [...out, `mov b,#${toAsmByte8(stride)}`, "mul ab"];
    }
    const count = ensureVar(ctx, "__struct_scale_count", line);
    const low = ensureVar(ctx, "__struct_scale_low", line);
    const high = ensureVar(ctx, "__struct_scale_high", line);
    const loop = nextLabel(ctx, "struct_scale_loop");
    const done = nextLabel(ctx, "struct_scale_done");
    return [
        ...emitExprToA(index, ctx, line),
        `mov ${variableTarget(count)},a`,
        `mov ${variableTarget(low)},#0x0`,
        `mov ${variableTarget(high)},#0x0`,
        `${loop}:`,
        `mov a,${variableTarget(count)}`,
        `jz ${done}`,
        `mov a,${variableTarget(low)}`,
        `add a,#${toAsmByte8(stride)}`,
        `mov ${variableTarget(low)},a`,
        `mov a,${variableTarget(high)}`,
        `addc a,#${toAsmByte8(stride >> 8)}`,
        `mov ${variableTarget(high)},a`,
        `dec ${variableTarget(count)}`,
        `sjmp ${loop}`,
        `${done}:`,
        `mov a,${variableTarget(low)}`,
        `mov b,${variableTarget(high)}`,
    ];
}
function emitStructAddressToWord(access, ctx, line) {
    if (access.baseAddr != null && access.terms.length === 0) {
        const address = access.baseAddr + access.constantOffset;
        return [`mov a,#${toAsmByte8(address)}`, `mov b,#${toAsmByte8(address >> 8)}`];
    }
    const addrLow = ensureVar(ctx, "__struct_addr_low", line);
    const addrHigh = ensureVar(ctx, "__struct_addr_high", line);
    const prodLow = ensureVar(ctx, "__struct_product_low", line);
    const prodHigh = ensureVar(ctx, "__struct_product_high", line);
    const out = [];
    if (access.baseAddr != null) {
        out.push(`mov ${variableTarget(addrLow)},#${toAsmByte8(access.baseAddr)}`, `mov ${variableTarget(addrHigh)},#${toAsmByte8(access.baseAddr >> 8)}`);
    }
    else if (access.pointer) {
        out.push(`mov a,${variableTarget(access.pointer)}`, `mov ${variableTarget(addrLow)},a`);
        if (access.pointer.size >= 2)
            out.push(`mov a,${variableTarget(access.pointer, 1)}`, `mov ${variableTarget(addrHigh)},a`);
        else
            out.push(`mov ${variableTarget(addrHigh)},#0x0`);
    }
    else
        return ["clr a", "mov b,#0x0"];
    for (const term of access.terms) {
        out.push(...emitScaledIndexToWord(term.expression, term.stride, ctx, line), `mov ${variableTarget(prodLow)},a`, `mov ${variableTarget(prodHigh)},b`, `mov a,${variableTarget(addrLow)}`, `add a,${variableTarget(prodLow)}`, `mov ${variableTarget(addrLow)},a`, `mov a,${variableTarget(addrHigh)}`, `addc a,${variableTarget(prodHigh)}`, `mov ${variableTarget(addrHigh)},a`);
    }
    if (access.constantOffset) {
        out.push(`mov a,${variableTarget(addrLow)}`, `add a,#${toAsmByte8(access.constantOffset)}`, `mov ${variableTarget(addrLow)},a`, `mov a,${variableTarget(addrHigh)}`, `addc a,#${toAsmByte8(access.constantOffset >> 8)}`, `mov ${variableTarget(addrHigh)},a`);
    }
    out.push(`mov a,${variableTarget(addrLow)}`, `mov b,${variableTarget(addrHigh)}`);
    return out;
}
function emitLoadStructAccess(access, ctx, line, asWord) {
    if (access.isArray) {
        ctx.diagnostics.push({ level: "error", line, message: "A structure or array member cannot be used as a scalar value." });
        return asWord ? ["clr a", "mov b,#0x0"] : ["clr a"];
    }
    const width = Math.min(2, access.size);
    if (access.baseAddr != null && access.terms.length === 0) {
        const address = access.baseAddr + access.constantOffset;
        if (access.storage === "ram") {
            if (width >= 2)
                return [`mov a,${toAsmByte(address)}`, `mov b,${toAsmByte(address + 1)}`];
            const out = [`mov a,${toAsmByte(address)}`];
            return asWord ? [...out, ...emitSignOrZeroExtendA(access.signed, ctx)] : out;
        }
        if (access.storage === "xdata") {
            if (width >= 2)
                return emitLoadWordFromXdataAddress(address);
            const out = emitLoadByteFromXdataAddress(address);
            return asWord ? [...out, ...emitSignOrZeroExtendA(access.signed, ctx)] : out;
        }
        ctx.diagnostics.push({ level: "error", line, message: "Direct code structure objects are not implemented." });
        return asWord ? ["clr a", "mov b,#0x0"] : ["clr a"];
    }
    const out = emitStructAddressToWord(access, ctx, line);
    if (access.storage === "ram") {
        out.push("mov r0,a", "mov a,@r0");
        if (width >= 2)
            out.push("mov b,a", "inc r0", "mov a,@r0", "xch a,b");
        else if (asWord)
            out.push(...emitSignOrZeroExtendA(access.signed, ctx));
        return out;
    }
    out.push("mov dpl,a", "mov dph,b");
    if (access.storage === "xdata") {
        out.push("movx a,@dptr");
        if (width >= 2)
            out.push("mov b,a", "inc dptr", "movx a,@dptr", "xch a,b");
        else if (asWord)
            out.push(...emitSignOrZeroExtendA(access.signed, ctx));
        return out;
    }
    out.push("clr a", "movc a,@a+dptr");
    if (width >= 2)
        out.push("mov b,a", "inc dptr", "clr a", "movc a,@a+dptr", "xch a,b");
    else if (asWord)
        out.push(...emitSignOrZeroExtendA(access.signed, ctx));
    return out;
}
function emitSignOrZeroExtendA(signed, ctx) {
    if (!signed)
        return ["mov b,#0x0"];
    const positive = nextLabel(ctx, "struct_sign_positive");
    const done = nextLabel(ctx, "struct_sign_done");
    return [`jnb acc.7,${positive}`, "mov b,#0xff", `sjmp ${done}`, `${positive}:`, "mov b,#0x0", `${done}:`];
}
function emitStoreStructAccess(access, rhs, ctx, line) {
    if (access.isArray) {
        ctx.diagnostics.push({ level: "error", line, message: "Assigning a complete structure or array member is not implemented." });
        return [];
    }
    if (access.isConst || access.storage === "code") {
        ctx.diagnostics.push({ level: "error", line, message: "Writing through a const/code structure object or pointer is not allowed." });
        return [];
    }
    const word = access.size >= 2;
    if (access.baseAddr != null && access.terms.length === 0) {
        const address = access.baseAddr + access.constantOffset;
        if (access.storage === "ram") {
            if (word)
                return [...emitExprToWord(rhs, ctx, line), `mov ${toAsmByte(address)},a`, `mov ${toAsmByte(address + 1)},b`];
            return emitAssignToTarget(toAsmByte(address), rhs, ctx, line);
        }
        if (word)
            return [...emitExprToWord(rhs, ctx, line), ...emitStoreWordToXdataAddress(address)];
        return [...emitExprToA(rhs, ctx, line), ...emitStoreByteToXdataAddress(address)];
    }
    const out = word
        ? [...emitExprToWord(rhs, ctx, line), "push acc", "push b"]
        : [...emitExprToA(rhs, ctx, line), "push acc"];
    out.push(...emitStructAddressToWord(access, ctx, line));
    if (access.storage === "ram")
        out.push("mov r0,a");
    else
        out.push("mov dpl,a", "mov dph,b");
    if (word)
        out.push("pop b", "pop acc");
    else
        out.push("pop acc");
    if (access.storage === "ram") {
        out.push("mov @r0,a");
        if (word)
            out.push("inc r0", "mov a,b", "mov @r0,a");
    }
    else {
        out.push("movx @dptr,a");
        if (word)
            out.push("inc dptr", "mov a,b", "movx @dptr,a");
    }
    return out;
}
function resolveAddressExpression(expr, ctx) {
    const text = trimOuter(expr.trim());
    const xdataVariable = resolveXdataVariable(text.toLowerCase(), ctx);
    if (xdataVariable)
        return xdataVariable.addr;
    const direct = resolveTarget(text.toLowerCase(), ctx);
    if (direct?.startsWith("0x"))
        return Number.parseInt(direct, 16);
    const structVar = ctx.structVars.get(text.toLowerCase());
    if (structVar && structVar.elementCount === 1)
        return structVar.baseAddr;
    const structElement = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(text);
    if (structElement) {
        const object = ctx.structVars.get(structElement[1].toLowerCase());
        const index = tryEvalConst(structElement[2]);
        const def = object ? ctx.structDefs.get(object.structName) : undefined;
        if (object && def && index != null && index >= 0 && index < object.elementCount)
            return object.baseAddr + index * def.size;
    }
    const access = resolveStructAccess(text, ctx, 0, false);
    if (access?.baseAddr != null && access.terms.length === 0)
        return access.baseAddr + access.constantOffset;
    const xdataArr = ctx.xdataArrays.get(text.toLowerCase());
    if (xdataArr)
        return xdataArr.baseAddr;
    const localArr = ctx.localArrays.get(text.toLowerCase());
    if (localArr)
        return localArr.baseAddr;
    const idx = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
    if (idx) {
        const xdata = ctx.xdataArrays.get(idx[1].toLowerCase());
        const local = ctx.localArrays.get(idx[1].toLowerCase());
        const constIndex = tryEvalConst(idx[2]);
        if (xdata && constIndex != null)
            return xdata.baseAddr + normalizedArrayOffset(constIndex, xdata);
        if (local && constIndex != null)
            return local.baseAddr + normalizedArrayOffset(constIndex, local);
    }
    return null;
}
function emitStoreToLValue(lhs, rhs, ctx, line) {
    const directXdata = resolveXdataVariable(trimOuter(lhs).toLowerCase(), ctx);
    if (directXdata)
        return emitAssignToXdataVariable(directXdata, rhs, ctx, line);
    const structAccess = resolveStructAccess(lhs, ctx, line, true);
    if (structAccess)
        return emitStoreStructAccess(structAccess, rhs, ctx, line);
    const ptrDeref = /^\*\s*([A-Za-z_]\w*)$/.exec(trimOuter(lhs));
    if (ptrDeref) {
        const ptrName = ptrDeref[1].toLowerCase();
        const ptr = resolveTarget(ptrName, ctx);
        const kind = ctx.pointerVars.get(ptrName);
        if (ctx.pointerPointeeConst.get(ptrName)) {
            ctx.diagnostics.push({ level: "error", line, message: "Writing through a const/code pointer is not allowed." });
            return [];
        }
        if (kind === "pdata" || kind === "far") {
            ctx.diagnostics.push({
                level: "error",
                line,
                message: `Dereferencing a ${kind} pointer is not implemented; MOVX/generic-pointer lowering is required.`,
            });
            return [];
        }
        if (ptr && kind === "ram") {
            if ((ctx.pointerElementSizes.get(ptrName) ?? 1) >= 2) {
                return [...emitExprToWord(rhs, ctx, line), "push acc", `mov a,${ptr}`, "mov r0,a", "pop acc", "mov @r0,a", "inc r0", "mov a,b", "mov @r0,a"];
            }
            return [...emitExprToA(rhs, ctx, line), "mov b,a", `mov a,${ptr}`, "mov r0,a", "mov a,b", "mov @r0,a"];
        }
        if (kind === "xdata") {
            const variable = resolveVariable(ptrName, ctx);
            if (variable) {
                if ((ctx.pointerElementSizes.get(ptrName) ?? 1) >= 2) {
                    return [...emitExprToWord(rhs, ctx, line), `mov dpl,${variableTarget(variable)}`, `mov dph,${variableTarget(variable, 1)}`, "movx @dptr,a", "inc dptr", "mov a,b", "movx @dptr,a"];
                }
                return [...emitExprToA(rhs, ctx, line), `mov dpl,${variableTarget(variable)}`, `mov dph,${variableTarget(variable, 1)}`, "movx @dptr,a"];
            }
        }
        if (kind === "code") {
            ctx.diagnostics.push({ level: "error", line, message: "Writing through a code pointer is not allowed." });
            return [];
        }
    }
    const localArr = /^([A-Za-z_]\w*)\s*\[\s*([^\[\]]+)\s*\]$/.exec(trimOuter(lhs));
    if (localArr) {
        const xdataArr = ctx.xdataArrays.get(localArr[1].toLowerCase());
        if (xdataArr)
            return emitXdataArrayStore(xdataArr, localArr[2], rhs, ctx, line);
        const arr = ctx.localArrays.get(localArr[1].toLowerCase());
        if (arr) {
            const idxConst = tryEvalConst(localArr[2]);
            if (idxConst != null) {
                const address = arr.baseAddr + normalizedArrayOffset(idxConst, arr);
                if (arr.elementSize >= 2)
                    return [...emitExprToWord(rhs, ctx, line), `mov ${toAsmByte(address)},a`, `mov ${toAsmByte(address + 1)},b`];
                return emitAssignToTarget(toAsmByte(address), rhs, ctx, line);
            }
            if (arr.elementSize >= 2) {
                return [
                    ...emitExprToWord(rhs, ctx, line),
                    "push acc",
                    ...emitScaledIndexToA(localArr[2], arr.elementSize, ctx, line),
                    `add a,#${toAsmByte8(arr.baseAddr)}`,
                    "mov r0,a",
                    "pop acc",
                    "mov @r0,a",
                    "inc r0",
                    "mov a,b",
                    "mov @r0,a",
                ];
            }
            return [
                ...emitExprToA(rhs, ctx, line),
                "mov b,a",
                ...emitScaledIndexToA(localArr[2], arr.elementSize, ctx, line),
                `add a,#${toAsmByte8(arr.baseAddr)}`,
                "mov r0,a",
                "mov a,b",
                "mov @r0,a",
            ];
        }
        const pointerName = localArr[1].toLowerCase();
        const pointer = resolveVariable(pointerName, ctx);
        const kind = ctx.pointerVars.get(pointerName);
        if (pointer && kind) {
            if (ctx.pointerPointeeConst.get(pointerName)) {
                ctx.diagnostics.push({ level: "error", line, message: "Writing through a const/code pointer is not allowed." });
                return [];
            }
            if (kind === "code") {
                ctx.diagnostics.push({ level: "error", line, message: "Writing through a code pointer is not allowed." });
                return [];
            }
            if (kind === "pdata" || kind === "far") {
                ctx.diagnostics.push({ level: "error", line, message: `Indexed writes through a ${kind} pointer are not implemented.` });
                return [];
            }
            const word = (ctx.pointerElementSizes.get(pointerName) ?? 1) >= 2;
            const out = word
                ? [...emitExprToWord(rhs, ctx, line), "push acc", "push b"]
                : [...emitExprToA(rhs, ctx, line), "push acc"];
            out.push(...emitScaledIndexToA(localArr[2], ctx.pointerElementSizes.get(pointerName) ?? 1, ctx, line));
            if (kind === "ram")
                out.push(`mov r1,${variableTarget(pointer)}`, "add a,r1", "mov r0,a");
            else
                out.push(`mov r1,${variableTarget(pointer)}`, "add a,r1", "mov dpl,a", "clr a", `mov r1,${variableTarget(pointer, 1)}`, "addc a,r1", "mov dph,a");
            if (word)
                out.push("pop b", "pop acc");
            else
                out.push("pop acc");
            if (kind === "ram") {
                out.push("mov @r0,a");
                if (word)
                    out.push("inc r0", "mov a,b", "mov @r0,a");
            }
            else {
                out.push("movx @dptr,a");
                if (word)
                    out.push("inc dptr", "mov a,b", "movx @dptr,a");
            }
            return out;
        }
    }
    return null;
}
function emitFunctionCall(name, rawArgs, ctx, line) {
    const fn = ctx.functions.get(name);
    if (!fn)
        return ["mov a,#0"];
    const out = [];
    const argItems = rawArgs.trim() ? splitCsv(rawArgs).map((item) => item.trim()) : [];
    if (argItems.length > fn.params.length) {
        ctx.diagnostics.push({ level: "warning", line, message: `Too many arguments for ${name}()` });
    }
    for (let i = 0; i < Math.min(argItems.length, fn.params.length); i++) {
        const param = fn.params[i];
        const arg = argItems[i];
        const base = param.argAddr ?? (ARG_BASE + (param.argOffset ?? i));
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
        if ((param.size ?? 1) >= 2) {
            out.push(...emitExprToWord(arg, ctx, line), `mov ${toAsmByte(base)},a`, `mov ${toAsmByte(base + 1)},b`);
            for (let byte = 2; byte < (param.size ?? 1); byte++)
                out.push(`mov ${toAsmByte(base + byte)},#0`);
        }
        else {
            out.push(...emitAssignToTarget(toAsmByte(base), arg, ctx, line));
        }
    }
    out.push(`call ${name}`);
    return out;
}
function transpileSwitchStatement(switchExpr, body, statement, lineOffset, ctx, line) {
    const parsed = parseSwitchCases(body, line, ctx.diagnostics);
    const selectorSize = switchExpressionSize(switchExpr, ctx);
    const wide = selectorSize > 1 || parsed.some((item) => item.kind === "case" && item.value != null && item.value > 0xff);
    const tmp = ensureVar(ctx, `__switch_value_${ctx.labelCounter.value++}`, line, wide ? 2 : 1);
    const endLabel = nextLabel(ctx, "switch_end");
    const out = wide
        ? [...emitExprToWord(switchExpr, ctx, line), `mov ${variableTarget(tmp)},a`, `mov ${variableTarget(tmp, 1)},b`]
        : [...emitExprToA(switchExpr, ctx, line), `mov ${variableTarget(tmp)},a`];
    let needDelay = false;
    let needWrite = false;
    const labels = parsed.map((item) => nextLabel(ctx, item.kind === "case" ? "case" : "default"));
    const defaultIndex = parsed.findIndex((item) => item.kind === "default" && item.dispatchable);
    const defaultLabel = defaultIndex >= 0 ? labels[defaultIndex] : endLabel;
    ctx.flowStack.push({ breakLabel: endLabel });
    parsed.forEach((item, index) => {
        if (item.kind !== "case" || item.value == null || !item.dispatchable)
            return;
        const next = nextLabel(ctx, "case_next");
        out.push(`mov a,${variableTarget(tmp)}`, `cjne a,#${toAsmByte8(item.value)},${next}`);
        if (wide)
            out.push(`mov a,${variableTarget(tmp, 1)}`, `cjne a,#${toAsmByte8(item.value >> 8)},${next}`);
        out.push(`ljmp ${labels[index]}`, `${next}:`);
    });
    out.push(`ljmp ${defaultLabel}`);
    parsed.forEach((item, index) => {
        out.push(`${labels[index]}:`);
        for (const stmt of splitStatements(item.body)) {
            const translated = transpileStatement(stmt, lineOffset + statement.line + item.relativeLine - 1, ctx);
            out.push(...translated.code);
            needDelay || (needDelay = translated.needDelay);
            needWrite || (needWrite = translated.needWrite);
        }
    });
    ctx.flowStack.pop();
    out.push(`${endLabel}:`);
    return { code: out, needDelay, needWrite };
}
function parseSwitchCases(body, baseLine, diagnostics) {
    const markers = findSwitchMarkers(body, baseLine, diagnostics);
    const seenValues = new Map();
    let seenDefaultLine = null;
    const parsed = [];
    for (let index = 0; index < markers.length; index++) {
        const marker = markers[index];
        const bodyEnd = index + 1 < markers.length ? markers[index + 1].start : body.length;
        const itemBody = body.slice(marker.bodyStart, bodyEnd).trim();
        if (marker.kind === "default") {
            const dispatchable = seenDefaultLine == null;
            if (!dispatchable) {
                diagnostics.push({
                    level: "error",
                    line: baseLine + marker.relativeLine - 1,
                    message: `Duplicate default label; first default is on line ${seenDefaultLine}.`,
                });
            }
            else {
                seenDefaultLine = baseLine + marker.relativeLine - 1;
            }
            parsed.push({ kind: "default", body: itemBody, relativeLine: marker.relativeLine, dispatchable });
            continue;
        }
        const value = tryEvalConst(marker.rawValue ?? "");
        if (value == null) {
            diagnostics.push({
                level: "error",
                line: baseLine + marker.relativeLine - 1,
                message: `switch case must be an integer constant expression: ${marker.rawValue?.trim() || "<empty>"}`,
            });
            parsed.push({ kind: "case", body: itemBody, relativeLine: marker.relativeLine, dispatchable: false });
            continue;
        }
        const normalized = value & 0xffff;
        const previousLine = seenValues.get(normalized);
        const dispatchable = previousLine == null;
        if (!dispatchable) {
            diagnostics.push({
                level: "error",
                line: baseLine + marker.relativeLine - 1,
                message: `Duplicate switch case value ${normalized}; first used on line ${previousLine}.`,
            });
        }
        else {
            seenValues.set(normalized, baseLine + marker.relativeLine - 1);
        }
        parsed.push({ kind: "case", value: normalized, body: itemBody, relativeLine: marker.relativeLine, dispatchable });
    }
    return parsed;
}
function findSwitchMarkers(body, baseLine, diagnostics) {
    const mask = lexicalCodeMask(body);
    const markers = [];
    let braceDepth = 0;
    for (let index = 0; index < body.length; index++) {
        if (!mask[index])
            continue;
        const ch = body[index];
        if (ch === "{") {
            braceDepth++;
            continue;
        }
        if (ch === "}") {
            braceDepth = Math.max(0, braceDepth - 1);
            continue;
        }
        if (braceDepth !== 0 || !/[A-Za-z_]/.test(ch))
            continue;
        const identifier = /^[A-Za-z_]\w*/.exec(body.slice(index))?.[0] ?? "";
        const keyword = identifier.toLowerCase();
        if (keyword !== "case" && keyword !== "default") {
            index += Math.max(0, identifier.length - 1);
            continue;
        }
        const relativeLine = body.slice(0, index).split("\n").length;
        if (keyword === "default") {
            let cursor = skipWhitespace(body, index + identifier.length);
            if (body[cursor] !== ":") {
                diagnostics.push({ level: "error", line: baseLine + relativeLine - 1, message: "default label requires a colon." });
                index += identifier.length - 1;
                continue;
            }
            markers.push({ kind: "default", start: index, bodyStart: cursor + 1, relativeLine });
            index = cursor;
            continue;
        }
        const expressionStart = skipWhitespace(body, index + identifier.length);
        const colon = findSwitchCaseColon(body, expressionStart, mask);
        if (colon < 0) {
            diagnostics.push({ level: "error", line: baseLine + relativeLine - 1, message: "case label requires a colon." });
            break;
        }
        markers.push({
            kind: "case",
            start: index,
            bodyStart: colon + 1,
            rawValue: body.slice(expressionStart, colon).trim(),
            relativeLine,
        });
        index = colon;
    }
    return markers;
}
function findSwitchCaseColon(body, start, mask) {
    let paren = 0;
    let bracket = 0;
    let ternary = 0;
    for (let index = start; index < body.length; index++) {
        if (!mask[index])
            continue;
        const ch = body[index];
        if (ch === "(")
            paren++;
        else if (ch === ")")
            paren--;
        else if (ch === "[")
            bracket++;
        else if (ch === "]")
            bracket--;
        else if (paren === 0 && bracket === 0 && ch === "?")
            ternary++;
        else if (paren === 0 && bracket === 0 && ch === ":") {
            if (ternary > 0)
                ternary--;
            else
                return index;
        }
    }
    return -1;
}
function switchExpressionSize(expression, ctx) {
    const text = trimOuter(expression).toLowerCase();
    const variable = resolveVariable(text, ctx);
    if (variable)
        return variable.size;
    const xdataVariable = resolveXdataVariable(text, ctx);
    if (xdataVariable)
        return xdataVariable.size;
    if (ctx.sfr16Map.has(text))
        return 2;
    const cast = peelLeadingScalarCasts(expression);
    if (cast.type)
        return cast.type.size;
    const identifiers = maskQuotedText(expression).match(/[A-Za-z_]\w*/g) ?? [];
    for (const identifier of identifiers) {
        const lowered = identifier.toLowerCase();
        if ((resolveVariable(lowered, ctx)?.size ?? 0) > 1 || (resolveXdataVariable(lowered, ctx)?.size ?? 0) > 1 || ctx.sfr16Map.has(lowered) || (ctx.functions.get(lowered)?.returnSize ?? 0) > 1)
            return 2;
    }
    const constant = tryEvalConst(expression);
    return constant != null && constant > 0xff ? 2 : 1;
}
function walkStructPath(structName, path, ctx) {
    let currentStruct = ctx.structDefs.get(structName);
    if (!currentStruct)
        return null;
    let offset = 0;
    const parts = path.split(".");
    for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx].trim();
        const match = /^([A-Za-z_]\w*)(?:\[(\d+)\])?$/.exec(part);
        if (!match)
            return null;
        const field = currentStruct.fields.find((item) => item.name === match[1].toLowerCase());
        if (!field)
            return null;
        const index = match[2] ? Number(match[2]) : 0;
        if (index >= field.size)
            return null;
        offset += field.offset + index;
        if (idx === parts.length - 1)
            return { offset, size: 1 };
        const nested = field.structName ? ctx.structDefs.get(field.structName) : undefined;
        if (!nested)
            return null;
        currentStruct = nested;
    }
    return null;
}
function findStructNameForPointer(ptrName, ctx) {
    return ctx.pointerStructTypes.get(ptrName) ?? null;
}
function resolveStructValue(expr, ctx) {
    const text = expr.trim().toLowerCase();
    const value = ctx.structVars.get(text);
    if (!value || value.storage !== "ram" || value.elementCount !== 1)
        return null;
    const def = ctx.structDefs.get(value.structName);
    return { ...value, size: def?.size ?? 1 };
}
function codePointerImmediate(expr, ctx) {
    const text = trimOuter(expr.trim());
    const arrayIndex = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
    if (arrayIndex && ctx.arrays.has(arrayIndex[1].toLowerCase())) {
        const array = ctx.arrays.get(arrayIndex[1].toLowerCase());
        const offset = (tryEvalConst(arrayIndex[2]) ?? 0) * array.elementSize;
        const label = `${arrayIndex[1]}+${offset & 0xffff}`;
        return { low: `low(${label})`, high: `high(${label})` };
    }
    if (ctx.arrays.has(text.toLowerCase())) {
        return { low: `low(${text})`, high: `high(${text})` };
    }
    return null;
}
function pointerImmediate(expr, kind, ctx) {
    const text = trimOuter(expr.trim());
    if (kind === "code") {
        const code = codePointerImmediate(text.replace(/^&\s*/, ""), ctx);
        if (code)
            return code;
    }
    const numeric = tryEvalConst(text);
    if (numeric != null)
        return { low: toAsmByte8(numeric), high: toAsmByte8(numeric >> 8) };
    const address = resolveAddressExpression(text.replace(/^&\s*/, ""), ctx);
    if (address != null)
        return { low: toAsmByte8(address), high: toAsmByte8(address >> 8) };
    return null;
}
function emitAddressExpressionToWord(expr, ctx, line) {
    const text = trimOuter(expr.trim());
    const address = resolveAddressExpression(text, ctx);
    if (address != null)
        return [`mov a,#${toAsmByte8(address)}`, `mov b,#${toAsmByte8(address >> 8)}`];
    const structAccess = resolveStructAccess(text, ctx, line, false);
    if (structAccess)
        return emitStructAddressToWord(structAccess, ctx, line);
    const structElement = /^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(text);
    if (structElement) {
        const object = ctx.structVars.get(structElement[1].toLowerCase());
        const def = object ? ctx.structDefs.get(object.structName) : undefined;
        if (object && def) {
            const access = {
                storage: object.storage,
                size: def.size,
                signed: false,
                isArray: true,
                isConst: object.isConst === true || object.storage === "code",
                baseAddr: object.baseAddr,
                constantOffset: 0,
                terms: [],
            };
            const constant = tryEvalConst(structElement[2]);
            if (constant != null)
                access.constantOffset = constant * def.size;
            else
                access.terms.push({ expression: structElement[2], stride: def.size });
            return emitStructAddressToWord(access, ctx, line);
        }
    }
    const indexed = /^([A-Za-z_]\w*)\s*\[\s*(.+)\s*\]$/.exec(text);
    if (indexed) {
        const array = ctx.xdataArrays.get(indexed[1].toLowerCase());
        if (array)
            return [...emitXdataArrayAddress(array, indexed[2], ctx, line), "mov a,dpl", "mov b,dph"];
        const local = ctx.localArrays.get(indexed[1].toLowerCase());
        if (local) {
            const constant = tryEvalConst(indexed[2]);
            if (constant != null) {
                const addressValue = local.baseAddr + normalizedArrayOffset(constant, local);
                return [`mov a,#${toAsmByte8(addressValue)}`, "mov b,#0x0"];
            }
            return [...emitScaledIndexToWord(indexed[2], local.elementSize, ctx, line), `add a,#${toAsmByte8(local.baseAddr)}`, "mov r0,a", "mov a,r0", "mov b,#0x0"];
        }
    }
    return null;
}
function emitLoadByteFromXdataAddress(address) {
    return [`mov dptr,#${toAsmByte(address)}`, "movx a,@dptr"];
}
function emitLoadWordFromXdataAddress(address) {
    return [`mov dptr,#${toAsmByte(address)}`, "movx a,@dptr", "mov b,a", "inc dptr", "movx a,@dptr", "xch a,b"];
}
function emitStoreByteToXdataAddress(address) {
    return [`mov dptr,#${toAsmByte(address)}`, "movx @dptr,a"];
}
function emitStoreWordToXdataAddress(address) {
    return [`mov dptr,#${toAsmByte(address)}`, "movx @dptr,a", "inc dptr", "mov a,b", "movx @dptr,a"];
}
function emitXdataConstantBytes(baseAddr, bytes) {
    const out = [`mov dptr,#${toAsmByte(baseAddr)}`];
    bytes.forEach((value, index) => {
        out.push(`mov a,#${toAsmByte8(value)}`, "movx @dptr,a");
        if (index + 1 < bytes.length)
            out.push("inc dptr");
    });
    return out;
}
function emitXdataArrayAddress(array, index, ctx, line) {
    const constant = tryEvalConst(index);
    if (constant != null)
        return [`mov dptr,#${toAsmByte(array.baseAddr + normalizedArrayOffset(constant, array))}`];
    return [
        ...emitScaledIndexToA(index, array.elementSize, ctx, line),
        `add a,#${toAsmByte8(array.baseAddr)}`,
        "mov dpl,a",
        "clr a",
        `addc a,#${toAsmByte8(array.baseAddr >> 8)}`,
        "mov dph,a",
    ];
}
function emitXdataArrayLoad(array, index, word, ctx, line) {
    const out = [...emitXdataArrayAddress(array, index, ctx, line), "movx a,@dptr"];
    if (word)
        out.push("mov b,a", "inc dptr", "movx a,@dptr", "xch a,b");
    return out;
}
function emitXdataArrayStore(array, index, rhs, ctx, line) {
    if (array.elementSize >= 2) {
        return [
            ...emitExprToWord(rhs, ctx, line),
            "push acc",
            "push b",
            ...emitXdataArrayAddress(array, index, ctx, line),
            "pop b",
            "pop acc",
            "movx @dptr,a",
            "inc dptr",
            "mov a,b",
            "movx @dptr,a",
        ];
    }
    return [
        ...emitExprToA(rhs, ctx, line),
        "push acc",
        ...emitXdataArrayAddress(array, index, ctx, line),
        "pop acc",
        "movx @dptr,a",
    ];
}
function normalizeNumber(raw) {
    const value = tryEvalConst(raw);
    if (value == null)
        return null;
    return toAsmByte8(value);
}
function unsupportedArithmeticLiteral(expression) {
    const codeOnly = maskQuotedText(expression);
    if (/(?:\b\d+\.\d*|(?:^|[^A-Za-z0-9_])\.\d+|\b\d+[eE][+\-]?\d+)(?:[eE][+\-]?\d+)?[fFlL]?\b/.test(codeOnly)) {
        return "Floating-point literals and arithmetic are not implemented.";
    }
    if (/\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+|\d+)[lL](?:[uU])?\b|\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+|\d+)[uU][lL]\b/.test(codeOnly)) {
        return "32-bit long literal arithmetic is not implemented.";
    }
    return null;
}
function tryEvalConst(raw) {
    const cast = peelLeadingScalarCasts(raw);
    if (cast.type?.unsupportedReason)
        return null;
    let expr = cast.expression;
    if (!expr)
        return null;
    if (cast.type && (findTopLevelTernary(expr) ||
        findTopLevelBinaryOperator(expr, ["||", "&&", "==", "!=", "<=", ">=", "<<", ">>", "|", "^", "&", "+", "-", "*", "/", "%", "<", ">"])))
        return null;
    // Keil/A51-style numeric suffixes are accepted as a convenience in C constants too.
    expr = expr.replace(/\b([0-9A-F]+)h\b/gi, (_match, hex) => `0x${hex}`);
    expr = expr.replace(/\b([01]+)b\b/gi, (_match, bits) => `0b${bits}`);
    // Character constants used by the methodology examples: 'A', '\n', '\x41', '\101'.
    expr = expr.replace(/'(?:\\.|[^'\\])+'/g, (token) => {
        const decoded = decodeCCharacter(token);
        return decoded == null ? token : String(decoded);
    });
    // Convert C octal integer literals to JavaScript's explicit 0o form. Avoid 0x/0b/0o.
    expr = expr.replace(/(^|[^A-Za-z0-9_.])0([0-7]+)\b/g, (_match, prefix, digits) => `${prefix}0o${digits}`);
    // Integer suffixes do not change the value in this 16-bit constant evaluator.
    expr = expr.replace(/\b(0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+)(?:[uUlL]+)\b/g, "$1");
    // Only operators with deterministic integer semantics are accepted. Identifiers, calls,
    // assignments and property access are deliberately rejected before evaluation.
    if (!/^[0-9a-fxobA-F\s().,+\-~!*\/%<>=&|^?:]+$/.test(expr))
        return null;
    if (/(?:\+\+|--|=>|===|!==|\b(?:new|this)\b)/.test(expr))
        return null;
    try {
        const value = Function(`"use strict"; return ((${expr}));`)();
        if (typeof value !== "number" && typeof value !== "boolean")
            return null;
        if (typeof value === "number" && !Number.isFinite(value))
            return null;
        let integer = typeof value === "boolean" ? (value ? 1 : 0) : Math.trunc(value);
        if (cast.type?.size === 1) {
            integer &= 0xff;
            if (cast.type.signed && (integer & 0x80))
                integer |= 0xff00;
        }
        return integer & 0xffff;
    }
    catch {
        return null;
    }
}
function decodeCCharacter(token) {
    const body = token.slice(1, -1);
    if (!body)
        return null;
    if (!body.startsWith("\\"))
        return body.charCodeAt(body.length - 1) & 0xff;
    const esc = body.slice(1);
    const simple = {
        "0": 0, "a": 7, "b": 8, "t": 9, "n": 10, "v": 11, "f": 12, "r": 13,
        "\\": 92, "'": 39, '"': 34, "?": 63,
    };
    if (Object.prototype.hasOwnProperty.call(simple, esc))
        return simple[esc];
    if (/^x[0-9a-fA-F]+$/.test(esc))
        return Number.parseInt(esc.slice(1), 16) & 0xff;
    if (/^[0-7]{1,3}$/.test(esc))
        return Number.parseInt(esc, 8) & 0xff;
    return null;
}
function formatBuiltinBitOperand(name, address) {
    const register = Object.entries(ADUC841_SFR).find(([candidate, base]) => /^(?:p[0-3]|acc|b)$/.test(candidate) && address >= base && address < base + 8);
    return register ? `${register[0]}.${address - register[1]}` : name;
}
function toAsmByte(value) {
    if (value < 0)
        value = (value + 0x10000) & 0xffff;
    if (value <= 0xff)
        return `0x${(value & 0xff).toString(16)}`;
    return `0x${(value & 0xffff).toString(16)}`;
}
function toAsmByte8(value) {
    return `0x${(value & 0xff).toString(16)}`;
}
function normalizeAccumulatorSource(source) {
    return source === "acc" ? "a" : source;
}
function stripComments(source) {
    const out = source.split("");
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let index = 0; index < source.length; index++) {
        const ch = source[index];
        const next = source[index + 1] ?? "";
        if (lineComment) {
            if (ch === "\n")
                lineComment = false;
            else
                out[index] = " ";
            continue;
        }
        if (blockComment) {
            if (ch !== "\n")
                out[index] = " ";
            if (ch === "*" && next === "/") {
                out[index + 1] = " ";
                index++;
                blockComment = false;
            }
            continue;
        }
        if (quote) {
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "/" && next === "/") {
            out[index] = " ";
            out[index + 1] = " ";
            index++;
            lineComment = true;
            continue;
        }
        if (ch === "/" && next === "*") {
            out[index] = " ";
            out[index + 1] = " ";
            index++;
            blockComment = true;
        }
    }
    return out.join("");
}
function normalizeControlFlowBodies(source) {
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
function consumeControlStatement(source, start) {
    const index = skipWhitespace(source, start);
    if (startsWithWord(source, index, "do")) {
        let cursor = index + 2;
        const body = consumeStatementLike(source, cursor);
        if (!body)
            return null;
        cursor = skipWhitespace(source, body.end);
        if (!startsWithWord(source, cursor, "while"))
            return null;
        const whileStart = cursor;
        cursor = skipWhitespace(source, cursor + 5);
        if (source[cursor] !== "(")
            return null;
        const condEnd = findMatchingParenLike(source, cursor, "(", ")");
        if (condEnd < 0)
            return null;
        cursor = condEnd + 1;
        cursor = skipWhitespace(source, cursor);
        if (source[cursor] === ";")
            cursor += 1;
        const prefix = source.slice(start, index);
        const bodyText = wrapAsBlockIfNeeded(body.text);
        const condText = source.slice(whileStart, cursor);
        return { text: `${prefix}do ${bodyText} ${condText}`, end: cursor };
    }
    for (const keyword of ["if", "for", "while", "switch"]) {
        if (!startsWithWord(source, index, keyword))
            continue;
        let cursor = skipWhitespace(source, index + keyword.length);
        if (source[cursor] !== "(")
            return null;
        const condEnd = findMatchingParenLike(source, cursor, "(", ")");
        if (condEnd < 0)
            return null;
        const header = source.slice(index, condEnd + 1);
        const body = consumeStatementLike(source, condEnd + 1);
        if (!body)
            return null;
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
function consumeStatementLike(source, start) {
    const index = skipWhitespace(source, start);
    if (index >= source.length)
        return null;
    const control = consumeControlStatement(source, index);
    if (control)
        return control;
    const labelMatch = /^([A-Za-z_]\w*)\s*:/.exec(source.slice(index));
    if (labelMatch && !/^(?:case|default)$/i.test(labelMatch[1])) {
        return { text: `${labelMatch[1]}:`, end: index + labelMatch[0].length };
    }
    if (source[index] === "{") {
        const end = findMatchingParenLike(source, index, "{", "}");
        if (end < 0)
            return null;
        return {
            text: `{${normalizeControlFlowBodies(source.slice(index + 1, end))}}`,
            end: end + 1,
        };
    }
    let depthParen = 0;
    let depthBracket = 0;
    for (let i = index; i < source.length; i++) {
        const ch = source[i];
        if (ch === "(")
            depthParen += 1;
        else if (ch === ")")
            depthParen -= 1;
        else if (ch === "[")
            depthBracket += 1;
        else if (ch === "]")
            depthBracket -= 1;
        else if (ch === ";" && depthParen === 0 && depthBracket === 0) {
            return { text: source.slice(index, i + 1), end: i + 1 };
        }
    }
    return { text: source.slice(index), end: source.length };
}
function wrapAsBlockIfNeeded(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return "{ }";
    if (trimmed.startsWith("{"))
        return trimmed;
    return `{ ${trimmed} }`;
}
function skipWhitespace(source, index) {
    let cursor = index;
    while (cursor < source.length && /\s/.test(source[cursor]))
        cursor += 1;
    return cursor;
}
function startsWithWord(source, index, word) {
    if (!source.startsWith(word, index))
        return false;
    const before = index > 0 ? source[index - 1] : "";
    const after = index + word.length < source.length ? source[index + word.length] : "";
    if (before && /[A-Za-z0-9_]/.test(before))
        return false;
    if (after && /[A-Za-z0-9_]/.test(after))
        return false;
    return true;
}
function parseSwitchStatementText(raw) {
    const start = skipWhitespace(raw, 0);
    if (raw.slice(start, start + 6).toLowerCase() !== "switch")
        return null;
    const before = start > 0 ? raw[start - 1] : "";
    const after = raw[start + 6] ?? "";
    if ((before && /[A-Za-z0-9_]/.test(before)) || (after && /[A-Za-z0-9_]/.test(after)))
        return null;
    let cursor = skipWhitespace(raw, start + 6);
    if (raw[cursor] !== "(")
        return null;
    const conditionEnd = findMatchingParenLike(raw, cursor, "(", ")");
    if (conditionEnd < 0)
        return null;
    const expression = raw.slice(cursor + 1, conditionEnd).trim();
    cursor = skipWhitespace(raw, conditionEnd + 1);
    if (raw[cursor] !== "{")
        return null;
    const bodyEnd = findMatchingParenLike(raw, cursor, "{", "}");
    if (bodyEnd < 0 || raw.slice(bodyEnd + 1).trim())
        return null;
    return { expression, body: raw.slice(cursor + 1, bodyEnd) };
}
function parseIfStatement(raw) {
    const start = skipWhitespace(raw, 0);
    if (!startsWithWord(raw, start, "if"))
        return null;
    let cursor = skipWhitespace(raw, start + 2);
    if (raw[cursor] !== "(")
        return null;
    const condEnd = findMatchingParenLike(raw, cursor, "(", ")");
    if (condEnd < 0)
        return null;
    const condition = raw.slice(cursor + 1, condEnd).trim();
    cursor = skipWhitespace(raw, condEnd + 1);
    if (raw[cursor] !== "{")
        return null;
    const thenEnd = findMatchingParenLike(raw, cursor, "{", "}");
    if (thenEnd < 0)
        return null;
    const thenBody = raw.slice(cursor + 1, thenEnd);
    cursor = skipWhitespace(raw, thenEnd + 1);
    if (!startsWithWord(raw, cursor, "else")) {
        if (raw.slice(cursor).trim())
            return null;
        return { condition, thenBody };
    }
    cursor = skipWhitespace(raw, cursor + 4);
    if (raw[cursor] !== "{")
        return null;
    const elseEnd = findMatchingParenLike(raw, cursor, "{", "}");
    if (elseEnd < 0)
        return null;
    if (raw.slice(elseEnd + 1).trim())
        return null;
    return {
        condition,
        thenBody,
        elseBody: raw.slice(cursor + 1, elseEnd),
    };
}
function splitCsv(text) {
    const out = [];
    let current = "";
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let quote = "";
    let escaped = false;
    for (const ch of text) {
        if (quote) {
            current += ch;
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            current += ch;
            continue;
        }
        if (ch === "(")
            depthParen += 1;
        if (ch === ")")
            depthParen -= 1;
        if (ch === "[")
            depthBracket += 1;
        if (ch === "]")
            depthBracket -= 1;
        if (ch === "{")
            depthBrace += 1;
        if (ch === "}")
            depthBrace -= 1;
        if (ch === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
            out.push(current);
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim())
        out.push(current);
    return out;
}
function trimOuter(text) {
    let out = text.trim();
    while (out.startsWith("(") && out.endsWith(")") && isWrapped(out)) {
        out = out.slice(1, -1).trim();
    }
    return out;
}
function isWrapped(text) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(")
            depth += 1;
        if (ch === ")")
            depth -= 1;
        if (depth === 0 && i < text.length - 1)
            return false;
    }
    return true;
}
function findTopLevelBinaryOperator(text, operators) {
    const sorted = [...operators].sort((a, b) => b.length - a.length);
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let quote = "";
    let escaped = false;
    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (quote) {
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === ")")
            depthParen++;
        else if (ch === "(")
            depthParen--;
        else if (ch === "]")
            depthBracket++;
        else if (ch === "[")
            depthBracket--;
        else if (ch === "}")
            depthBrace++;
        else if (ch === "{")
            depthBrace--;
        if (depthParen || depthBracket || depthBrace)
            continue;
        for (const op of sorted) {
            const start = i - op.length + 1;
            if (start < 0 || text.slice(start, i + 1) !== op)
                continue;
            if ((op === "+" || op === "-") && (start === 0 || /[+\-*/%&|^!<>=?:,(]/.test(text[start - 1])))
                continue;
            if (op === "&" && (text[start - 1] === "&" || text[i + 1] === "&"))
                continue;
            if (op === "|" && (text[start - 1] === "|" || text[i + 1] === "|"))
                continue;
            if (op === "<" && (text[start - 1] === "<" || text[i + 1] === "<" || text[i + 1] === "="))
                continue;
            if (op === ">" && (text[start - 1] === ">" || text[i + 1] === ">" || text[i + 1] === "="))
                continue;
            const left = text.slice(0, start).trim();
            const right = text.slice(i + 1).trim();
            if (!left || !right)
                continue;
            return { left, op, right };
        }
    }
    return null;
}
function findTopLevelTernary(text) {
    let depthParen = 0;
    let depthBracket = 0;
    let nestedQuestions = 0;
    let question = -1;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(")
            depthParen++;
        else if (ch === ")")
            depthParen--;
        else if (ch === "[")
            depthBracket++;
        else if (ch === "]")
            depthBracket--;
        if (depthParen || depthBracket)
            continue;
        if (ch === "?") {
            if (question < 0)
                question = i;
            else
                nestedQuestions++;
        }
        else if (ch === ":" && question >= 0) {
            if (nestedQuestions > 0) {
                nestedQuestions--;
                continue;
            }
            return { condition: text.slice(0, question).trim(), whenTrue: text.slice(question + 1, i).trim(), whenFalse: text.slice(i + 1).trim() };
        }
    }
    return null;
}
function findTopLevelOperator(text, operators) {
    let depthParen = 0;
    let depthBracket = 0;
    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ")")
            depthParen += 1;
        else if (ch === "(")
            depthParen -= 1;
        else if (ch === "]")
            depthBracket += 1;
        else if (ch === "[")
            depthBracket -= 1;
        if (depthParen || depthBracket)
            continue;
        if (operators.includes(ch)) {
            if ((ch === "+" || ch === "-") && i === 0)
                continue;
            return { left: text.slice(0, i).trim(), op: ch, right: text.slice(i + 1).trim() };
        }
    }
    return null;
}
function findComparator(text) {
    return findTopLevelBinaryOperator(text, ["<=", ">=", "==", "!=", "<", ">"]);
}
function findMatchingBrace(source, openIndex) {
    return findMatchingParenLike(source, openIndex, "{", "}");
}
function findMatchingParenLike(source, openIndex, openChar, closeChar) {
    let depth = 0;
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = openIndex; i < source.length; i++) {
        const ch = source[i];
        const next = source[i + 1] ?? "";
        if (lineComment) {
            if (ch === "\n")
                lineComment = false;
            continue;
        }
        if (blockComment) {
            if (ch === "*" && next === "/") {
                i++;
                blockComment = false;
            }
            continue;
        }
        if (quote) {
            if (escaped)
                escaped = false;
            else if (ch === "\\")
                escaped = true;
            else if (ch === quote)
                quote = "";
            continue;
        }
        if (ch === "/" && next === "/") {
            i++;
            lineComment = true;
            continue;
        }
        if (ch === "/" && next === "*") {
            i++;
            blockComment = true;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === openChar)
            depth += 1;
        else if (ch === closeChar) {
            depth -= 1;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
