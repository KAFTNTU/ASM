import { EmuBoardController } from "../vm/emuBoardController";
import { SFR } from "../vm/st841Map";
import { compileAsm } from "./asmCompiler";
import { checkC } from "./cChecker";
import { transpileCToAsm } from "./cTranspiler";
import { createMotorPanel } from "./motorPanel";
import { LiveAudioMonitor } from "./liveAudioMonitor";
import { createLogicEditor } from "./logicEditor";
import {
    ASM_DIRECTIVES,
    ASM_HIGHLIGHT_SYMBOLS,
    ASM_MNEMONICS,
    C_BUILTINS,
    C_HIGHLIGHT_SYMBOLS,
    C_KEYWORDS,
    C_MEMORY_QUALIFIERS,
    C_TYPE_NAMES,
    getCodeCompletions,
} from "./codeCompletions";
export function renderStand(params) {
    const { board } = params;
    const cpu = new EmuBoardController(board);
    const liveAudio = new LiveAudioMonitor();
    const root = el("div", { class: "minimalShell" });
    const windowCard = el("div", { class: "windowCard" });
    root.appendChild(windowCard);
    const toolbar = el("div", { class: "toolbar" });
    const runBtn = button("Start", "green");
    const resetBtn = button("Reset");
    const stepBtn = button("Step");
    const traceBtn = button("Runner");
    const oscilloscopeBtn = button("\u041e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444");
    const logicEditorBtn = button("Логічні схеми");
    const modeSelect = el("select", { class: "samplePicker" });
    modeSelect.append(option("asm", "ASM"), option("c", "C"));
    const fileNameInput = el("input", { class: "fileNameInput mono", value: "main", title: "File name" });
    const fileMenuWrap = el("div", { class: "fileMenuWrap" });
    const fileMenuBtn = button("Файл");
    fileMenuBtn.classList.add("fileMenuBtn");
    const fileMenu = el("div", { class: "fileMenu hidden" });
    const openFileBtn = el("button", { class: "fileMenuItem", type: "button" });
    openFileBtn.textContent = "Відкрити файл";
    const downloadFileBtn = el("button", { class: "fileMenuItem", type: "button" });
    downloadFileBtn.textContent = "Завантажити";
    const autosaveBtn = el("button", { class: "fileMenuItem autosaveMenuItem", type: "button" });
    autosaveBtn.textContent = "Автозбереження";
    const fileInput = el("input", { type: "file", accept: ".c,.h,.asm,.a51,.txt", class: "hiddenFileInput" });
    fileMenu.append(openFileBtn, downloadFileBtn, autosaveBtn);
    fileMenuWrap.append(fileMenuBtn, fileMenu, fileInput);
    const speedGroup = el("div", { class: "speedGroup" });
    const speedMultipliers = [1, 10, 100, 1000, 10000];
    const speedButtons = speedMultipliers.map((speed) => {
        const node = button(String(speed), speed === 1 ? "speed active" : "speed");
        node.addEventListener("click", () => setSpeed(speed));
        speedGroup.appendChild(node);
        return { speed, node };
    });
    const fullscreenBtn = button("⛶", "fullscreenBtn");
    fullscreenBtn.title = "Повноекранний режим";
    toolbar.append(runBtn, resetBtn, stepBtn, fileNameInput, modeSelect, fileMenuWrap, traceBtn, oscilloscopeBtn, logicEditorBtn, speedGroup, fullscreenBtn);
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
    windowCard.appendChild(debugModal);
    const motorPanel = createMotorPanel({
        motor: board.extraDevices.motor,
        audio: board.extraDevices.audio,
        getScopeSignal: (source) => board.scope.getSignal(source),
    });
    windowCard.appendChild(motorPanel.element);
    const logicEditor = createLogicEditor({ board });
    windowCard.appendChild(logicEditor.element);
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
    const scopeHitAreas = [
        { source: "sevenSeg", x: 428, y: 44, w: 232, h: 104 },
        { source: "ledBar", x: 38, y: 164, w: 232, h: 56 },
        { source: "matrix", x: 82, y: 266, w: 132, h: 186 },
        { source: "lcd", x: 404, y: 262, w: 268, h: 184 },
    ];
    const scopeSourceAtPointer = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
        const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
        return scopeHitAreas.find((area) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h)?.source ?? null;
    };
    canvas.addEventListener("click", (event) => {
        const source = scopeSourceAtPointer(event);
        if (source)
            motorPanel.open(source);
    });
    canvas.addEventListener("pointermove", (event) => {
        canvas.style.cursor = scopeSourceAtPointer(event) ? "pointer" : "default";
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
    keypadWrap.querySelector(".boardCaption")?.addEventListener("click", () => motorPanel.open("keypad"));
    const joystickWrap = el("div", { class: "boardBox joystickBox" });
    joystickWrap.appendChild(caption("ADC / JOYSTICK"));
    const joystickFace = el("div", { class: "joystickFaceMini" });
    const joystickKnob = el("div", { class: "joystickKnobMini" });
    joystickFace.appendChild(joystickKnob);
    joystickWrap.appendChild(joystickFace);
    boardOverlays.appendChild(joystickWrap);
    joystickWrap.querySelector(".boardCaption")?.addEventListener("click", () => motorPanel.open("joystick"));
    const motorWrap = el("button", { class: "boardBox motorBox" });
    motorWrap.type = "button";
    motorWrap.appendChild(caption("\u0414\u0432\u0438\u0433\u0443\u043d 28BYJ-48"));
    const motorStatus = el("div", { class: "motorPreview mono" });
    motorStatus.textContent = "0% \u2022 0 \u043e\u0431/\u0445\u0432";
    const motorHint = el("div", { class: "motorHint" });
    motorHint.textContent = "\u041a\u0440\u043e\u043a\u043e\u0432\u0438\u0439 \u0434\u0432\u0438\u0433\u0443\u043d";
    motorWrap.append(motorStatus, motorHint);
    boardOverlays.appendChild(motorWrap);
    const audioWrap = el("button", { class: "boardBox audioBox" });
    audioWrap.type = "button";
    audioWrap.title = "\u0417\u0432\u0443\u043a\u043e\u0432\u0430 \u043f\u0456\u0434\u0441\u0438\u0441\u0442\u0435\u043c\u0430";
    const audioSpeaker = el("div", { class: "audioSpeaker" });
    const audioSpeakerCone = el("div", { class: "audioSpeakerCone" });
    const audioSpeakerCap = el("div", { class: "audioSpeakerCap" });
    const audioSpeakerRing1 = el("div", { class: "audioSpeakerRing ring1" });
    const audioSpeakerRing2 = el("div", { class: "audioSpeakerRing ring2" });
    audioSpeaker.append(audioSpeakerCone, audioSpeakerCap, audioSpeakerRing1, audioSpeakerRing2);
    const audioStatus = el("div", { class: "audioPreview mono" });
    audioStatus.textContent = "SPK";
    const audioHint = el("div", { class: "audioHint" });
    audioHint.textContent = "0 Hz";
    audioWrap.append(audioSpeaker, audioStatus, audioHint);
    boardOverlays.appendChild(audioWrap);
    const editorBox = el("div", { class: "editorBox" });
    const editorTop = el("div", { class: "editorTopMini" });
    const modeTag = el("div", { class: "editorTag mono" });
    modeTag.textContent = "ASM";
    const runtimeBar = el("div", { class: "runtimeBar mono" });
    editorTop.append(modeTag, runtimeBar);
    editorBox.appendChild(editorTop);
    const editorShell = el("div", { class: "editorShell" });
    const lineNumbers = el("pre", { class: "lineNumbers mono" });
    const execMarker = el("div", { class: "execMarker", title: "Current instruction" });
    const editorStack = el("div", { class: "editorStack" });
    const codeHighlight = el("pre", { class: "codeHighlight mono" });
    const editor = el("textarea", { class: "editorText spellcheck-false" });
    const autocompleteMenu = el("div", { class: "autocompleteMenu hidden" });
    const autocompleteGhost = el("pre", { class: "autocompleteGhost mono hidden" });
    const scrollSlider = el("div", { class: "editorScrollSlider" });
    const scrollThumb = el("div", { class: "editorScrollThumb" });
    scrollSlider.appendChild(scrollThumb);
    editor.spellcheck = false;
    editorStack.append(codeHighlight, editor, autocompleteMenu, autocompleteGhost);
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
    let sourceMode: "asm" | "c" = "asm";
    let programLoaded = false;
    cpu.setSpeed(speedToBatch(currentSpeed));
    let editorScrollDrag = false;
    let currentPcToLine = [];
    let lastUiUpdateTs = 0;
    let lastDebugUpdateTs = 0;
    let lastFrameTs = performance.now();
    let debugOpen = false;
    let inputDebounce = null;
    let diagnosticLines = new Map();
    const savedFileKey = "st841.editor.autosave.v2";
    let autosaveTimer = null;
    let autosaveEnabled = localStorage.getItem("st841.editor.autosave.enabled") !== "0";
    let lastSavedSignature = "";
    let autocompleteOpen = false;
    let autocompleteIndex = 0;
    let autocompleteMatches = [];
    let autocompletePrefix = "";
    let autocompleteReplaceStart = 0;
    let autocompleteReplaceEnd = 0;
    let autocompleteUserSelected = false;
    editor.value = "";
    function currentEditorSignature() {
        return JSON.stringify({ name: fileNameInput.value || "main", mode: sourceMode, text: editor.value });
    }
    function currentFileName() {
        const rawName = (fileNameInput.value || "main").trim().replace(/[\\/:*?"<>|]+/g, "_");
        const baseName = rawName.replace(/\.(c|h|asm|a51|txt)$/i, "") || "main";
        return `${baseName}.${sourceMode === "c" ? "c" : "asm"}`;
    }
    function updateAutosaveButton() {
        const isSaved = lastSavedSignature === currentEditorSignature();
        autosaveBtn.classList.remove("saved", "dirty", "disabled");
        if (!autosaveEnabled) {
            autosaveBtn.innerHTML = '<span>Autosave</span><span class="autosaveIcon off">X</span>';
            autosaveBtn.classList.add("disabled");
            return;
        }
        if (isSaved) {
            autosaveBtn.innerHTML = '<span>Autosave</span><span class="autosaveIcon on">OK</span>';
            autosaveBtn.classList.add("saved");
        }
        else {
            autosaveBtn.innerHTML = '<span>Autosave</span><span class="autosaveIcon off">!</span>';
            autosaveBtn.classList.add("dirty");
        }
    }
    function autosaveEditor(showMessage = true) {
        const payload = { name: fileNameInput.value || "main", mode: sourceMode, text: editor.value, savedAt: Date.now() };
        localStorage.setItem(savedFileKey, JSON.stringify(payload));
        lastSavedSignature = currentEditorSignature();
        updateAutosaveButton();
        if (showMessage)
            messagesMeta.textContent = `autosaved ${currentFileName()}`;
    }
    function scheduleAutosave() {
        if (autosaveTimer != null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        if (!autosaveEnabled) {
            updateAutosaveButton();
            return;
        }
        autosaveTimer = window.setTimeout(() => {
            autosaveEditor(false);
            autosaveTimer = null;
        }, 600);
    }
    function restoreAutosave() {
        const raw = localStorage.getItem(savedFileKey);
        if (!raw)
            return false;
        try {
            const payload = JSON.parse(raw);
            fileNameInput.value = payload.name || "main";
            sourceMode = payload.mode === "c" ? "c" : "asm";
            modeSelect.value = sourceMode;
            modeTag.textContent = sourceMode.toUpperCase();
            editor.value = String(payload.text || "").replace(/\r\n?/g, "\n");
            lastSavedSignature = currentEditorSignature();
            updateAutosaveButton();
            messagesMeta.textContent = `restored ${currentFileName()}`;
            return true;
        }
        catch {
            return false;
        }
    }
    function closeFileMenu() {
        fileMenu.classList.add("hidden");
    }
    function syncAutocompleteGhostScroll() {
        autocompleteGhost.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    }
    function closeAutocomplete() {
        autocompleteGhost.classList.add("hidden");
        autocompleteGhost.innerHTML = "";
        autocompleteOpen = false;
        autocompleteMatches = [];
        autocompletePrefix = "";
        autocompleteReplaceStart = 0;
        autocompleteReplaceEnd = 0;
        autocompleteIndex = -1;
        autocompleteUserSelected = false;
        autocompleteMenu.classList.add("hidden");
        autocompleteMenu.innerHTML = "";
    }
    function syncAutocompleteActive() {
        if (!autocompleteUserSelected)
            return;
        const active = autocompleteMenu.querySelector(".autocompleteItem.active");
        active?.scrollIntoView({ block: "nearest" });
    }
    function updateAutocompleteGhost() {
        const item = autocompleteOpen && autocompleteUserSelected && autocompleteIndex >= 0 ? autocompleteMatches[autocompleteIndex] : null;
        if (!item || !autocompletePrefix) {
            autocompleteGhost.classList.add("hidden");
            autocompleteGhost.innerHTML = "";
            return;
        }
        const before = editor.value.slice(0, autocompleteReplaceStart);
        autocompleteGhost.classList.remove("hidden");
        autocompleteGhost.innerHTML = `${escapeHtml(before)}<span class="autocompleteGhostInsert">${escapeHtml(item.insertText)}</span>`;
        syncAutocompleteGhostScroll();
    }
    function updateAutocompleteActiveClass() {
        for (const node of Array.from(autocompleteMenu.querySelectorAll(".autocompleteItem"))) {
            node.classList.toggle("active", autocompleteUserSelected && Number(node.dataset.index || "0") === autocompleteIndex);
        }
        syncAutocompleteActive();
        updateAutocompleteGhost();
    }
    function applyAutocomplete(index = autocompleteIndex) {
        if (index < 0)
            return;
        const item = autocompleteMatches[index];
        if (!item)
            return;
        editor.setRangeText(item.insertText, autocompleteReplaceStart, autocompleteReplaceEnd, "end");
        closeAutocomplete();
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.focus();
    }
    function renderAutocomplete() {
        if (!autocompleteMatches.length) {
            closeAutocomplete();
            return;
        }
        autocompleteOpen = true;
        autocompleteMenu.classList.remove("hidden");
        autocompleteMenu.innerHTML = autocompleteMatches
            .map((item, index) => `
      <button class="autocompleteItem ${autocompleteUserSelected && index === autocompleteIndex ? "active" : ""}" data-index="${index}" type="button">
        <span class="autocompleteLabel">${escapeHtml(item.label)}</span>
        <span class="autocompleteDesc">${escapeHtml(item.description)}</span>
        <span class="autocompleteKind">${escapeHtml(item.category || "Code")}</span>
        <span class="autocompleteKey">Tab</span>
        <span class="autocompletePreview">${escapeHtml(completionPreview(item.insertText))}</span>
      </button>`)
            .join("");
        for (const node of Array.from(autocompleteMenu.querySelectorAll(".autocompleteItem"))) {
            node.addEventListener("mousemove", () => {
                const next = Number(node.dataset.index || "0");
                if (next !== autocompleteIndex || !autocompleteUserSelected) {
                    autocompleteIndex = next;
                    autocompleteUserSelected = true;
                    updateAutocompleteActiveClass();
                }
            });
            node.addEventListener("mousedown", (event) => {
                event.preventDefault();
                applyAutocomplete(Number(node.dataset.index || "0"));
            });
        }
        syncAutocompleteActive();
        updateAutocompleteGhost();
    }
    function updateAutocomplete() {
        const cursor = editor.selectionStart ?? 0;
        const result = getCodeCompletions(editor.value, sourceMode, cursor, 160);
        if (!result || !result.matches.length) {
            closeAutocomplete();
            return;
        }
        autocompletePrefix = result.prefix;
        autocompleteReplaceStart = result.replaceStart;
        autocompleteReplaceEnd = result.replaceEnd;
        autocompleteMatches = result.matches;
        autocompleteIndex = -1;
        autocompleteUserSelected = false;
        renderAutocomplete();
    }
    fileMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        fileMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", closeFileMenu);
    fileMenu.addEventListener("click", (event) => event.stopPropagation());
    openFileBtn.addEventListener("click", () => {
        closeFileMenu();
        fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file)
            return;
        const text = await file.text();
        const name = file.name || "main";
        fileNameInput.value = name.replace(/\.(c|h|asm|a51|txt)$/i, "") || "main";
        sourceMode = /\.(c|h)$/i.test(name) ? "c" : "asm";
        modeSelect.value = sourceMode;
        modeTag.textContent = sourceMode.toUpperCase();
        editor.value = String(text).replace(/\r\n?/g, "\n");
        updateLineNumbers();
        updateSyntaxHighlight();
        compileAndRender(false);
        autosaveEditor();
        messagesMeta.textContent = `opened ${name}`;
        fileInput.value = "";
    });
    downloadFileBtn.addEventListener("click", () => {
        closeFileMenu();
        const blob = new Blob([editor.value.replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = currentFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
        messagesMeta.textContent = `downloaded ${currentFileName()}`;
    });
    autosaveBtn.addEventListener("click", () => {
        autosaveEnabled = !autosaveEnabled;
        localStorage.setItem("st841.editor.autosave.enabled", autosaveEnabled ? "1" : "0");
        if (autosaveEnabled) {
            autosaveEditor(true);
        }
        else {
            if (autosaveTimer != null) {
                window.clearTimeout(autosaveTimer);
                autosaveTimer = null;
            }
            updateAutosaveButton();
            messagesMeta.textContent = "autosave off";
        }
        closeFileMenu();
    });
    fileNameInput.addEventListener("input", () => {
        updateAutosaveButton();
        scheduleAutosave();
    });
    autocompleteMenu.addEventListener("wheel", (event) => {
        if (autocompleteOpen)
            event.stopPropagation();
    }, { passive: true });
    editor.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && key === "s") {
            event.preventDefault();
            if (event.shiftKey)
                downloadFileBtn.click();
            else
                autosaveEditor();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "o") {
            event.preventDefault();
            openFileBtn.click();
            return;
        }
        if (!autocompleteOpen)
            return;
        if (event.key === "Tab") {
            event.preventDefault();
            if (autocompleteUserSelected && autocompleteIndex >= 0)
                applyAutocomplete();
            else
                closeAutocomplete();
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            autocompleteUserSelected = true;
            autocompleteIndex = autocompleteIndex < 0 ? 0 : (autocompleteIndex + 1) % autocompleteMatches.length;
            updateAutocompleteActiveClass();
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            autocompleteUserSelected = true;
            autocompleteIndex =
                autocompleteIndex < 0 ? autocompleteMatches.length - 1 : (autocompleteIndex - 1 + autocompleteMatches.length) % autocompleteMatches.length;
            updateAutocompleteActiveClass();
            return;
        }
        if (event.key === "Escape" || event.key === "Enter") {
            closeAutocomplete();
        }
    });
    editor.addEventListener("input", () => {
        programLoaded = false;
        updateLineNumbers();
        updateSyntaxHighlight();
        syncEditorScrollSlider();
        updateAutocomplete();
        updateAutosaveButton();
        scheduleAutosave();
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
        const nextMode = modeSelect.value === "c" ? "c" : "asm";
        if (nextMode !== sourceMode && editor.value) {
            editor.value = "";
            updateLineNumbers();
        }
        sourceMode = nextMode;
        closeAutocomplete();
        modeTag.textContent = sourceMode.toUpperCase();
        programLoaded = false;
        updateSyntaxHighlight();
        updateAutosaveButton();
        scheduleAutosave();
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
        liveAudio.touch();
        debugOpen = true;
        debugModal.classList.remove("hidden");
        syncDeviceBadges();
        renderDebugPanel();
    });
    oscilloscopeBtn.addEventListener("click", () => {
        liveAudio.touch();
        motorPanel.openScope("general");
    });
    logicEditorBtn.addEventListener("click", () => {
        liveAudio.touch();
        logicEditor.open();
    });
    fullscreenBtn.addEventListener("click", () => {
        liveAudio.touch();
        toggleSimulatorFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    motorWrap.addEventListener("click", () => {
        liveAudio.touch();
        motorPanel.open("motor");
    });
    audioWrap.addEventListener("click", () => {
        liveAudio.touch();
        motorPanel.openScope("audio");
    });
    debugClose.addEventListener("click", () => {
        debugOpen = false;
        debugModal.classList.add("hidden");
    });
    // Keep runner open until user presses "Close" explicitly.
    runBtn.addEventListener("click", async () => {
        liveAudio.touch();
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
        liveAudio.touch();
        cpu.stop();
        isRunning = false;
        board.reset();
        await cpu.reset();
        programLoaded = false;
        syncRunButton();
        updateRuntimeBar();
    });
    stepBtn.addEventListener("click", async () => {
        liveAudio.touch();
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
            const merged = [
                ...c.diagnostics.filter((d) => d.level !== "hint"),
                ...transpiled.diagnostics,
                ...asm.diagnostics,
                ...buildCGuideHints(editor.value),
            ];
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
        diagnosticLines = buildDiagnosticLineMap(list);
        updateSyntaxHighlight();
        messagesBody.innerHTML = "";
        const errors = list.filter((item) => item.level === "error").length;
        const warnings = list.filter((item) => item.level === "warning").length;
        messagesMeta.textContent = `${errors} / ${warnings}`;
        for (const item of list) {
            const row = el("div", { class: `messageRow ${item.level}` });
            const line = item.line != null ? `L${item.line}` : "";
            row.innerHTML = `<span class="mono messageLine">${line}</span><span class="messageText">${item.message}</span>`;
            messagesBody.appendChild(row);
        }
        if (expand) {
            messagesBody.scrollTop = 0;
        }
        statusStrip.textContent = summary;
    }
    function updateRuntimeBar(ok = true) {
        isRunning = cpu.isRunning();
        const motor = board.extraDevices.motor?.getTelemetry?.();
        const audio = board.extraDevices.audio?.getTelemetry?.();
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
            motor ? `Motor ${Math.round(motor.duty * 100)}%` : "Motor -",
            motor ? `RPM ${Math.round(motor.currentRpm)}` : "RPM -",
            audio ? `Audio ${audio.frequencyHz.toFixed(0)}Hz` : "Audio -",
            audio ? `DAC ${audio.leftVolts.toFixed(2)}V` : "DAC -",
            `x${currentSpeed}`,
            cpu.isRunning() ? "RUN" : "STOP",
        ].join("   ");
        syncDeviceBadges();
        renderDebugPanel();
        syncExecMarker();
    }
    function syncDeviceBadges() {
        const motor = board.extraDevices.motor?.getTelemetry?.();
        if (motor) {
            motorStatus.textContent = `${Math.round(motor.duty * 100)}% \u2022 ${Math.round(motor.currentRpm)} \u043e\u0431/\u0445\u0432`;
            motorWrap.classList.toggle("active", motor.currentRpm > 0.2 || motor.active);
        }
        else {
            motorStatus.textContent = "0% \u2022 0 \u043e\u0431/\u0445\u0432";
            motorWrap.classList.remove("active");
        }
        const audio = board.extraDevices.audio?.getTelemetry?.();
        if (audio) {
            audioStatus.textContent = audio.active ? "ON" : "SPK";
            audioHint.textContent = audio.active
                ? `${audio.frequencyHz.toFixed(0)} Hz`
                : "0 Hz";
            audioWrap.classList.toggle("active", audio.active || audio.dacEnabled);
        }
        else {
            audioStatus.textContent = "SPK";
            audioHint.textContent = "0 Hz";
            audioWrap.classList.remove("active");
        }
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
        const exactBadge = exactLine ? "\u0442\u043e\u0447\u043d\u043e" : previousLine ? "\u043d\u0430\u0439\u0431\u043b\u0438\u0436\u0447\u0430" : "\u043d\u0435\u043c\u0430";
        const statusText = cpu.isRunning() ? "RUN" : "STOP";
        const p36 = ((cpu.getSfr(SFR.p3) >> 6) & 1) === 1 ? "TX / \u0437\u0430\u043f\u0438\u0441" : "RX / \u0447\u0438\u0442\u0430\u043d\u043d\u044f";
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
            ["P0 / \u0448\u0438\u043d\u0430 \u0434\u0430\u043d\u0438\u0445", hexByte(cpu.getSfr(SFR.p0))],
            ["P1", hexByte(cpu.getSfr(SFR.p1))],
            ["P2 / \u0430\u0434\u0440\u0435\u0441\u0430", hexByte(cpu.getSfr(SFR.p2))],
            ["P3", hexByte(cpu.getSfr(SFR.p3))],
            ["P3.6 \u0440\u0435\u0436\u0438\u043c", p36],
        ];
        const sfrs = [
            ["IE", hexByte(cpu.getSfr(SFR.ie))],
            ["IP", hexByte(cpu.getSfr(SFR.ip))],
            ["TCON", hexByte(cpu.getSfr(SFR.tcon))],
            ["TMOD", hexByte(cpu.getSfr(SFR.tmod))],
            ["PWMCON", hexByte(cpu.getSfr(SFR.pwmcon))],
            ["PWM0H", hexByte(cpu.getSfr(SFR.pwm0h))],
            ["PWM0L", hexByte(cpu.getSfr(SFR.pwm0l))],
            ["PWM1H", hexByte(cpu.getSfr(SFR.pwm1h))],
            ["PWM1L", hexByte(cpu.getSfr(SFR.pwm1l))],
            ["ADCCON1", hexByte(cpu.getSfr(SFR.adccon1))],
            ["ADCCON2", hexByte(cpu.getSfr(SFR.adccon2))],
            ["ADCDATAL", hexByte(cpu.getSfr(SFR.adcdatal))],
            ["ADCDATAH", hexByte(cpu.getSfr(SFR.adcdatah))],
        ];
        const pressedKeys = board
            .getPressedKeys()
            .map((idx) => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"][idx] ?? "?")
            .join(" ");
        const keypadBus = board.getKeypadBusPreview();
        const joy = board.getJoystick();
        const motor = board.extraDevices.motor?.getTelemetry?.();
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
            <div class="runnerLabel">\u0417\u0430\u0440\u0430\u0437 \u0432\u0438\u043a\u043e\u043d\u0443\u0454\u0442\u044c\u0441\u044f</div>
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
          ${card("\u0412\u0432\u0456\u0434 / \u0448\u0438\u043d\u0438", `
            ${kv("P3.6", p36, p36.startsWith("RX") ? "warn" : "ok")}
            ${kv("\u041d\u0430\u0442\u0438\u0441\u043d\u0443\u0442\u043e", pressedKeys || "-")}
            ${kv("Keypad col1", hexByte(keypadBus.col1))}
            ${kv("Keypad col2", hexByte(keypadBus.col2))}
            ${kv("Keypad col3", hexByte(keypadBus.col3))}
            ${kv("Joystick X", joy.x)}
            ${kv("Joystick Y", joy.y)}
          `)}

          ${card("\u0420\u0435\u0433\u0456\u0441\u0442\u0440\u0438 CPU", kvList(coreRegs) + `<div class="runnerSub mono">Bank ${bank} - SP delta +${spDelta}</div>`)}

          ${card("\u041f\u043e\u0440\u0442\u0438 / SFR", kvList(ports) + `<hr class="runnerHr"/>` + kvList(sfrs))}

          ${card("R0-R7 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u0431\u0430\u043d\u043a\u0443", kvList(regsR))}

          ${card("Motor", kvList([
            ["active", motor ? String(motor.active) : "-"],
            ["duty", motor ? `${Math.round(motor.duty * 100)}%` : "-"],
            ["freq", motor ? `${motor.frequencyHz.toFixed(1)} Hz` : "-"],
            ["current rpm", motor ? motor.currentRpm.toFixed(1) : "-"],
            ["target rpm", motor ? motor.targetRpm.toFixed(1) : "-"],
            ["source", motor ? motor.sourceLabel : "-"],
        ]))}

          ${card("LCD cells", `<pre class="runnerPre mono">${escapeHtml(lcdRows.join("\n") || "-")}</pre>`)}

          ${card("\u0421\u0442\u0435\u043a", smallTable(stackRows, ["Addr", "Value", "Mark"]))}

          ${card("IRAM 0x00..0x1F", smallTable(iramRows, ["Addr", "Bytes"]) + `${kv("XRAM 00..07", xramPreview)}`)}

          ${card("\u041f\u043e\u0442\u0456\u043a \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043d\u044f", `
            ${kv("current PC", hexWord(pc))}
            ${kv("ASM line", lineNo != null ? `L${lineNo}` : "-")}
            ${kv("last known", flow.lastKnown)}
            ${kv("last CALL/RET", flow.lastCallRet)}
            ${kv("same-PC streak", flow.streak)}
            ${kv("recent PCs", flow.recent)}
          `, "wide")}
        </div>

        <section class="runnerCard runnerTraceCard">
          <h3>Trace - \u043e\u0441\u0442\u0430\u043d\u043d\u0456 \u0456\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0456\u0457</h3>
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
    async function toggleSimulatorFullscreen() {
        try {
            if (document.fullscreenElement === windowCard) {
                await document.exitFullscreen();
            }
            else if (windowCard.requestFullscreen) {
                await windowCard.requestFullscreen();
            }
        }
        catch {
            // Ignore browser-level fullscreen denial; the button simply stays unchanged.
        }
        syncFullscreenButton();
    }
    function syncFullscreenButton() {
        const active = document.fullscreenElement === windowCard;
        fullscreenBtn.textContent = active ? "🗗" : "⛶";
        fullscreenBtn.title = active ? "Вийти з повноекранного режиму" : "Повноекранний режим";
        fullscreenBtn.classList.toggle("active", active);
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
        const now = performance.now();
        const dtSeconds = Math.max(0.001, Math.min(0.05, (now - lastFrameTs) / 1000));
        lastFrameTs = now;
        board.extraDevices.motor?.advance?.(dtSeconds);
        liveAudio.update(board.extraDevices.audio?.getTelemetry?.() ?? null);
        board.render(drawContext, canvas.width, canvas.height);
        if (!cpu.isRunning() || now - lastUiUpdateTs >= 100) {
            updateRuntimeBar();
            lastUiUpdateTs = now;
        }
        motorPanel.renderFrame(dtSeconds);
        window.requestAnimationFrame(draw);
    }
    restoreAutosave();
    updateLineNumbers();
    updateSyntaxHighlight();
    updateAutosaveButton();
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
                message: `\u041c\u0456\u0442\u043a\u0430 '${label}' \u0432\u0438\u043a\u043b\u0438\u043a\u0430\u0454 \u0441\u0430\u043c\u0443 \u0441\u0435\u0431\u0435. \u0426\u0435 \u0441\u0445\u043e\u0436\u0435 \u043d\u0430 \u0437\u0430\u0446\u0438\u043a\u043b\u0435\u043d\u043d\u044f \u043f\u0456\u0434\u043f\u0440\u043e\u0433\u0440\u0430\u043c\u0438. \u0414\u043b\u044f \u0437\u0430\u0442\u0440\u0438\u043c\u043a\u0438 \u043a\u0440\u0430\u0449\u0435 \u0432\u0438\u043a\u043e\u0440\u0438\u0441\u0442\u0430\u0439 DJNZ \u0430\u0431\u043e CALL \u0456\u043d\u0448\u043e\u0457 \u043f\u0456\u0434\u043f\u0440\u043e\u0433\u0440\u0430\u043c\u0438.`,
            });
        }
    }
    if (/\bpush\b/i.test(text) || /\bpop\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "PUSH/POP \u0432 \u0437\u0430\u0442\u0440\u0438\u043c\u043a\u0430\u0445 \u043c\u043e\u0436\u0435 \u0434\u0430\u0442\u0438 stack overflow. \u0427\u0430\u0441\u0442\u0456\u0448\u0435 \u0446\u0435 \u0441\u043b\u0456\u0434 \u0446\u0438\u043a\u043b\u0443 \u0431\u0435\u0437 \u0437\u0431\u0430\u043b\u0430\u043d\u0441\u043e\u0432\u0430\u043d\u0438\u0445 PUSH/POP.",
        });
    }
    if (/\bpush\s+_?temp0\b/i.test(text) || /\bpop\s+_?temp0\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "\u0417\u043c\u0456\u043d\u043d\u0430 `_Temp0` \u0432 PUSH/POP \u0432\u0438\u0433\u043b\u044f\u0434\u0430\u0454 \u044f\u043a \u043d\u0435\u0432\u0434\u0430\u043b\u0430 \u0437\u0430\u0442\u0440\u0438\u043c\u043a\u0430 \u0432 long-loop. \u041a\u0440\u0430\u0449\u0435: `MOV R2,#...` + `DJNZ R2,label` \u0431\u0435\u0437 PUSH/POP.",
        });
    }
    if (/\bcolumn_1\b/i.test(text) && !/\bwaitrel\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "\u0414\u043b\u044f \u0441\u043a\u0430\u043d\u0443\u0432\u0430\u043d\u043d\u044f \u043a\u043b\u0430\u0432\u0456\u0430\u0442\u0443\u0440\u0438 \u0434\u043e\u0434\u0430\u0439 \u043d\u0435\u0432\u0435\u043b\u0438\u043a\u0443 \u0437\u0430\u0442\u0440\u0438\u043c\u043a\u0443 WAITREL, \u0449\u043e\u0431 \u043a\u043d\u043e\u043f\u043a\u0430 \u043d\u0435 \u0437\u0447\u0438\u0442\u0443\u0432\u0430\u043b\u0430\u0441\u044c \u0431\u0430\u0433\u0430\u0442\u043e \u0440\u0430\u0437\u0456\u0432 \u043f\u0456\u0434\u0440\u044f\u0434.",
        });
    }
    if (/\bmov\s+p2\s*,\s*adr\b/i.test(text) && !/\bmov\s+p2\s*,\s*#0x?0+\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "\u042f\u043a\u0449\u043e \u043f\u0438\u0448\u0435\u0448 \u043d\u0430 LCD/ST841 \u0447\u0435\u0440\u0435\u0437 `MOV P2,ADR`, \u043f\u0456\u0441\u043b\u044f \u0437\u0430\u043f\u0438\u0441\u0443 \u043e\u0431\u043d\u0443\u043b\u0438 latch \u043a\u043e\u043c\u0430\u043d\u0434\u043e\u044e `MOV P2,#0x00`.",
        });
    }
    if (!/\borg\b/i.test(text)) {
        hints.push({
            level: "warning",
            message: "\u041d\u0435\u043c\u0430\u0454 ORG. \u041f\u043e\u0447\u043d\u0438 \u0437 `ORG 0x0000`, \u0449\u043e\u0431 \u0441\u0442\u0430\u0440\u0442 \u043a\u043e\u0434\u0443 \u0431\u0443\u0432 \u0432\u0438\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.",
        });
    }
    if (/\blow\s*\(/i.test(text) || /\bhigh\s*\(/i.test(text)) {
        hints.push({
            level: "hint",
            message: "LOW()/HIGH() already work for label addresses. Use them for code tables and DPTR setup.",
        });
    }
    if (/\bajmp\b/i.test(text) || /\bacall\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "AJMP/ACALL are page-local 2-byte jumps. If the label is farther away, switch to LJMP/LCALL.",
        });
    }
    if (/\bmovc\b/i.test(text) && /\bdptr\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "MOVC with DPTR is ready for ROM/code tables: `MOV DPTR,#table`, then `MOVC A,@A+DPTR`.",
        });
    }
    if (/\bmovx\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "MOVX is supported for @DPTR and @R0/@R1 forms, useful for XRAM-style code.",
        });
    }
    return hints;
}
function buildCGuideHints(source) {
    const text = source.replace(/\r/g, "");
    const hints = [];
    if (/\bswitch\s*\(/i.test(text)) {
        hints.push({
            level: "hint",
            message: "C helper: switch/case/default/break are supported now and work well for keypad, menus and decoders.",
        });
    }
    if (/\bstruct\b/i.test(text)) {
        hints.push({
            level: "hint",
            message: "C helper: local struct, nested struct, struct-by-value and p->field are supported.",
        });
    }
    if (/\breturn\s+.+;/i.test(text) || /\b[A-Za-z_]\w+\s*\([^)]*\)/.test(text)) {
        hints.push({
            level: "hint",
            message: "C helper: functions beyond main() now work, including return values and calls inside expressions.",
        });
    }
    if (/\bcode\s*\*/i.test(text)) {
        hints.push({
            level: "hint",
            message: "C helper: code pointers and calls like foo(table) / table[1] are supported for ROM tables.",
        });
    }
    if (/\bunsigned\s+char\s+\w+\s*\[\s*\d+\s*\]/i.test(text)) {
        hints.push({
            level: "hint",
            message: "C helper: local RAM arrays with initializer and indexed access are supported.",
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
function completionPreview(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
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
        if (item.level !== "error")
            continue;
        map.set(item.line, "error");
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
function highlightAsmLine(line) {
    const semicolonPos = line.indexOf(";");
    const slashPos = line.indexOf("//");
    const commentPos = semicolonPos < 0 ? slashPos : slashPos < 0 ? semicolonPos : Math.min(semicolonPos, slashPos);
    const code = commentPos >= 0 ? line.slice(0, commentPos) : line;
    const comment = commentPos >= 0 ? line.slice(commentPos) : "";
    const tokenRe = /([A-Za-z_.$?][\w.$?]*:)|#?0x[0-9a-fA-F]+\b|#?[0-9a-fA-F]+[hH]\b|#?[01]+[bB]\b|#?\d+\b|\b[A-Za-z_.$?][\w.$?]*\b|[,()#@:+\-*/&|^~=<>\[\].]/g;
    let out = "";
    let index = 0;
    for (const match of code.matchAll(tokenRe)) {
        const token = match[0];
        const start = match.index ?? 0;
        out += escapeHtml(code.slice(index, start));
        const lower = token.toLowerCase();
        if (/^[A-Za-z_.$?][\w.$?]*:$/.test(token)) {
            out += `<span class="tok-label">${escapeHtml(token)}</span>`;
        }
        else if (ASM_MNEMONICS.has(lower)) {
            out += `<span class="tok-key">${escapeHtml(token)}</span>`;
        }
        else if (ASM_DIRECTIVES.has(lower)) {
            out += `<span class="tok-pre">${escapeHtml(token)}</span>`;
        }
        else if (ASM_HIGHLIGHT_SYMBOLS.has(lower) || /^p[0-3]\.[0-7]$/i.test(token)) {
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
    if (comment)
        out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    return out;
}
function highlightCLines(source) {
    const text = source.replace(/\r/g, "");
    let out = "";
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === "\n") {
            out += "\n";
            i++;
            continue;
        }
        if (/\s/.test(ch)) {
            out += escapeHtml(ch);
            i++;
            continue;
        }
        if (text.startsWith("//", i)) {
            const end = text.indexOf("\n", i);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end);
            out += `<span class="tok-comment">${escapeHtml(slice)}</span>`;
            i += slice.length;
            continue;
        }
        if (text.startsWith("/*", i)) {
            const end = text.indexOf("*/", i + 2);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end + 2);
            out += `<span class="tok-comment">${escapeHtml(slice)}</span>`;
            i += slice.length;
            continue;
        }
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === "\\") {
                    j += 2;
                    continue;
                }
                if (text[j] === quote) {
                    j++;
                    break;
                }
                j++;
            }
            const slice = text.slice(i, j);
            out += `<span class="${quote === '"' ? "tok-str" : "tok-char"}">${escapeHtml(slice)}</span>`;
            i = j;
            continue;
        }
        if (ch === "#") {
            const end = text.indexOf("\n", i);
            const slice = end === -1 ? text.slice(i) : text.slice(i, end);
            const esc = escapeHtml(slice).replace(/(#[A-Za-z_][\w]*)/, '<span class="tok-pre">$1</span>');
            out += `<span class="tok-macro">${esc}</span>`;
            i += slice.length;
            continue;
        }
        const number = /^(?:0x[0-9a-fA-F]+|0b[01]+|[01]+[bB]|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?|\d+)(?:[uUlLfF]+)?/.exec(text.slice(i));
        if (number) {
            out += `<span class="tok-num">${escapeHtml(number[0])}</span>`;
            i += number[0].length;
            continue;
        }
        const ident = /^[A-Za-z_][\w]*/.exec(text.slice(i));
        if (ident) {
            const word = ident[0];
            const lower = word.toLowerCase();
            let j = i + word.length;
            while (j < text.length && /\s/.test(text[j]))
                j++;
            const isFn = text[j] === "(";
            if (C_KEYWORDS.has(lower))
                out += `<span class="tok-key">${escapeHtml(word)}</span>`;
            else if (C_TYPE_NAMES.has(lower) || C_MEMORY_QUALIFIERS.has(lower))
                out += `<span class="tok-type">${escapeHtml(word)}</span>`;
            else if (C_HIGHLIGHT_SYMBOLS.has(lower))
                out += `<span class="tok-reg">${escapeHtml(word)}</span>`;
            else if (C_BUILTINS.has(lower) || isFn)
                out += `<span class="tok-fn">${escapeHtml(word)}</span>`;
            else
                out += `<span class="tok-ident">${escapeHtml(word)}</span>`;
            i += word.length;
            continue;
        }
        out += `<span class="tok-op">${escapeHtml(ch)}</span>`;
        i++;
    }
    return out;
}
function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, value);
    }
    return node;
}
