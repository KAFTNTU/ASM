import { EmuBoardController } from "../vm/emuBoardController.js";
import { SFR } from "../vm/st841Map.js";
import { compileAsm } from "./asmCompiler.js";
import { checkC } from "./cChecker.js";
import { transpileCToAsm } from "./cTranspiler.js";
export function renderStand(params) {
    const { board } = params;
    const cpu = new EmuBoardController(board);
    const root = el("div", { class: "minimalShell" });
    const windowCard = el("div", { class: "windowCard" });
    root.appendChild(windowCard);
    const chrome = el("div", { class: "windowChrome" });
    chrome.appendChild(el("div", { class: "trafficLights" })).innerHTML =
        '<span class="red"></span><span class="yellow"></span><span class="green"></span>';
    windowCard.appendChild(chrome);
    const toolbar = el("div", { class: "toolbar" });
    const runBtn = button("Start", "green");
    const resetBtn = button("Reset");
    const stepBtn = button("Step");
    const traceBtn = button("Runner");
    const modeSelect = el("select", { class: "samplePicker" });
    modeSelect.append(option("asm", "ASM"), option("c", "C"));
    const speedGroup = el("div", { class: "speedGroup" });
    const speedMultipliers = [1, 10, 100, 1000, 10000];
    const speedButtons = speedMultipliers.map((speed) => {
        const node = button(String(speed), speed === 1 ? "speed active" : "speed");
        node.addEventListener("click", () => setSpeed(speed));
        speedGroup.appendChild(node);
        return { speed, node };
    });
    toolbar.append(runBtn, resetBtn, stepBtn, modeSelect, traceBtn, speedGroup);
    windowCard.appendChild(toolbar);
    const debugModal = el("div", { class: "debugModal hidden" });
    const debugCard = el("div", { class: "debugCard" });
    const debugHead = el("div", { class: "debugHead" });
    const debugTitle = el("div", { class: "debugTitle" });
    debugTitle.textContent = "Runner / registers / memory";
    const debugClose = button("Close");
    debugClose.classList.add("debugClose");
    debugHead.append(debugTitle, debugClose);
    const debugBody = el("div", { class: "debugBody" });
    debugCard.append(debugHead, debugBody);
    debugModal.appendChild(debugCard);
    root.appendChild(debugModal);
    const mainRow = el("div", { class: "mainRow" });
    const boardPane = el("section", { class: "boardPane" });
    const editorPane = el("section", { class: "editorPane" });
    mainRow.append(boardPane, editorPane);
    windowCard.appendChild(mainRow);
    const boardSurface = el("div", { class: "boardSurfaceMini" });
    const canvas = el("canvas", { class: "boardCanvasMini" });
    canvas.width = 720;
    canvas.height = 720;
    boardSurface.appendChild(canvas);
    boardPane.appendChild(boardSurface);
    const boardOverlays = el("div", { class: "boardOverlayMini" });
    boardSurface.appendChild(boardOverlays);
    boardSurface.addEventListener("pointerdown", () => {
        editor.blur();
    });
    const keypadWrap = el("div", { class: "boardBox keypadBox" });
    keypadWrap.appendChild(caption("KEYPAD"));
    const keypadGrid = el("div", { class: "miniKeypad" });
    keypadWrap.appendChild(keypadGrid);
    for (const [index, key] of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].entries()) {
        const btn = el("button", { class: "miniKey" });
        btn.textContent = key;
        btn.addEventListener("pointerdown", (event) => {
            btn.classList.add("active");
            board.keypadPress(index, true);
            updateRuntimeBar();
            btn.setPointerCapture(event.pointerId);
        });
        const releaseKey = () => {
            btn.classList.remove("active");
            board.keypadRelease(index);
            updateRuntimeBar();
        };
        btn.addEventListener("pointerup", releaseKey);
        btn.addEventListener("pointercancel", releaseKey);
        keypadGrid.appendChild(btn);
    }
    boardOverlays.appendChild(keypadWrap);
    const joystickWrap = el("div", { class: "boardBox joystickBox" });
    joystickWrap.appendChild(caption("ADC / JOYSTICK"));
    const joystickFace = el("div", { class: "joystickFaceMini" });
    const joystickKnob = el("div", { class: "joystickKnobMini" });
    joystickFace.appendChild(joystickKnob);
    joystickWrap.appendChild(joystickFace);
    boardOverlays.appendChild(joystickWrap);
    const editorBox = el("div", { class: "editorBox" });
    const editorTop = el("div", { class: "editorTopMini" });
    const modeTag = el("div", { class: "editorTag mono" });
    modeTag.textContent = "ASM";
    const runtimeBar = el("div", { class: "runtimeBar mono" });
    const editorActions = el("div", { class: "editorActions" });
    const formatBtn = el("button", { class: "editorMiniBtn", type: "button", title: "Format / align code (Ctrl+I)" });
    formatBtn.textContent = "Format";
    const indentBtn = el("button", { class: "editorMiniBtn", type: "button", title: "Indent selection (Tab)" });
    indentBtn.textContent = "Indent";
    editorActions.append(formatBtn, indentBtn);
    editorTop.append(modeTag, runtimeBar, editorActions);
    editorBox.appendChild(editorTop);
    const editorShell = el("div", { class: "editorShell" });
    const lineNumbers = el("pre", { class: "lineNumbers mono" });
    const execMarker = el("div", { class: "execMarker", title: "Current instruction" });
    const editorStack = el("div", { class: "editorStack" });
    const codeHighlight = el("pre", { class: "codeHighlight mono" });
    const editor = el("textarea", { class: "editorText spellcheck-false" });
    const scrollSlider = el("div", { class: "editorScrollSlider" });
    const scrollThumb = el("div", { class: "editorScrollThumb" });
    scrollSlider.appendChild(scrollThumb);
    editor.spellcheck = false;
    editorStack.append(codeHighlight, editor);
    const autocompleteMenu = el("div", { class: "autocompleteMenu hidden" });
    editorStack.appendChild(autocompleteMenu);

    const autocompleteGhost = el("pre", { class: "autocompleteGhost mono hidden" });
    editorStack.appendChild(autocompleteGhost);

    autocompleteMenu.addEventListener("wheel", (event) => {
        if (autocompleteOpen)
            event.stopPropagation();
    }, { passive: true });
    editorShell.append(lineNumbers, execMarker, editorStack, scrollSlider);
    editorBox.appendChild(editorShell);
    const statusStrip = el("div", { class: "statusStrip mono" });
    editorBox.appendChild(statusStrip);
    editorPane.appendChild(editorBox);
    const splitHandle = el("div", { class: "splitHandle", title: "Resize" });
    splitHandle.appendChild(el("div", { class: "splitDot" }));
    windowCard.appendChild(splitHandle);
    const messagesPane = el("section", { class: "messagesPane" });
    const messagesHead = el("div", { class: "messagesHead" });
    const messagesTitle = el("div", { class: "messagesTitle" });
    messagesTitle.textContent = "Output";
    const messagesMeta = el("div", { class: "messagesMeta mono" });
    messagesHead.append(messagesTitle, messagesMeta);
    messagesPane.appendChild(messagesHead);
    const messagesBody = el("div", { class: "messagesBody" });
    messagesPane.appendChild(messagesBody);
    windowCard.appendChild(messagesPane);
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error("No 2d context");
    const drawContext = context;
    let currentHex = "";
    let drag = false;
    let joystickDrag = false;
    let joystickX = 2048;
    let joystickY = 2048;
    let isRunning = false;
    let currentSpeed = 1;
    let sourceMode = "asm";
    let diagnosticLines = new Map();
    let programLoaded = false;
    cpu.setSpeed(speedToBatch(currentSpeed));
    let editorScrollDrag = false;
    let currentPcToLine = [];
    let lastUiUpdateTs = 0;
    let lastDebugUpdateTs = 0;
    let debugOpen = false;
    let inputDebounce = null;
    let autocompleteOpen = false;
    let autocompleteIndex = 0;
    let autocompleteMatches = [];
    let autocompletePrefix = "";
    function getCompletionPrefix() {
        const pos = editor.selectionStart ?? 0;
        const before = editor.value.slice(0, pos);
        const match = before.match(/[A-Za-z_.$][A-Za-z0-9_.$#]$|[A-Za-z_.$][A-Za-z0-9_.$#]*$/);
        return match ? match[0] : "";
    }
    function updateAutocomplete() {
        const prefix = getCompletionPrefix();
        autocompletePrefix = prefix;
        if (!prefix || prefix.length < 2) {
            closeAutocomplete();
            return;
        }
        const q = prefix.toLowerCase();
        autocompleteMatches = CODE_COMPLETIONS
            .filter((item) => (item.mode === sourceMode || item.mode === "both") && (item.trigger.toLowerCase().startsWith(q) ||
            item.label.toLowerCase().startsWith(q) ||
            item.trigger.toLowerCase().includes(q)))
            .slice(0, 120);
        autocompleteIndex = 0;
        renderAutocomplete();
    }
    function renderAutocomplete() {
        if (!autocompleteMatches.length) {
            closeAutocomplete();
            return;
        }
        autocompleteOpen = true;
        autocompleteMenu.classList.remove("hidden");
        autocompleteMenu.innerHTML = autocompleteMatches.map((item, index) => `
      <button class="autocompleteItem ${index === autocompleteIndex ? "active" : ""}" data-index="${index}" type="button">
        <span class="autocompleteLabel">${escapeHtml(item.label)}</span>
        <span class="autocompleteDesc">${escapeHtml(item.description)}</span>
        <span class="autocompleteKey">Tab</span>
      </button>
    `).join("");
        for (const node of Array.from(autocompleteMenu.querySelectorAll(".autocompleteItem"))) {
            node.addEventListener("mousemove", () => {
                const next = Number(node.dataset.index || "0");
                if (next !== autocompleteIndex) {
                    autocompleteIndex = next;
                    updateAutocompleteActiveClass();
                }
            });
            node.addEventListener("mousedown", (event) => {
                event.preventDefault();
                const index = Number(node.dataset.index || "0");
                applyAutocomplete(index);
            });
        }
        syncAutocompleteActive();
        updateAutocompleteGhost();
    }
    function updateAutocompleteActiveClass() {
        for (const node of Array.from(autocompleteMenu.querySelectorAll(".autocompleteItem"))) {
            node.classList.toggle("active", Number(node.dataset.index || "0") === autocompleteIndex);
        }
        syncAutocompleteActive();
        updateAutocompleteGhost();
    }
    function syncAutocompleteActive() {
        const active = autocompleteMenu.querySelector(".autocompleteItem.active");
        active?.scrollIntoView({ block: "nearest" });
    }
    function updateAutocompleteGhost() {
        const item = autocompleteOpen ? autocompleteMatches[autocompleteIndex] : null;

        if (!item || !autocompletePrefix) {
            autocompleteGhost.classList.add("hidden");
            autocompleteGhost.innerHTML = "";
            return;
        }

        const pos = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? pos;
        const start = Math.max(0, pos - autocompletePrefix.length);
        const before = editor.value.slice(0, start);

        autocompleteGhost.classList.remove("hidden");
        autocompleteGhost.innerHTML = `${escapeHtml(before)}<span class="autocompleteGhostInsert">${escapeHtml(item.insertText)}</span>`;
        syncAutocompleteGhostScroll();
    }

    function syncAutocompleteGhostScroll() {
        autocompleteGhost.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    }

    function closeAutocomplete() {
        autocompleteGhost.classList.add("hidden");
        autocompleteGhost.innerHTML = "";
        autocompleteOpen = false;
        autocompleteMatches = [];
        autocompleteMenu.classList.add("hidden");
        autocompleteMenu.innerHTML = "";
    }
    function applyAutocomplete(index = autocompleteIndex) {
        const item = autocompleteMatches[index];
        if (!item)
            return;
        const pos = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? pos;
        const start = Math.max(0, pos - autocompletePrefix.length);
        editor.setRangeText(item.insertText, start, end, "end");
        closeAutocomplete();
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.focus();
    }
    const EDITOR_INDENT = "  ";
    function lineStartAt(value, pos) {
        const n = value.lastIndexOf("\n", Math.max(0, pos - 1));
        return n < 0 ? 0 : n + 1;
    }
    function lineEndAt(value, pos) {
        const n = value.indexOf("\n", pos);
        return n < 0 ? value.length : n;
    }
    function lineNumberFromPos(value, pos) {
        return value.slice(0, pos).split("\n").length;
    }
    function goToEditorLine(line, flash = true) {
        const lineNo = Math.max(1, Number(line) || 1);
        const lines = editor.value.split("\n");
        let start = 0;
        for (let i = 0; i < Math.min(lineNo - 1, lines.length); i++)
            start += lines[i].length + 1;
        const end = start + (lines[lineNo - 1]?.length ?? 0);
        editor.focus();
        editor.setSelectionRange(start, end);
        const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 20;
        editor.scrollTop = Math.max(0, (lineNo - 3) * lineHeight);
        lineNumbers.scrollTop = editor.scrollTop;
        syncHighlightScroll();
        syncEditorScrollSlider();
        syncExecMarker();
        if (flash) {
            editorStack.classList.add("editorLineJumpFlash");
            window.setTimeout(() => editorStack.classList.remove("editorLineJumpFlash"), 420);
        }
    }
    function replaceEditorRange(text, start, end, mode = "end") {
        editor.setRangeText(text, start, end, mode);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function indentSelection() {
        const value = editor.value;
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? start;
        const first = lineStartAt(value, start);
        const last = lineStartAt(value, end);
        if (start !== end && first !== last) {
            const selectionEnd = end > 0 && value[end - 1] === "\n" ? end - 1 : end;
            const blockStart = lineStartAt(value, start);
            const blockEnd = lineEndAt(value, selectionEnd);
            const block = value.slice(blockStart, blockEnd);
            const indented = block.split("\n").map((line) => EDITOR_INDENT + line).join("\n");
            editor.setRangeText(indented, blockStart, blockEnd, "select");
            editor.selectionStart = start + EDITOR_INDENT.length;
            editor.selectionEnd = end + EDITOR_INDENT.length * block.split("\n").length;
            editor.dispatchEvent(new Event("input", { bubbles: true }));
            return;
        }
        replaceEditorRange(EDITOR_INDENT, start, end, "end");
    }
    function unindentSelection() {
        const value = editor.value;
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? start;
        const blockStart = lineStartAt(value, start);
        const selectionEnd = end > 0 && value[end - 1] === "\n" ? end - 1 : end;
        const blockEnd = lineEndAt(value, selectionEnd);
        const block = value.slice(blockStart, blockEnd);
        let removedBeforeStart = 0;
        let totalRemoved = 0;
        const lines = block.split("\n");
        const unindented = lines.map((line, idx) => {
            const remove = line.startsWith(EDITOR_INDENT) ? EDITOR_INDENT.length : line.startsWith("\t") ? 1 : line.startsWith(" ") ? 1 : 0;
            if (remove && blockStart + lines.slice(0, idx).join("\n").length + idx < start)
                removedBeforeStart += remove;
            totalRemoved += remove;
            return line.slice(remove);
        }).join("\n");
        editor.setRangeText(unindented, blockStart, blockEnd, "select");
        editor.selectionStart = Math.max(blockStart, start - removedBeforeStart);
        editor.selectionEnd = Math.max(editor.selectionStart, end - totalRemoved);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function autoIndentNewLine() {
        const value = editor.value;
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? start;
        const lineStart = lineStartAt(value, start);
        const beforeLine = value.slice(lineStart, start);
        let indent = beforeLine.match(/^\s*/)?.[0] ?? "";
        const trimmed = beforeLine.trim();
        if (sourceMode === "c" && /[{:]$/.test(trimmed) && !/^case\b|^default\b/i.test(trimmed))
            indent += EDITOR_INDENT;
        if (sourceMode === "c" && /^(case\b|default\b)/i.test(trimmed))
            indent += EDITOR_INDENT;
        replaceEditorRange("\n" + indent, start, end, "end");
    }
    function formatEditorText() {
        const originalLine = lineNumberFromPos(editor.value, editor.selectionStart ?? 0);
        const text = sourceMode === "c" ? formatCText(editor.value) : formatAsmText(editor.value);
        editor.value = text;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        goToEditorLine(originalLine, false);
    }
    function formatCText(text) {
        const lines = normalizeEditorText(text).split("\n");
        let level = 0;
        const out = [];
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) { out.push(""); continue; }
            if (/^}/.test(line)) level = Math.max(0, level - 1);
            let localLevel = level;
            if (/^(case\b|default\b)/i.test(line)) localLevel = Math.max(0, level - 1);
            out.push(EDITOR_INDENT.repeat(localLevel) + line);
            const opens = (line.match(/{/g) || []).length;
            const closes = (line.match(/}/g) || []).length;
            level = Math.max(0, level + opens - closes);
            if (/^(case\b|default\b)/i.test(line) && !/{/.test(line)) level = Math.max(level, localLevel + 1);
            if (/^break\s*;|^return\b/i.test(line) && level > 0) {
                const nextRaw = lines[out.length] ?? "";
                if (/^\s*(case\b|default\b|})/i.test(nextRaw)) level = Math.max(0, level - 1);
            }
        }
        return out.join("\n");
    }
    function formatAsmText(text) {
        const lines = normalizeEditorText(text).split("\n");
        return lines.map((raw) => {
            const line = raw.trim();
            if (!line) return "";
            if (/^;/.test(line)) return line;
            if (/^[A-Za-z_.$?][\w.$?]*:$/.test(line)) return line;
            if (/^[A-Za-z_.$?][\w.$?]*\s+(equ|data|bit)\b/i.test(line)) return line;
            if (/^(org|end|cseg|dseg|xseg|bseg|db|dw|ds)\b/i.test(line)) return line.toUpperCase().replace(/\s+/g, " ");
            return EDITOR_INDENT + line;
        }).join("\n");
    }
    editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            if (event.shiftKey) {
                closeAutocomplete();
                unindentSelection();
                return;
            }
            if (autocompleteOpen && autocompleteMatches.length > 0) {
                applyAutocomplete();
                return;
            }
            updateAutocomplete();
            if (autocompleteOpen && autocompleteMatches.length > 0 && autocompletePrefix.length >= 2) {
                applyAutocomplete(0);
                return;
            }
            indentSelection();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
            event.preventDefault();
            closeAutocomplete();
            formatEditorText();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === "]") {
            event.preventDefault();
            indentSelection();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === "[") {
            event.preventDefault();
            unindentSelection();
            return;
        }
        if (event.key === "Enter") {
            if (autocompleteOpen) {
                closeAutocomplete();
                return;
            }
            event.preventDefault();
            autoIndentNewLine();
            return;
        }
        if (!autocompleteOpen)
            return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            autocompleteIndex = (autocompleteIndex + 1) % autocompleteMatches.length;
            updateAutocompleteActiveClass();
        }
        else if (event.key === "ArrowUp") {
            event.preventDefault();
            autocompleteIndex = (autocompleteIndex - 1 + autocompleteMatches.length) % autocompleteMatches.length;
            updateAutocompleteActiveClass();
        }
        else if (event.key === "PageDown") {
            event.preventDefault();
            autocompleteIndex = Math.min(autocompleteMatches.length - 1, autocompleteIndex + 8);
            updateAutocompleteActiveClass();
        }
        else if (event.key === "PageUp") {
            event.preventDefault();
            autocompleteIndex = Math.max(0, autocompleteIndex - 8);
            updateAutocompleteActiveClass();
        }
        else if (event.key === "Home") {
            event.preventDefault();
            autocompleteIndex = 0;
            updateAutocompleteActiveClass();
        }
        else if (event.key === "End") {
            event.preventDefault();
            autocompleteIndex = autocompleteMatches.length - 1;
            updateAutocompleteActiveClass();
        }
        else if (event.key === "Escape") {
            event.preventDefault();
            closeAutocomplete();
        }
    });
    formatBtn.addEventListener("click", () => {
        closeAutocomplete();
        formatEditorText();
        editor.focus();
    });
    indentBtn.addEventListener("click", () => {
        closeAutocomplete();
        indentSelection();
        editor.focus();
    });
    editor.addEventListener("input", () => {
        programLoaded = false;
        updateLineNumbers();
        updateSyntaxHighlight();
        syncEditorScrollSlider();
        updateAutocomplete();
        if (inputDebounce != null)
            window.clearTimeout(inputDebounce);
        inputDebounce = window.setTimeout(() => {
            updateSyntaxHighlight();
            compileAndRender(false);
            inputDebounce = null;
        }, 120);
    });
    editor.addEventListener("paste", (event) => {
        const clip = event.clipboardData?.getData("text");
        if (!clip)
            return;
        event.preventDefault();
        const normalized = normalizeEditorText(clip);
        const start = editor.selectionStart ?? 0;
        const end = editor.selectionEnd ?? 0;
        editor.setRangeText(normalized, start, end, "end");
        editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    modeSelect.addEventListener("change", () => {
        sourceMode = modeSelect.value === "c" ? "c" : "asm";
        modeTag.textContent = sourceMode.toUpperCase();
        closeAutocomplete();
        programLoaded = false;
        updateSyntaxHighlight();
        compileAndRender(true);
    });
    editor.addEventListener("scroll", () => {
        lineNumbers.scrollTop = editor.scrollTop;
        syncHighlightScroll();
        syncEditorScrollSlider();
        syncExecMarker();
    });
    editorShell.addEventListener("wheel", (event) => {
        event.preventDefault();
        editor.scrollTop += event.deltaY;
        lineNumbers.scrollTop = editor.scrollTop;
        syncEditorScrollSlider();
        syncExecMarker();
    }, { passive: false });
    scrollSlider.addEventListener("pointerdown", (event) => {
        editorScrollDrag = true;
        scrollSlider.setPointerCapture(event.pointerId);
        updateEditorScrollFromPointer(event);
    });
    scrollSlider.addEventListener("pointermove", (event) => {
        if (!editorScrollDrag)
            return;
        updateEditorScrollFromPointer(event);
    });
    scrollSlider.addEventListener("pointerup", () => {
        editorScrollDrag = false;
    });
    scrollSlider.addEventListener("pointercancel", () => {
        editorScrollDrag = false;
    });
    splitHandle.addEventListener("pointerdown", (event) => {
        drag = true;
        splitHandle.setPointerCapture(event.pointerId);
    });
    splitHandle.addEventListener("pointermove", (event) => {
        if (!drag)
            return;
        const rect = windowCard.getBoundingClientRect();
        const desired = Math.max(28, Math.min(280, rect.bottom - event.clientY));
        windowCard.style.setProperty("--messages-height", `${desired}px`);
    });
    splitHandle.addEventListener("pointerup", () => {
        drag = false;
    });
    joystickFace.addEventListener("pointerdown", (event) => {
        joystickDrag = true;
        joystickFace.setPointerCapture(event.pointerId);
        updateJoystickFromPointer(event);
    });
    joystickFace.addEventListener("pointermove", (event) => {
        if (!joystickDrag)
            return;
        updateJoystickFromPointer(event);
    });
    const releaseJoystick = () => {
        joystickDrag = false;
        joystickX = 2048;
        joystickY = 2048;
        syncJoystick();
    };
    joystickFace.addEventListener("pointerup", releaseJoystick);
    joystickFace.addEventListener("pointercancel", releaseJoystick);
    traceBtn.addEventListener("click", () => {
        debugOpen = true;
        debugModal.classList.remove("hidden");
        renderDebugPanel();
    });
    debugClose.addEventListener("click", () => {
        debugOpen = false;
        debugModal.classList.add("hidden");
    });
    // Keep runner open until user presses "Close" explicitly.
    runBtn.addEventListener("click", async () => {
        if (isRunning) {
            cpu.stop();
            isRunning = false;
            board.reset();
            await cpu.reset();
            programLoaded = false;
            joystickX = 2048;
            joystickY = 2048;
            syncJoystick();
            syncRunButton();
            updateRuntimeBar();
            return;
        }
        const result = compileAndRender(true);
        if (!result.ok)
            return;
        if (!currentHex.trim()) {
            showMessages([], "", true);
            return;
        }
        await cpu.loadHex(currentHex);
        programLoaded = true;
        cpu.run();
        isRunning = true;
        syncRunButton();
        updateRuntimeBar();
    });
    resetBtn.addEventListener("click", async () => {
        cpu.stop();
        isRunning = false;
        board.reset();
        await cpu.reset();
        programLoaded = false;
        syncRunButton();
        updateRuntimeBar();
    });
    stepBtn.addEventListener("click", async () => {
        const result = compileAndRender(false);
        if (!result.ok)
            return;
        if (!currentHex.trim()) {
            showMessages([], "", true);
            return;
        }
        if (!programLoaded) {
            await cpu.loadHex(currentHex);
            programLoaded = true;
        }
        cpu.step(1);
        isRunning = false;
        syncRunButton();
        updateRuntimeBar();
    });
    function compileAndRender(expand = false) {
        if (sourceMode === "c") {
            const c = checkC(editor.value);
            if (!c.ok) {
                currentHex = "";
                currentPcToLine = [];
                const summary = editor.value.trim() ? "errors" : "";
                showMessages(c.diagnostics, summary, expand);
                updateRuntimeBar(false);
                return { ok: false, diagnostics: c.diagnostics, hex: "", pcToLine: [] };
            }
            const transpiled = transpileCToAsm(editor.value);
            if (!transpiled.ok) {
                currentHex = "";
                currentPcToLine = [];
                showMessages(transpiled.diagnostics, "errors", expand);
                updateRuntimeBar(false);
                return { ok: false, diagnostics: transpiled.diagnostics, hex: "", pcToLine: [] };
            }
            const asm = compileAsm(transpiled.asm);
            currentHex = asm.hex;
            currentPcToLine = [];
            const merged = [...c.diagnostics.filter((d) => d.level !== "hint"), ...transpiled.diagnostics, ...asm.diagnostics];
            const summary = editor.value.trim() ? (asm.ok ? "ok" : "errors") : "";
            showMessages(merged, summary, expand);
            updateRuntimeBar(asm.ok);
            return { ok: asm.ok, diagnostics: merged, hex: asm.hex, pcToLine: [] };
        }
        const asm = compileAsm(editor.value);
        const guideHints = buildAsmGuideHints(editor.value);
        currentHex = asm.hex;
        currentPcToLine = asm.pcToLine;
        const summary = editor.value.trim() ? (asm.ok ? "ok" : "errors") : "";
        showMessages([...asm.diagnostics, ...guideHints], summary, expand);
        updateRuntimeBar(asm.ok);
        return { ok: asm.ok, diagnostics: [...asm.diagnostics, ...guideHints], hex: asm.hex, pcToLine: asm.pcToLine };
    }
    function showMessages(list, summary, expand = false) {
        messagesBody.innerHTML = "";
        diagnosticLines = buildDiagnosticLineMap(list);
        updateSyntaxHighlight();
        const errors = list.filter((item) => item.level === "error").length;
        const warnings = list.filter((item) => item.level === "warning").length;
        messagesMeta.textContent = `${errors} / ${warnings}`;
        for (const item of list) {
            const row = el("div", { class: `messageRow ${item.level} ${item.line != null ? "clickable" : ""}` });
            const line = item.line != null ? `L${item.line}` : "";
            row.innerHTML = `<span class="mono">${line}</span><span>${item.message}</span>`;
            if (item.line != null) {
                row.title = `Go to line ${item.line}`;
                row.addEventListener("click", () => goToEditorLine(item.line, true));
            }
            messagesBody.appendChild(row);
        }
        if (expand) {
            messagesBody.scrollTop = 0;
        }
        statusStrip.textContent = summary;
    }
    function updateRuntimeBar(ok = true) {
        isRunning = cpu.isRunning();
        const flow = buildExecFlow(cpu.getTrace(64), cpu.getPC(), currentPcToLine);
        syncRunButton();
        runtimeBar.textContent = [
            !ok ? "ERROR" : cpu.isRunning() ? "RUNNING" : "READY",
            `PC ${hexWord(cpu.getPC())}`,
            `L${currentPcToLine.find((item) => (item.pc & 0xffff) === (cpu.getPC() & 0xffff))?.line ?? "-"}`,
            `OP ${hexByte(cpu.readCode(cpu.getPC()))}`,
            decodeInstruction(cpu),
            `ACC ${hexByte(cpu.getSfr(SFR.acc))}`,
            `P0 ${hexByte(board.readPort("P0"))}`,
            `P2 ${hexByte(board.readPort("P2"))}`,
            `x${currentSpeed}`,
            cpu.isRunning() ? "RUN" : "STOP",
        ].join("   ");
        renderDebugPanel();
        syncExecMarker();
    }
    function renderDebugPanel() {
        if (!debugOpen)
            return;
        const now = performance.now();
        if (cpu.isRunning() && now - lastDebugUpdateTs < 240)
            return;
        lastDebugUpdateTs = now;
        const trace = cpu.getTrace(64);
        const pc = cpu.getPC() & 0xffff;
        const op = cpu.readCode(pc) & 0xff;
        const flow = buildExecFlow(trace, pc, currentPcToLine);
        const exactLine = currentPcToLine.find((item) => (item.pc & 0xffff) === pc);
        const previousLine = currentPcToLine
            .filter((item) => (item.pc & 0xffff) <= pc)
            .sort((a, b) => b.pc - a.pc)[0];
        const lineNo = exactLine?.line ?? previousLine?.line ?? null;
        const sourceLine = lineNo != null ? editor.value.split(/\r?\n/)[lineNo - 1] ?? "" : "";
        const exactBadge = exactLine ? "точно" : previousLine ? "найближча" : "нема";
        const statusText = cpu.isRunning() ? "RUN" : "STOP";
        const p36 = ((cpu.getSfr(SFR.p3) >> 6) & 1) === 1 ? "TX / запис" : "RX / читання";
        const psw = cpu.getSfr(SFR.psw);
        const bank = (psw >> 3) & 0x03;
        const regBase = bank * 8;
        const sp = cpu.getSfr(SFR.sp);
        const spDelta = ((sp - 0x07) & 0xff).toString(10);
        const regsR = Array.from({ length: 8 }, (_, i) => [
            `R${i}`,
            hexByte(cpu.readIram(regBase + i)),
        ]);
        const coreRegs = [
            ["PC", hexWord(pc)],
            ["OP", hexByte(op)],
            ["ASM", lineNo != null ? `L${lineNo}` : "-"],
            ["ACC", hexByte(cpu.getSfr(SFR.acc))],
            ["B", hexByte(cpu.getSfr(SFR.b))],
            ["PSW", hexByte(psw)],
            ["SP", hexByte(sp)],
            ["DPTR", `${hexByte(cpu.getSfr(SFR.dph))}${hexByte(cpu.getSfr(SFR.dpl)).slice(2)}`],
        ];
        const ports = [
            ["P0 / шина даних", hexByte(cpu.getSfr(SFR.p0))],
            ["P1", hexByte(cpu.getSfr(SFR.p1))],
            ["P2 / адреса", hexByte(cpu.getSfr(SFR.p2))],
            ["P3", hexByte(cpu.getSfr(SFR.p3))],
            ["P3.6 режим", p36],
        ];
        const sfrs = [
            ["IE", hexByte(cpu.getSfr(SFR.ie))],
            ["IP", hexByte(cpu.getSfr(SFR.ip))],
            ["TCON", hexByte(cpu.getSfr(SFR.tcon))],
            ["TMOD", hexByte(cpu.getSfr(SFR.tmod))],
            ["ADCCON1", hexByte(cpu.getSfr(0xef))],
            ["ADCCON2", hexByte(cpu.getSfr(0xd8))],
            ["ADCDATAL", hexByte(cpu.getSfr(0xd9))],
            ["ADCDATAH", hexByte(cpu.getSfr(0xda))],
        ];
        const pressedKeys = board
            .getPressedKeys()
            .map((idx) => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"][idx] ?? "?")
            .join(" ");
        const keypadBus = board.getKeypadBusPreview();
        const joy = board.getJoystick();
        const lcdRows = typeof board.extraDevices.lcd?.getDebugRows === "function"
            ? board.extraDevices.lcd.getDebugRows()
            : [];
        const stackRows = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
            const addr = (sp - d) & 0xff;
            return [hexByte(addr), hexByte(cpu.readIram(addr)), d === 0 ? "SP" : ""];
        });
        const iramRows = [];
        for (let i = 0; i < 32; i += 8) {
            iramRows.push([
                hexByte(i),
                [0, 1, 2, 3, 4, 5, 6, 7].map((d) => hexByte(cpu.readIram(i + d))).join(" "),
            ]);
        }
        const xramPreview = [0, 1, 2, 3, 4, 5, 6, 7]
            .map((d) => hexByte(cpu.readXram(d)))
            .join(" ");
        const traceRows = trace.slice(-22).map((item) => {
            const current = (item.pc & 0xffff) === pc;
            const line = currentPcToLine.find((m) => (m.pc & 0xffff) === (item.pc & 0xffff));
            return `<tr class="${current ? "runnerCurrentRow" : ""}"><td>${escapeHtml(String(item.tick))}</td><td>${hexWord(item.pc)}</td><td>${hexByte(item.opcode)}</td><td>${line ? `L${line.line}` : "-"}</td><td>${hexByte(item.acc)}</td><td>${hexByte(item.p0)}</td><td>${hexByte(item.p2)}</td></tr>`;
        }).join("");
        const codeBytes = [0, 1, 2, 3].map((d) => hexByte(cpu.readCode(pc + d))).join(" ");
        const kv = (label, value, extra = "") => `<div class="runnerKv ${extra}"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`;
        const kvList = (items) => items.map(([label, value]) => kv(label, value)).join("");
        const card = (title, body, extra = "") => `<section class="runnerCard ${extra}"><h3>${escapeHtml(title)}</h3>${body}</section>`;
        const smallTable = (rows, headers) => `<table class="runnerTable"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`;
        debugBody.innerHTML = `
      <div class="runnerPanel">
        <section class="runnerHero">
          <div>
            <div class="runnerLabel">Зараз виконується</div>
            <div class="runnerInstruction mono">${escapeHtml(decodeInstruction(cpu))}</div>
            <pre class="runnerSourceLine mono">${lineNo != null ? `L${lineNo}  ` : "L-  "}${escapeHtml(sourceLine || "-")}</pre>
          </div>
          <div class="runnerStatusBox mono">
            <span class="runnerPill ${cpu.isRunning() ? "run" : "stop"}">${statusText}</span>
            <span>PC ${hexWord(pc)}</span>
            <span>OP ${hexByte(op)}</span>
            <span>bytes ${codeBytes}</span>
            <span>line: ${exactBadge}</span>
          </div>
        </section>

        <div class="runnerGrid">
          ${card("Ввід / шини", `
            ${kv("P3.6", p36, p36.startsWith("RX") ? "warn" : "ok")}
            ${kv("Натиснуто", pressedKeys || "-")}
            ${kv("Keypad col1", hexByte(keypadBus.col1))}
            ${kv("Keypad col2", hexByte(keypadBus.col2))}
            ${kv("Keypad col3", hexByte(keypadBus.col3))}
            ${kv("Joystick X", joy.x)}
            ${kv("Joystick Y", joy.y)}
          `)}

          ${card("Регістри CPU", kvList(coreRegs) + `<div class="runnerSub mono">Bank ${bank} · SP delta +${spDelta}</div>`)}

          ${card("Порти / SFR", kvList(ports) + `<hr class="runnerHr"/>` + kvList(sfrs))}

          ${card("R0–R7 активного банку", kvList(regsR))}

          ${card("LCD", `<pre class="runnerPre mono">${escapeHtml(lcdRows.join("\n") || "-")}</pre>`, "wide lcdCard")}

          ${card("Стек", smallTable(stackRows, ["Addr", "Value", "Mark"]))}

          ${card("IRAM 0x00..0x1F", smallTable(iramRows, ["Addr", "Bytes"]) + `${kv("XRAM 00..07", xramPreview)}`)}

          ${card("Потік виконання", `
            ${kv("current PC", hexWord(pc))}
            ${kv("ASM line", lineNo != null ? `L${lineNo}` : "-")}
            ${kv("last known", flow.lastKnown)}
            ${kv("last CALL/RET", flow.lastCallRet)}
            ${kv("same-PC streak", flow.streak)}
            ${kv("recent PCs", flow.recent)}
          `, "wide")}
        </div>

        <section class="runnerCard runnerTraceCard">
          <h3>Trace — останні інструкції</h3>
          <table class="runnerTrace mono">
            <thead><tr><th>tick</th><th>PC</th><th>OP</th><th>ASM</th><th>ACC</th><th>P0</th><th>P2</th></tr></thead>
            <tbody>${traceRows || `<tr><td colspan="7">-</td></tr>`}</tbody>
          </table>
        </section>
      </div>
    `;
    }
    function syncRunButton() {
        runBtn.textContent = isRunning ? "Stop" : "Start";
        runBtn.className = `topBtn ${isRunning ? "red" : "green"}`;
    }
    function setSpeed(speed) {
        currentSpeed = speed;
        cpu.setSpeed(speedToBatch(currentSpeed));
        for (const item of speedButtons) {
            item.node.className = `topBtn speed ${item.speed === currentSpeed ? "active" : ""}`.trim();
        }
        updateRuntimeBar();
    }
    function updateLineNumbers() {
        const clean = trimTrailingEmptyLines(editor.value);
        const count = Math.max(1, clean.split(/\r?\n/).length);
        lineNumbers.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
        syncExecMarker();
    }
    function updateSyntaxHighlight() {
        const highlighted = sourceMode === "c" ? highlightC(editor.value) : highlightAsm(editor.value);
        codeHighlight.innerHTML = decorateHighlightedLines(highlighted, diagnosticLines, editor.value.endsWith("\n"));
        syncHighlightScroll();
    }
    function syncHighlightScroll() {
        codeHighlight.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
        syncAutocompleteGhostScroll();
    }
    function syncEditorScrollSlider() {
        const maxTop = Math.max(1, editor.scrollHeight - editor.clientHeight);
        const pct = Math.max(0, Math.min(100, (editor.scrollTop / maxTop) * 100));
        const thumbHeight = scrollThumb.offsetHeight || 34;
        const trackHeight = scrollSlider.clientHeight;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        scrollThumb.style.top = `${(pct / 100) * maxThumbTop}px`;
    }
    function syncExecMarker() {
        if (sourceMode !== "asm" || !programLoaded || !currentPcToLine.length) {
            execMarker.style.setProperty("--marker-opacity", "0");
            return;
        }
        const pc = cpu.getPC() & 0xffff;
        const hit = currentPcToLine.find((item) => item.pc === pc);
        if (!hit) {
            execMarker.style.setProperty("--marker-opacity", "0");
            return;
        }
        const logicalLines = trimTrailingEmptyLines(editor.value).split(/\r?\n/).length;
        if (hit.line > logicalLines) {
            execMarker.style.setProperty("--marker-opacity", "0");
            return;
        }
        const lineHeight = 13 * 1.55;
        const y = 10 + (hit.line - 1) * lineHeight - editor.scrollTop + lineHeight / 2 - 4;
        if (y < -8 || y > editor.clientHeight + 8) {
            execMarker.style.setProperty("--marker-opacity", "0");
            return;
        }
        execMarker.style.setProperty("--marker-top", `${Math.round(y)}px`);
        execMarker.style.setProperty("--marker-opacity", "1");
    }
    function updateEditorScrollFromPointer(event) {
        const rect = scrollSlider.getBoundingClientRect();
        const thumbHeight = scrollThumb.offsetHeight || 34;
        const y = Math.max(0, Math.min(rect.height - thumbHeight, event.clientY - rect.top - thumbHeight / 2));
        const pct = rect.height > thumbHeight ? y / (rect.height - thumbHeight) : 0;
        const maxTop = Math.max(1, editor.scrollHeight - editor.clientHeight);
        editor.scrollTop = pct * maxTop;
    }
    function syncJoystick() {
        board.setJoystick(joystickX, joystickY);
        const centerX = 50;
        const centerY = 50;
        const movePct = 34;
        const nx = (joystickX - 2048) / 2047;
        const ny = (joystickY - 2048) / 2047;
        joystickKnob.style.left = `${centerX + nx * movePct}%`;
        joystickKnob.style.top = `${centerY + ny * movePct}%`;
    }
    function updateJoystickFromPointer(event) {
        const rect = joystickFace.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const knobRadius = 17;
        const maxR = Math.max(6, Math.min(rect.width, rect.height) / 2 - knobRadius - 2);
        let dx = event.clientX - rect.left - cx;
        let dy = event.clientY - rect.top - cy;
        const r = Math.hypot(dx, dy);
        if (r > maxR) {
            const scale = maxR / r;
            dx *= scale;
            dy *= scale;
        }
        const nx = dx / maxR;
        const ny = dy / maxR;
        joystickX = Math.round(2048 + nx * 2047);
        joystickY = Math.round(2048 + ny * 2047);
        syncJoystick();
    }
    function draw() {
        board.render(drawContext, canvas.width, canvas.height);
        const now = performance.now();
        if (!cpu.isRunning() || now - lastUiUpdateTs >= 100) {
            updateRuntimeBar();
            lastUiUpdateTs = now;
        }
        window.requestAnimationFrame(draw);
    }
    updateLineNumbers();
    updateSyntaxHighlight();
    syncEditorScrollSlider();
    compileAndRender(false);
    syncJoystick();
    window.requestAnimationFrame(draw);
    return root;
}
function option(value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
}
function caption(text) {
    const node = el("div", { class: "boardCaption mono" });
    node.textContent = text;
    return node;
}
function button(text, tone = "") {
    const node = el("button", { class: `topBtn ${tone}`.trim() });
    node.textContent = text;
    return node;
}
function hexByte(value) {
    return "0x" + (value & 0xff).toString(16).padStart(2, "0").toUpperCase();
}
function hexWord(value) {
    return "0x" + (value & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}
function speedToBatch(speed) {
    // 1x should feel close to real board refresh speed.
    return Math.max(1, Math.round(speed * 16700));
}
function buildAsmGuideHints(source) {
    const text = source.replace(/\r/g, "");
    const hints = [];
    const labelMap = collectLabels(text);
    for (const [label, line] of labelMap) {
        const selfCall = new RegExp(`\\b(?:acall|lcall|call)\\s+${escapeRegExp(label)}\\b`, "i");
        const labelBlock = extractLabelBlock(text, label);
        if (labelBlock && selfCall.test(labelBlock)) {
            hints.push({
                level: "warning",
                line,
                message: `Рекурсивний виклик '${label}' може ламати стек. Для затримки краще цикл на DJNZ без CALL себе.`,
            });
        }
    }
    if (/\bpush\b/i.test(text) || /\bpop\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "PUSH/POP у delay часто дає stack overflow. Якщо є виліт PC — заміни на простий DJNZ-цикл без PUSH/POP.",
        });
    }
    if (/\bpush\s+_?temp0\b/i.test(text) || /\bpop\s+_?temp0\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "У цьому симуляторі `_Temp0` у PUSH/POP часто ламає стек у long-loop. Краще: `MOV R2,#...` + `DJNZ R2,label` без PUSH/POP.",
        });
    }
    if (/\bcolumn_1\b/i.test(text) && !/\bwaitrel\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "Для стабільної клавіатури додай блок WAITREL (чекати відпускання кнопки), інакше події дублюються.",
        });
    }
    if (/\bmov\s+p2\s*,\s*adr\b/i.test(text) && !/\bmov\s+p2\s*,\s*#0x?0+\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "Для запису на LCD/ST841 після `MOV P2,ADR` обов'язково має бути latch `MOV P2,#0x00`.",
        });
    }
    if (!/\borg\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "Немає ORG. Додай `ORG 0x0000`, щоб старт адреси був коректний.",
        });
    }
    return hints;
}
function collectLabels(source) {
    const lines = source.split("\n");
    const out = new Map();
    for (let i = 0; i < lines.length; i++) {
        const clean = lines[i].replace(/;.*$/, "").trim();
        const m = /^([A-Za-z_.$?][\w.$?]*):/.exec(clean);
        if (m)
            out.set(m[1], i + 1);
    }
    return out;
}
function extractLabelBlock(source, label) {
    const lines = source.split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (new RegExp(`^\\s*${escapeRegExp(label)}\\s*:`).test(lines[i])) {
            start = i;
            break;
        }
    }
    if (start < 0)
        return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\s*[A-Za-z_.$?][\w.$?]*\s*:/.test(lines[i])) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join("\n");
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function formatCount(value) {
    if (value < 1000)
        return String(value);
    if (value < 1000000)
        return `${(value / 1000).toFixed(1)}k`;
    if (value < 1000000000)
        return `${(value / 1000000).toFixed(1)}M`;
    return `${(value / 1000000000).toFixed(1)}G`;
}
function decodeInstruction(cpu) {
    const pc = cpu.getPC();
    const op = cpu.readCode(pc);
    if (op >= 0x78 && op <= 0x7f)
        return `MOV R${op - 0x78},#${hexByte(cpu.readCode(pc + 1))}`;
    if (op >= 0xd8 && op <= 0xdf)
        return `DJNZ R${op - 0xd8}`;
    if (op === 0x00)
        return "NOP";
    if (op === 0x02)
        return `LJMP ${hexWord((cpu.readCode(pc + 1) << 8) | cpu.readCode(pc + 2))}`;
    if (op === 0x03)
        return "RR A";
    if (op === 0x12)
        return `LCALL ${hexWord((cpu.readCode(pc + 1) << 8) | cpu.readCode(pc + 2))}`;
    if (op === 0x22)
        return "RET";
    if (op === 0x32)
        return "RETI";
    if (op === 0x74)
        return `MOV A,#${hexByte(cpu.readCode(pc + 1))}`;
    if (op === 0x75)
        return `MOV ${hexByte(cpu.readCode(pc + 1))},#${hexByte(cpu.readCode(pc + 2))}`;
    if (op === 0x80)
        return "SJMP";
    if (op === 0xa0)
        return "ORL C,/bit";
    if (op === 0xd2)
        return `SETB ${hexByte(cpu.readCode(pc + 1))}`;
    if (op === 0xf5)
        return `MOV ${hexByte(cpu.readCode(pc + 1))},A`;
    if (op >= 0xe8 && op <= 0xef)
        return `MOV A,R${op - 0xe8}`;
    return "EXEC";
}
function buildExecFlow(trace, currentPc, pcToLine) {
    const pc = currentPc & 0xffff;
    const hit = pcToLine.find((item) => item.pc === pc);
    const line = hit ? `ASM line: ${hit.line}` : "ASM line: -";
    let streak = 0;
    for (let i = trace.length - 1; i >= 0; i--) {
        if ((trace[i].pc & 0xffff) !== pc)
            break;
        streak += 1;
    }
    const recentPcs = trace
        .slice(-10)
        .map((item) => hexWord(item.pc))
        .join(" -> ");
    const pcs = pcToLine.map((item) => item.pc & 0xffff);
    const minPc = pcs.length ? Math.min(...pcs) : 0;
    const maxPc = pcs.length ? Math.max(...pcs) : 0;
    // ROM is full 64K space on 8051. Gaps between ORG blocks are valid and treated as NOP.
    const inKnownRange = pc >= 0x0000 && pc <= 0xffff;
    const prevKnown = pcToLine
        .filter((item) => (item.pc & 0xffff) <= pc)
        .sort((a, b) => b.pc - a.pc)[0];
    const lastCallRetTrace = [...trace]
        .reverse()
        .find((item) => isCallRetOpcode(item.opcode));
    const lastCallRet = lastCallRetTrace
        ? `${hexWord(lastCallRetTrace.pc)} OP ${hexByte(lastCallRetTrace.opcode)} ${decodeOpcodeName(lastCallRetTrace.opcode)}`
        : "-";
    return {
        current: `current PC: ${hexWord(pc)}`,
        line,
        streak,
        recent: recentPcs || "-",
        range: "0x0000 .. 0xFFFF",
        inRange: inKnownRange ? "yes" : "no",
        lastKnown: prevKnown ? `PC ${hexWord(prevKnown.pc)} line ${prevKnown.line}` : "-",
        lastCallRet,
    };
}
function isCallRetOpcode(op) {
    const code = op & 0xff;
    if (code === 0x12 || code === 0x22 || code === 0x32)
        return true;
    return (code & 0x1f) === 0x11;
}
function decodeOpcodeName(op) {
    const code = op & 0xff;
    if (code === 0x12)
        return "LCALL";
    if ((code & 0x1f) === 0x11)
        return "ACALL";
    if (code === 0x22)
        return "RET";
    if (code === 0x32)
        return "RETI";
    return "OP";
}
function trimTrailingEmptyLines(text) {
    const normalized = text.replace(/\r/g, "");
    const trimmed = normalized.replace(/\n+$/g, "");
    return trimmed.length ? trimmed : "";
}
function normalizeEditorText(text) {
    const normalized = text.replace(/\r\n?/g, "\n");
    return normalized.replace(/\n{3,}/g, "\n\n");
}
function decorateHighlightedLines(highlighted, diagnosticLines, endsWithNewline) {
    const lines = highlighted.split("\n");
    const decorated = lines.map((line, index) => {
        const lineNo = index + 1;
        const level = diagnosticLines.get(lineNo);
        if (!level)
            return line || " ";
        const cls = level === "error" ? "diag-line diag-error" : "diag-line diag-warning";
        return `<span class="${cls}">${line || " "}</span>`;
    });
    return decorated.join("\n") + (endsWithNewline ? "\n" : "");
}
function buildDiagnosticLineMap(list) {
    const map = new Map();
    for (const item of list) {
        if (item.line == null)
            continue;
        if (item.level !== "error" && item.level !== "warning")
            continue;
        const prev = map.get(item.line);
        if (prev === "error")
            continue;
        map.set(item.line, item.level);
    }
    return map;
}
function highlightAsm(source) {
    return source
        .split("\n")
        .map((line) => highlightAsmLine(line))
        .join("\n");
}
function highlightC(source) {
    return highlightCLines(source);
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


const CODE_COMPLETIONS = [
    {
        "mode": "asm",
        "trigger": "mov",
        "label": "MOV",
        "description": "8051 move instruction",
        "insertText": "MOV "
    },
    {
        "mode": "asm",
        "trigger": "movimm",
        "label": "MOV immediate",
        "description": "MOV A,#0x00",
        "insertText": "MOV A,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "movp0",
        "label": "MOV P0 immediate",
        "description": "MOV P0,#0x00",
        "insertText": "MOV P0,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "movp2",
        "label": "MOV P2 immediate",
        "description": "MOV P2,#0x00",
        "insertText": "MOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "setb",
        "label": "SETB bit",
        "description": "SETB ",
        "insertText": "SETB "
    },
    {
        "mode": "asm",
        "trigger": "clr",
        "label": "CLR bit/A/C",
        "description": "CLR ",
        "insertText": "CLR "
    },
    {
        "mode": "asm",
        "trigger": "call",
        "label": "CALL label",
        "description": "CALL ",
        "insertText": "CALL "
    },
    {
        "mode": "asm",
        "trigger": "ret",
        "label": "RET",
        "description": "RET",
        "insertText": "RET"
    },
    {
        "mode": "asm",
        "trigger": "jmp",
        "label": "JMP label",
        "description": "JMP ",
        "insertText": "JMP "
    },
    {
        "mode": "asm",
        "trigger": "sjmp",
        "label": "SJMP label",
        "description": "SJMP ",
        "insertText": "SJMP "
    },
    {
        "mode": "asm",
        "trigger": "djnz",
        "label": "DJNZ loop",
        "description": "DJNZ R7,",
        "insertText": "DJNZ R7,"
    },
    {
        "mode": "asm",
        "trigger": "cjne",
        "label": "CJNE compare",
        "description": "CJNE A,#0x00,",
        "insertText": "CJNE A,#0x00,"
    },
    {
        "mode": "asm",
        "trigger": "jnb",
        "label": "JNB bit,label",
        "description": "JNB ",
        "insertText": "JNB "
    },
    {
        "mode": "asm",
        "trigger": "jb",
        "label": "JB bit,label",
        "description": "JB ",
        "insertText": "JB "
    },
    {
        "mode": "asm",
        "trigger": "jz",
        "label": "JZ label",
        "description": "JZ ",
        "insertText": "JZ "
    },
    {
        "mode": "asm",
        "trigger": "jnz",
        "label": "JNZ label",
        "description": "JNZ ",
        "insertText": "JNZ "
    },
    {
        "mode": "asm",
        "trigger": "inc",
        "label": "INC",
        "description": "INC ",
        "insertText": "INC "
    },
    {
        "mode": "asm",
        "trigger": "dec",
        "label": "DEC",
        "description": "DEC ",
        "insertText": "DEC "
    },
    {
        "mode": "asm",
        "trigger": "add",
        "label": "ADD A,#imm",
        "description": "ADD A,#0x00",
        "insertText": "ADD A,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "subb",
        "label": "SUBB A,#imm",
        "description": "SUBB A,#0x00",
        "insertText": "SUBB A,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "anl",
        "label": "ANL A,#mask",
        "description": "ANL A,#0x0F",
        "insertText": "ANL A,#0x0F"
    },
    {
        "mode": "asm",
        "trigger": "orl",
        "label": "ORL A,#mask",
        "description": "ORL A,#0x00",
        "insertText": "ORL A,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "xrl",
        "label": "XRL A,#mask",
        "description": "XRL A,#0x00",
        "insertText": "XRL A,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "rl",
        "label": "RL A",
        "description": "RL A",
        "insertText": "RL A"
    },
    {
        "mode": "asm",
        "trigger": "rr",
        "label": "RR A",
        "description": "RR A",
        "insertText": "RR A"
    },
    {
        "mode": "asm",
        "trigger": "swap",
        "label": "SWAP A",
        "description": "SWAP A",
        "insertText": "SWAP A"
    },
    {
        "mode": "asm",
        "trigger": "org",
        "label": "ORG",
        "description": "ORG 0x0000",
        "insertText": "ORG 0x0000"
    },
    {
        "mode": "asm",
        "trigger": "end",
        "label": "END",
        "description": "END",
        "insertText": "END"
    },
    {
        "mode": "asm",
        "trigger": "equ",
        "label": "EQU",
        "description": "NAME EQU 0x20",
        "insertText": "NAME EQU 0x20"
    },
    {
        "mode": "asm",
        "trigger": "data",
        "label": "DATA SFR alias",
        "description": "ADCCON2 DATA 0D8H",
        "insertText": "ADCCON2 DATA 0D8H"
    },
    {
        "mode": "asm",
        "trigger": "bit",
        "label": "BIT alias",
        "description": "ADCI BIT 0DFH",
        "insertText": "ADCI BIT 0DFH"
    },
    {
        "mode": "asm",
        "trigger": "db",
        "label": "DB bytes",
        "description": "DB 0x00",
        "insertText": "DB 0x00"
    },
    {
        "mode": "asm",
        "trigger": "dw",
        "label": "DW word",
        "description": "DW 0x0000",
        "insertText": "DW 0x0000"
    },
    {
        "mode": "asm",
        "trigger": "base",
        "label": "ASM base template",
        "description": "ORG 0x0000\n\nSTART:\n    MOV SP,#0x2F\n\nMAIN:\n    JMP MAIN\n\nEND",
        "insertText": "ORG 0x0000\n\nSTART:\n    MOV SP,#0x2F\n\nMAIN:\n    JMP MAIN\n\nEND"
    },
    {
        "mode": "asm",
        "trigger": "write",
        "label": "ST841 write routine",
        "description": "WRIT:\n    SETB P3.6\n    MOV P0,DAT\n    MOV P2,ADR\n    NOP\n    MOV P2,#0x00\n    RET",
        "insertText": "WRIT:\n    SETB P3.6\n    MOV P0,DAT\n    MOV P2,ADR\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "buswrite",
        "label": "Direct ST841 bus write",
        "description": "SETB P3.6\nMOV P0,#0x00\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "SETB P3.6\nMOV P0,#0x00\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "delay",
        "label": "Delay routine",
        "description": "DELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET",
        "insertText": "DELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "ledoff",
        "label": "LED line off",
        "description": "MOV P0,#11111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "ledall",
        "label": "LED line all on",
        "description": "MOV P0,#00000000b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#00000000b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led1",
        "label": "LED 1 on",
        "description": "MOV P0,#11111110b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11111110b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led2",
        "label": "LED 2 on",
        "description": "MOV P0,#11111101b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11111101b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led3",
        "label": "LED 3 on",
        "description": "MOV P0,#11111011b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11111011b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led4",
        "label": "LED 4 on",
        "description": "MOV P0,#11110111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11110111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led5",
        "label": "LED 5 on",
        "description": "MOV P0,#11101111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11101111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led6",
        "label": "LED 6 on",
        "description": "MOV P0,#11011111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#11011111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led7",
        "label": "LED 7 on",
        "description": "MOV P0,#10111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#10111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "led8",
        "label": "LED 8 on",
        "description": "MOV P0,#01111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#01111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "ledrun",
        "label": "LED running light",
        "description": "MAIN:\n    MOV P0,#11111110b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    MOV P0,#11111101b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    JMP MAIN",
        "insertText": "MAIN:\n    MOV P0,#11111110b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    MOV P0,#11111101b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    JMP MAIN"
    },
    {
        "mode": "asm",
        "trigger": "adcregs",
        "label": "ADuC ADC register aliases",
        "description": "ADCCON1  DATA 0EFH\nADCCON2  DATA 0D8H\nADCDATAL DATA 0D9H\nADCDATAH DATA 0DAH\nADCI     BIT 0DFH\nSCONV    BIT 0DCH",
        "insertText": "ADCCON1  DATA 0EFH\nADCCON2  DATA 0D8H\nADCDATAL DATA 0D9H\nADCDATAH DATA 0DAH\nADCI     BIT 0DFH\nSCONV    BIT 0DCH"
    },
    {
        "mode": "asm",
        "trigger": "adc6",
        "label": "Read joystick X ADC6",
        "description": "READ_ADC6:\n    MOV ADCCON2,#6h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC6:\n    JNB ADCI,WAIT_ADC6\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET",
        "insertText": "READ_ADC6:\n    MOV ADCCON2,#6h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC6:\n    JNB ADCI,WAIT_ADC6\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "adc7",
        "label": "Read joystick Y ADC7",
        "description": "READ_ADC7:\n    MOV ADCCON2,#7h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC7:\n    JNB ADCI,WAIT_ADC7\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET",
        "insertText": "READ_ADC7:\n    MOV ADCCON2,#7h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC7:\n    JNB ADCI,WAIT_ADC7\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "joyled",
        "label": "Joystick X to LED",
        "description": "MAIN:\n    CALL READ_ADC6\n    CJNE A,#0x08,JOY_LEFT\n    MOV P0,#11100111b\n    SJMP JOY_OUT\nJOY_LEFT:\n    JC JOY_LOW\n    MOV P0,#01111111b\n    SJMP JOY_OUT\nJOY_LOW:\n    MOV P0,#11111110b\nJOY_OUT:\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    JMP MAIN",
        "insertText": "MAIN:\n    CALL READ_ADC6\n    CJNE A,#0x08,JOY_LEFT\n    MOV P0,#11100111b\n    SJMP JOY_OUT\nJOY_LEFT:\n    JC JOY_LOW\n    MOV P0,#01111111b\n    SJMP JOY_OUT\nJOY_LOW:\n    MOV P0,#11111110b\nJOY_OUT:\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    JMP MAIN"
    },
    {
        "mode": "asm",
        "trigger": "keypadcols",
        "label": "Keypad column read constants",
        "description": "; P2=0x60 col1, P2=0x50 col2, P2=0x30 col3\n; row values: 0x0E,0x0D,0x0B,0x07",
        "insertText": "; P2=0x60 col1, P2=0x50 col2, P2=0x30 col3\n; row values: 0x0E,0x0D,0x0B,0x07"
    },
    {
        "mode": "asm",
        "trigger": "keycol1",
        "label": "Read keypad column 1",
        "description": "CLR P3.6\nMOV P2,#0x60\nMOV A,P0\nANL A,#0x0F",
        "insertText": "CLR P3.6\nMOV P2,#0x60\nMOV A,P0\nANL A,#0x0F"
    },
    {
        "mode": "asm",
        "trigger": "keycol2",
        "label": "Read keypad column 2",
        "description": "CLR P3.6\nMOV P2,#0x50\nMOV A,P0\nANL A,#0x0F",
        "insertText": "CLR P3.6\nMOV P2,#0x50\nMOV A,P0\nANL A,#0x0F"
    },
    {
        "mode": "asm",
        "trigger": "keycol3",
        "label": "Read keypad column 3",
        "description": "CLR P3.6\nMOV P2,#0x30\nMOV A,P0\nANL A,#0x0F",
        "insertText": "CLR P3.6\nMOV P2,#0x30\nMOV A,P0\nANL A,#0x0F"
    },
    {
        "mode": "asm",
        "trigger": "lcdaddr",
        "label": "LCD address write",
        "description": "MOV P0,DAT\nMOV P2,#0x08\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,DAT\nMOV P2,#0x08\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "lcdclear",
        "label": "LCD clear command nibbles",
        "description": "MOV P0,#0x00\nMOV P2,#0x08\nNOP\nMOV P2,#0x00\nMOV P0,#0x10\nMOV P2,#0x08\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#0x00\nMOV P2,#0x08\nNOP\nMOV P2,#0x00\nMOV P0,#0x10\nMOV P2,#0x08\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "lcdchar3",
        "label": "LCD print character 3",
        "description": "MOV P0,#0x31\nMOV P2,#0x08\nNOP\nMOV P2,#0x00\nMOV P0,#0x31\nMOV P2,#0x08\nNOP\nMOV P2,#0x00",
        "insertText": "MOV P0,#0x31\nMOV P2,#0x08\nNOP\nMOV P2,#0x00\nMOV P0,#0x31\nMOV P2,#0x08\nNOP\nMOV P2,#0x00"
    },
    {
        "mode": "asm",
        "trigger": "sp",
        "label": "Safe stack pointer",
        "description": "MOV SP,#0x2F",
        "insertText": "MOV SP,#0x2F"
    },
    {
        "mode": "asm",
        "trigger": "xramwrite",
        "label": "MOVX write @DPTR",
        "description": "MOV DPTR,#0x2000\nMOV A,#0x55\nMOVX @DPTR,A",
        "insertText": "MOV DPTR,#0x2000\nMOV A,#0x55\nMOVX @DPTR,A"
    },
    {
        "mode": "asm",
        "trigger": "xramread",
        "label": "MOVX read @DPTR",
        "description": "MOV DPTR,#0x2000\nMOVX A,@DPTR",
        "insertText": "MOV DPTR,#0x2000\nMOVX A,@DPTR"
    },
    {
        "mode": "asm",
        "trigger": "acall",
        "label": "ACALL",
        "description": "8051 instruction mnemonic",
        "insertText": "ACALL "
    },
    {
        "mode": "asm",
        "trigger": "add",
        "label": "ADD",
        "description": "8051 instruction mnemonic",
        "insertText": "ADD "
    },
    {
        "mode": "asm",
        "trigger": "ajmp",
        "label": "AJMP",
        "description": "8051 instruction mnemonic",
        "insertText": "AJMP "
    },
    {
        "mode": "asm",
        "trigger": "anl",
        "label": "ANL",
        "description": "8051 instruction mnemonic",
        "insertText": "ANL "
    },
    {
        "mode": "asm",
        "trigger": "cjb",
        "label": "CJB",
        "description": "8051 instruction mnemonic",
        "insertText": "CJB "
    },
    {
        "mode": "asm",
        "trigger": "cjne",
        "label": "CJNE",
        "description": "8051 instruction mnemonic",
        "insertText": "CJNE "
    },
    {
        "mode": "asm",
        "trigger": "clr",
        "label": "CLR",
        "description": "8051 instruction mnemonic",
        "insertText": "CLR "
    },
    {
        "mode": "asm",
        "trigger": "cpl",
        "label": "CPL",
        "description": "8051 instruction mnemonic",
        "insertText": "CPL "
    },
    {
        "mode": "asm",
        "trigger": "da",
        "label": "DA",
        "description": "8051 instruction mnemonic",
        "insertText": "DA "
    },
    {
        "mode": "asm",
        "trigger": "dec",
        "label": "DEC",
        "description": "8051 instruction mnemonic",
        "insertText": "DEC "
    },
    {
        "mode": "asm",
        "trigger": "div",
        "label": "DIV",
        "description": "8051 instruction mnemonic",
        "insertText": "DIV "
    },
    {
        "mode": "asm",
        "trigger": "djnz",
        "label": "DJNZ",
        "description": "8051 instruction mnemonic",
        "insertText": "DJNZ "
    },
    {
        "mode": "asm",
        "trigger": "inc",
        "label": "INC",
        "description": "8051 instruction mnemonic",
        "insertText": "INC "
    },
    {
        "mode": "asm",
        "trigger": "jb",
        "label": "JB",
        "description": "8051 instruction mnemonic",
        "insertText": "JB "
    },
    {
        "mode": "asm",
        "trigger": "jbc",
        "label": "JBC",
        "description": "8051 instruction mnemonic",
        "insertText": "JBC "
    },
    {
        "mode": "asm",
        "trigger": "jc",
        "label": "JC",
        "description": "8051 instruction mnemonic",
        "insertText": "JC "
    },
    {
        "mode": "asm",
        "trigger": "jnb",
        "label": "JNB",
        "description": "8051 instruction mnemonic",
        "insertText": "JNB "
    },
    {
        "mode": "asm",
        "trigger": "jnc",
        "label": "JNC",
        "description": "8051 instruction mnemonic",
        "insertText": "JNC "
    },
    {
        "mode": "asm",
        "trigger": "jnz",
        "label": "JNZ",
        "description": "8051 instruction mnemonic",
        "insertText": "JNZ "
    },
    {
        "mode": "asm",
        "trigger": "jz",
        "label": "JZ",
        "description": "8051 instruction mnemonic",
        "insertText": "JZ "
    },
    {
        "mode": "asm",
        "trigger": "lcall",
        "label": "LCALL",
        "description": "8051 instruction mnemonic",
        "insertText": "LCALL "
    },
    {
        "mode": "asm",
        "trigger": "ljmp",
        "label": "LJMP",
        "description": "8051 instruction mnemonic",
        "insertText": "LJMP "
    },
    {
        "mode": "asm",
        "trigger": "mov",
        "label": "MOV",
        "description": "8051 instruction mnemonic",
        "insertText": "MOV "
    },
    {
        "mode": "asm",
        "trigger": "movc",
        "label": "MOVC",
        "description": "8051 instruction mnemonic",
        "insertText": "MOVC "
    },
    {
        "mode": "asm",
        "trigger": "movx",
        "label": "MOVX",
        "description": "8051 instruction mnemonic",
        "insertText": "MOVX "
    },
    {
        "mode": "asm",
        "trigger": "mul",
        "label": "MUL",
        "description": "8051 instruction mnemonic",
        "insertText": "MUL "
    },
    {
        "mode": "asm",
        "trigger": "nop",
        "label": "NOP",
        "description": "8051 instruction mnemonic",
        "insertText": "NOP"
    },
    {
        "mode": "asm",
        "trigger": "orl",
        "label": "ORL",
        "description": "8051 instruction mnemonic",
        "insertText": "ORL "
    },
    {
        "mode": "asm",
        "trigger": "pop",
        "label": "POP",
        "description": "8051 instruction mnemonic",
        "insertText": "POP "
    },
    {
        "mode": "asm",
        "trigger": "push",
        "label": "PUSH",
        "description": "8051 instruction mnemonic",
        "insertText": "PUSH "
    },
    {
        "mode": "asm",
        "trigger": "ret",
        "label": "RET",
        "description": "8051 instruction mnemonic",
        "insertText": "RET"
    },
    {
        "mode": "asm",
        "trigger": "reti",
        "label": "RETI",
        "description": "8051 instruction mnemonic",
        "insertText": "RETI"
    },
    {
        "mode": "asm",
        "trigger": "rl",
        "label": "RL",
        "description": "8051 instruction mnemonic",
        "insertText": "RL "
    },
    {
        "mode": "asm",
        "trigger": "rr",
        "label": "RR",
        "description": "8051 instruction mnemonic",
        "insertText": "RR "
    },
    {
        "mode": "asm",
        "trigger": "rrc",
        "label": "RRC",
        "description": "8051 instruction mnemonic",
        "insertText": "RRC "
    },
    {
        "mode": "asm",
        "trigger": "setb",
        "label": "SETB",
        "description": "8051 instruction mnemonic",
        "insertText": "SETB "
    },
    {
        "mode": "asm",
        "trigger": "subb",
        "label": "SUBB",
        "description": "8051 instruction mnemonic",
        "insertText": "SUBB "
    },
    {
        "mode": "asm",
        "trigger": "swap",
        "label": "SWAP",
        "description": "8051 instruction mnemonic",
        "insertText": "SWAP "
    },
    {
        "mode": "asm",
        "trigger": "xch",
        "label": "XCH",
        "description": "8051 instruction mnemonic",
        "insertText": "XCH "
    },
    {
        "mode": "asm",
        "trigger": "xrl",
        "label": "XRL",
        "description": "8051 instruction mnemonic",
        "insertText": "XRL "
    },
    {
        "mode": "asm",
        "trigger": "a",
        "label": "A",
        "description": "8051 register/SFR",
        "insertText": "A"
    },
    {
        "mode": "asm",
        "trigger": "acc",
        "label": "ACC",
        "description": "8051 register/SFR",
        "insertText": "ACC"
    },
    {
        "mode": "asm",
        "trigger": "b",
        "label": "B",
        "description": "8051 register/SFR",
        "insertText": "B"
    },
    {
        "mode": "asm",
        "trigger": "c",
        "label": "C",
        "description": "8051 register/SFR",
        "insertText": "C"
    },
    {
        "mode": "asm",
        "trigger": "dptr",
        "label": "DPTR",
        "description": "8051 register/SFR",
        "insertText": "DPTR"
    },
    {
        "mode": "asm",
        "trigger": "dpl",
        "label": "DPL",
        "description": "8051 register/SFR",
        "insertText": "DPL"
    },
    {
        "mode": "asm",
        "trigger": "dph",
        "label": "DPH",
        "description": "8051 register/SFR",
        "insertText": "DPH"
    },
    {
        "mode": "asm",
        "trigger": "psw",
        "label": "PSW",
        "description": "8051 register/SFR",
        "insertText": "PSW"
    },
    {
        "mode": "asm",
        "trigger": "sp",
        "label": "SP",
        "description": "8051 register/SFR",
        "insertText": "SP"
    },
    {
        "mode": "asm",
        "trigger": "p0",
        "label": "P0",
        "description": "8051 register/SFR",
        "insertText": "P0"
    },
    {
        "mode": "asm",
        "trigger": "p1",
        "label": "P1",
        "description": "8051 register/SFR",
        "insertText": "P1"
    },
    {
        "mode": "asm",
        "trigger": "p2",
        "label": "P2",
        "description": "8051 register/SFR",
        "insertText": "P2"
    },
    {
        "mode": "asm",
        "trigger": "p3",
        "label": "P3",
        "description": "8051 register/SFR",
        "insertText": "P3"
    },
    {
        "mode": "asm",
        "trigger": "r0",
        "label": "R0",
        "description": "8051 register/SFR",
        "insertText": "R0"
    },
    {
        "mode": "asm",
        "trigger": "r1",
        "label": "R1",
        "description": "8051 register/SFR",
        "insertText": "R1"
    },
    {
        "mode": "asm",
        "trigger": "r2",
        "label": "R2",
        "description": "8051 register/SFR",
        "insertText": "R2"
    },
    {
        "mode": "asm",
        "trigger": "r3",
        "label": "R3",
        "description": "8051 register/SFR",
        "insertText": "R3"
    },
    {
        "mode": "asm",
        "trigger": "r4",
        "label": "R4",
        "description": "8051 register/SFR",
        "insertText": "R4"
    },
    {
        "mode": "asm",
        "trigger": "r5",
        "label": "R5",
        "description": "8051 register/SFR",
        "insertText": "R5"
    },
    {
        "mode": "asm",
        "trigger": "r6",
        "label": "R6",
        "description": "8051 register/SFR",
        "insertText": "R6"
    },
    {
        "mode": "asm",
        "trigger": "r7",
        "label": "R7",
        "description": "8051 register/SFR",
        "insertText": "R7"
    },
    {
        "mode": "asm",
        "trigger": "tl0",
        "label": "TL0",
        "description": "8051 register/SFR",
        "insertText": "TL0"
    },
    {
        "mode": "asm",
        "trigger": "th0",
        "label": "TH0",
        "description": "8051 register/SFR",
        "insertText": "TH0"
    },
    {
        "mode": "asm",
        "trigger": "tl1",
        "label": "TL1",
        "description": "8051 register/SFR",
        "insertText": "TL1"
    },
    {
        "mode": "asm",
        "trigger": "th1",
        "label": "TH1",
        "description": "8051 register/SFR",
        "insertText": "TH1"
    },
    {
        "mode": "asm",
        "trigger": "tcon",
        "label": "TCON",
        "description": "8051 register/SFR",
        "insertText": "TCON"
    },
    {
        "mode": "asm",
        "trigger": "tmod",
        "label": "TMOD",
        "description": "8051 register/SFR",
        "insertText": "TMOD"
    },
    {
        "mode": "asm",
        "trigger": "ie",
        "label": "IE",
        "description": "8051 register/SFR",
        "insertText": "IE"
    },
    {
        "mode": "asm",
        "trigger": "ip",
        "label": "IP",
        "description": "8051 register/SFR",
        "insertText": "IP"
    },
    {
        "mode": "asm",
        "trigger": "scon",
        "label": "SCON",
        "description": "8051 register/SFR",
        "insertText": "SCON"
    },
    {
        "mode": "asm",
        "trigger": "sbuf",
        "label": "SBUF",
        "description": "8051 register/SFR",
        "insertText": "SBUF"
    },
    {
        "mode": "asm",
        "trigger": "adccon1",
        "label": "ADCCON1 DATA 0EFH",
        "description": "ST841/ADuC alias",
        "insertText": "ADCCON1 DATA 0EFH"
    },
    {
        "mode": "asm",
        "trigger": "adccon2",
        "label": "ADCCON2 DATA 0D8H",
        "description": "ST841/ADuC alias",
        "insertText": "ADCCON2 DATA 0D8H"
    },
    {
        "mode": "asm",
        "trigger": "adcdatal",
        "label": "ADCDATAL DATA 0D9H",
        "description": "ST841/ADuC alias",
        "insertText": "ADCDATAL DATA 0D9H"
    },
    {
        "mode": "asm",
        "trigger": "adcdatah",
        "label": "ADCDATAH DATA 0DAH",
        "description": "ST841/ADuC alias",
        "insertText": "ADCDATAH DATA 0DAH"
    },
    {
        "mode": "asm",
        "trigger": "adci",
        "label": "ADCI BIT 0DFH",
        "description": "ST841/ADuC alias",
        "insertText": "ADCI BIT 0DFH"
    },
    {
        "mode": "asm",
        "trigger": "sconv",
        "label": "SCONV BIT 0DCH",
        "description": "ST841/ADuC alias",
        "insertText": "SCONV BIT 0DCH"
    },
    {
        "mode": "asm",
        "trigger": "datr0",
        "label": "DAT EQU R0",
        "description": "ST841/ADuC alias",
        "insertText": "DAT EQU R0"
    },
    {
        "mode": "asm",
        "trigger": "adrr1",
        "label": "ADR EQU R1",
        "description": "ST841/ADuC alias",
        "insertText": "ADR EQU R1"
    },
    {
        "mode": "asm",
        "trigger": "temp1",
        "label": "Temp1 EQU R2",
        "description": "ST841/ADuC alias",
        "insertText": "Temp1 EQU R2"
    },
    {
        "mode": "asm",
        "trigger": "temp2",
        "label": "Temp2 EQU R3",
        "description": "ST841/ADuC alias",
        "insertText": "Temp2 EQU R3"
    },
    {
        "mode": "asm",
        "trigger": "sv1",
        "label": "sv1 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv1:\n    MOV P0,#11111110b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv2",
        "label": "sv2 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv2:\n    MOV P0,#11111101b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv3",
        "label": "sv3 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv3:\n    MOV P0,#11111011b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv4",
        "label": "sv4 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv4:\n    MOV P0,#11110111b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv5",
        "label": "sv5 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv5:\n    MOV P0,#11101111b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv6",
        "label": "sv6 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv6:\n    MOV P0,#11011111b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv7",
        "label": "sv7 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv7:\n    MOV P0,#10111111b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "asm",
        "trigger": "sv8",
        "label": "sv8 LED pattern",
        "description": "LED line subroutine",
        "insertText": "sv8:\n    MOV P0,#01111111b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    RET"
    },
    {
        "mode": "c",
        "trigger": "main",
        "label": "C main template",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  while(1){\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "while1",
        "label": "while forever",
        "description": "C/ST841 helper",
        "insertText": "while(1){\n  \n}"
    },
    {
        "mode": "c",
        "trigger": "if",
        "label": "if block",
        "description": "C/ST841 helper",
        "insertText": "if(condition){\n  \n}"
    },
    {
        "mode": "c",
        "trigger": "ifelse",
        "label": "if else block",
        "description": "C/ST841 helper",
        "insertText": "if(condition){\n  \n} else {\n  \n}"
    },
    {
        "mode": "c",
        "trigger": "for",
        "label": "for loop",
        "description": "C/ST841 helper",
        "insertText": "for(i=0; i<10; i++){\n  \n}"
    },
    {
        "mode": "c",
        "trigger": "delay",
        "label": "delay()",
        "description": "C/ST841 helper",
        "insertText": "delay();"
    },
    {
        "mode": "c",
        "trigger": "delayms",
        "label": "delay_ms(n)",
        "description": "C/ST841 helper",
        "insertText": "delay_ms(10);"
    },
    {
        "mode": "c",
        "trigger": "nop",
        "label": "nop()",
        "description": "C/ST841 helper",
        "insertText": "nop();"
    },
    {
        "mode": "c",
        "trigger": "_nop_",
        "label": "_nop_()",
        "description": "C/ST841 helper",
        "insertText": "_nop_();"
    },
    {
        "mode": "c",
        "trigger": "write",
        "label": "write(addr,data)",
        "description": "C/ST841 helper",
        "insertText": "write(0x07, 0xff);"
    },
    {
        "mode": "c",
        "trigger": "bus_write",
        "label": "bus_write(addr,data)",
        "description": "C/ST841 helper",
        "insertText": "bus_write(0x07, 0xff);"
    },
    {
        "mode": "c",
        "trigger": "st_write",
        "label": "st_write(addr,data)",
        "description": "C/ST841 helper",
        "insertText": "st_write(0x07, 0xff);"
    },
    {
        "mode": "c",
        "trigger": "led",
        "label": "led(value)",
        "description": "C/ST841 helper",
        "insertText": "led(0b11111110);"
    },
    {
        "mode": "c",
        "trigger": "leds",
        "label": "leds(value)",
        "description": "C/ST841 helper",
        "insertText": "leds(0b11111110);"
    },
    {
        "mode": "c",
        "trigger": "led_line",
        "label": "led_line(value)",
        "description": "C/ST841 helper",
        "insertText": "led_line(0b11111110);"
    },
    {
        "mode": "c",
        "trigger": "ledoff",
        "label": "led_off()",
        "description": "C/ST841 helper",
        "insertText": "led_off();"
    },
    {
        "mode": "c",
        "trigger": "ledall",
        "label": "led_all()",
        "description": "C/ST841 helper",
        "insertText": "led_all();"
    },
    {
        "mode": "c",
        "trigger": "ledon",
        "label": "led_on(n)",
        "description": "C/ST841 helper",
        "insertText": "led_on(1);"
    },
    {
        "mode": "c",
        "trigger": "blink",
        "label": "LED blink example",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  while(1){\n    led_on(1);\n    delay();\n    led_off();\n    delay();\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "ledrun",
        "label": "LED running example",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  unsigned char i;\n  while(1){\n    for(i=1; i<=8; i++){\n      led_on(i);\n      delay();\n    }\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "adc_read",
        "label": "adc_read(channel)",
        "description": "C/ST841 helper",
        "insertText": "adc_read(6)"
    },
    {
        "mode": "c",
        "trigger": "read_adc",
        "label": "read_adc(channel)",
        "description": "C/ST841 helper",
        "insertText": "read_adc(6)"
    },
    {
        "mode": "c",
        "trigger": "adclow",
        "label": "adc_low(channel)",
        "description": "C/ST841 helper",
        "insertText": "adc_low(6)"
    },
    {
        "mode": "c",
        "trigger": "joystick_x",
        "label": "joystick_x()",
        "description": "C/ST841 helper",
        "insertText": "joystick_x()"
    },
    {
        "mode": "c",
        "trigger": "joystick_y",
        "label": "joystick_y()",
        "description": "C/ST841 helper",
        "insertText": "joystick_y()"
    },
    {
        "mode": "c",
        "trigger": "joy_x",
        "label": "joy_x()",
        "description": "C/ST841 helper",
        "insertText": "joy_x()"
    },
    {
        "mode": "c",
        "trigger": "joy_y",
        "label": "joy_y()",
        "description": "C/ST841 helper",
        "insertText": "joy_y()"
    },
    {
        "mode": "c",
        "trigger": "joyled",
        "label": "Joystick to LED example",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  unsigned char x;\n  while(1){\n    x = joystick_x();\n    if(x < 4){\n      led_on(1);\n    } else {\n      led_on(8);\n    }\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "keypad_read",
        "label": "keypad_read(addr)",
        "description": "C/ST841 helper",
        "insertText": "keypad_read(0x60)"
    },
    {
        "mode": "c",
        "trigger": "key_read",
        "label": "key_read(addr)",
        "description": "C/ST841 helper",
        "insertText": "key_read(0x60)"
    },
    {
        "mode": "c",
        "trigger": "keypad_col1",
        "label": "keypad_col1()",
        "description": "C/ST841 helper",
        "insertText": "keypad_col1()"
    },
    {
        "mode": "c",
        "trigger": "keypad_col2",
        "label": "keypad_col2()",
        "description": "C/ST841 helper",
        "insertText": "keypad_col2()"
    },
    {
        "mode": "c",
        "trigger": "keypad_col3",
        "label": "keypad_col3()",
        "description": "C/ST841 helper",
        "insertText": "keypad_col3()"
    },
    {
        "mode": "c",
        "trigger": "keytest",
        "label": "Keypad test example",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  unsigned char k;\n  while(1){\n    k = keypad_col1();\n    if(k == 0x0e){ led_on(1); }\n    else { led_off(); }\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "lcd_init",
        "label": "lcd_init()",
        "description": "C/ST841 helper",
        "insertText": "lcd_init();"
    },
    {
        "mode": "c",
        "trigger": "lcd_clear",
        "label": "lcd_clear()",
        "description": "C/ST841 helper",
        "insertText": "lcd_clear();"
    },
    {
        "mode": "c",
        "trigger": "lcd_home",
        "label": "lcd_home()",
        "description": "C/ST841 helper",
        "insertText": "lcd_home();"
    },
    {
        "mode": "c",
        "trigger": "lcd_line",
        "label": "lcd_line(n)",
        "description": "C/ST841 helper",
        "insertText": "lcd_line(1);"
    },
    {
        "mode": "c",
        "trigger": "lcd_cmd",
        "label": "lcd_cmd(byte)",
        "description": "C/ST841 helper",
        "insertText": "lcd_cmd(0x01);"
    },
    {
        "mode": "c",
        "trigger": "lcd_data",
        "label": "lcd_data(byte)",
        "description": "C/ST841 helper",
        "insertText": "lcd_data('A');"
    },
    {
        "mode": "c",
        "trigger": "lcd_char",
        "label": "lcd_char(byte)",
        "description": "C/ST841 helper",
        "insertText": "lcd_char('A');"
    },
    {
        "mode": "c",
        "trigger": "lcd_putc",
        "label": "lcd_putc(byte)",
        "description": "C/ST841 helper",
        "insertText": "lcd_putc('A');"
    },
    {
        "mode": "c",
        "trigger": "lcd_print",
        "label": "lcd_print(\"TEXT\")",
        "description": "C/ST841 helper",
        "insertText": "lcd_print(\"HELLO\");"
    },
    {
        "mode": "c",
        "trigger": "lcd_puts",
        "label": "lcd_puts(\"TEXT\")",
        "description": "C/ST841 helper",
        "insertText": "lcd_puts(\"HELLO\");"
    },
    {
        "mode": "c",
        "trigger": "lcdhello",
        "label": "LCD hello example",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  lcd_init();\n  lcd_line(1);\n  lcd_print(\"HELLO\");\n  while(1){}\n}"
    },
    {
        "mode": "c",
        "trigger": "seg",
        "label": "seg(pos,pattern)",
        "description": "C/ST841 helper",
        "insertText": "seg(1, 0x3f);"
    },
    {
        "mode": "c",
        "trigger": "sevenseg",
        "label": "sevenseg(pos,pattern)",
        "description": "C/ST841 helper",
        "insertText": "sevenseg(1, 0x3f);"
    },
    {
        "mode": "c",
        "trigger": "seg_digit",
        "label": "seg_digit(pos,digit)",
        "description": "C/ST841 helper",
        "insertText": "seg_digit(1, 5);"
    },
    {
        "mode": "c",
        "trigger": "sevenseg_digit",
        "label": "sevenseg_digit(pos,digit)",
        "description": "C/ST841 helper",
        "insertText": "sevenseg_digit(1, 5);"
    },
    {
        "mode": "c",
        "trigger": "seg_clear",
        "label": "seg_clear()",
        "description": "C/ST841 helper",
        "insertText": "seg_clear();"
    },
    {
        "mode": "c",
        "trigger": "segcounter",
        "label": "7-segment counter",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  unsigned char i;\n  while(1){\n    for(i=0; i<10; i++){\n      seg_digit(1,i);\n      delay();\n    }\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "matrix",
        "label": "matrix(rows,cols)",
        "description": "C/ST841 helper",
        "insertText": "matrix(0xff, 0x01);"
    },
    {
        "mode": "c",
        "trigger": "matrix_write",
        "label": "matrix_write(rows,cols)",
        "description": "C/ST841 helper",
        "insertText": "matrix_write(0xff, 0x01);"
    },
    {
        "mode": "c",
        "trigger": "matrix_rows",
        "label": "matrix_rows(value)",
        "description": "C/ST841 helper",
        "insertText": "matrix_rows(0xff);"
    },
    {
        "mode": "c",
        "trigger": "matrix_cols",
        "label": "matrix_cols(value)",
        "description": "C/ST841 helper",
        "insertText": "matrix_cols(0x01);"
    },
    {
        "mode": "c",
        "trigger": "matrixtest",
        "label": "Matrix test",
        "description": "C/ST841 helper",
        "insertText": "void main(){\n  while(1){\n    matrix(0xff, 0x01);\n    delay();\n    matrix(0x00, 0x00);\n    delay();\n  }\n}"
    },
    {
        "mode": "c",
        "trigger": "sfr",
        "label": "sfr declaration",
        "description": "C/ST841 helper",
        "insertText": "sfr P0 = 0x80;"
    },
    {
        "mode": "c",
        "trigger": "sbit",
        "label": "sbit declaration",
        "description": "C/ST841 helper",
        "insertText": "sbit WR = P3^6;"
    },
    {
        "mode": "c",
        "trigger": "uchar",
        "label": "unsigned char variable",
        "description": "C/ST841 helper",
        "insertText": "unsigned char x;"
    },
    {
        "mode": "c",
        "trigger": "uint8",
        "label": "uint8_t variable",
        "description": "C/ST841 helper",
        "insertText": "uint8_t x;"
    },
    {
        "mode": "c",
        "trigger": "define",
        "label": "#define constant",
        "description": "C/ST841 helper",
        "insertText": "#define LED_ADDR 0x07"
    },
    {
        "mode": "c",
        "trigger": "auto",
        "label": "auto",
        "description": "C keyword",
        "insertText": "auto "
    },
    {
        "mode": "c",
        "trigger": "break",
        "label": "break",
        "description": "C keyword",
        "insertText": "break;"
    },
    {
        "mode": "c",
        "trigger": "case",
        "label": "case",
        "description": "C keyword",
        "insertText": "case "
    },
    {
        "mode": "c",
        "trigger": "char",
        "label": "char",
        "description": "C keyword",
        "insertText": "char "
    },
    {
        "mode": "c",
        "trigger": "const",
        "label": "const",
        "description": "C keyword",
        "insertText": "const "
    },
    {
        "mode": "c",
        "trigger": "continue",
        "label": "continue",
        "description": "C keyword",
        "insertText": "continue;"
    },
    {
        "mode": "c",
        "trigger": "default",
        "label": "default",
        "description": "C keyword",
        "insertText": "default "
    },
    {
        "mode": "c",
        "trigger": "do",
        "label": "do",
        "description": "C keyword",
        "insertText": "do "
    },
    {
        "mode": "c",
        "trigger": "double",
        "label": "double",
        "description": "C keyword",
        "insertText": "double "
    },
    {
        "mode": "c",
        "trigger": "else",
        "label": "else",
        "description": "C keyword",
        "insertText": "else "
    },
    {
        "mode": "c",
        "trigger": "enum",
        "label": "enum",
        "description": "C keyword",
        "insertText": "enum "
    },
    {
        "mode": "c",
        "trigger": "extern",
        "label": "extern",
        "description": "C keyword",
        "insertText": "extern "
    },
    {
        "mode": "c",
        "trigger": "float",
        "label": "float",
        "description": "C keyword",
        "insertText": "float "
    },
    {
        "mode": "c",
        "trigger": "for",
        "label": "for",
        "description": "C keyword",
        "insertText": "for "
    },
    {
        "mode": "c",
        "trigger": "goto",
        "label": "goto",
        "description": "C keyword",
        "insertText": "goto "
    },
    {
        "mode": "c",
        "trigger": "if",
        "label": "if",
        "description": "C keyword",
        "insertText": "if "
    },
    {
        "mode": "c",
        "trigger": "int",
        "label": "int",
        "description": "C keyword",
        "insertText": "int "
    },
    {
        "mode": "c",
        "trigger": "long",
        "label": "long",
        "description": "C keyword",
        "insertText": "long "
    },
    {
        "mode": "c",
        "trigger": "register",
        "label": "register",
        "description": "C keyword",
        "insertText": "register "
    },
    {
        "mode": "c",
        "trigger": "return",
        "label": "return",
        "description": "C keyword",
        "insertText": "return "
    },
    {
        "mode": "c",
        "trigger": "short",
        "label": "short",
        "description": "C keyword",
        "insertText": "short "
    },
    {
        "mode": "c",
        "trigger": "signed",
        "label": "signed",
        "description": "C keyword",
        "insertText": "signed "
    },
    {
        "mode": "c",
        "trigger": "sizeof",
        "label": "sizeof",
        "description": "C keyword",
        "insertText": "sizeof "
    },
    {
        "mode": "c",
        "trigger": "static",
        "label": "static",
        "description": "C keyword",
        "insertText": "static "
    },
    {
        "mode": "c",
        "trigger": "struct",
        "label": "struct",
        "description": "C keyword",
        "insertText": "struct "
    },
    {
        "mode": "c",
        "trigger": "switch",
        "label": "switch",
        "description": "C keyword",
        "insertText": "switch "
    },
    {
        "mode": "c",
        "trigger": "typedef",
        "label": "typedef",
        "description": "C keyword",
        "insertText": "typedef "
    },
    {
        "mode": "c",
        "trigger": "union",
        "label": "union",
        "description": "C keyword",
        "insertText": "union "
    },
    {
        "mode": "c",
        "trigger": "unsigned",
        "label": "unsigned",
        "description": "C keyword",
        "insertText": "unsigned "
    },
    {
        "mode": "c",
        "trigger": "void",
        "label": "void",
        "description": "C keyword",
        "insertText": "void "
    },
    {
        "mode": "c",
        "trigger": "volatile",
        "label": "volatile",
        "description": "C keyword",
        "insertText": "volatile "
    },
    {
        "mode": "c",
        "trigger": "while",
        "label": "while",
        "description": "C keyword",
        "insertText": "while "
    },
    {
        "mode": "c",
        "trigger": "uint8_t",
        "label": "uint8_t",
        "description": "C keyword",
        "insertText": "uint8_t "
    },
    {
        "mode": "c",
        "trigger": "uint16_t",
        "label": "uint16_t",
        "description": "C keyword",
        "insertText": "uint16_t "
    },
    {
        "mode": "c",
        "trigger": "include",
        "label": "include",
        "description": "C keyword",
        "insertText": "include "
    },
    {
        "mode": "c",
        "trigger": "define",
        "label": "define",
        "description": "C keyword",
        "insertText": "define "
    },
    {
        "mode": "c",
        "trigger": "led1",
        "label": "led_on(1)",
        "description": "Turn one LED on",
        "insertText": "led_on(1);"
    },
    {
        "mode": "c",
        "trigger": "led2",
        "label": "led_on(2)",
        "description": "Turn one LED on",
        "insertText": "led_on(2);"
    },
    {
        "mode": "c",
        "trigger": "led3",
        "label": "led_on(3)",
        "description": "Turn one LED on",
        "insertText": "led_on(3);"
    },
    {
        "mode": "c",
        "trigger": "led4",
        "label": "led_on(4)",
        "description": "Turn one LED on",
        "insertText": "led_on(4);"
    },
    {
        "mode": "c",
        "trigger": "led5",
        "label": "led_on(5)",
        "description": "Turn one LED on",
        "insertText": "led_on(5);"
    },
    {
        "mode": "c",
        "trigger": "led6",
        "label": "led_on(6)",
        "description": "Turn one LED on",
        "insertText": "led_on(6);"
    },
    {
        "mode": "c",
        "trigger": "led7",
        "label": "led_on(7)",
        "description": "Turn one LED on",
        "insertText": "led_on(7);"
    },
    {
        "mode": "c",
        "trigger": "led8",
        "label": "led_on(8)",
        "description": "Turn one LED on",
        "insertText": "led_on(8);"
    },
    {
        "mode": "c",
        "trigger": "led0000",
        "label": "led(0x00) all on",
        "description": "LED pattern",
        "insertText": "led(0x00);"
    },
    {
        "mode": "c",
        "trigger": "ledffff",
        "label": "led(0xff) off",
        "description": "LED pattern",
        "insertText": "led(0xff);"
    },
    {
        "mode": "c",
        "trigger": "digit0",
        "label": "seg_digit(1,0)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,0);"
    },
    {
        "mode": "c",
        "trigger": "digit1",
        "label": "seg_digit(1,1)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,1);"
    },
    {
        "mode": "c",
        "trigger": "digit2",
        "label": "seg_digit(1,2)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,2);"
    },
    {
        "mode": "c",
        "trigger": "digit3",
        "label": "seg_digit(1,3)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,3);"
    },
    {
        "mode": "c",
        "trigger": "digit4",
        "label": "seg_digit(1,4)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,4);"
    },
    {
        "mode": "c",
        "trigger": "digit5",
        "label": "seg_digit(1,5)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,5);"
    },
    {
        "mode": "c",
        "trigger": "digit6",
        "label": "seg_digit(1,6)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,6);"
    },
    {
        "mode": "c",
        "trigger": "digit7",
        "label": "seg_digit(1,7)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,7);"
    },
    {
        "mode": "c",
        "trigger": "digit8",
        "label": "seg_digit(1,8)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,8);"
    },
    {
        "mode": "c",
        "trigger": "digit9",
        "label": "seg_digit(1,9)",
        "description": "7-seg digit",
        "insertText": "seg_digit(1,9);"
    },
    {
        "mode": "c",
        "trigger": "line1",
        "label": "lcd_line(1)",
        "description": "LCD line select",
        "insertText": "lcd_line(1);"
    },
    {
        "mode": "c",
        "trigger": "line2",
        "label": "lcd_line(2)",
        "description": "LCD line select",
        "insertText": "lcd_line(2);"
    },
    {
        "mode": "c",
        "trigger": "line3",
        "label": "lcd_line(3)",
        "description": "LCD line select",
        "insertText": "lcd_line(3);"
    },
    {
        "mode": "c",
        "trigger": "line4",
        "label": "lcd_line(4)",
        "description": "LCD line select",
        "insertText": "lcd_line(4);"
    },
    {
        "mode": "c",
        "trigger": "puta",
        "label": "lcd_putc('A')",
        "description": "LCD character",
        "insertText": "lcd_putc('A');"
    },
    {
        "mode": "c",
        "trigger": "putb",
        "label": "lcd_putc('B')",
        "description": "LCD character",
        "insertText": "lcd_putc('B');"
    },
    {
        "mode": "c",
        "trigger": "putc",
        "label": "lcd_putc('C')",
        "description": "LCD character",
        "insertText": "lcd_putc('C');"
    },
    {
        "mode": "c",
        "trigger": "putd",
        "label": "lcd_putc('D')",
        "description": "LCD character",
        "insertText": "lcd_putc('D');"
    },
    {
        "mode": "c",
        "trigger": "pute",
        "label": "lcd_putc('E')",
        "description": "LCD character",
        "insertText": "lcd_putc('E');"
    },
    {
        "mode": "c",
        "trigger": "putf",
        "label": "lcd_putc('F')",
        "description": "LCD character",
        "insertText": "lcd_putc('F');"
    },
    {
        "mode": "c",
        "trigger": "putg",
        "label": "lcd_putc('G')",
        "description": "LCD character",
        "insertText": "lcd_putc('G');"
    },
    {
        "mode": "c",
        "trigger": "puth",
        "label": "lcd_putc('H')",
        "description": "LCD character",
        "insertText": "lcd_putc('H');"
    },
    {
        "mode": "c",
        "trigger": "puti",
        "label": "lcd_putc('I')",
        "description": "LCD character",
        "insertText": "lcd_putc('I');"
    },
    {
        "mode": "c",
        "trigger": "putj",
        "label": "lcd_putc('J')",
        "description": "LCD character",
        "insertText": "lcd_putc('J');"
    },
    {
        "mode": "c",
        "trigger": "putk",
        "label": "lcd_putc('K')",
        "description": "LCD character",
        "insertText": "lcd_putc('K');"
    },
    {
        "mode": "c",
        "trigger": "putl",
        "label": "lcd_putc('L')",
        "description": "LCD character",
        "insertText": "lcd_putc('L');"
    },
    {
        "mode": "c",
        "trigger": "putm",
        "label": "lcd_putc('M')",
        "description": "LCD character",
        "insertText": "lcd_putc('M');"
    },
    {
        "mode": "c",
        "trigger": "putn",
        "label": "lcd_putc('N')",
        "description": "LCD character",
        "insertText": "lcd_putc('N');"
    },
    {
        "mode": "c",
        "trigger": "puto",
        "label": "lcd_putc('O')",
        "description": "LCD character",
        "insertText": "lcd_putc('O');"
    },
    {
        "mode": "c",
        "trigger": "putp",
        "label": "lcd_putc('P')",
        "description": "LCD character",
        "insertText": "lcd_putc('P');"
    },
    {
        "mode": "c",
        "trigger": "putq",
        "label": "lcd_putc('Q')",
        "description": "LCD character",
        "insertText": "lcd_putc('Q');"
    },
    {
        "mode": "c",
        "trigger": "putr",
        "label": "lcd_putc('R')",
        "description": "LCD character",
        "insertText": "lcd_putc('R');"
    },
    {
        "mode": "c",
        "trigger": "puts",
        "label": "lcd_putc('S')",
        "description": "LCD character",
        "insertText": "lcd_putc('S');"
    },
    {
        "mode": "c",
        "trigger": "putt",
        "label": "lcd_putc('T')",
        "description": "LCD character",
        "insertText": "lcd_putc('T');"
    },
    {
        "mode": "c",
        "trigger": "putu",
        "label": "lcd_putc('U')",
        "description": "LCD character",
        "insertText": "lcd_putc('U');"
    },
    {
        "mode": "c",
        "trigger": "putv",
        "label": "lcd_putc('V')",
        "description": "LCD character",
        "insertText": "lcd_putc('V');"
    },
    {
        "mode": "c",
        "trigger": "putw",
        "label": "lcd_putc('W')",
        "description": "LCD character",
        "insertText": "lcd_putc('W');"
    },
    {
        "mode": "c",
        "trigger": "putx",
        "label": "lcd_putc('X')",
        "description": "LCD character",
        "insertText": "lcd_putc('X');"
    },
    {
        "mode": "c",
        "trigger": "puty",
        "label": "lcd_putc('Y')",
        "description": "LCD character",
        "insertText": "lcd_putc('Y');"
    },
    {
        "mode": "c",
        "trigger": "putz",
        "label": "lcd_putc('Z')",
        "description": "LCD character",
        "insertText": "lcd_putc('Z');"
    },
    {
        "mode": "c",
        "trigger": "put0",
        "label": "lcd_putc('0')",
        "description": "LCD character",
        "insertText": "lcd_putc('0');"
    },
    {
        "mode": "c",
        "trigger": "put1",
        "label": "lcd_putc('1')",
        "description": "LCD character",
        "insertText": "lcd_putc('1');"
    },
    {
        "mode": "c",
        "trigger": "put2",
        "label": "lcd_putc('2')",
        "description": "LCD character",
        "insertText": "lcd_putc('2');"
    },
    {
        "mode": "c",
        "trigger": "put3",
        "label": "lcd_putc('3')",
        "description": "LCD character",
        "insertText": "lcd_putc('3');"
    },
    {
        "mode": "c",
        "trigger": "put4",
        "label": "lcd_putc('4')",
        "description": "LCD character",
        "insertText": "lcd_putc('4');"
    },
    {
        "mode": "c",
        "trigger": "put5",
        "label": "lcd_putc('5')",
        "description": "LCD character",
        "insertText": "lcd_putc('5');"
    },
    {
        "mode": "c",
        "trigger": "put6",
        "label": "lcd_putc('6')",
        "description": "LCD character",
        "insertText": "lcd_putc('6');"
    },
    {
        "mode": "c",
        "trigger": "put7",
        "label": "lcd_putc('7')",
        "description": "LCD character",
        "insertText": "lcd_putc('7');"
    },
    {
        "mode": "c",
        "trigger": "put8",
        "label": "lcd_putc('8')",
        "description": "LCD character",
        "insertText": "lcd_putc('8');"
    },
    {
        "mode": "c",
        "trigger": "put9",
        "label": "lcd_putc('9')",
        "description": "LCD character",
        "insertText": "lcd_putc('9');"
    },
    {
        "mode": "c",
        "trigger": "addr_led",
        "label": "addr_led 0x07",
        "description": "ST841 address",
        "insertText": "0x07"
    },
    {
        "mode": "c",
        "trigger": "addr_lcd",
        "label": "addr_lcd 0x08",
        "description": "ST841 address",
        "insertText": "0x08"
    },
    {
        "mode": "c",
        "trigger": "addr_key1",
        "label": "addr_key1 0x60",
        "description": "ST841 address",
        "insertText": "0x60"
    },
    {
        "mode": "c",
        "trigger": "addr_key2",
        "label": "addr_key2 0x50",
        "description": "ST841 address",
        "insertText": "0x50"
    },
    {
        "mode": "c",
        "trigger": "addr_key3",
        "label": "addr_key3 0x30",
        "description": "ST841 address",
        "insertText": "0x30"
    },
    {
        "mode": "c",
        "trigger": "addr_cfg5",
        "label": "addr_cfg5 0x05",
        "description": "ST841 address",
        "insertText": "0x05"
    },
    {
        "mode": "c",
        "trigger": "addr_cfg6",
        "label": "addr_cfg6 0x06",
        "description": "ST841 address",
        "insertText": "0x06"
    },
    { "mode": "asm", "trigger": "mov_a_imm", "label": "MOV A immediate", "description": "8051 instruction snippet", "insertText": "MOV A,#0x00" },
    { "mode": "asm", "trigger": "mov_b_imm", "label": "MOV B immediate", "description": "8051 instruction snippet", "insertText": "MOV B,#0x00" },
    { "mode": "asm", "trigger": "mov_r0_imm", "label": "MOV R0 immediate", "description": "8051 instruction snippet", "insertText": "MOV R0,#0x00" },
    { "mode": "asm", "trigger": "mov_r1_imm", "label": "MOV R1 immediate", "description": "8051 instruction snippet", "insertText": "MOV R1,#0x00" },
    { "mode": "asm", "trigger": "mov_r2_imm", "label": "MOV R2 immediate", "description": "8051 instruction snippet", "insertText": "MOV R2,#0x00" },
    { "mode": "asm", "trigger": "mov_r3_imm", "label": "MOV R3 immediate", "description": "8051 instruction snippet", "insertText": "MOV R3,#0x00" },
    { "mode": "asm", "trigger": "mov_r4_imm", "label": "MOV R4 immediate", "description": "8051 instruction snippet", "insertText": "MOV R4,#0x00" },
    { "mode": "asm", "trigger": "mov_r5_imm", "label": "MOV R5 immediate", "description": "8051 instruction snippet", "insertText": "MOV R5,#0x00" },
    { "mode": "asm", "trigger": "mov_r6_imm", "label": "MOV R6 immediate", "description": "8051 instruction snippet", "insertText": "MOV R6,#0x00" },
    { "mode": "asm", "trigger": "mov_r7_imm", "label": "MOV R7 immediate", "description": "8051 instruction snippet", "insertText": "MOV R7,#0x00" },
    { "mode": "asm", "trigger": "mov_a_r0", "label": "MOV A,R0", "description": "8051 instruction snippet", "insertText": "MOV A,R0" },
    { "mode": "asm", "trigger": "mov_a_r1", "label": "MOV A,R1", "description": "8051 instruction snippet", "insertText": "MOV A,R1" },
    { "mode": "asm", "trigger": "mov_a_direct", "label": "MOV A,direct", "description": "8051 instruction snippet", "insertText": "MOV A,0x20" },
    { "mode": "asm", "trigger": "mov_direct_a", "label": "MOV direct,A", "description": "8051 instruction snippet", "insertText": "MOV 0x20,A" },
    { "mode": "asm", "trigger": "mov_direct_imm", "label": "MOV direct,#imm", "description": "8051 instruction snippet", "insertText": "MOV 0x20,#0x00" },
    { "mode": "asm", "trigger": "mov_dptr_imm", "label": "MOV DPTR,#addr", "description": "8051 instruction snippet", "insertText": "MOV DPTR,#0x2000" },
    { "mode": "asm", "trigger": "mov_p0_a", "label": "MOV P0,A", "description": "8051 instruction snippet", "insertText": "MOV P0,A" },
    { "mode": "asm", "trigger": "mov_p2_a", "label": "MOV P2,A", "description": "8051 instruction snippet", "insertText": "MOV P2,A" },
    { "mode": "asm", "trigger": "mov_a_p0", "label": "MOV A,P0", "description": "8051 instruction snippet", "insertText": "MOV A,P0" },
    { "mode": "asm", "trigger": "mov_a_p2", "label": "MOV A,P2", "description": "8051 instruction snippet", "insertText": "MOV A,P2" },
    { "mode": "asm", "trigger": "inc_a", "label": "INC A", "description": "8051 instruction snippet", "insertText": "INC A" },
    { "mode": "asm", "trigger": "dec_a", "label": "DEC A", "description": "8051 instruction snippet", "insertText": "DEC A" },
    { "mode": "asm", "trigger": "inc_dptr", "label": "INC DPTR", "description": "8051 instruction snippet", "insertText": "INC DPTR" },
    { "mode": "asm", "trigger": "inc_r0", "label": "INC R0", "description": "8051 instruction snippet", "insertText": "INC R0" },
    { "mode": "asm", "trigger": "dec_r0", "label": "DEC R0", "description": "8051 instruction snippet", "insertText": "DEC R0" },
    { "mode": "asm", "trigger": "add_a_r0", "label": "ADD A,R0", "description": "8051 instruction snippet", "insertText": "ADD A,R0" },
    { "mode": "asm", "trigger": "add_a_direct", "label": "ADD A,direct", "description": "8051 instruction snippet", "insertText": "ADD A,0x20" },
    { "mode": "asm", "trigger": "addc_a_imm", "label": "ADDC A,#imm", "description": "8051 instruction snippet", "insertText": "ADDC A,#0x00" },
    { "mode": "asm", "trigger": "subb_a_direct", "label": "SUBB A,direct", "description": "8051 instruction snippet", "insertText": "SUBB A,0x20" },
    { "mode": "asm", "trigger": "mul_ab", "label": "MUL AB", "description": "8051 instruction snippet", "insertText": "MUL AB" },
    { "mode": "asm", "trigger": "div_ab", "label": "DIV AB", "description": "8051 instruction snippet", "insertText": "DIV AB" },
    { "mode": "asm", "trigger": "da_a", "label": "DA A", "description": "8051 instruction snippet", "insertText": "DA A" },
    { "mode": "asm", "trigger": "anl_direct_imm", "label": "ANL direct,#mask", "description": "8051 instruction snippet", "insertText": "ANL 0x20,#0x0F" },
    { "mode": "asm", "trigger": "orl_direct_imm", "label": "ORL direct,#mask", "description": "8051 instruction snippet", "insertText": "ORL 0x20,#0x01" },
    { "mode": "asm", "trigger": "xrl_direct_imm", "label": "XRL direct,#mask", "description": "8051 instruction snippet", "insertText": "XRL 0x20,#0xFF" },
    { "mode": "asm", "trigger": "cpl_a", "label": "CPL A", "description": "8051 instruction snippet", "insertText": "CPL A" },
    { "mode": "asm", "trigger": "cpl_c", "label": "CPL C", "description": "8051 instruction snippet", "insertText": "CPL C" },
    { "mode": "asm", "trigger": "clr_c", "label": "CLR C", "description": "8051 instruction snippet", "insertText": "CLR C" },
    { "mode": "asm", "trigger": "setb_c", "label": "SETB C", "description": "8051 instruction snippet", "insertText": "SETB C" },
    { "mode": "asm", "trigger": "rlc_a", "label": "RLC A", "description": "8051 instruction snippet", "insertText": "RLC A" },
    { "mode": "asm", "trigger": "rrc_a", "label": "RRC A", "description": "8051 instruction snippet", "insertText": "RRC A" },
    { "mode": "asm", "trigger": "swap_a", "label": "SWAP A", "description": "8051 instruction snippet", "insertText": "SWAP A" },
    { "mode": "asm", "trigger": "push_acc", "label": "PUSH ACC", "description": "8051 instruction snippet", "insertText": "PUSH ACC" },
    { "mode": "asm", "trigger": "pop_acc", "label": "POP ACC", "description": "8051 instruction snippet", "insertText": "POP ACC" },
    { "mode": "asm", "trigger": "push_psw", "label": "PUSH PSW", "description": "8051 instruction snippet", "insertText": "PUSH PSW" },
    { "mode": "asm", "trigger": "pop_psw", "label": "POP PSW", "description": "8051 instruction snippet", "insertText": "POP PSW" },
    { "mode": "asm", "trigger": "acall", "label": "ACALL label", "description": "8051 instruction snippet", "insertText": "ACALL LABEL" },
    { "mode": "asm", "trigger": "lcall", "label": "LCALL label", "description": "8051 instruction snippet", "insertText": "LCALL LABEL" },
    { "mode": "asm", "trigger": "ljmp", "label": "LJMP label", "description": "8051 instruction snippet", "insertText": "LJMP LABEL" },
    { "mode": "asm", "trigger": "reti", "label": "RETI", "description": "8051 instruction snippet", "insertText": "RETI" },
    { "mode": "asm", "trigger": "nop", "label": "NOP", "description": "8051 instruction snippet", "insertText": "NOP" },
    { "mode": "asm", "trigger": "jc", "label": "JC label", "description": "8051 instruction snippet", "insertText": "JC LABEL" },
    { "mode": "asm", "trigger": "jnc", "label": "JNC label", "description": "8051 instruction snippet", "insertText": "JNC LABEL" },
    { "mode": "asm", "trigger": "jb_p36", "label": "JB P3.6,label", "description": "8051 instruction snippet", "insertText": "JB P3.6,LABEL" },
    { "mode": "asm", "trigger": "jnb_p36", "label": "JNB P3.6,label", "description": "8051 instruction snippet", "insertText": "JNB P3.6,LABEL" },
    { "mode": "asm", "trigger": "jbc", "label": "JBC bit,label", "description": "8051 instruction snippet", "insertText": "JBC 0x20,LABEL" },
    { "mode": "asm", "trigger": "djnz_r0", "label": "DJNZ R0,label", "description": "8051 instruction snippet", "insertText": "DJNZ R0,LABEL" },
    { "mode": "asm", "trigger": "djnz_direct", "label": "DJNZ direct,label", "description": "8051 instruction snippet", "insertText": "DJNZ 0x20,LABEL" },
    { "mode": "asm", "trigger": "cjne_a_imm", "label": "CJNE A,#imm,label", "description": "8051 instruction snippet", "insertText": "CJNE A,#0x00,LABEL" },
    { "mode": "asm", "trigger": "cjne_r0_imm", "label": "CJNE R0,#imm,label", "description": "8051 instruction snippet", "insertText": "CJNE R0,#0x00,LABEL" },
    { "mode": "asm", "trigger": "cjne_a_direct", "label": "CJNE A,direct,label", "description": "8051 instruction snippet", "insertText": "CJNE A,0x20,LABEL" },
    { "mode": "asm", "trigger": "movx_write_dptr", "label": "MOVX write @DPTR", "description": "8051 instruction snippet", "insertText": "MOV DPTR,#0x2000\nMOV A,#0x55\nMOVX @DPTR,A" },
    { "mode": "asm", "trigger": "movx_read_dptr", "label": "MOVX read @DPTR", "description": "8051 instruction snippet", "insertText": "MOV DPTR,#0x2000\nMOVX A,@DPTR" },
    { "mode": "asm", "trigger": "movx_write_r0", "label": "MOVX write @R0", "description": "8051 instruction snippet", "insertText": "MOV R0,#0x20\nMOV A,#0x55\nMOVX @R0,A" },
    { "mode": "asm", "trigger": "movx_read_r0", "label": "MOVX read @R0", "description": "8051 instruction snippet", "insertText": "MOV R0,#0x20\nMOVX A,@R0" },
    { "mode": "asm", "trigger": "asm_led1", "label": "LED 1 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11111110b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led2", "label": "LED 2 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11111101b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led3", "label": "LED 3 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11111011b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led4", "label": "LED 4 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11110111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led5", "label": "LED 5 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11101111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led6", "label": "LED 6 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11011111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led7", "label": "LED 7 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#10111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led8", "label": "LED 8 on", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#01111111b\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led_run", "label": "LED running demo", "description": "ST841 ready structure", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\nMAIN:\n    MOV P0,#11111110b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    MOV P0,#11111101b\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    JMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND" },
    { "mode": "asm", "trigger": "asm_7seg_0", "label": "7-seg digit 0 pos0", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#00111111b\nMOV P2,#0x01\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_7seg_1", "label": "7-seg digit 1 pos0", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#00000110b\nMOV P2,#0x01\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_7seg_2", "label": "7-seg digit 2 pos0", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#01011011b\nMOV P2,#0x01\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_7seg_3", "label": "7-seg digit 3 pos0", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#01001111b\nMOV P2,#0x01\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_7seg_clear", "label": "7-seg clear", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#0x00\nMOV P2,#0x01\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_matrix_dot", "label": "Matrix single pattern", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#00000001b\nMOV P2,#0x03\nNOP\nMOV P2,#0x00\nMOV P0,#00000001b\nMOV P2,#0x04\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_matrix_full", "label": "Matrix full", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#11111111b\nMOV P2,#0x03\nNOP\nMOV P2,#0x00\nMOV P0,#11111111b\nMOV P2,#0x04\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_matrix_clear", "label": "Matrix clear", "description": "ST841 ready structure", "insertText": "SETB P3.6\nMOV P0,#0x00\nMOV P2,#0x03\nNOP\nMOV P2,#0x00\nMOV P0,#0x00\nMOV P2,#0x04\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_key_col1", "label": "Keypad read col1", "description": "ST841 ready structure", "insertText": "CLR P3.6\nMOV P2,#0x60\nNOP\nMOV A,P0\nANL A,#0x0F" },
    { "mode": "asm", "trigger": "asm_key_col2", "label": "Keypad read col2", "description": "ST841 ready structure", "insertText": "CLR P3.6\nMOV P2,#0x50\nNOP\nMOV A,P0\nANL A,#0x0F" },
    { "mode": "asm", "trigger": "asm_key_col3", "label": "Keypad read col3", "description": "ST841 ready structure", "insertText": "CLR P3.6\nMOV P2,#0x30\nNOP\nMOV A,P0\nANL A,#0x0F" },
    { "mode": "asm", "trigger": "asm_key_wait", "label": "Keypad wait any", "description": "ST841 ready structure", "insertText": "WAIT_KEY:\n    CLR P3.6\n    MOV P2,#0x60\n    MOV A,P0\n    ANL A,#0x0F\n    CJNE A,#0x0F,KEY_FOUND\n    MOV P2,#0x50\n    MOV A,P0\n    ANL A,#0x0F\n    CJNE A,#0x0F,KEY_FOUND\n    MOV P2,#0x30\n    MOV A,P0\n    ANL A,#0x0F\n    CJNE A,#0x0F,KEY_FOUND\n    JMP WAIT_KEY\nKEY_FOUND:\n    RET" },
    { "mode": "asm", "trigger": "asm_adcregs", "label": "ADC registers", "description": "ST841 ready structure", "insertText": "ADCCON1 DATA 0EFH\nADCCON2 DATA 0D8H\nADCDATAL DATA 0D9H\nADCDATAH DATA 0DAH\nADCI BIT 0DFH\nSCONV BIT 0DCH" },
    { "mode": "asm", "trigger": "asm_adc6_read", "label": "Read ADC6 joystick X", "description": "ST841 ready structure", "insertText": "READ_ADC6:\n    MOV ADCCON2,#6h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC6:\n    JNB ADCI,WAIT_ADC6\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET" },
    { "mode": "asm", "trigger": "asm_adc7_read", "label": "Read ADC7 joystick Y", "description": "ST841 ready structure", "insertText": "READ_ADC7:\n    MOV ADCCON2,#7h\n    CLR ADCI\n    SETB SCONV\nWAIT_ADC7:\n    JNB ADCI,WAIT_ADC7\n    MOV B,ADCDATAL\n    MOV A,ADCDATAH\n    ANL A,#00001111b\n    RET" },
    { "mode": "asm", "trigger": "asm_joy_led", "label": "Joystick X to LED", "description": "ST841 ready structure", "insertText": "ORG 0x0000\nADCCON1 DATA 0EFH\nADCCON2 DATA 0D8H\nADCDATAL DATA 0D9H\nADCDATAH DATA 0DAH\nADCI BIT 0DFH\nSCONV BIT 0DCH\nSTART:\n    MOV ADCCON1,#10101100b\nMAIN:\n    MOV ADCCON2,#6h\n    CLR ADCI\n    SETB SCONV\nWAIT:\n    JNB ADCI,WAIT\n    MOV A,ADCDATAH\n    ANL A,#0x0F\n    RL A\n    CPL A\n    MOV P0,A\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    JMP MAIN\nEND" },
    { "mode": "asm", "trigger": "asm_lcd_regs", "label": "LCD aliases", "description": "ST841 ready structure", "insertText": "DAT EQU R2\nADR EQU R3" },
    { "mode": "asm", "trigger": "asm_lcd_clear", "label": "LCD clear cmd", "description": "ST841 ready structure", "insertText": "MOV DAT,#0x01\nMOV ADR,#0x08\nCALL WRIT" },
    { "mode": "asm", "trigger": "asm_lcd_home", "label": "LCD home cmd", "description": "ST841 ready structure", "insertText": "MOV DAT,#0x02\nMOV ADR,#0x08\nCALL WRIT" },
    { "mode": "asm", "trigger": "asm_lcd_char_A", "label": "LCD char A", "description": "ST841 ready structure", "insertText": "MOV DAT,#0x41\nMOV ADR,#0x08\nCALL WRIT" },
    { "mode": "asm", "trigger": "asm_lcd_print_hello", "label": "LCD print HELLO", "description": "ST841 ready structure", "insertText": "MOV DAT,#0x48\nMOV ADR,#0x08\nCALL WRIT\nMOV DAT,#0x45\nCALL WRIT\nMOV DAT,#0x4C\nCALL WRIT\nMOV DAT,#0x4C\nCALL WRIT\nMOV DAT,#0x4F\nCALL WRIT" },
    { "mode": "asm", "trigger": "asm_led_pattern_096", "label": "LED pattern 96", "description": "ST841 LED line pattern", "insertText": "SETB P3.6\nMOV P0,#0x7F\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led_pattern_097", "label": "LED pattern 97", "description": "ST841 LED line pattern", "insertText": "SETB P3.6\nMOV P0,#0xFE\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led_pattern_098", "label": "LED pattern 98", "description": "ST841 LED line pattern", "insertText": "SETB P3.6\nMOV P0,#0xFD\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led_pattern_099", "label": "LED pattern 99", "description": "ST841 LED line pattern", "insertText": "SETB P3.6\nMOV P0,#0xFB\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "asm", "trigger": "asm_led_pattern_100", "label": "LED pattern 100", "description": "ST841 LED line pattern", "insertText": "SETB P3.6\nMOV P0,#0xF7\nMOV P2,#0x07\nNOP\nMOV P2,#0x00" },
    { "mode": "c", "trigger": "c_main_loop", "label": "main while loop", "description": "C/ST841 ready structure", "insertText": "void main(){\n  while(1){\n  }\n}" },
    { "mode": "c", "trigger": "c_led_blink", "label": "LED blink", "description": "C/ST841 ready structure", "insertText": "void main(){\n  while(1){\n    led(0b11111110);\n    delay();\n    led_off();\n    delay();\n  }\n}" },
    { "mode": "c", "trigger": "c_led_run", "label": "LED running", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char i;\n  while(1){\n    for(i=0;i<8;i++){\n      led_on(i+1);\n      delay();\n    }\n  }\n}" },
    { "mode": "c", "trigger": "c_joy_led", "label": "Joystick X to LED", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char x;\n  while(1){\n    x=joystick_x();\n    if(x<4){ led(0b11111110); }\n    else if(x<8){ led(0b11110000); }\n    else { led(0b01111111); }\n  }\n}" },
    { "mode": "c", "trigger": "c_lcd_hello", "label": "LCD hello", "description": "C/ST841 ready structure", "insertText": "void main(){\n  lcd_init();\n  lcd_line(1);\n  lcd_print(\"HELLO\");\n  while(1){}\n}" },
    { "mode": "c", "trigger": "c_key_led", "label": "Keypad to LED", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char k;\n  while(1){\n    k=keypad_col1();\n    if(k!=0x0F){ led(0b11111110); } else { led_off(); }\n  }\n}" },
    { "mode": "c", "trigger": "c_adc6", "label": "ADC6 read variable", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char x;\n  while(1){\n    x=adc_read(6);\n  }\n}" },
    { "mode": "c", "trigger": "c_adc7", "label": "ADC7 read variable", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char y;\n  while(1){\n    y=adc_read(7);\n  }\n}" },
    { "mode": "c", "trigger": "c_sevenseg_counter", "label": "7-seg counter", "description": "C/ST841 ready structure", "insertText": "void main(){\n  unsigned char i;\n  while(1){\n    for(i=0;i<10;i++){\n      seg_digit(1,i);\n      delay();\n    }\n  }\n}" },
    { "mode": "c", "trigger": "c_matrix_demo", "label": "Matrix demo", "description": "C/ST841 ready structure", "insertText": "void main(){\n  while(1){\n    matrix(0xFF,0xFF);\n    delay();\n    matrix(0x00,0x00);\n    delay();\n  }\n}" },
    { "mode": "c", "trigger": "c_bus_write", "label": "bus write", "description": "C/ST841 ready structure", "insertText": "write(0x07,0b11111110);" },
    { "mode": "c", "trigger": "c_delay_ms", "label": "delay ms", "description": "C/ST841 ready structure", "insertText": "delay_ms(10);" },
    { "mode": "c", "trigger": "c_if_else", "label": "if else", "description": "C/ST841 ready structure", "insertText": "if(value==0){\n  led_off();\n}else{\n  led_all();\n}" },
    { "mode": "c", "trigger": "c_for_loop", "label": "for loop", "description": "C/ST841 ready structure", "insertText": "for(i=0;i<10;i++){\n  delay();\n}" },
    { "mode": "c", "trigger": "c_while_loop", "label": "while loop", "description": "C/ST841 ready structure", "insertText": "while(1){\n  delay();\n}" },
    { "mode": "c", "trigger": "c_define_addr", "label": "define address", "description": "C/ST841 ready structure", "insertText": "#define LED_ADDR 0x07" },
    { "mode": "c", "trigger": "c_sfr_adc", "label": "ADC SFR declarations", "description": "C/ST841 ready structure", "insertText": "sfr ADCCON1 = 0xEF;\nsfr ADCCON2 = 0xD8;\nsfr ADCDATAL = 0xD9;\nsfr ADCDATAH = 0xDA;" },
    { "mode": "c", "trigger": "c_sbit_adc", "label": "ADC bits", "description": "C/ST841 ready structure", "insertText": "sbit ADCI = 0xDF;\nsbit SCONV = 0xDC;" },
    { "mode": "c", "trigger": "c_led_all", "label": "led all", "description": "C/ST841 ready structure", "insertText": "led_all();" },
    { "mode": "c", "trigger": "c_led_off", "label": "led off", "description": "C/ST841 ready structure", "insertText": "led_off();" },
    { "mode": "c", "trigger": "c_lcd_clear", "label": "lcd clear", "description": "C/ST841 ready structure", "insertText": "lcd_clear();" },
    { "mode": "c", "trigger": "c_lcd_line1", "label": "lcd line 1", "description": "C/ST841 ready structure", "insertText": "lcd_line(1);" },
    { "mode": "c", "trigger": "c_lcd_line2", "label": "lcd line 2", "description": "C/ST841 ready structure", "insertText": "lcd_line(2);" },
    { "mode": "c", "trigger": "c_lcd_putc", "label": "lcd put char", "description": "C/ST841 ready structure", "insertText": "lcd_putc('A');" },
    { "mode": "c", "trigger": "c_lcd_print", "label": "lcd print", "description": "C/ST841 ready structure", "insertText": "lcd_print(\"TEXT\");" },
    { "mode": "c", "trigger": "c_joyx", "label": "joystick x", "description": "C/ST841 ready structure", "insertText": "joystick_x();" },
    { "mode": "c", "trigger": "c_joyy", "label": "joystick y", "description": "C/ST841 ready structure", "insertText": "joystick_y();" },
    { "mode": "c", "trigger": "c_key1", "label": "keypad col1", "description": "C/ST841 ready structure", "insertText": "keypad_col1();" },
    { "mode": "c", "trigger": "c_key2", "label": "keypad col2", "description": "C/ST841 ready structure", "insertText": "keypad_col2();" },
    { "mode": "c", "trigger": "c_key3", "label": "keypad col3", "description": "C/ST841 ready structure", "insertText": "keypad_col3();" },
    { "mode": "c", "trigger": "c_seg0", "label": "seg digit 0", "description": "C/ST841 ready structure", "insertText": "seg_digit(1,0);" },
    { "mode": "c", "trigger": "c_segclear", "label": "seg clear", "description": "C/ST841 ready structure", "insertText": "seg_clear();" },
    { "mode": "c", "trigger": "c_matrixclear", "label": "matrix clear", "description": "C/ST841 ready structure", "insertText": "matrix(0x00,0x00);" },
    { "mode": "c", "trigger": "c_matrixfull", "label": "matrix full", "description": "C/ST841 ready structure", "insertText": "matrix(0xFF,0xFF);" },
    { "mode": "c", "trigger": "c_led_on_1", "label": "led_on(1)", "description": "turn one LED on", "insertText": "led_on(1);" },
    { "mode": "c", "trigger": "c_led_on_2", "label": "led_on(2)", "description": "turn one LED on", "insertText": "led_on(2);" },
    { "mode": "c", "trigger": "c_led_on_3", "label": "led_on(3)", "description": "turn one LED on", "insertText": "led_on(3);" },
    { "mode": "c", "trigger": "c_led_on_4", "label": "led_on(4)", "description": "turn one LED on", "insertText": "led_on(4);" },
    { "mode": "c", "trigger": "c_led_on_5", "label": "led_on(5)", "description": "turn one LED on", "insertText": "led_on(5);" },
    { "mode": "c", "trigger": "c_led_on_6", "label": "led_on(6)", "description": "turn one LED on", "insertText": "led_on(6);" },
    { "mode": "c", "trigger": "c_led_on_7", "label": "led_on(7)", "description": "turn one LED on", "insertText": "led_on(7);" },
    { "mode": "c", "trigger": "c_led_on_8", "label": "led_on(8)", "description": "turn one LED on", "insertText": "led_on(8);" },
    { "mode": "c", "trigger": "c_seg_digit_0", "label": "seg_digit 1,0", "description": "7-segment digit", "insertText": "seg_digit(1,0);" },
    { "mode": "c", "trigger": "c_seg_digit_1", "label": "seg_digit 1,1", "description": "7-segment digit", "insertText": "seg_digit(1,1);" },
    { "mode": "c", "trigger": "c_seg_digit_2", "label": "seg_digit 1,2", "description": "7-segment digit", "insertText": "seg_digit(1,2);" },
    { "mode": "c", "trigger": "c_seg_digit_3", "label": "seg_digit 1,3", "description": "7-segment digit", "insertText": "seg_digit(1,3);" },
    { "mode": "c", "trigger": "c_seg_digit_4", "label": "seg_digit 1,4", "description": "7-segment digit", "insertText": "seg_digit(1,4);" },
    { "mode": "c", "trigger": "c_seg_digit_5", "label": "seg_digit 1,5", "description": "7-segment digit", "insertText": "seg_digit(1,5);" },
    { "mode": "c", "trigger": "c_seg_digit_6", "label": "seg_digit 1,6", "description": "7-segment digit", "insertText": "seg_digit(1,6);" },
    { "mode": "c", "trigger": "c_seg_digit_7", "label": "seg_digit 1,7", "description": "7-segment digit", "insertText": "seg_digit(1,7);" },
    { "mode": "c", "trigger": "c_seg_digit_8", "label": "seg_digit 1,8", "description": "7-segment digit", "insertText": "seg_digit(1,8);" },
    { "mode": "c", "trigger": "c_seg_digit_9", "label": "seg_digit 1,9", "description": "7-segment digit", "insertText": "seg_digit(1,9);" },
    { "mode": "c", "trigger": "c_adc_read_0", "label": "adc_read(0)", "description": "read ADC channel", "insertText": "adc_read(0);" },
    { "mode": "c", "trigger": "c_adc_read_1", "label": "adc_read(1)", "description": "read ADC channel", "insertText": "adc_read(1);" },
    { "mode": "c", "trigger": "c_adc_read_2", "label": "adc_read(2)", "description": "read ADC channel", "insertText": "adc_read(2);" },
    { "mode": "c", "trigger": "c_adc_read_3", "label": "adc_read(3)", "description": "read ADC channel", "insertText": "adc_read(3);" },
    { "mode": "c", "trigger": "c_adc_read_4", "label": "adc_read(4)", "description": "read ADC channel", "insertText": "adc_read(4);" },
    { "mode": "c", "trigger": "c_adc_read_5", "label": "adc_read(5)", "description": "read ADC channel", "insertText": "adc_read(5);" },
    { "mode": "c", "trigger": "c_adc_read_6", "label": "adc_read(6)", "description": "read ADC channel", "insertText": "adc_read(6);" },
    { "mode": "c", "trigger": "c_adc_read_7", "label": "adc_read(7)", "description": "read ADC channel", "insertText": "adc_read(7);" },
    { "mode": "c", "trigger": "c_if_adc_lt_0", "label": "if adc < 0", "description": "ADC threshold block", "insertText": "if(adc_read(6)<0){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_1", "label": "if adc < 1", "description": "ADC threshold block", "insertText": "if(adc_read(6)<1){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_2", "label": "if adc < 2", "description": "ADC threshold block", "insertText": "if(adc_read(6)<2){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_3", "label": "if adc < 3", "description": "ADC threshold block", "insertText": "if(adc_read(6)<3){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_4", "label": "if adc < 4", "description": "ADC threshold block", "insertText": "if(adc_read(6)<4){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_5", "label": "if adc < 5", "description": "ADC threshold block", "insertText": "if(adc_read(6)<5){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_6", "label": "if adc < 6", "description": "ADC threshold block", "insertText": "if(adc_read(6)<6){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_7", "label": "if adc < 7", "description": "ADC threshold block", "insertText": "if(adc_read(6)<7){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_8", "label": "if adc < 8", "description": "ADC threshold block", "insertText": "if(adc_read(6)<8){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_9", "label": "if adc < 9", "description": "ADC threshold block", "insertText": "if(adc_read(6)<9){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_10", "label": "if adc < 10", "description": "ADC threshold block", "insertText": "if(adc_read(6)<10){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_11", "label": "if adc < 11", "description": "ADC threshold block", "insertText": "if(adc_read(6)<11){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_12", "label": "if adc < 12", "description": "ADC threshold block", "insertText": "if(adc_read(6)<12){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_13", "label": "if adc < 13", "description": "ADC threshold block", "insertText": "if(adc_read(6)<13){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_14", "label": "if adc < 14", "description": "ADC threshold block", "insertText": "if(adc_read(6)<14){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_if_adc_lt_15", "label": "if adc < 15", "description": "ADC threshold block", "insertText": "if(adc_read(6)<15){\n  led(0b11111110);\n}else{\n  led_off();\n}" },
    { "mode": "c", "trigger": "c_led_pattern_077", "label": "led pattern 77", "description": "ST841 LED pattern", "insertText": "led(0b11101111);" },
    { "mode": "c", "trigger": "c_led_pattern_078", "label": "led pattern 78", "description": "ST841 LED pattern", "insertText": "led(0b11011111);" },
    { "mode": "c", "trigger": "c_led_pattern_079", "label": "led pattern 79", "description": "ST841 LED pattern", "insertText": "led(0b10111111);" },
    { "mode": "c", "trigger": "c_led_pattern_080", "label": "led pattern 80", "description": "ST841 LED pattern", "insertText": "led(0b01111111);" },
    { "mode": "c", "trigger": "c_led_pattern_081", "label": "led pattern 81", "description": "ST841 LED pattern", "insertText": "led(0b11111110);" },
    { "mode": "c", "trigger": "c_led_pattern_082", "label": "led pattern 82", "description": "ST841 LED pattern", "insertText": "led(0b11111101);" },
    { "mode": "c", "trigger": "c_led_pattern_083", "label": "led pattern 83", "description": "ST841 LED pattern", "insertText": "led(0b11111011);" },
    { "mode": "c", "trigger": "c_led_pattern_084", "label": "led pattern 84", "description": "ST841 LED pattern", "insertText": "led(0b11110111);" },
    { "mode": "c", "trigger": "c_led_pattern_085", "label": "led pattern 85", "description": "ST841 LED pattern", "insertText": "led(0b11101111);" },
    { "mode": "c", "trigger": "c_led_pattern_086", "label": "led pattern 86", "description": "ST841 LED pattern", "insertText": "led(0b11011111);" },
    { "mode": "c", "trigger": "c_led_pattern_087", "label": "led pattern 87", "description": "ST841 LED pattern", "insertText": "led(0b10111111);" },
    { "mode": "c", "trigger": "c_led_pattern_088", "label": "led pattern 88", "description": "ST841 LED pattern", "insertText": "led(0b01111111);" },
    { "mode": "c", "trigger": "c_led_pattern_089", "label": "led pattern 89", "description": "ST841 LED pattern", "insertText": "led(0b11111110);" },
    { "mode": "c", "trigger": "c_led_pattern_090", "label": "led pattern 90", "description": "ST841 LED pattern", "insertText": "led(0b11111101);" },
    { "mode": "c", "trigger": "c_led_pattern_091", "label": "led pattern 91", "description": "ST841 LED pattern", "insertText": "led(0b11111011);" },
    { "mode": "c", "trigger": "c_led_pattern_092", "label": "led pattern 92", "description": "ST841 LED pattern", "insertText": "led(0b11110111);" },
    { "mode": "c", "trigger": "c_led_pattern_093", "label": "led pattern 93", "description": "ST841 LED pattern", "insertText": "led(0b11101111);" },
    { "mode": "c", "trigger": "c_led_pattern_094", "label": "led pattern 94", "description": "ST841 LED pattern", "insertText": "led(0b11011111);" },
    { "mode": "c", "trigger": "c_led_pattern_095", "label": "led pattern 95", "description": "ST841 LED pattern", "insertText": "led(0b10111111);" },
    { "mode": "c", "trigger": "c_led_pattern_096", "label": "led pattern 96", "description": "ST841 LED pattern", "insertText": "led(0b01111111);" },
    { "mode": "c", "trigger": "c_led_pattern_097", "label": "led pattern 97", "description": "ST841 LED pattern", "insertText": "led(0b11111110);" },
    { "mode": "c", "trigger": "c_led_pattern_098", "label": "led pattern 98", "description": "ST841 LED pattern", "insertText": "led(0b11111101);" },
    { "mode": "c", "trigger": "c_led_pattern_099", "label": "led pattern 99", "description": "ST841 LED pattern", "insertText": "led(0b11111011);" },
    { "mode": "c", "trigger": "c_led_pattern_100", "label": "led pattern 100", "description": "ST841 LED pattern", "insertText": "led(0b11110111);" },
    {"mode": "c", "trigger": "c_ready_build_001", "label": "C ready build 001", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 001\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_002", "label": "C ready build 002", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 002\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_003", "label": "C ready build 003", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 003\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_004", "label": "C ready build 004", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 004\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_005", "label": "C ready build 005", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 005\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_006", "label": "C ready build 006", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 006\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_007", "label": "C ready build 007", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 007\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_008", "label": "C ready build 008", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 008\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_009", "label": "C ready build 009", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 009\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_010", "label": "C ready build 010", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 010\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_011", "label": "C ready build 011", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 011\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_012", "label": "C ready build 012", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 012\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_013", "label": "C ready build 013", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 013\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_014", "label": "C ready build 014", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 014\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_015", "label": "C ready build 015", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 015\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_016", "label": "C ready build 016", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 016\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_017", "label": "C ready build 017", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 017\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_018", "label": "C ready build 018", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 018\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_019", "label": "C ready build 019", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 019\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_020", "label": "C ready build 020", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 020\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_021", "label": "C ready build 021", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 021\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_022", "label": "C ready build 022", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 022\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_023", "label": "C ready build 023", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 023\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_024", "label": "C ready build 024", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 024\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_025", "label": "C ready build 025", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 025\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_026", "label": "C ready build 026", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 026\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_027", "label": "C ready build 027", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 027\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_028", "label": "C ready build 028", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 028\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_029", "label": "C ready build 029", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 029\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_030", "label": "C ready build 030", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 030\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_031", "label": "C ready build 031", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 031\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_032", "label": "C ready build 032", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 032\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_033", "label": "C ready build 033", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 033\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_034", "label": "C ready build 034", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 034\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_035", "label": "C ready build 035", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 035\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_036", "label": "C ready build 036", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 036\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_037", "label": "C ready build 037", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 037\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_038", "label": "C ready build 038", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 038\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_039", "label": "C ready build 039", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 039\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_040", "label": "C ready build 040", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 040\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_041", "label": "C ready build 041", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 041\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_042", "label": "C ready build 042", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 042\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_043", "label": "C ready build 043", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 043\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_044", "label": "C ready build 044", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 044\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_045", "label": "C ready build 045", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 045\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_046", "label": "C ready build 046", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 046\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_047", "label": "C ready build 047", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 047\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_048", "label": "C ready build 048", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 048\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_049", "label": "C ready build 049", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 049\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_050", "label": "C ready build 050", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 050\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_051", "label": "C ready build 051", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 051\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_052", "label": "C ready build 052", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 052\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_053", "label": "C ready build 053", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 053\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_054", "label": "C ready build 054", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 054\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_055", "label": "C ready build 055", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 055\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_056", "label": "C ready build 056", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 056\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_057", "label": "C ready build 057", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 057\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_058", "label": "C ready build 058", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 058\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_059", "label": "C ready build 059", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 059\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_060", "label": "C ready build 060", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 060\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_061", "label": "C ready build 061", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 061\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_062", "label": "C ready build 062", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 062\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_063", "label": "C ready build 063", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 063\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_064", "label": "C ready build 064", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 064\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_065", "label": "C ready build 065", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 065\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_066", "label": "C ready build 066", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 066\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_067", "label": "C ready build 067", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 067\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_068", "label": "C ready build 068", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 068\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_069", "label": "C ready build 069", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 069\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_070", "label": "C ready build 070", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 070\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_071", "label": "C ready build 071", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 071\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_072", "label": "C ready build 072", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 072\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_073", "label": "C ready build 073", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 073\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_074", "label": "C ready build 074", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 074\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_075", "label": "C ready build 075", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 075\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_076", "label": "C ready build 076", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 076\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_077", "label": "C ready build 077", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 077\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_078", "label": "C ready build 078", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 078\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_079", "label": "C ready build 079", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 079\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_080", "label": "C ready build 080", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 080\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_081", "label": "C ready build 081", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 081\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_082", "label": "C ready build 082", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 082\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_083", "label": "C ready build 083", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 083\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_084", "label": "C ready build 084", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 084\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_085", "label": "C ready build 085", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 085\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_086", "label": "C ready build 086", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 086\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_087", "label": "C ready build 087", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 087\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_088", "label": "C ready build 088", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 088\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_089", "label": "C ready build 089", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 089\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_090", "label": "C ready build 090", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 090\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_091", "label": "C ready build 091", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 091\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x00);\n    seg(1, 0x00);\n    seg(2, 0x00);\n    seg(3, 0x00);\n    seg(4, 0x00);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_092", "label": "C ready build 092", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 092\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFF);\n    seg(1, 0x06);\n    seg(2, 0x06);\n    seg(3, 0x06);\n    seg(4, 0x06);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_093", "label": "C ready build 093", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 093\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xAA);\n    seg(1, 0x5B);\n    seg(2, 0x5B);\n    seg(3, 0x5B);\n    seg(4, 0x5B);\n    matrix(0x10, 0x0F);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_094", "label": "C ready build 094", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 094\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x55);\n    seg(1, 0x4F);\n    seg(2, 0x4F);\n    seg(3, 0x4F);\n    seg(4, 0x4F);\n    matrix(0x20, 0xF0);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_095", "label": "C ready build 095", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 095\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF0);\n    seg(1, 0x66);\n    seg(2, 0x66);\n    seg(3, 0x66);\n    seg(4, 0x66);\n    matrix(0x40, 0x33);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_096", "label": "C ready build 096", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 096\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0x0F);\n    seg(1, 0x6D);\n    seg(2, 0x6D);\n    seg(3, 0x6D);\n    seg(4, 0x6D);\n    matrix(0x80, 0xCC);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_097", "label": "C ready build 097", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 097\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFE);\n    seg(1, 0x7D);\n    seg(2, 0x7D);\n    seg(3, 0x7D);\n    seg(4, 0x7D);\n    matrix(0x01, 0x00);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_098", "label": "C ready build 098", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 098\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFD);\n    seg(1, 0x07);\n    seg(2, 0x07);\n    seg(3, 0x07);\n    seg(4, 0x07);\n    matrix(0x02, 0xFF);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_099", "label": "C ready build 099", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 099\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xFB);\n    seg(1, 0x7F);\n    seg(2, 0x7F);\n    seg(3, 0x7F);\n    seg(4, 0x7F);\n    matrix(0x04, 0xAA);\n    delay();\n  }\n}"},
    {"mode": "c", "trigger": "c_ready_build_100", "label": "C ready build 100", "description": "Full C program: LCD + LED + 7-seg + matrix", "insertText": "void main(){\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"READY BUILD 100\");\n  lcd_line(2);\n  lcd_print(\"LED SEG MATRIX\");\n\n  while(1){\n    write(0x07, 0xF7);\n    seg(1, 0x6F);\n    seg(2, 0x6F);\n    seg(3, 0x6F);\n    seg(4, 0x6F);\n    matrix(0x08, 0x55);\n    delay();\n  }\n}"},
    {"mode": "asm", "trigger": "asm_ready_build_001", "label": "ASM ready build 001", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_002", "label": "ASM ready build 002", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_003", "label": "ASM ready build 003", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_004", "label": "ASM ready build 004", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_005", "label": "ASM ready build 005", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_006", "label": "ASM ready build 006", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_007", "label": "ASM ready build 007", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_008", "label": "ASM ready build 008", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_009", "label": "ASM ready build 009", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_010", "label": "ASM ready build 010", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_011", "label": "ASM ready build 011", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_012", "label": "ASM ready build 012", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_013", "label": "ASM ready build 013", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_014", "label": "ASM ready build 014", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_015", "label": "ASM ready build 015", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_016", "label": "ASM ready build 016", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_017", "label": "ASM ready build 017", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_018", "label": "ASM ready build 018", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_019", "label": "ASM ready build 019", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_020", "label": "ASM ready build 020", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_021", "label": "ASM ready build 021", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_022", "label": "ASM ready build 022", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_023", "label": "ASM ready build 023", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_024", "label": "ASM ready build 024", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_025", "label": "ASM ready build 025", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_026", "label": "ASM ready build 026", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_027", "label": "ASM ready build 027", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_028", "label": "ASM ready build 028", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_029", "label": "ASM ready build 029", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_030", "label": "ASM ready build 030", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_031", "label": "ASM ready build 031", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_032", "label": "ASM ready build 032", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_033", "label": "ASM ready build 033", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_034", "label": "ASM ready build 034", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_035", "label": "ASM ready build 035", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_036", "label": "ASM ready build 036", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_037", "label": "ASM ready build 037", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_038", "label": "ASM ready build 038", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_039", "label": "ASM ready build 039", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_040", "label": "ASM ready build 040", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_041", "label": "ASM ready build 041", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_042", "label": "ASM ready build 042", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_043", "label": "ASM ready build 043", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_044", "label": "ASM ready build 044", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_045", "label": "ASM ready build 045", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_046", "label": "ASM ready build 046", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_047", "label": "ASM ready build 047", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_048", "label": "ASM ready build 048", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_049", "label": "ASM ready build 049", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_050", "label": "ASM ready build 050", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_051", "label": "ASM ready build 051", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_052", "label": "ASM ready build 052", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_053", "label": "ASM ready build 053", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_054", "label": "ASM ready build 054", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_055", "label": "ASM ready build 055", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_056", "label": "ASM ready build 056", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_057", "label": "ASM ready build 057", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_058", "label": "ASM ready build 058", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_059", "label": "ASM ready build 059", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_060", "label": "ASM ready build 060", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_061", "label": "ASM ready build 061", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_062", "label": "ASM ready build 062", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_063", "label": "ASM ready build 063", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_064", "label": "ASM ready build 064", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_065", "label": "ASM ready build 065", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_066", "label": "ASM ready build 066", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_067", "label": "ASM ready build 067", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_068", "label": "ASM ready build 068", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_069", "label": "ASM ready build 069", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_070", "label": "ASM ready build 070", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_071", "label": "ASM ready build 071", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_072", "label": "ASM ready build 072", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_073", "label": "ASM ready build 073", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_074", "label": "ASM ready build 074", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_075", "label": "ASM ready build 075", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_076", "label": "ASM ready build 076", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_077", "label": "ASM ready build 077", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_078", "label": "ASM ready build 078", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_079", "label": "ASM ready build 079", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_080", "label": "ASM ready build 080", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_081", "label": "ASM ready build 081", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_082", "label": "ASM ready build 082", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_083", "label": "ASM ready build 083", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_084", "label": "ASM ready build 084", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_085", "label": "ASM ready build 085", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_086", "label": "ASM ready build 086", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_087", "label": "ASM ready build 087", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_088", "label": "ASM ready build 088", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_089", "label": "ASM ready build 089", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_090", "label": "ASM ready build 090", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_091", "label": "ASM ready build 091", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x00\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_092", "label": "ASM ready build 092", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFF\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_093", "label": "ASM ready build 093", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xAA\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_094", "label": "ASM ready build 094", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x55\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_095", "label": "ASM ready build 095", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF0\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_096", "label": "ASM ready build 096", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0x0F\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x10\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_097", "label": "ASM ready build 097", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFE\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x20\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_098", "label": "ASM ready build 098", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFD\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x30\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_099", "label": "ASM ready build 099", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xFB\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x40\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"},
    {"mode": "asm", "trigger": "asm_ready_build_100", "label": "ASM ready build 100", "description": "Full ASM program: LED line loop through ST841 bus", "insertText": "ORG 0x0000\nSTART:\n    MOV SP,#0x2F\n    SETB P3.6\nMAIN:\n    MOV P0,#0xF7\n    MOV P2,#0x07\n    NOP\n    MOV P2,#0x00\n    CALL DELAY\n    SJMP MAIN\n\nDELAY:\n    MOV R5,#0x50\nD1:\n    MOV R6,#0xFF\nD2:\n    DJNZ R6,D2\n    DJNZ R5,D1\n    RET\nEND"}
,
{
    "mode": "c",
    "trigger": "m_c_lab2_write_led",
    "label": "Методичка 1: C Lab2 write + LED",
    "description": "write(), LED(), ClearLatches()",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat)\n{\n  WR = 1;\n  P0 = Dat;\n  P2 &= 0xF0;\n  P2 |= (Addr & 0x0F);\n  P2 &= 0xF0;\n}\nvoid LED(unsigned char Data)\n{\n  write(7, ~Data);\n}\nvoid ClearLatches()\n{\n  unsigned char i;\n  for (i = 1; i != 9; i++)\n    write(i, 0xFF);\n}\nvoid main()\n{\n  ClearLatches();\n  LED(0xAA);\n  while (1);\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lab3_static1234",
    "label": "Методичка 2: C Lab3 Static 0x1234",
    "description": "Hto7[] + Static(unsigned int)",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat)\n{\n  WR = 1;\n  P0 = Dat;\n  P2 &= 0xF0;\n  P2 |= (Addr & 0x0F);\n  P2 &= 0xF0;\n}\nconst unsigned char code Hto7[16] = {\n  0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,\n  0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E\n};\nvoid Static(unsigned int A)\n{\n  write(1, Hto7[(A) & 0x0F]);\n  write(2, Hto7[(A >> 4) & 0x0F]);\n  write(3, Hto7[(A >> 8) & 0x0F]);\n  write(4, Hto7[(A >> 12) & 0x0F]);\n}\nvoid main()\n{\n  Static(0x1234);\n  while (1);\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lab4_keypad_static",
    "label": "Методичка 3: C Lab4 keypad to 7seg",
    "description": "readkey() + StaticL()",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat)\n{\n  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;\n}\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid StaticL(unsigned char A)\n{\n  write(1, Hto7[A & 0x0F]);\n  write(2, Hto7[(A >> 4) & 0x0F]);\n}\nunsigned char readkey()\n{\n  unsigned char Key;\n  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xEF;\n  Key = P0; Key = ~Key; Key &= 0x0F;\n  switch (Key) { case 1: return 1; case 2: return 4; case 4: return 7; case 8: return 10; }\n  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xDF;\n  Key = P0; Key = ~Key; Key &= 0x0F;\n  switch (Key) { case 1: return 2; case 2: return 5; case 4: return 8; case 8: return 0; }\n  P0 = 0xFF; WR = 0; P2 |= 0x70; P2 &= 0xBF;\n  Key = P0; Key = ~Key; Key &= 0x0F;\n  switch (Key) { case 1: return 3; case 2: return 6; case 4: return 9; case 8: return 11; }\n  return 255;\n}\nvoid main()\n{\n  unsigned char Key;\n  while (1) {\n    Key = readkey();\n    if (Key != 255) StaticL(Key);\n  }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lab5_stepper",
    "label": "Методичка 4: C Lab5 stepper half-step",
    "description": "Step(bit Reverse) skeleton",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat)\n{\n  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;\n}\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid delay(unsigned int T)\n{\n  unsigned int i; unsigned char j;\n  for (i = 0; i != T; i++) for (j = 0; j != 255; j++);\n}\nunsigned char Step(bit Reverse)\n{\n  static unsigned char Pos = 0;\n  const unsigned char code Half[8] = {1,3,2,6,4,12,8,9};\n  if (Reverse) Pos--; else Pos++;\n  Pos &= 7;\n  write(8, Half[Pos]);\n  return Half[Pos];\n}\nvoid main()\n{\n  while (1) {\n    LED(Step(0));\n    delay(20);\n  }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lab6_adc_led",
    "label": "Методичка 5: C Lab6 ADC to LED/static",
    "description": "ADCCON/ADCDATA example",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat)\n{\n  WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0;\n}\nvoid LED(unsigned char Data) { write(7, ~Data); }\nunsigned int GetADC(unsigned char Channel)\n{\n  unsigned int A;\n  ADCCON1 = 0xAC;\n  ADCCON2 = Channel & 0x0F;\n  SCONV = 1;\n  while (!ADCI);\n  A = ADCDATAH & 0x0F;\n  A = A << 8;\n  A |= ADCDATAL;\n  return A;\n}\nvoid main()\n{\n  unsigned int A;\n  while (1) {\n    A = GetADC(6);\n    LED(A >> 4);\n  }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_00",
    "label": "Методичка 6: C LED 0x00",
    "description": "LED() pattern 0x00",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x00); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_01",
    "label": "Методичка 7: C LED 0x01",
    "description": "LED() pattern 0x01",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x01); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_03",
    "label": "Методичка 8: C LED 0x03",
    "description": "LED() pattern 0x03",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x03); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_05",
    "label": "Методичка 9: C LED 0x05",
    "description": "LED() pattern 0x05",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x05); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_0f",
    "label": "Методичка 10: C LED 0x0F",
    "description": "LED() pattern 0x0F",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x0F); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_33",
    "label": "Методичка 11: C LED 0x33",
    "description": "LED() pattern 0x33",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x33); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_55",
    "label": "Методичка 12: C LED 0x55",
    "description": "LED() pattern 0x55",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x55); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_aa",
    "label": "Методичка 13: C LED 0xAA",
    "description": "LED() pattern 0xAA",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0xAA); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_f0",
    "label": "Методичка 14: C LED 0xF0",
    "description": "LED() pattern 0xF0",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0xF0); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_ff",
    "label": "Методичка 15: C LED 0xFF",
    "description": "LED() pattern 0xFF",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0xFF); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_7e",
    "label": "Методичка 16: C LED 0x7E",
    "description": "LED() pattern 0x7E",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x7E); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_81",
    "label": "Методичка 17: C LED 0x81",
    "description": "LED() pattern 0x81",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x81); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_18",
    "label": "Методичка 18: C LED 0x18",
    "description": "LED() pattern 0x18",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x18); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_24",
    "label": "Методичка 19: C LED 0x24",
    "description": "LED() pattern 0x24",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x24); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_42",
    "label": "Методичка 20: C LED 0x42",
    "description": "LED() pattern 0x42",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x42); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_66",
    "label": "Методичка 21: C LED 0x66",
    "description": "LED() pattern 0x66",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x66); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_99",
    "label": "Методичка 22: C LED 0x99",
    "description": "LED() pattern 0x99",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x99); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_c3",
    "label": "Методичка 23: C LED 0xC3",
    "description": "LED() pattern 0xC3",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0xC3); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_3c",
    "label": "Методичка 24: C LED 0x3C",
    "description": "LED() pattern 0x3C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0x3C); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_led_a5",
    "label": "Методичка 25: C LED 0xA5",
    "description": "LED() pattern 0xA5",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid LED(unsigned char Data) { write(7, ~Data); }\nvoid main() { LED(0xA5); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0000",
    "label": "Методичка 26: C Static 0x0000",
    "description": "Static(0x0000) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0000); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0001",
    "label": "Методичка 27: C Static 0x0001",
    "description": "Static(0x0001) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0001); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0012",
    "label": "Методичка 28: C Static 0x0012",
    "description": "Static(0x0012) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0012); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0034",
    "label": "Методичка 29: C Static 0x0034",
    "description": "Static(0x0034) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0034); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0101",
    "label": "Методичка 30: C Static 0x0101",
    "description": "Static(0x0101) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0101); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0123",
    "label": "Методичка 31: C Static 0x0123",
    "description": "Static(0x0123) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0123); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_1234",
    "label": "Методичка 32: C Static 0x1234",
    "description": "Static(0x1234) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x1234); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_4321",
    "label": "Методичка 33: C Static 0x4321",
    "description": "Static(0x4321) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x4321); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_5555",
    "label": "Методичка 34: C Static 0x5555",
    "description": "Static(0x5555) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x5555); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_aaaa",
    "label": "Методичка 35: C Static 0xAAAA",
    "description": "Static(0xAAAA) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xAAAA); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_0f0f",
    "label": "Методичка 36: C Static 0x0F0F",
    "description": "Static(0x0F0F) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x0F0F); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_f00d",
    "label": "Методичка 37: C Static 0xF00D",
    "description": "Static(0xF00D) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xF00D); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_beef",
    "label": "Методичка 38: C Static 0xBEEF",
    "description": "Static(0xBEEF) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xBEEF); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_cafe",
    "label": "Методичка 39: C Static 0xCAFE",
    "description": "Static(0xCAFE) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xCAFE); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_2026",
    "label": "Методичка 40: C Static 0x2026",
    "description": "Static(0x2026) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x2026); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_1760",
    "label": "Методичка 41: C Static 0x1760",
    "description": "Static(0x1760) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x1760); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_8410",
    "label": "Методичка 42: C Static 0x8410",
    "description": "Static(0x8410) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x8410); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_8051",
    "label": "Методичка 43: C Static 0x8051",
    "description": "Static(0x8051) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0x8051); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_ad0c",
    "label": "Методичка 44: C Static 0xAD0C",
    "description": "Static(0xAD0C) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xAD0C); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_static_ffff",
    "label": "Методичка 45: C Static 0xFFFF",
    "description": "Static(0xFFFF) via Hto7[]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main() { Static(0xFFFF); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg1_0",
    "label": "Методичка 46: C write addr 1",
    "description": "write(1,0x81) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(1, 0x81); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg2_0",
    "label": "Методичка 47: C write addr 2",
    "description": "write(2,0xA6) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(2, 0xA6); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg3_0",
    "label": "Методичка 48: C write addr 3",
    "description": "write(3,0xCB) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(3, 0xCB); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg4_0",
    "label": "Методичка 49: C write addr 4",
    "description": "write(4,0xF0) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(4, 0xF0); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_rows_0",
    "label": "Методичка 50: C write addr 5",
    "description": "write(5,0x15) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(5, 0x15); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_cols_0",
    "label": "Методичка 51: C write addr 6",
    "description": "write(6,0x3A) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(6, 0x3A); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_led_0",
    "label": "Методичка 52: C write addr 7",
    "description": "write(7,0x5F) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(7, 0x5F); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_lcd_or_step_0",
    "label": "Методичка 53: C write addr 8",
    "description": "write(8,0x84) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(8, 0x84); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg1_1",
    "label": "Методичка 54: C write addr 1",
    "description": "write(1,0xA9) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(1, 0xA9); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg2_1",
    "label": "Методичка 55: C write addr 2",
    "description": "write(2,0xCE) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(2, 0xCE); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg3_1",
    "label": "Методичка 56: C write addr 3",
    "description": "write(3,0xF3) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(3, 0xF3); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg4_1",
    "label": "Методичка 57: C write addr 4",
    "description": "write(4,0x18) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(4, 0x18); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_rows_1",
    "label": "Методичка 58: C write addr 5",
    "description": "write(5,0x3D) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(5, 0x3D); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_cols_1",
    "label": "Методичка 59: C write addr 6",
    "description": "write(6,0x62) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(6, 0x62); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_led_1",
    "label": "Методичка 60: C write addr 7",
    "description": "write(7,0x87) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(7, 0x87); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_lcd_or_step_1",
    "label": "Методичка 61: C write addr 8",
    "description": "write(8,0xAC) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(8, 0xAC); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg1_2",
    "label": "Методичка 62: C write addr 1",
    "description": "write(1,0xD1) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(1, 0xD1); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg2_2",
    "label": "Методичка 63: C write addr 2",
    "description": "write(2,0xF6) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(2, 0xF6); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg3_2",
    "label": "Методичка 64: C write addr 3",
    "description": "write(3,0x1B) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(3, 0x1B); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_seg4_2",
    "label": "Методичка 65: C write addr 4",
    "description": "write(4,0x40) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(4, 0x40); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_rows_2",
    "label": "Методичка 66: C write addr 5",
    "description": "write(5,0x65) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(5, 0x65); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_matrix_cols_2",
    "label": "Методичка 67: C write addr 6",
    "description": "write(6,0x8A) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(6, 0x8A); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_led_2",
    "label": "Методичка 68: C write addr 7",
    "description": "write(7,0xAF) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(7, 0xAF); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_write_lcd_or_step_2",
    "label": "Методичка 69: C write addr 8",
    "description": "write(8,0xD4) direct ST841 bus",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nvoid main() { write(8, 0xD4); while (1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_1",
    "label": "Методичка 70: C keypad counter 1",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=0; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_2",
    "label": "Методичка 71: C keypad counter 2",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=1; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_3",
    "label": "Методичка 72: C keypad counter 3",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=2; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_4",
    "label": "Методичка 73: C keypad counter 4",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=3; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_5",
    "label": "Методичка 74: C keypad counter 5",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=4; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_6",
    "label": "Методичка 75: C keypad counter 6",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=5; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_7",
    "label": "Методичка 76: C keypad counter 7",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=6; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_8",
    "label": "Методичка 77: C keypad counter 8",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=7; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_9",
    "label": "Методичка 78: C keypad counter 9",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=8; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_10",
    "label": "Методичка 79: C keypad counter 10",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=9; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_11",
    "label": "Методичка 80: C keypad counter 11",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=10; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_12",
    "label": "Методичка 81: C keypad counter 12",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=11; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_13",
    "label": "Методичка 82: C keypad counter 13",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=12; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_14",
    "label": "Методичка 83: C keypad counter 14",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=13; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_15",
    "label": "Методичка 84: C keypad counter 15",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=14; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_16",
    "label": "Методичка 85: C keypad counter 16",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=15; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_17",
    "label": "Методичка 86: C keypad counter 17",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=16; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_18",
    "label": "Методичка 87: C keypad counter 18",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=17; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_19",
    "label": "Методичка 88: C keypad counter 19",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=18; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_20",
    "label": "Методичка 89: C keypad counter 20",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=19; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_21",
    "label": "Методичка 90: C keypad counter 21",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=20; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_22",
    "label": "Методичка 91: C keypad counter 22",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=21; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_23",
    "label": "Методичка 92: C keypad counter 23",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=22; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_24",
    "label": "Методичка 93: C keypad counter 24",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=23; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_25",
    "label": "Методичка 94: C keypad counter 25",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=24; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_26",
    "label": "Методичка 95: C keypad counter 26",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=25; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_27",
    "label": "Методичка 96: C keypad counter 27",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=26; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_28",
    "label": "Методичка 97: C keypad counter 28",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=27; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_29",
    "label": "Методичка 98: C keypad counter 29",
    "description": "case 10: Counter--",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=28; while(1){ Key=readkey(); switch(Key){ case 10: Counter--; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_key_counter_30",
    "label": "Методичка 99: C keypad counter 30",
    "description": "case 11: Counter++",
    "insertText": "#include \"ADUC841.h\"\nunsigned int Counter;\nvoid write(unsigned char Addr, unsigned char Dat) { WR = 1; P0 = Dat; P2 &= 0xF0; P2 |= (Addr & 0x0F); P2 &= 0xF0; }\nconst unsigned char code Hto7[16] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A) { write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nunsigned char readkey() { unsigned char Key; P0=0xFF; WR=0; P2|=0x70; P2&=0xEF; Key=P0; Key=~Key; Key&=0x0F; switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;} return 255; }\nvoid main() { unsigned char Key; Counter=29; while(1){ Key=readkey(); switch(Key){ case 11: Counter++; break; default: break; } Static(Counter); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_1",
    "label": "Методичка 100: C for clear 1",
    "description": "for loop write 1..1",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_2",
    "label": "Методичка 101: C for clear 2",
    "description": "for loop write 1..2",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_3",
    "label": "Методичка 102: C for clear 3",
    "description": "for loop write 1..3",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_4",
    "label": "Методичка 103: C for clear 4",
    "description": "for loop write 1..4",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_5",
    "label": "Методичка 104: C for clear 5",
    "description": "for loop write 1..5",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_6",
    "label": "Методичка 105: C for clear 6",
    "description": "for loop write 1..6",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_7",
    "label": "Методичка 106: C for clear 7",
    "description": "for loop write 1..7",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_8",
    "label": "Методичка 107: C for clear 8",
    "description": "for loop write 1..8",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_9",
    "label": "Методичка 108: C for clear 1",
    "description": "for loop write 1..1",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_10",
    "label": "Методичка 109: C for clear 2",
    "description": "for loop write 1..2",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_11",
    "label": "Методичка 110: C for clear 3",
    "description": "for loop write 1..3",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_12",
    "label": "Методичка 111: C for clear 4",
    "description": "for loop write 1..4",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_13",
    "label": "Методичка 112: C for clear 5",
    "description": "for loop write 1..5",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_14",
    "label": "Методичка 113: C for clear 6",
    "description": "for loop write 1..6",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_15",
    "label": "Методичка 114: C for clear 7",
    "description": "for loop write 1..7",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_16",
    "label": "Методичка 115: C for clear 8",
    "description": "for loop write 1..8",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_17",
    "label": "Методичка 116: C for clear 1",
    "description": "for loop write 1..1",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_18",
    "label": "Методичка 117: C for clear 2",
    "description": "for loop write 1..2",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_19",
    "label": "Методичка 118: C for clear 3",
    "description": "for loop write 1..3",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_20",
    "label": "Методичка 119: C for clear 4",
    "description": "for loop write 1..4",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_21",
    "label": "Методичка 120: C for clear 5",
    "description": "for loop write 1..5",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_22",
    "label": "Методичка 121: C for clear 6",
    "description": "for loop write 1..6",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_23",
    "label": "Методичка 122: C for clear 7",
    "description": "for loop write 1..7",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=8; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_24",
    "label": "Методичка 123: C for clear 8",
    "description": "for loop write 1..8",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=9; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_25",
    "label": "Методичка 124: C for clear 1",
    "description": "for loop write 1..1",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=2; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_26",
    "label": "Методичка 125: C for clear 2",
    "description": "for loop write 1..2",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=3; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_27",
    "label": "Методичка 126: C for clear 3",
    "description": "for loop write 1..3",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=4; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_28",
    "label": "Методичка 127: C for clear 4",
    "description": "for loop write 1..4",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=5; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_29",
    "label": "Методичка 128: C for clear 5",
    "description": "for loop write 1..5",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=6; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_for_clear_30",
    "label": "Методичка 129: C for clear 6",
    "description": "for loop write 1..6",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid main() { unsigned char i; for(i=1; i!=7; i++) write(i,0xFF); while(1); }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_0_high",
    "label": "Методичка 130: C ADC ch0 high",
    "description": "GetADC(0) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_0_low",
    "label": "Методичка 131: C ADC ch0 low",
    "description": "GetADC(0) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_0_led",
    "label": "Методичка 132: C ADC ch0 led",
    "description": "GetADC(0) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(0); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_1_high",
    "label": "Методичка 133: C ADC ch1 high",
    "description": "GetADC(1) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_1_low",
    "label": "Методичка 134: C ADC ch1 low",
    "description": "GetADC(1) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_1_led",
    "label": "Методичка 135: C ADC ch1 led",
    "description": "GetADC(1) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(1); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_2_high",
    "label": "Методичка 136: C ADC ch2 high",
    "description": "GetADC(2) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_2_low",
    "label": "Методичка 137: C ADC ch2 low",
    "description": "GetADC(2) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_2_led",
    "label": "Методичка 138: C ADC ch2 led",
    "description": "GetADC(2) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(2); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_3_high",
    "label": "Методичка 139: C ADC ch3 high",
    "description": "GetADC(3) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_3_low",
    "label": "Методичка 140: C ADC ch3 low",
    "description": "GetADC(3) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_3_led",
    "label": "Методичка 141: C ADC ch3 led",
    "description": "GetADC(3) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(3); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_4_high",
    "label": "Методичка 142: C ADC ch4 high",
    "description": "GetADC(4) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_4_low",
    "label": "Методичка 143: C ADC ch4 low",
    "description": "GetADC(4) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_4_led",
    "label": "Методичка 144: C ADC ch4 led",
    "description": "GetADC(4) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(4); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_5_high",
    "label": "Методичка 145: C ADC ch5 high",
    "description": "GetADC(5) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_5_low",
    "label": "Методичка 146: C ADC ch5 low",
    "description": "GetADC(5) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_5_led",
    "label": "Методичка 147: C ADC ch5 led",
    "description": "GetADC(5) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(5); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_6_high",
    "label": "Методичка 148: C ADC ch6 high",
    "description": "GetADC(6) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_6_low",
    "label": "Методичка 149: C ADC ch6 low",
    "description": "GetADC(6) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_6_led",
    "label": "Методичка 150: C ADC ch6 led",
    "description": "GetADC(6) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(6); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_7_high",
    "label": "Методичка 151: C ADC ch7 high",
    "description": "GetADC(7) high",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_7_low",
    "label": "Методичка 152: C ADC ch7 low",
    "description": "GetADC(7) low",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 0); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_adc_7_led",
    "label": "Методичка 153: C ADC ch7 led",
    "description": "GetADC(7) led",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid LED(unsigned char Data) { write(7,~Data); }\nunsigned int GetADC(unsigned char Channel) { unsigned int A; ADCCON1=0xAC; ADCCON2=Channel&0x0F; SCONV=1; while(!ADCI); A=ADCDATAH&0x0F; A=A<<8; A|=ADCDATAL; return A; }\nvoid main() { unsigned int A; while(1) { A=GetADC(7); LED(A >> 4); } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_0_5",
    "label": "Методичка 154: C Stepper p0 r0 d5",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_0_20",
    "label": "Методичка 155: C Stepper p0 r0 d20",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_0_80",
    "label": "Методичка 156: C Stepper p0 r0 d80",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_0_150",
    "label": "Методичка 157: C Stepper p0 r0 d150",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_0_250",
    "label": "Методичка 158: C Stepper p0 r0 d250",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_1_5",
    "label": "Методичка 159: C Stepper p0 r1 d5",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_1_20",
    "label": "Методичка 160: C Stepper p0 r1 d20",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_1_80",
    "label": "Методичка 161: C Stepper p0 r1 d80",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_1_150",
    "label": "Методичка 162: C Stepper p0 r1 d150",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_0_1_250",
    "label": "Методичка 163: C Stepper p0 r1 d250",
    "description": "stepper pattern [1, 2, 4, 8]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x01,0x02,0x04,0x08};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_0_5",
    "label": "Методичка 164: C Stepper p1 r0 d5",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_0_20",
    "label": "Методичка 165: C Stepper p1 r0 d20",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_0_80",
    "label": "Методичка 166: C Stepper p1 r0 d80",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_0_150",
    "label": "Методичка 167: C Stepper p1 r0 d150",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_0_250",
    "label": "Методичка 168: C Stepper p1 r0 d250",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_1_5",
    "label": "Методичка 169: C Stepper p1 r1 d5",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_1_20",
    "label": "Методичка 170: C Stepper p1 r1 d20",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_1_80",
    "label": "Методичка 171: C Stepper p1 r1 d80",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_1_150",
    "label": "Методичка 172: C Stepper p1 r1 d150",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_1_1_250",
    "label": "Методичка 173: C Stepper p1 r1 d250",
    "description": "stepper pattern [1, 3, 2, 6, 4, 12, 8, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[8] = {0x01,0x03,0x02,0x06,0x04,0x0C,0x08,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=8;i++) { write(8, StepTab[8-1-i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_0_5",
    "label": "Методичка 174: C Stepper p2 r0 d5",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_0_20",
    "label": "Методичка 175: C Stepper p2 r0 d20",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_0_80",
    "label": "Методичка 176: C Stepper p2 r0 d80",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_0_150",
    "label": "Методичка 177: C Stepper p2 r0 d150",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_0_250",
    "label": "Методичка 178: C Stepper p2 r0 d250",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_1_5",
    "label": "Методичка 179: C Stepper p2 r1 d5",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(5); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_1_20",
    "label": "Методичка 180: C Stepper p2 r1 d20",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(20); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_1_80",
    "label": "Методичка 181: C Stepper p2 r1 d80",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(80); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_1_150",
    "label": "Методичка 182: C Stepper p2 r1 d150",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(150); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_step_2_1_250",
    "label": "Методичка 183: C Stepper p2 r1 d250",
    "description": "stepper pattern [3, 6, 12, 9]",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat) { WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nvoid delay(unsigned int T) { unsigned int i; unsigned char j; for(i=0;i!=T;i++) for(j=0;j!=255;j++); }\nconst unsigned char code StepTab[4] = {0x03,0x06,0x0C,0x09};\nvoid main() { unsigned char i; while(1) { for(i=0;i!=4;i++) { write(8, StepTab[4-1-i]); delay(250); } } }\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_1",
    "label": "Методичка 184: C LCD ST841",
    "description": "lcd_print \"ST841\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"ST841\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_2",
    "label": "Методичка 185: C LCD ADUC841",
    "description": "lcd_print \"ADUC841\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"ADUC841\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_3",
    "label": "Методичка 186: C LCD P0 DATA",
    "description": "lcd_print \"P0 DATA\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"P0 DATA\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_4",
    "label": "Методичка 187: C LCD P2 ADDR",
    "description": "lcd_print \"P2 ADDR\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"P2 ADDR\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_5",
    "label": "Методичка 188: C LCD WR P3.6",
    "description": "lcd_print \"WR P3.6\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"WR P3.6\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_6",
    "label": "Методичка 189: C LCD KEYPAD",
    "description": "lcd_print \"KEYPAD\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"KEYPAD\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_7",
    "label": "Методичка 190: C LCD ADC CH6",
    "description": "lcd_print \"ADC CH6\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"ADC CH6\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_8",
    "label": "Методичка 191: C LCD STEP MOTOR",
    "description": "lcd_print \"STEP MOTOR\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"STEP MOTOR\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_9",
    "label": "Методичка 192: C LCD STATIC 7SEG",
    "description": "lcd_print \"STATIC 7SEG\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"STATIC 7SEG\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_10",
    "label": "Методичка 193: C LCD MATRIX",
    "description": "lcd_print \"MATRIX\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"MATRIX\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_11",
    "label": "Методичка 194: C LCD HELLO",
    "description": "lcd_print \"HELLO\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"HELLO\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_12",
    "label": "Методичка 195: C LCD MICROLAB",
    "description": "lcd_print \"MICROLAB\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"MICROLAB\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_13",
    "label": "Методичка 196: C LCD C MODE",
    "description": "lcd_print \"C MODE\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"C MODE\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_14",
    "label": "Методичка 197: C LCD KEIL STYLE",
    "description": "lcd_print \"KEIL STYLE\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"KEIL STYLE\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_15",
    "label": "Методичка 198: C LCD METHODYCHKA",
    "description": "lcd_print \"METHODYCHKA\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"METHODYCHKA\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_16",
    "label": "Методичка 199: C LCD LAB TEST",
    "description": "lcd_print \"LAB TEST\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"LAB TEST\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "m_c_lcd_text_17",
    "label": "Методичка 200: C LCD INPUT OK",
    "description": "lcd_print \"INPUT OK\"",
    "insertText": "void main() {\n  lcd_init();\n  lcd_clear();\n  lcd_line(1);\n  lcd_print(\"INPUT OK\");\n  while(1) { }\n}\n"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_001",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1001); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_002",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1002); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_003",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1003); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_004",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1004); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_005",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1005); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_006",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1006); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_007",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1007); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_008",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1008); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_009",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1009); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_010",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_011",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_012",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_013",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_014",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_015",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x100F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_016",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1010); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_017",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1011); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_018",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1012); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_019",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1013); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_020",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1014); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_021",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1015); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_022",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1016); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_023",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1017); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_024",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1018); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_025",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1019); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_026",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_027",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_028",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_029",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_030",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_031",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x101F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_032",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1020); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_033",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1021); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_034",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1022); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_035",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1023); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_036",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1024); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_037",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1025); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_038",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1026); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_039",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1027); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_040",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1028); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_041",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1029); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_042",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_043",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_044",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_045",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_046",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_047",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x102F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_048",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1030); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_049",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1031); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_050",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1032); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_051",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1033); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_052",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1034); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_053",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1035); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_054",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1036); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_055",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1037); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_056",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1038); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_057",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1039); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_058",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_059",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_060",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_061",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_062",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_063",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x103F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_064",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1040); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_065",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1041); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_066",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1042); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_067",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1043); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_068",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1044); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_069",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1045); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_070",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1046); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_071",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1047); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_072",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1048); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_073",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1049); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_074",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_075",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_076",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_077",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_078",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_079",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x104F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_080",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1050); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_081",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1051); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_082",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1052); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_083",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1053); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_084",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1054); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_085",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1055); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_086",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1056); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_087",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1057); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_088",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1058); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_089",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1059); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_090",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105A); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_091",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105B); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_092",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105C); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_093",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105D); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_094",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105E); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_095",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x105F); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_096",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1060); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_097",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1061); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_098",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1062); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_099",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1063); while(1); }"
},
{
    "mode": "c",
    "trigger": "static",
    "label": "m3_static_hex_100",
    "description": "Methodychka Lab3 Static/Hto7 technical C",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr, unsigned char Dat){ WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0; }\nconst unsigned char code Hto7[16]={0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E};\nvoid Static(unsigned int A){ write(1,Hto7[A&0x0F]); write(2,Hto7[(A>>4)&0x0F]); write(3,Hto7[(A>>8)&0x0F]); write(4,Hto7[(A>>12)&0x0F]); }\nvoid main(){ Static(0x1064); while(1); }"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_001",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_002",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_003",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_004",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_005",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_006",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_007",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_008",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_009",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_010",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_011",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_012",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_013",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_014",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_015",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_016",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_017",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_018",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_019",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_020",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_021",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_022",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_023",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_024",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_025",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_026",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_027",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_028",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_029",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_030",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_031",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_032",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_033",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_034",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_035",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_036",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_037",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_038",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_039",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_040",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_041",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_042",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_043",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_044",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_045",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_046",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_047",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_048",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_049",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_050",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_051",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_052",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_053",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_054",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_055",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_056",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_057",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_058",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_059",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_060",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_061",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_062",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_063",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_064",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_065",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_066",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_067",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_068",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_069",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_070",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_071",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_072",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_073",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_074",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_075",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_076",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_077",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_078",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_079",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "readkey",
    "label": "m4_readkey_switch_080",
    "description": "Methodychka Lab4 keypad switch/case counter",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid LED(unsigned char Data){write(7,~Data);}\nunsigned char readkey(){unsigned char Key;P0=0xFF;WR=0;P2|=0x70;P2&=0xEF;Key=P0;Key=~Key;Key&=0x0F;switch(Key){case 1:return 1;case 2:return 4;case 4:return 7;case 8:return 10;}return 255;}\nvoid main(){unsigned char Key;while(1){Key=readkey();switch(Key){case 10:LED(0x0A);break;case 255:break;default:LED(Key);break;}}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_001",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(11);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_002",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(12);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_003",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(13);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_004",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(14);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_005",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(15);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_006",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(16);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_007",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(17);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_008",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(18);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_009",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(19);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_010",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(20);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_011",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(21);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_012",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(22);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_013",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(23);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_014",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(24);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_015",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(25);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_016",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(26);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_017",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(27);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_018",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(28);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_019",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(29);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_020",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(30);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_021",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(31);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_022",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(32);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_023",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(33);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_024",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(34);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_025",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(35);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_026",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(36);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_027",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(37);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_028",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(38);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_029",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(39);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_030",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(40);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_031",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(41);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_032",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(42);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_033",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(43);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_034",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(44);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_035",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(45);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_036",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(46);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_037",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(47);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_038",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(48);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_039",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(49);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_040",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(50);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_041",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(51);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_042",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(52);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_043",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(53);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_044",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(54);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_045",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(55);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_046",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(56);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_047",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(57);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_048",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(58);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_049",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(59);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_050",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(60);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_051",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(61);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_052",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(62);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_053",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(63);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_054",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(64);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_055",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(65);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_056",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(66);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_057",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(67);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_058",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(68);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_059",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(69);}}"
},
{
    "mode": "c",
    "trigger": "step",
    "label": "m5_stepper_halfstep_060",
    "description": "Methodychka Lab5 stepper motor technical pattern",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nvoid delay(unsigned int T){unsigned int i;unsigned char j;for(i=0;i<T;i++)for(j=0;j!=255;j++);}\nunsigned char Step(bit Reverse){static unsigned char S=1;if(Reverse){S=S>>1;if(S==0)S=8;}else{S=S<<1;if(S>8)S=1;}write(8,S);write(7,~S);return S;}\nvoid main(){while(1){Step(0);delay(70);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_001",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_002",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_003",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_004",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_005",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_006",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_007",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_008",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_009",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_010",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_011",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_012",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_013",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_014",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_015",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_016",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_017",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_018",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_019",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_020",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_021",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_022",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_023",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_024",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_025",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_026",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_027",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_028",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_029",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_030",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_031",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_032",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_033",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_034",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_035",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_036",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_037",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_038",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_039",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_040",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_041",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_042",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_043",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_044",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_045",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_046",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_047",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_048",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_049",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_050",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_051",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_052",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_053",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_054",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_055",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_056",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_057",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_058",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_059",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
},
{
    "mode": "c",
    "trigger": "adc",
    "label": "m6_adc_getadc_060",
    "description": "Methodychka Lab6 ADC technical registers",
    "insertText": "#include \"ADUC841.h\"\nvoid write(unsigned char Addr,unsigned char Dat){WR=1;P0=Dat;P2&=0xF0;P2|=(Addr&0x0F);P2&=0xF0;}\nunsigned char GetADC(unsigned char Ch){ADCCON1=0xAC;ADCCON2=Ch;SCONV=1;while(!ADCI);return ADCDATAH&0x0F;}\nvoid main(){unsigned char x;while(1){x=GetADC(6);write(7,~x);}}"
}
];

function highlightCLine(line) {
    const commentPos = line.indexOf("//");
    const code = commentPos >= 0 ? line.slice(0, commentPos) : line;
    const comment = commentPos >= 0 ? line.slice(commentPos) : "";
    const tokenRe = /\b(void|int|char|short|long|unsigned|signed|if|else|for|while|do|switch|case|break|continue|return|typedef|struct|enum|static|const|volatile|sbit)\b|0x[0-9a-f]+\b|0b[01]+\b|\b\d+\b|"(?:[^"\\]|\\.)*"/gi;
    let out = "";
    let index = 0;
    for (const match of code.matchAll(tokenRe)) {
        const token = match[0];
        const start = match.index ?? 0;
        out += escapeHtml(code.slice(index, start));
        if (/^"/.test(token)) {
            out += `<span class="tok-str">${escapeHtml(token)}</span>`;
        }
        else if (/^(void|int|char|short|long|unsigned|signed|if|else|for|while|do|switch|case|break|continue|return|typedef|struct|enum|static|const|volatile|sbit)$/i.test(token)) {
            out += `<span class="tok-key">${escapeHtml(token)}</span>`;
        }
        else {
            out += `<span class="tok-num">${escapeHtml(token)}</span>`;
        }
        index = start + token.length;
    }
    out += escapeHtml(code.slice(index));
    if (comment)
        out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    return out;
}
function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, value);
    }
    return node;
}


// --- Full syntax highlighter override: Keil C51 / ST841 C + 8051 ASM ---
function highlightAsmLine(line) {
    const commentPos = line.indexOf(";");
    const code = commentPos >= 0 ? line.slice(0, commentPos) : line;
    const comment = commentPos >= 0 ? line.slice(commentPos) : "";
    const asmKeywords = new Set(`
        acall add addc ajmp anl cjne clr cpl da dec div djnz inc jb jbc jc jmp jnb jnc jnz jz
        lcall ljmp mov movc movx mul nop orl pop push ret reti rl rlc rr rrc setb sjmp subb swap xch xchd xrl
    `.trim().split(/\s+/));
    const asmDirectives = new Set(`
        org end equ data bit db dw ds cseg dseg xseg bseg using public extern name include segment rseg
    `.trim().split(/\s+/));
    const asmRegs = new Set(`
        a acc ab b c dptr dpl dph psw sp p0 p1 p2 p3 r0 r1 r2 r3 r4 r5 r6 r7
        ie ip tcon tmod th0 tl0 th1 tl1 th2 tl2 scon sbuf pcon
        adccon1 adccon2 adccon3 adcdatal adcdatah dac0l dac0h dac1l dac1h pwmcon
        wr rd int0 int1 t0 t1 adci sconv
    `.trim().split(/\s+/));
    const re = /([A-Za-z_.$?][\w.$?]*:)|#?0x[0-9a-fA-F]+\b|#?[0-9a-fA-F]+[hH]\b|#?[01]+[bB]\b|#?\d+\b|\b[A-Za-z_.$?][\w.$?]*\b|[,()#@:+\-*/&|^~=<>\[\].]/g;
    let out = "";
    let index = 0;
    for (const m of code.matchAll(re)) {
        const token = m[0];
        const start = m.index ?? 0;
        out += escapeHtml(code.slice(index, start));
        const lower = token.toLowerCase();
        if (/^[A-Za-z_.$?][\w.$?]*:$/.test(token)) {
            out += `<span class="tok-label">${escapeHtml(token)}</span>`;
        }
        else if (asmKeywords.has(lower)) {
            out += `<span class="tok-key">${escapeHtml(token)}</span>`;
        }
        else if (asmDirectives.has(lower)) {
            out += `<span class="tok-pre">${escapeHtml(token)}</span>`;
        }
        else if (asmRegs.has(lower) || /^p[0-3]\.[0-7]$/i.test(token)) {
            out += `<span class="tok-reg">${escapeHtml(token)}</span>`;
        }
        else if (/^#?(?:0x[0-9a-f]+|[0-9a-f]+h|[01]+b|\d+)$/i.test(token)) {
            out += `<span class="tok-num">${escapeHtml(token)}</span>`;
        }
        else if (/^[,()#@:+\-*/&|^~=<>\[\].]$/.test(token)) {
            out += `<span class="tok-op">${escapeHtml(token)}</span>`;
        }
        else {
            out += `<span class="tok-ident">${escapeHtml(token)}</span>`;
        }
        index = start + token.length;
    }
    out += escapeHtml(code.slice(index));
    if (comment) out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    return out;
}

function highlightCLines(source) {
    const text = source.replace(/\r/g, "");
    const keywords = new Set(`
        auto break case continue default do else enum extern for goto if register return sizeof static struct switch typedef union volatile while
        interrupt using reentrant compact small large alien priority task _task inline restrict signed unsigned const
    `.trim().split(/\s+/));
    const types = new Set(`
        void char short int long float double signed unsigned bit sbit sfr sfr16 __sfr __sbit __sfr16
        data idata bdata xdata pdata far code const near huge uint8_t uint16_t uint32_t int8_t int16_t int32_t bool boolean
    `.trim().split(/\s+/));
    const sfrs = new Set(`
        p0 p1 p2 p3 pcon tcon tmod tl0 tl1 th0 th1 scon sbuf ie ip psw acc b sp dpl dph dptr
        adccon1 adccon2 adccon3 adcdatal adcdatah dac0l dac0h dac1l dac1h pwmcon pwm0l pwm0h pwm1l pwm1h
        wr rd int0 int1 t0 t1 adci sconv
    `.trim().split(/\s+/));
    const builtins = new Set(`
        write led static staticl statich clearstatic clearlatches readkey readkeycol readkeycolumn1 readkeycolumn2 readkeycolumn3
        getadc readadc adc_read adc_low adc_high step stepv delay sleep lcd_init lcd_clear lcd_home lcd_line lcd_print lcd_puts lcd_cmd lcd_command lcd_data lcd_char lcd_putc
        seg sevenseg seg_digit sevenseg_digit seg_clear matrix matrix_write matrix_rows matrix_cols bus_write st_write
        _nop_ nop abs min max main init send processkey updatecommand goback execute
    `.trim().split(/\s+/));
    let out = "";
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === "\n") { out += "\n"; i++; continue; }
        if (/\s/.test(ch)) { out += escapeHtml(ch); i++; continue; }
        if (text.startsWith("//", i)) {
            const end = text.indexOf("\n", i);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end);
            out += `<span class="tok-comment">${escapeHtml(slice)}</span>`;
            i += slice.length; continue;
        }
        if (text.startsWith("/*", i)) {
            const end = text.indexOf("*/", i + 2);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end + 2);
            out += `<span class="tok-comment">${escapeHtml(slice)}</span>`;
            i += slice.length; continue;
        }
        if (ch === '"' || ch === "'") {
            const quote = ch; let j = i + 1;
            while (j < text.length) {
                if (text[j] === "\\") { j += 2; continue; }
                if (text[j] === quote) { j++; break; }
                j++;
            }
            const slice = text.slice(i, j);
            out += `<span class="${quote === '"' ? 'tok-str' : 'tok-char'}">${escapeHtml(slice)}</span>`;
            i = j; continue;
        }
        if (ch === "#") {
            const end = text.indexOf("\n", i);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end);
            const esc = escapeHtml(slice).replace(/(#[A-Za-z_][\w]*)/, '<span class="tok-pre">$1</span>');
            out += `<span class="tok-macro">${esc}</span>`;
            i += slice.length; continue;
        }
        const number = /^(?:0x[0-9a-fA-F]+|0b[01]+|[01]+[bB]|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\d+)(?:[uUlLfF]+)?/.exec(text.slice(i));
        if (number) {
            out += `<span class="tok-num">${escapeHtml(number[0])}</span>`;
            i += number[0].length; continue;
        }
        const ident = /^[A-Za-z_][\w]*/.exec(text.slice(i));
        if (ident) {
            const word = ident[0]; const lower = word.toLowerCase();
            let j = i + word.length;
            while (j < text.length && /\s/.test(text[j])) j++;
            const isFn = text[j] === "(";
            if (keywords.has(lower)) out += `<span class="tok-key">${escapeHtml(word)}</span>`;
            else if (types.has(lower)) out += `<span class="tok-type">${escapeHtml(word)}</span>`;
            else if (sfrs.has(lower)) out += `<span class="tok-reg">${escapeHtml(word)}</span>`;
            else if (builtins.has(lower) || isFn) out += `<span class="tok-fn">${escapeHtml(word)}</span>`;
            else out += `<span class="tok-ident">${escapeHtml(word)}</span>`;
            i += word.length; continue;
        }
        const op = /^(?:>>=|<<=|\+\+|--|&&|\|\||==|!=|<=|>=|->|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|[{}()[\].,;:?~!+\-*/%&|^=<>])/.exec(text.slice(i));
        if (op) {
            out += `<span class="tok-op">${escapeHtml(op[0])}</span>`;
            i += op[0].length; continue;
        }
        out += escapeHtml(ch);
        i++;
    }
    return out;
}
