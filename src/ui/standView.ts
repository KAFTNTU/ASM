import type { Board } from "../vm/board";
import { EmuBoardController } from "../vm/emuBoardController";
import { SFR } from "../vm/st841Map";
import { compileAsm, type AsmDiagnostic } from "./asmCompiler";
import { checkC } from "./cChecker";
import { transpileCToAsm } from "./cTranspiler";
import type { ScriptExample } from "./scriptRunner";

type CompileResult = {
  ok: boolean;
  diagnostics: AsmDiagnostic[];
  hex: string;
  pcToLine: Array<{ pc: number; line: number }>;
};

export function renderStand(params: {
  board: Board;
  exampleScripts: ScriptExample[];
}): HTMLElement {
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
  const lcdTableBtn = button("Таблиця РКІ");
  const modeSelect = el("select", { class: "samplePicker" }) as HTMLSelectElement;
  modeSelect.append(option("asm", "ASM"), option("c", "C"));
  const speedGroup = el("div", { class: "speedGroup" });
  const speedMultipliers = [1, 10, 100, 1000, 10000];
  const speedButtons = speedMultipliers.map((speed) => {
    const node = button(String(speed), speed === 1 ? "speed active" : "speed");
    node.addEventListener("click", () => setSpeed(speed));
    speedGroup.appendChild(node);
    return { speed, node };
  });
  toolbar.append(runBtn, resetBtn, stepBtn, modeSelect, traceBtn, lcdTableBtn, speedGroup);
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
  const canvas = el("canvas", { class: "boardCanvasMini" }) as HTMLCanvasElement;
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
  editorTop.append(modeTag, runtimeBar);
  editorBox.appendChild(editorTop);

  const editorShell = el("div", { class: "editorShell" });
  const lineNumbers = el("pre", { class: "lineNumbers mono" });
  const execMarker = el("div", { class: "execMarker", title: "Current instruction" });
  const editorStack = el("div", { class: "editorStack" });
  const codeHighlight = el("pre", { class: "codeHighlight mono" });
  const editor = el("textarea", { class: "editorText spellcheck-false" }) as HTMLTextAreaElement;
  const scrollSlider = el("div", { class: "editorScrollSlider" });
  const scrollThumb = el("div", { class: "editorScrollThumb" });
  scrollSlider.appendChild(scrollThumb);
  editor.spellcheck = false;
  editorStack.append(codeHighlight, editor);
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
  if (!context) throw new Error("No 2d context");
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
  let currentPcToLine: Array<{ pc: number; line: number }> = [];
  let lastUiUpdateTs = 0;
  let lastDebugUpdateTs = 0;
  let debugOpen = false;
  let inputDebounce: number | null = null;

  editor.addEventListener("input", () => {
    programLoaded = false;
    updateLineNumbers();
    syncEditorScrollSlider();
    if (inputDebounce != null) window.clearTimeout(inputDebounce);
    inputDebounce = window.setTimeout(() => {
      updateSyntaxHighlight();
      compileAndRender(false);
      inputDebounce = null;
    }, 120);
  });
  editor.addEventListener("paste", (event) => {
    const clip = event.clipboardData?.getData("text");
    if (!clip) return;
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
  editorShell.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      editor.scrollTop += event.deltaY;
      lineNumbers.scrollTop = editor.scrollTop;
      syncEditorScrollSlider();
      syncExecMarker();
    },
    { passive: false },
  );
  scrollSlider.addEventListener("pointerdown", (event) => {
    editorScrollDrag = true;
    scrollSlider.setPointerCapture(event.pointerId);
    updateEditorScrollFromPointer(event);
  });
  scrollSlider.addEventListener("pointermove", (event) => {
    if (!editorScrollDrag) return;
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
    if (!drag) return;
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
    if (!joystickDrag) return;
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
  lcdTableBtn.addEventListener("click", () => {
    window.open(
      "https://www.alldatasheet.com/html-pdf/63673/HITACHI/HD44780/4513/18/HD44780.html",
      "_blank",
      "noopener,noreferrer",
    );
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
    if (!result.ok) return;
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
    if (!result.ok) return;
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

  function compileAndRender(expand = false): CompileResult {
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

  function showMessages(list: AsmDiagnostic[], summary: string, expand = false) {
    messagesBody.innerHTML = "";
    const errors = list.filter((item) => item.level === "error").length;
    const warnings = list.filter((item) => item.level === "warning").length;
    messagesMeta.textContent = `${errors} / ${warnings}`;
    for (const item of list) {
      const row = el("div", { class: `messageRow ${item.level}` });
      const line = item.line != null ? `L${item.line}` : "";
      row.innerHTML = `<span class="mono">${line}</span><span>${item.message}</span>`;
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
    if (!debugOpen) return;
    const now = performance.now();
    if (cpu.isRunning() && now - lastDebugUpdateTs < 240) return;
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
    const regsR: Array<[string, unknown]> = Array.from({ length: 8 }, (_, i) => [
      `R${i}`,
      hexByte(cpu.readIram(regBase + i)),
    ]);
    const coreRegs: Array<[string, unknown]> = [
      ["PC", hexWord(pc)],
      ["OP", hexByte(op)],
      ["ASM", lineNo != null ? `L${lineNo}` : "-"],
      ["ACC", hexByte(cpu.getSfr(SFR.acc))],
      ["B", hexByte(cpu.getSfr(SFR.b))],
      ["PSW", hexByte(psw)],
      ["SP", hexByte(sp)],
      ["DPTR", `${hexByte(cpu.getSfr(SFR.dph))}${hexByte(cpu.getSfr(SFR.dpl)).slice(2)}`],
    ];
    const ports: Array<[string, unknown]> = [
      ["P0 / шина даних", hexByte(cpu.getSfr(SFR.p0))],
      ["P1", hexByte(cpu.getSfr(SFR.p1))],
      ["P2 / адреса", hexByte(cpu.getSfr(SFR.p2))],
      ["P3", hexByte(cpu.getSfr(SFR.p3))],
      ["P3.6 режим", p36],
    ];
    const sfrs: Array<[string, unknown]> = [
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
    const lcdRows =
      typeof board.extraDevices.lcd?.getDebugRows === "function"
        ? board.extraDevices.lcd.getDebugRows()
        : [];
    const stackRows = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
      const addr = (sp - d) & 0xff;
      return [hexByte(addr), hexByte(cpu.readIram(addr)), d === 0 ? "SP" : ""];
    });
    const iramRows: Array<Array<unknown>> = [];
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

    const kv = (label: string, value: unknown, extra = "") =>
      `<div class="runnerKv ${extra}"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`;
    const kvList = (items: Array<[string, unknown]>) => items.map(([label, value]) => kv(label, value)).join("");
    const card = (title: string, body: string, extra = "") =>
      `<section class="runnerCard ${extra}"><h3>${escapeHtml(title)}</h3>${body}</section>`;
    const smallTable = (rows: Array<Array<unknown>>, headers: string[]) =>
      `<table class="runnerTable"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
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

          ${card("LCD cells", `<pre class="runnerPre mono">${escapeHtml(lcdRows.join("\n") || "-")}</pre>`)}

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

  function setSpeed(speed: number) {
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
    return;
  }

  function syncHighlightScroll() {
    codeHighlight.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
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

  function updateEditorScrollFromPointer(event: PointerEvent) {
    const rect = scrollSlider.getBoundingClientRect();
    const thumbHeight = scrollThumb.offsetHeight || 34;
    const y = Math.max(
      0,
      Math.min(rect.height - thumbHeight, event.clientY - rect.top - thumbHeight / 2),
    );
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

  function updateJoystickFromPointer(event: PointerEvent) {
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

function option(value: string, label: string): HTMLOptionElement {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function caption(text: string): HTMLDivElement {
  const node = el("div", { class: "boardCaption mono" });
  node.textContent = text;
  return node;
}

function button(text: string, tone = ""): HTMLButtonElement {
  const node = el("button", { class: `topBtn ${tone}`.trim() }) as HTMLButtonElement;
  node.textContent = text;
  return node;
}

function hexByte(value: number): string {
  return "0x" + (value & 0xff).toString(16).padStart(2, "0").toUpperCase();
}

function hexWord(value: number): string {
  return "0x" + (value & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}

function speedToBatch(speed: number): number {
  // 1x should feel close to real board refresh speed.
  return Math.max(1, Math.round(speed * 16700));
}

function buildAsmGuideHints(source: string): AsmDiagnostic[] {
  const text = source.replace(/\r/g, "");
  const hints: AsmDiagnostic[] = [];
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

function collectLabels(source: string): Map<string, number> {
  const lines = source.split("\n");
  const out = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i].replace(/;.*$/, "").trim();
    const m = /^([A-Za-z_.$?][\w.$?]*):/.exec(clean);
    if (m) out.set(m[1], i + 1);
  }
  return out;
}

function extractLabelBlock(source: string, label: string): string | null {
  const lines = source.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^\\s*${escapeRegExp(label)}\\s*:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*[A-Za-z_.$?][\w.$?]*\s*:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}k`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}G`;
}

function decodeInstruction(cpu: EmuBoardController): string {
  const pc = cpu.getPC();
  const op = cpu.readCode(pc);
  if (op >= 0x78 && op <= 0x7f) return `MOV R${op - 0x78},#${hexByte(cpu.readCode(pc + 1))}`;
  if (op >= 0xd8 && op <= 0xdf) return `DJNZ R${op - 0xd8}`;
  if (op === 0x00) return "NOP";
  if (op === 0x02) return `LJMP ${hexWord((cpu.readCode(pc + 1) << 8) | cpu.readCode(pc + 2))}`;
  if (op === 0x03) return "RR A";
  if (op === 0x12) return `LCALL ${hexWord((cpu.readCode(pc + 1) << 8) | cpu.readCode(pc + 2))}`;
  if (op === 0x22) return "RET";
  if (op === 0x32) return "RETI";
  if (op === 0x74) return `MOV A,#${hexByte(cpu.readCode(pc + 1))}`;
  if (op === 0x75) return `MOV ${hexByte(cpu.readCode(pc + 1))},#${hexByte(cpu.readCode(pc + 2))}`;
  if (op === 0x80) return "SJMP";
  if (op === 0xa0) return "ORL C,/bit";
  if (op === 0xd2) return `SETB ${hexByte(cpu.readCode(pc + 1))}`;
  if (op === 0xf5) return `MOV ${hexByte(cpu.readCode(pc + 1))},A`;
  if (op >= 0xe8 && op <= 0xef) return `MOV A,R${op - 0xe8}`;
  return "EXEC";
}

function buildExecFlow(
  trace: Array<{ pc: number; opcode: number; acc: number; p0: number; p2: number; tick: number }>,
  currentPc: number,
  pcToLine: Array<{ pc: number; line: number }>,
): {
  current: string;
  line: string;
  streak: number;
  recent: string;
  range: string;
  inRange: string;
  lastKnown: string;
  lastCallRet: string;
} {
  const pc = currentPc & 0xffff;
  const hit = pcToLine.find((item) => item.pc === pc);
  const line = hit ? `ASM line: ${hit.line}` : "ASM line: -";

  let streak = 0;
  for (let i = trace.length - 1; i >= 0; i--) {
    if ((trace[i].pc & 0xffff) !== pc) break;
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

function isCallRetOpcode(op: number): boolean {
  const code = op & 0xff;
  if (code === 0x12 || code === 0x22 || code === 0x32) return true;
  return (code & 0x1f) === 0x11;
}

function decodeOpcodeName(op: number): string {
  const code = op & 0xff;
  if (code === 0x12) return "LCALL";
  if ((code & 0x1f) === 0x11) return "ACALL";
  if (code === 0x22) return "RET";
  if (code === 0x32) return "RETI";
  return "OP";
}

function trimTrailingEmptyLines(text: string): string {
  const normalized = text.replace(/\r/g, "");
  const trimmed = normalized.replace(/\n+$/g, "");
  return trimmed.length ? trimmed : "";
}

function normalizeEditorText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  return normalized.replace(/\n{3,}/g, "\n\n");
}

function highlightAsm(source: string): string {
  return source
    .split("\n")
    .map((line) => highlightAsmLine(line))
    .join("\n");
}

function highlightC(source: string): string {
  return source
    .split("\n")
    .map((line) => highlightCLine(line))
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightAsmLine(line: string): string {
  const commentPos = line.indexOf(";");
  const code = commentPos >= 0 ? line.slice(0, commentPos) : line;
  const comment = commentPos >= 0 ? line.slice(commentPos) : "";

  const tokenRe = /\b(mov|movc|movx|setb|clr|cpl|anl|orl|xrl|add|addc|subb|inc|dec|djnz|cjne|sjmp|jmp|ljmp|acall|lcall|call|ret|reti|nop|rr|rl|rrc|rlc|swap|mul|div|push|pop|jb|jnb|jbc|jz|jnz|jc|jnc|org|equ|db|end)\b|\b(a|acc|b|dptr|dpl|dph|psw|sp|p[0-3]|r[0-7]|ie|ip|tcon|tmod|th0|tl0|th1|tl1|scon|sbuf)\b|#?0x[0-9a-f]+\b|#?[01]+b\b|#?\d+\b|#?[0-9a-f]+h\b/gi;
  let out = "";
  let index = 0;
  for (const match of code.matchAll(tokenRe)) {
    const token = match[0];
    const start = match.index ?? 0;
    out += escapeHtml(code.slice(index, start));
    if (/^(mov|movc|movx|setb|clr|cpl|anl|orl|xrl|add|addc|subb|inc|dec|djnz|cjne|sjmp|jmp|ljmp|acall|lcall|call|ret|reti|nop|rr|rl|rrc|rlc|swap|mul|div|push|pop|jb|jnb|jbc|jz|jnz|jc|jnc|org|equ|db|end)$/i.test(token)) {
      out += `<span class="tok-key">${escapeHtml(token)}</span>`;
    } else if (/^(a|acc|b|dptr|dpl|dph|psw|sp|p[0-3]|r[0-7]|ie|ip|tcon|tmod|th0|tl0|th1|tl1|scon|sbuf)$/i.test(token)) {
      out += `<span class="tok-reg">${escapeHtml(token)}</span>`;
    } else {
      out += `<span class="tok-num">${escapeHtml(token)}</span>`;
    }
    index = start + token.length;
  }
  out += escapeHtml(code.slice(index));
  if (comment) out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
  return out;
}

function highlightCLine(line: string): string {
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
    } else if (/^(void|int|char|short|long|unsigned|signed|if|else|for|while|do|switch|case|break|continue|return|typedef|struct|enum|static|const|volatile|sbit)$/i.test(token)) {
      out += `<span class="tok-key">${escapeHtml(token)}</span>`;
    } else {
      out += `<span class="tok-num">${escapeHtml(token)}</span>`;
    }
    index = start + token.length;
  }
  out += escapeHtml(code.slice(index));
  if (comment) out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
  return out;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}
