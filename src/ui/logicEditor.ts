import type { Board } from "../vm/board";
import {
  COMPONENT_LIBRARY,
  EDITABLE_BUILTIN_KINDS,
  cloneProject,
  createBoardLogicAdapter,
  createComponent,
  createCustomChip,
  createEmptyLogicProject,
  evaluateCircuit,
  expandBuiltinComponent,
  getComponentPins,
  getComponentSize,
  getPinPosition,
  logicValueLabel,
  stepLogicProject,
  validateProject,
  type CircuitDefinition,
  type EvaluationResult,
  type LogicComponent,
  type LogicComponentKind,
  type LogicProject,
  type LogicValue,
  type LogicWire,
  type WirePoint,
  type WireEndpoint,
} from "./logicCircuit";

interface LogicEditorHandle {
  element: HTMLElement;
  open(): void;
  close(): void;
}

interface LogicEditorOptions {
  board: Board;
}

type Tool = "select" | "wire" | "delete" | LogicComponentKind;

interface ComponentDragState {
  componentIds: string[];
  start: WirePoint;
}

interface WireBendDragState {
  wireId: string;
  affectedIndices: number[];
  axis: "x" | "y";
  baseBends: WirePoint[];
  before: LogicProject;
  moved: boolean;
}

interface MarqueeState {
  start: WirePoint;
  current: WirePoint;
  additive: boolean;
}

interface LogicClipboard {
  components: LogicComponent[];
  wires: LogicWire[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "st841.logic-editor.project.v1";
const GRID_SIZE = 20;
const MIN_VIEWPORT_WIDTH = 420;
const MAX_VIEWPORT_WIDTH = 16800;
const PIN_OPTIONS = Array.from({ length: 4 }, (_, port) =>
  Array.from({ length: 8 }, (_, bit) => `P${port}.${bit}`),
).flat();

export function createLogicEditor(options: LogicEditorOptions): LogicEditorHandle {
  const adapter = createBoardLogicAdapter(options.board);
  let project = restoreProject();
  let currentCircuitId = project.rootCircuitId;
  let selectedId: string | null = null;
  let selectedWireId: string | null = null;
  let selectedComponentIds = new Set<string>();
  let selectedWireIds = new Set<string>();
  let tool: Tool = "select";
  let pendingCustomCircuitId: string | null = null;
  let pendingWire: WireEndpoint | null = null;
  let wireCursor: { x: number; y: number } | null = null;
  let running = false;
  let open = false;
  let lastClockTime = performance.now();
  let evaluation: EvaluationResult = evaluateCircuit(project, currentCircuitId, adapter);
  let dragState: ComponentDragState | null = null;
  let wireBendDragState: WireBendDragState | null = null;
  let marqueeState: MarqueeState | null = null;
  let marqueeRect: SVGRectElement | null = null;
  let dragFramePending = false;
  let preDragProject: LogicProject | null = null;
  let panState: { x: number; y: number; startX: number; startY: number } | null = null;
  let viewport = { x: 0, y: 0, width: 1400, height: 900 };
  let history: LogicProject[] = [];
  let future: LogicProject[] = [];
  let saveTimer: number | null = null;
  let libraryFilter = "";
  let clipboard: LogicClipboard | null = null;
  let pasteOffset = 0;
  let wireColorPopover: HTMLElement | null = null;
  let wirePreviewPath: SVGPathElement | null = null;
  let hoveredPinGroup: SVGGElement | null = null;
  let pointerDoubleClickTime = -Infinity;

  const modal = div("logicEditorModal hidden");
  const shell = div("logicEditorShell");
  modal.appendChild(shell);

  const titlebar = div("logicTitlebar");
  const title = div("logicWindowTitle");
  title.textContent = "Редактор логічних схем";
  const windowActions = div("logicWindowActions");
  const fullscreenButton = textButton("⛶", "logicWindowFullscreen");
  fullscreenButton.title = "Повноекранний режим";
  const closeButton = textButton("✕", "logicWindowClose");
  closeButton.title = "Закрити редактор";
  windowActions.append(fullscreenButton, closeButton);
  titlebar.append(title, windowActions);

  const menuBar = div("logicMenuBar");
  const fileButton = menuButton("Файл");
  const editButton = menuButton("Редагування");
  const viewButton = menuButton("Вигляд");
  const helpButton = menuButton("Довідка");
  menuBar.append(fileButton, editButton, viewButton, helpButton);

  const mainToolbar = div("logicMainToolbar");
  const quickToolButtons = new Map<Tool, HTMLButtonElement>();
  const runButton = toolbarButton("▶", "", "Запустити або призупинити симуляцію", true);
  const truthButton = toolbarButton("▦", "", "Побудувати таблицю істинності", true);
  const verifyButton = toolbarButton("✓", "", "Перевірити тестові вектори", true);
  const chipButton = toolbarButton("▣", "", "Створити вкладену мікросхему", true);
  const fitButton = toolbarButton("⌂", "", "Умістити всю схему", true);
  for (const button of [runButton, truthButton, verifyButton, chipButton, fitButton]) button.classList.add("iconOnly");
  menuBar.append(div("logicMenuActionSpacer"), runButton, truthButton, verifyButton, chipButton, fitButton);
  syncRunButton();
  for (const item of COMPONENT_LIBRARY) {
    const button = componentToolbarButton(item.kind, item.title, item.description);
    button.addEventListener("click", () => setTool(item.kind));
    mainToolbar.appendChild(button);
    quickToolButtons.set(item.kind, button);
  }
  const toolbarSpacer = div("logicToolbarSpacer");
  mainToolbar.append(toolbarSpacer);

  const breadcrumb = div("logicBreadcrumb");
  const body = div("logicEditorBody");
  const canvasArea = div("logicCanvasArea");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("logicCanvas");
  svg.setAttribute("tabindex", "0");
  canvasArea.appendChild(svg);
  const emptyHint = div("logicEmptyHint");
  emptyHint.innerHTML = "<strong>Складіть схему</strong><span>Виберіть елемент на панелі та клацніть по полю. З'єднуйте контакти інструментом «Дріт».</span>";
  canvasArea.appendChild(emptyHint);

  const sidebar = div("logicSidebar");
  const sidebarTabs = div("logicSidebarTabs");
  const libraryTab = textButton("Компоненти", "logicSidebarTab active");
  const propertiesTab = textButton("Властивості", "logicSidebarTab");
  sidebarTabs.append(libraryTab, propertiesTab);
  const libraryPanel = div("logicLibraryPanel");
  const propertiesPanel = div("logicPropertiesPanel hidden");
  sidebar.append(sidebarTabs, libraryPanel, propertiesPanel);
  body.append(canvasArea, sidebar);

  const statusbar = div("logicStatusbar");
  const statusLeft = div("logicStatusLeft");
  const statusRight = div("logicStatusRight");
  statusbar.append(statusLeft, statusRight);

  shell.append(titlebar, menuBar, mainToolbar, breadcrumb, body, statusbar);

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = ".json,.logic.json";
  importInput.className = "hiddenFileInput";
  modal.appendChild(importInput);

  const dropdown = div("logicDropdown hidden");
  modal.appendChild(dropdown);

  const dialogLayer = div("logicDialogLayer hidden");
  modal.appendChild(dialogLayer);

  const colorPopover = div("logicWireColorPopover hidden");
  colorPopover.addEventListener("click", (event) => event.stopPropagation());
  colorPopover.addEventListener("pointerdown", (event) => event.stopPropagation());
  modal.appendChild(colorPopover);

  const propertiesPopover = div("logicPropertiesPopover hidden");
  propertiesPopover.addEventListener("click", (event) => event.stopPropagation());
  propertiesPopover.addEventListener("pointerdown", (event) => event.stopPropagation());
  modal.appendChild(propertiesPopover);

  buildLibraryPanel();
  setTool("select");
  renderAll();

  closeButton.addEventListener("click", closeEditor);
  modal.addEventListener("pointerdown", (event) => {
    if (event.target === modal) closeDropdown();
  });
  fileButton.addEventListener("click", (event) => openMenu(event.currentTarget as HTMLElement, [
    ["Нова схема", newProject],
    ["Відкрити JSON…", () => importInput.click()],
    ["Зберегти JSON", exportProject],
    ["Зберегти у браузері", () => persistProject(true)],
  ]));
  editButton.addEventListener("click", (event) => openMenu(event.currentTarget as HTMLElement, [
    ["Скасувати", undo],
    ["Повторити", redo],
    ["Копіювати", copySelection],
    ["Вирізати", cutSelection],
    ["Вставити", pasteSelection],
    ["Виділити все", selectAll],
    ["Видалити вибране", deleteSelection],
    ["Дублювати", duplicateSelection],
  ]));
  viewButton.addEventListener("click", (event) => openMenu(event.currentTarget as HTMLElement, [
    ["Умістити схему", fitCircuit],
    ["Масштаб 100%", () => { viewport = { x: 0, y: 0, width: 1400, height: 900 }; renderCanvas(); }],
    ["Повноекранний режим", toggleFullscreen],
    ["Показати таблицю істинності", showTruthTable],
  ]));
  helpButton.addEventListener("click", () => showInfoDialog(
    "Як працювати",
    "Додайте входи, логічні елементи та виходи. Дріт можна починати з входу або виходу, але з’єднання має завершуватися контактом протилежного типу. Кути вибраного дроту перетягуються квадратними ручками. Shift додає об’єкти до виділення, а протягування по вільному полю створює рамку. Подвійний клік по MUX, DEC, суматору або власній мікросхемі відкриває внутрішню схему.",
  ));
  libraryTab.addEventListener("click", () => setSidebarTab("library"));
  propertiesTab.addEventListener("click", () => setSidebarTab("properties"));
  runButton.addEventListener("click", () => {
    running = !running;
    resetClockTimers();
    if (!running) adapter.releaseAll();
    syncRunButton();
    updateStatus();
  });
  truthButton.addEventListener("click", showTruthTable);
  verifyButton.addEventListener("click", showVectorVerifier);
  chipButton.addEventListener("click", createChipDialog);
  fitButton.addEventListener("click", fitCircuit);
  fullscreenButton.addEventListener("click", toggleFullscreen);

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const candidate = JSON.parse(await file.text()) as LogicProject;
      const errors = validateProject(candidate);
      if (errors.length) throw new Error(errors.join("\n"));
      snapshot();
      project = candidate;
      currentCircuitId = project.rootCircuitId;
      resetClockTimers();
      clearSelection();
      persistProject();
      fitCircuit();
      renderAll();
    } catch (error) {
      showInfoDialog("Не вдалося відкрити", error instanceof Error ? error.message : String(error));
    } finally {
      importInput.value = "";
    }
  });

  svg.addEventListener("pointerdown", onCanvasPointerDown);
  svg.addEventListener("pointermove", onCanvasPointerMove);
  svg.addEventListener("pointerup", onCanvasPointerUp);
  svg.addEventListener("pointercancel", onCanvasPointerUp);
  svg.addEventListener("wheel", onCanvasWheel, { passive: false });
  svg.addEventListener("dblclick", onCanvasDoubleClick);
  svg.addEventListener("contextmenu", onCanvasContextMenu);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("click", (event) => {
    if (wireColorPopover && !wireColorPopover.contains(event.target as Node)) closeWireColorPopover();
    if (!propertiesPopover.classList.contains("hidden") && !propertiesPopover.contains(event.target as Node)) closePropertiesPopover();
    if (!dropdown.contains(event.target as Node) && event.target !== fileButton && event.target !== editButton && event.target !== viewButton) {
      closeDropdown();
    }
  });

  function openEditor(): void {
    open = true;
    modal.classList.remove("hidden");
    resetClockTimers();
    syncRunButton();
    renderAll();
    svg.focus();
  }

  function closeEditor(): void {
    open = false;
    modal.classList.add("hidden");
    pendingWire = null;
    clearPinHover();
    closeWireColorPopover();
    closePropertiesPopover();
    persistProject();
    if (document.fullscreenElement === modal) void document.exitFullscreen();
  }

  function syncRunButton(): void {
    runButton.classList.toggle("active", running);
    const icon = runButton.querySelector(".logicToolIcon");
    if (icon) icon.textContent = running ? "⏸" : "▶";
    runButton.title = running ? "Симуляція активна — натисніть, щоб призупинити" : "Симуляція призупинена — натисніть, щоб запустити";
  }

  function resetClockTimers(): void {
    lastClockTime = performance.now();
    for (const circuit of Object.values(project.circuits)) {
      for (const component of circuit.components) {
        if (component.kind === "CLOCK") component.state.lastToggleMs = lastClockTime;
      }
    }
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement === modal) await document.exitFullscreen();
      else if (modal.requestFullscreen) await modal.requestFullscreen();
      else flashStatus("Браузер не підтримує повноекранний режим");
    } catch {
      flashStatus("Не вдалося змінити повноекранний режим");
    }
  }

  function updateFullscreenButton(): void {
    const active = document.fullscreenElement === modal;
    fullscreenButton.textContent = active ? "▣" : "⛶";
    fullscreenButton.title = active ? "Вийти з повноекранного режиму" : "Повноекранний режим";
    modal.classList.toggle("isFullscreen", active);
    if (open) window.requestAnimationFrame(() => renderCanvas());
  }

  function buildLibraryPanel(): void {
    libraryPanel.innerHTML = "";
    const searchWrap = div("logicLibrarySearch");
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Пошук елементів…";
    search.value = libraryFilter;
    search.addEventListener("input", () => {
      libraryFilter = search.value.trim().toLowerCase();
      buildLibraryPanel();
      const next = libraryPanel.querySelector<HTMLInputElement>(".logicLibrarySearch input");
      next?.focus();
      if (next) next.setSelectionRange(next.value.length, next.value.length);
    });
    searchWrap.appendChild(search);
    libraryPanel.appendChild(searchWrap);
    const grouped = new Map<string, typeof COMPONENT_LIBRARY>();
    for (const item of COMPONENT_LIBRARY) {
      const searchable = `${item.title} ${item.description} ${item.category} ${item.kind}`.toLowerCase();
      if (libraryFilter && !searchable.includes(libraryFilter)) continue;
      const group = grouped.get(item.category) ?? [];
      group.push(item);
      grouped.set(item.category, group);
    }
    for (const [category, items] of grouped) {
      const section = div("logicLibrarySection");
      const heading = div("logicLibraryHeading");
      heading.textContent = category;
      const list = div("logicLibraryList");
      for (const item of items) {
        const button = document.createElement("button");
        button.className = "logicLibraryItem";
        button.type = "button";
        button.innerHTML = `<span class="logicLibrarySymbol">${escapeHtml(symbolForKind(item.kind))}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description)}</small></span>`;
        button.addEventListener("click", () => setTool(item.kind));
        list.appendChild(button);
      }
      section.append(heading, list);
      libraryPanel.appendChild(section);
    }
    const chipSection = div("logicLibrarySection");
    const chipHeading = div("logicLibraryHeading");
    chipHeading.textContent = "Власні мікросхеми";
    const chipList = div("logicLibraryList");
    for (const circuit of Object.values(project.circuits).filter((item) =>
      item.id !== project.rootCircuitId && (!libraryFilter || item.name.toLowerCase().includes(libraryFilter)),
    )) {
      const button = document.createElement("button");
      button.className = "logicLibraryItem";
      button.type = "button";
      button.innerHTML = `<span class="logicLibrarySymbol">▣</span><span><strong>${escapeHtml(circuit.name)}</strong><small>Вкладена редагована схема</small></span>`;
      button.addEventListener("click", () => {
        const component = createComponent("CUSTOM", 220, 160);
        component.label = circuit.name;
        component.subcircuitId = circuit.id;
        addComponentAtNextClick(component);
      });
      chipList.appendChild(button);
    }
    const create = document.createElement("button");
    create.className = "logicLibraryCreateChip";
    create.textContent = "+ Створити мікросхему";
    create.addEventListener("click", createChipDialog);
    chipSection.append(chipHeading, chipList, create);
    libraryPanel.appendChild(chipSection);
  }

  function setSidebarTab(name: "library" | "properties"): void {
    const properties = name === "properties";
    libraryTab.classList.toggle("active", !properties);
    propertiesTab.classList.toggle("active", properties);
    libraryPanel.classList.toggle("hidden", properties);
    propertiesPanel.classList.toggle("hidden", !properties);
    if (properties) renderProperties();
  }

  function setTool(next: Tool): void {
    tool = next;
    pendingCustomCircuitId = null;
    pendingWire = null;
    wirePreviewPath = null;
    clearPinHover();
    for (const [kind, button] of quickToolButtons) button.classList.toggle("active", kind === tool);
    svg.classList.toggle("wireMode", tool === "wire");
    svg.classList.toggle("deleteMode", tool === "delete");
    updateStatus();
  }

  function componentToolbarButton(kind: LogicComponentKind, titleText: string, description: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "logicComponentToolButton";
    button.title = `${titleText} — ${description}`;
    button.setAttribute("aria-label", titleText);
    const preview = document.createElementNS(SVG_NS, "svg");
    preview.classList.add("logicComponentToolPreview");
    preview.setAttribute("aria-hidden", "true");
    const sample = createComponent(kind, 0, 0);
    sample.label = "";
    const size = getComponentSize(sample, project);
    preview.setAttribute("viewBox", `${-14} ${-12} ${size.width + 28} ${size.height + 24}`);
    preview.appendChild(renderComponent(sample));
    const label = document.createElement("span");
    label.className = "logicComponentToolLabel";
    label.textContent = toolbarLabelForKind(kind);
    button.append(preview, label);
    return button;
  }

  function currentCircuit(): CircuitDefinition {
    return project.circuits[currentCircuitId];
  }

  function onCanvasPointerDown(event: PointerEvent): void {
    closeDropdown();
    const target = event.target as SVGElement;
    const bendHandle = target.closest<SVGElement>("[data-wire-handle]");
    const dipBitNode = target.closest<SVGElement>("[data-dip-bit]");
    const toggleNode = target.closest<SVGElement>("[data-logic-toggle]");
    const pinNode = target.closest<SVGElement>("[data-pin]");
    const componentNode = target.closest<SVGElement>("[data-component-id]");
    const wireNode = target.closest<SVGElement>("[data-wire-id]");
    const world = screenToWorld(event.clientX, event.clientY);

    if (event.button === 0 && event.detail >= 2 && (componentNode || wireNode)) {
      pointerDoubleClickTime = performance.now();
      onCanvasDoubleClick(event);
      return;
    }

    if (event.button === 1 || event.button === 2 || (event.button === 0 && event.altKey)) {
      panState = { x: viewport.x, y: viewport.y, startX: event.clientX, startY: event.clientY };
      svg.setPointerCapture(event.pointerId);
      return;
    }

    if (bendHandle && event.button === 0 && tool !== "delete") {
      const wireId = String(bendHandle.dataset.wireId);
      const pointIndex = Number(bendHandle.dataset.wireHandle);
      if (beginWireBendDrag(wireId, pointIndex)) {
        svg.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (toggleNode) {
      const componentId = String(toggleNode.dataset.componentId);
      const component = currentCircuit().components.find((item) => item.id === componentId);
      if (component?.kind === "SWITCH") {
        snapshot();
        component.state.value = component.state.value === 1 ? 0 : 1;
        setSingleComponentSelection(component.id);
        persistProject();
        renderAll();
      } else if (component?.kind === "BUTTON") {
        component.state.value = 1;
        setSingleComponentSelection(component.id);
        renderAll();
        const release = () => {
          component.state.value = 0;
          renderAll();
          window.removeEventListener("pointerup", release);
          window.removeEventListener("pointercancel", release);
        };
        window.addEventListener("pointerup", release);
        window.addEventListener("pointercancel", release);
      }
      event.stopPropagation();
      return;
    }

    if (dipBitNode) {
      const componentId = String(dipBitNode.dataset.componentId);
      const bit = Number(dipBitNode.dataset.dipBit);
      const component = currentCircuit().components.find((item) => item.id === componentId && item.kind === "DIP4");
      if (component && bit >= 0 && bit < 4) {
        snapshot();
        component.state.value = (Number(component.state.value ?? 0) ^ (1 << bit)) & 0x0f;
        setSingleComponentSelection(component.id);
        persistProject();
        renderAll();
      }
      event.stopPropagation();
      return;
    }

    if (pinNode) {
      const endpoint: WireEndpoint = {
        componentId: String(pinNode.dataset.componentId),
        pinId: String(pinNode.dataset.pin),
      };
      handlePinClick(endpoint);
      if (pendingWire) {
        wireCursor = world;
        svg.setPointerCapture(event.pointerId);
        updateWirePreview();
      }
      event.stopPropagation();
      return;
    }

    if (wireNode) {
      selectWire(String(wireNode.dataset.wireId), event.shiftKey);
      if (tool === "delete") deleteSelection();
      else {
        renderCanvas();
        renderProperties();
        updateStatus();
      }
      return;
    }

    if (componentNode) {
      const componentId = String(componentNode.dataset.componentId);
      const component = currentCircuit().components.find((item) => item.id === componentId);
      if (!component) return;
      if (tool === "delete") {
        snapshot();
        removeComponent(componentId);
        persistProject();
        renderAll();
        return;
      }
      if (tool !== "select" && tool !== "wire") return;
      selectComponent(componentId, event.shiftKey);
      if (tool === "select") {
        if (!selectedComponentIds.has(componentId)) {
          renderCanvas();
          return;
        }
        preDragProject = cloneProject(project);
        dragState = { componentIds: [...selectedComponentIds], start: world };
        svg.setPointerCapture(event.pointerId);
      }
      renderCanvas();
      renderProperties();
      updateStatus();
      return;
    }

    if (pendingCustomCircuitId) {
      const definition = project.circuits[pendingCustomCircuitId];
      if (definition) {
        snapshot();
        const component = createComponent("CUSTOM", snap(world.x), snap(world.y));
        component.label = definition.name;
        component.subcircuitId = definition.id;
        currentCircuit().components.push(component);
        setSingleComponentSelection(component.id);
        pendingCustomCircuitId = null;
        persistProject();
        renderAll();
        return;
      }
      pendingCustomCircuitId = null;
    }

    if (isComponentTool(tool)) {
      snapshot();
      const component = createComponent(tool, snap(world.x), snap(world.y));
      currentCircuit().components.push(component);
      setSingleComponentSelection(component.id);
      setTool("select");
      persistProject();
      renderAll();
      return;
    }

    if (tool === "select" && event.button === 0) {
      beginMarquee(world, event.shiftKey);
      svg.setPointerCapture(event.pointerId);
      return;
    }
    clearSelection();
    renderCanvas();
    renderProperties();
    updateStatus();
  }

  function onCanvasPointerMove(event: PointerEvent): void {
    wireCursor = screenToWorld(event.clientX, event.clientY);
    if (wireBendDragState) {
      moveWireBend(wireCursor);
      return;
    }
    if (marqueeState) {
      marqueeState.current = wireCursor;
      updateMarqueeRect();
      return;
    }
    if (panState) {
      const scaleX = viewport.width / Math.max(1, svg.clientWidth);
      const scaleY = viewport.height / Math.max(1, svg.clientHeight);
      viewport.x = panState.x - (event.clientX - panState.startX) * scaleX;
      viewport.y = panState.y - (event.clientY - panState.startY) * scaleY;
      renderCanvas();
      return;
    }
    if (pendingWire && !dragState) {
      updatePinHover(event.clientX, event.clientY);
      updateWirePreview();
      return;
    }
    clearPinHover();
    if (!dragState) return;
    moveSelectedComponents(wireCursor.x - dragState.start.x, wireCursor.y - dragState.start.y);
    if (!dragFramePending) {
      dragFramePending = true;
      window.requestAnimationFrame(() => {
        dragFramePending = false;
        if (dragState) renderCanvas();
      });
    }
  }

  function onCanvasPointerUp(event: PointerEvent): void {
    if (wireBendDragState) {
      finishWireBendDrag();
      releasePointer(event.pointerId);
      return;
    }
    if (marqueeState) {
      finishMarquee();
      releasePointer(event.pointerId);
      return;
    }
    // Also support the natural drag-from-output-to-input gesture. Pointer
    // capture can make event.target the SVG itself, so resolve the pin under
    // the release position explicitly.
    if (pendingWire && tool === "wire") {
      const dropNode = document.elementFromPoint(event.clientX, event.clientY)?.closest<SVGElement>("[data-pin]");
      if (dropNode?.dataset.componentId && dropNode.dataset.pin) {
        const endpoint = { componentId: String(dropNode.dataset.componentId), pinId: String(dropNode.dataset.pin) };
        if (endpoint.componentId !== pendingWire.componentId || endpoint.pinId !== pendingWire.pinId) handlePinClick(endpoint);
        if (!pendingWire) {
          releasePointer(event.pointerId);
          wireCursor = null;
          clearPinHover();
          return;
        }
      }
    }
    if (dragState) {
      snapDraggedComponents();
    }
    if (dragState && preDragProject) {
      const moved = JSON.stringify(preDragProject) !== JSON.stringify(project);
      if (moved) {
        history.push(preDragProject);
        if (history.length > 50) history.shift();
        future = [];
        persistProject();
      }
    }
    preDragProject = null;
    dragState = null;
    dragFramePending = false;
    panState = null;
    clearPinHover();
    renderCanvas();
    releasePointer(event.pointerId);
  }

  function updateWirePreview(): void {
    if (!pendingWire || !wireCursor || !wirePreviewPath) return;
    const source = currentCircuit().components.find((item) => item.id === pendingWire!.componentId);
    if (!source) return;
    const from = getPinPosition(source, pendingWire.pinId, project);
    wirePreviewPath.setAttribute("d", liveWirePath(from, wireCursor));
  }

  function endpointDirection(endpoint: WireEndpoint): "input" | "output" | null {
    const component = currentCircuit().components.find((item) => item.id === endpoint.componentId);
    if (!component) return null;
    return getComponentPins(component, project).find((pin) => pin.id === endpoint.pinId)?.direction ?? null;
  }

  function releasePointer(pointerId: number): void {
    if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
  }

  function beginWireBendDrag(wireId: string, pointIndex: number): boolean {
    const wire = currentCircuit().wires.find((item) => item.id === wireId);
    const fromComponent = wire && currentCircuit().components.find((item) => item.id === wire.from.componentId);
    const toComponent = wire && currentCircuit().components.find((item) => item.id === wire.to.componentId);
    if (!wire || !fromComponent || !toComponent) return false;
    const from = getPinPosition(fromComponent, wire.from.pinId, project);
    const to = getPinPosition(toComponent, wire.to.pinId, project);
    const bends = wireRoute(wire, from, to).bends;
    if (!Number.isInteger(pointIndex) || !bends[pointIndex]) return false;
    const segmentCandidates: Array<[number, number]> = [];
    if (pointIndex + 1 < bends.length) segmentCandidates.push([pointIndex, pointIndex + 1]);
    if (pointIndex > 0) segmentCandidates.push([pointIndex - 1, pointIndex]);
    let axis: "x" | "y" = "x";
    let affectedIndices = [pointIndex];
    for (const [a, b] of segmentCandidates) {
      if (nearlyEqual(bends[a].x, bends[b].x)) {
        axis = "x";
        affectedIndices = [a, b];
        break;
      }
      if (nearlyEqual(bends[a].y, bends[b].y)) {
        axis = "y";
        affectedIndices = [a, b];
        break;
      }
    }
    if (affectedIndices.length === 1) {
      const previous = pointIndex === 0 ? from : bends[pointIndex - 1];
      axis = nearlyEqual(previous.x, bends[pointIndex].x) ? "x" : "y";
    }
    setSingleWireSelection(wireId);
    wireBendDragState = {
      wireId,
      affectedIndices,
      axis,
      baseBends: bends.map((point) => ({ ...point })),
      before: cloneProject(project),
      moved: false,
    };
    renderCanvas();
    return true;
  }

  function moveWireBend(point: WirePoint): void {
    const state = wireBendDragState;
    if (!state) return;
    const wire = currentCircuit().wires.find((item) => item.id === state.wireId);
    if (!wire) return;
    const bends = state.baseBends.map((bend) => ({ ...bend }));
    for (const index of state.affectedIndices) bends[index][state.axis] = point[state.axis];
    wire.bendPoints = bends;
    state.moved = true;
    updateWireDom(wire);
  }

  function finishWireBendDrag(): void {
    const state = wireBendDragState;
    wireBendDragState = null;
    if (!state) return;
    const wire = currentCircuit().wires.find((item) => item.id === state.wireId);
    if (wire && state.moved && wire.bendPoints) {
      for (const index of state.affectedIndices) {
        wire.bendPoints[index][state.axis] = snap(wire.bendPoints[index][state.axis]);
      }
      pushHistorySnapshot(state.before);
      persistProject();
    }
    renderCanvas();
  }

  function updateWireDom(wire: LogicWire): void {
    const group = [...svg.querySelectorAll<SVGGElement>(".logicWireGroup")]
      .find((node) => node.dataset.wireId === wire.id);
    const fromComponent = currentCircuit().components.find((item) => item.id === wire.from.componentId);
    const toComponent = currentCircuit().components.find((item) => item.id === wire.to.componentId);
    if (!group || !fromComponent || !toComponent) return;
    const from = getPinPosition(fromComponent, wire.from.pinId, project);
    const to = getPinPosition(toComponent, wire.to.pinId, project);
    const route = wireRoute(wire, from, to);
    group.querySelectorAll<SVGPathElement>(".logicWire, .logicWireHit").forEach((path) => path.setAttribute("d", route.path));
    const stroke = group.querySelector<SVGPathElement>(".logicWire");
    if (stroke) {
      const conflict = wireHasError(wire);
      stroke.classList.toggle("conflict", conflict);
      const color = conflict ? "#d74242" : normalizeWireColor(wire.color);
      if (color) stroke.style.stroke = color;
      else stroke.style.removeProperty("stroke");
    }
    group.querySelectorAll<SVGRectElement>("[data-wire-handle]").forEach((handle) => {
      const point = route.bends[Number(handle.dataset.wireHandle)];
      if (!point) return;
      handle.setAttribute("x", String(point.x - 5));
      handle.setAttribute("y", String(point.y - 5));
    });
  }

  function wireHasError(wire: LogicWire): boolean {
    const from = currentCircuit().components.find((item) => item.id === wire.from.componentId);
    const to = currentCircuit().components.find((item) => item.id === wire.to.componentId);
    const fromPin = from && getComponentPins(from, project).find((pin) => pin.id === wire.from.pinId);
    const toPin = to && getComponentPins(to, project).find((pin) => pin.id === wire.to.pinId);
    return !from || !to || from.id === to.id || fromPin?.direction !== "output" || toPin?.direction !== "input" ||
      evaluation.conflicts.has(`${wire.to.componentId}:${wire.to.pinId}`);
  }

  function updatePinHover(clientX: number, clientY: number): void {
    clearPinHover();
    if (!pendingWire) return;
    const node = document.elementFromPoint(clientX, clientY)?.closest<SVGGElement>(".logicPinGroup");
    if (!node?.dataset.componentId || !node.dataset.pin) return;
    const endpoint = { componentId: node.dataset.componentId, pinId: node.dataset.pin };
    const direction = endpointDirection(endpoint);
    const pendingDirection = endpointDirection(pendingWire);
    const valid = endpoint.componentId !== pendingWire.componentId && direction !== null && pendingDirection !== null && direction !== pendingDirection;
    node.classList.add("wireTarget", valid ? "valid" : "invalid");
    hoveredPinGroup = node;
  }

  function clearPinHover(): void {
    hoveredPinGroup?.classList.remove("wireTarget", "valid", "invalid");
    hoveredPinGroup = null;
  }

  function markPinAsInvalid(endpoint: WireEndpoint): void {
    const node = [...svg.querySelectorAll<SVGGElement>(".logicPinGroup")].find((candidate) =>
      candidate.dataset.componentId === endpoint.componentId && candidate.dataset.pin === endpoint.pinId,
    );
    if (!node) return;
    clearPinHover();
    node.classList.add("wireTarget", "invalid");
    hoveredPinGroup = node;
    window.setTimeout(() => {
      if (hoveredPinGroup === node) clearPinHover();
    }, 700);
  }

  function beginMarquee(point: WirePoint, additive: boolean): void {
    if (!additive) clearSelection();
    marqueeState = { start: point, current: point, additive };
    marqueeRect = svgElement("rect", { class: "logicMarquee", x: point.x, y: point.y, width: 0, height: 0 });
    svg.appendChild(marqueeRect);
  }

  function updateMarqueeRect(): void {
    if (!marqueeState || !marqueeRect) return;
    const bounds = normalizedRect(marqueeState.start, marqueeState.current);
    marqueeRect.setAttribute("x", String(bounds.x));
    marqueeRect.setAttribute("y", String(bounds.y));
    marqueeRect.setAttribute("width", String(bounds.width));
    marqueeRect.setAttribute("height", String(bounds.height));
  }

  function finishMarquee(): void {
    const state = marqueeState;
    marqueeState = null;
    marqueeRect = null;
    if (!state) return;
    const bounds = normalizedRect(state.start, state.current);
    if (bounds.width >= 4 || bounds.height >= 4) {
      for (const component of currentCircuit().components) {
        const size = getComponentSize(component, project);
        if (rectsIntersect(bounds, { x: component.x, y: component.y, width: size.width, height: size.height })) {
          selectedComponentIds.add(component.id);
        }
      }
      for (const wire of currentCircuit().wires) {
        const from = currentCircuit().components.find((item) => item.id === wire.from.componentId);
        const to = currentCircuit().components.find((item) => item.id === wire.to.componentId);
        if (!from || !to) continue;
        const route = wireRoute(wire, getPinPosition(from, wire.from.pinId, project), getPinPosition(to, wire.to.pinId, project));
        if (routeIntersectsRect(route.points, bounds)) selectedWireIds.add(wire.id);
      }
    }
    syncPrimarySelection();
    renderCanvas();
    renderProperties();
    updateStatus();
  }

  function moveSelectedComponents(dx: number, dy: number): void {
    if (!preDragProject) return;
    const beforeCircuit = preDragProject.circuits[currentCircuitId];
    const selected = new Set(dragState?.componentIds ?? []);
    for (const componentId of selected) {
      const before = beforeCircuit?.components.find((item) => item.id === componentId);
      const component = currentCircuit().components.find((item) => item.id === componentId);
      if (!before || !component) continue;
      component.x = before.x + dx;
      component.y = before.y + dy;
    }
    adjustDraggedWireBends(beforeCircuit, selected, dx, dy);
  }

  function snapDraggedComponents(): void {
    if (!dragState || !preDragProject) return;
    const firstId = dragState.componentIds[0];
    const before = preDragProject.circuits[currentCircuitId]?.components.find((item) => item.id === firstId);
    const current = currentCircuit().components.find((item) => item.id === firstId);
    if (!before || !current) return;
    moveSelectedComponents(snap(current.x) - before.x, snap(current.y) - before.y);
  }

  function adjustDraggedWireBends(beforeCircuit: CircuitDefinition | undefined, selected: Set<string>, dx: number, dy: number): void {
    if (!beforeCircuit) return;
    for (const wire of currentCircuit().wires) {
      const beforeWire = beforeCircuit.wires.find((item) => item.id === wire.id);
      if (!beforeWire?.bendPoints?.length) continue;
      const fromSelected = selected.has(wire.from.componentId);
      const toSelected = selected.has(wire.to.componentId);
      const bends = beforeWire.bendPoints.map((point) => ({ ...point }));
      if (fromSelected && toSelected) {
        wire.bendPoints = bends.map((point) => ({ x: point.x + dx, y: point.y + dy }));
        continue;
      }
      if (fromSelected) alignEndpointBend(bends[0], beforeWire.from, beforeCircuit, dx, dy);
      if (toSelected) alignEndpointBend(bends[bends.length - 1], beforeWire.to, beforeCircuit, dx, dy);
      wire.bendPoints = bends;
    }
  }

  function alignEndpointBend(point: WirePoint, endpoint: WireEndpoint, circuit: CircuitDefinition, dx: number, dy: number): void {
    const component = circuit.components.find((item) => item.id === endpoint.componentId);
    if (!component) return;
    const endpointPoint = getPinPosition(component, endpoint.pinId, preDragProject ?? project);
    if (nearlyEqual(point.x, endpointPoint.x)) point.x += dx;
    else if (nearlyEqual(point.y, endpointPoint.y)) point.y += dy;
    else if (Math.abs(point.x - endpointPoint.x) < Math.abs(point.y - endpointPoint.y)) point.x += dx;
    else point.y += dy;
  }

  function onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const worldBefore = screenToWorld(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    const nextWidth = clamp(viewport.width * factor, MIN_VIEWPORT_WIDTH, MAX_VIEWPORT_WIDTH);
    const nextHeight = nextWidth * (viewport.height / viewport.width);
    const rect = svg.getBoundingClientRect();
    const rx = (event.clientX - rect.left) / Math.max(1, rect.width);
    const ry = (event.clientY - rect.top) / Math.max(1, rect.height);
    viewport.width = nextWidth;
    viewport.height = nextHeight;
    viewport.x = worldBefore.x - rx * nextWidth;
    viewport.y = worldBefore.y - ry * nextHeight;
    renderCanvas();
  }

  function onCanvasContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const target = event.target as SVGElement;
    const componentNode = target.closest<SVGElement>("[data-component-id]");
    const wireNode = target.closest<SVGElement>("[data-wire-id]");
    if (componentNode?.dataset.componentId) {
      const component = currentCircuit().components.find((item) => item.id === componentNode.dataset.componentId);
      if (!component) return;
      if (!selectedComponentIds.has(component.id)) setSingleComponentSelection(component.id);
      renderCanvas();
      const items: Array<[string, () => void]> = [
        ["Властивості…", () => openPropertiesPopover(event.clientX, event.clientY)],
        ["Копіювати", copySelection],
        ["Дублювати", duplicateSelection],
        ["Видалити", deleteSelection],
      ];
      if ((component.kind === "CUSTOM" && component.subcircuitId) || EDITABLE_BUILTIN_KINDS.has(component.kind)) {
        items.unshift(["Відкрити внутрішню схему", () => openComponentSubcircuit(component)]);
      }
      openMenuAt(event.clientX, event.clientY, items);
      return;
    }
    if (wireNode?.dataset.wireId) {
      const wire = currentCircuit().wires.find((item) => item.id === wireNode.dataset.wireId);
      if (!wire) return;
      setSingleWireSelection(wire.id);
      renderCanvas();
      openMenuAt(event.clientX, event.clientY, [
        ["Колір дроту…", () => openWireColorMenu(wire, event.clientX, event.clientY)],
        ["Властивості…", () => openPropertiesPopover(event.clientX, event.clientY)],
        ["Копіювати", copySelection],
        ["Видалити", deleteSelection],
      ]);
      return;
    }
    openMenuAt(event.clientX, event.clientY, [
      ["Вставити", pasteSelection],
      ["Виділити все", selectAll],
      ["Умістити схему", fitCircuit],
    ]);
  }

  function openComponentSubcircuit(component: LogicComponent): void {
    if (component.kind === "CUSTOM" && component.subcircuitId) {
      enterCircuit(component.subcircuitId);
      return;
    }
    if (!EDITABLE_BUILTIN_KINDS.has(component.kind)) return;
    snapshot();
    const circuitId = expandBuiltinComponent(project, currentCircuitId, component.id);
    if (!circuitId) return;
    persistProject();
    renderAll();
    enterCircuit(circuitId);
  }

  function onCanvasDoubleClick(event: MouseEvent): void {
    if (event.type === "dblclick" && performance.now() - pointerDoubleClickTime < 700) return;
    const target = event.target as SVGElement;
    const componentNode = target.closest<SVGElement>("[data-component-id]");
    if (componentNode) {
      event.preventDefault();
      event.stopPropagation();
      const component = currentCircuit().components.find((item) => item.id === componentNode.dataset.componentId);
      if (component?.kind === "CUSTOM" && component.subcircuitId) {
        enterCircuit(component.subcircuitId);
      } else if (component && EDITABLE_BUILTIN_KINDS.has(component.kind)) {
        snapshot();
        const circuitId = expandBuiltinComponent(project, currentCircuitId, component.id);
        if (circuitId) {
          persistProject();
          renderAll();
          enterCircuit(circuitId);
        }
      } else if (component) {
        setSingleComponentSelection(component.id);
        renderCanvas();
        openPropertiesPopover(event.clientX, event.clientY);
      }
      return;
    }
    const wireNode = target.closest<SVGElement>("[data-wire-id]");
    if (wireNode) {
      event.preventDefault();
      event.stopPropagation();
      const wireId = String(wireNode.dataset.wireId);
      setSingleWireSelection(wireId);
      const wire = currentCircuit().wires.find((item) => item.id === wireId);
      if (wire) openWireColorMenu(wire, event.clientX, event.clientY);
      renderCanvas();
    }
  }

  function openWireColorMenu(wire: LogicWire, clientX: number, clientY: number): void {
    closeWireColorPopover();
    closePropertiesPopover();
    wireColorPopover = colorPopover;
    colorPopover.innerHTML = "";
    colorPopover.classList.remove("hidden");
    colorPopover.style.left = `${Math.min(clientX, window.innerWidth - 230)}px`;
    colorPopover.style.top = `${Math.min(clientY, window.innerHeight - 118)}px`;
    const title = div("logicWireColorTitle");
    title.textContent = "Колір дроту";
    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizeWireColor(wire.color) ?? "#1f2832";
    const palette = div("logicWirePalette");
    for (const color of ["#1f2832", "#2166c2", "#16834b", "#8b4cc2", "#d17a12", "#d74242"]) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.title = color;
      swatch.style.background = color;
      swatch.addEventListener("click", (event) => {
        event.stopPropagation();
        applyColor(color);
        input.value = color;
      });
      palette.appendChild(swatch);
    }
    const actions = div("logicWireColorActions");
    const reset = textButton("Скинути", "logicSecondaryButton");
    const done = textButton("Готово", "logicPrimaryButton");
    actions.append(reset, done);
    colorPopover.append(title, palette, input, actions);
    let colorSnapshotTaken = false;
    const applyColor = (value: string) => {
      if (!colorSnapshotTaken) {
        snapshot();
        colorSnapshotTaken = true;
      }
      wire.color = value;
      persistProject();
      updateWireDom(wire);
    };
    input.addEventListener("input", () => {
      applyColor(input.value);
    });
    reset.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!colorSnapshotTaken) snapshot();
      wire.color = undefined;
      persistProject();
      closeWireColorPopover();
      updateWireDom(wire);
    });
    done.addEventListener("click", (event) => {
      event.stopPropagation();
      closeWireColorPopover();
      renderCanvas();
    });
    window.setTimeout(() => input.focus(), 0);
  }

  function closeWireColorPopover(): void {
    colorPopover.classList.add("hidden");
    colorPopover.innerHTML = "";
    wireColorPopover = null;
  }

  function openPropertiesPopover(clientX: number, clientY: number): void {
    closeWireColorPopover();
    if (!selectedId && !selectedWireId) {
      closePropertiesPopover();
      return;
    }
    renderProperties();
    propertiesPanel.classList.remove("hidden");
    propertiesPopover.appendChild(propertiesPanel);
    propertiesPopover.style.left = `${Math.max(6, Math.min(clientX, window.innerWidth - 286))}px`;
    propertiesPopover.style.top = `${Math.max(6, Math.min(clientY, window.innerHeight - 430))}px`;
    propertiesPopover.classList.remove("hidden");
  }

  function closePropertiesPopover(): void {
    if (propertiesPopover.classList.contains("hidden")) return;
    propertiesPopover.classList.add("hidden");
    propertiesPanel.classList.add("hidden");
    sidebar.appendChild(propertiesPanel);
  }

  function handlePinClick(endpoint: WireEndpoint): void {
    const component = currentCircuit().components.find((item) => item.id === endpoint.componentId);
    if (!component) return;
    const pin = getComponentPins(component, project).find((item) => item.id === endpoint.pinId);
    if (!pin) return;
    if (tool !== "wire") setTool("wire");
    if (!pendingWire) {
      pendingWire = endpoint;
      renderCanvas();
      return;
    }
    if (pendingWire.componentId === endpoint.componentId && pendingWire.pinId === endpoint.pinId) return;
    const pendingDirection = endpointDirection(pendingWire);
    if (!pendingDirection) {
      pendingWire = null;
      renderCanvas();
      return;
    }
    if (pendingWire.componentId === endpoint.componentId) {
      flashStatus("Не можна з'єднати елемент із самим собою");
      return;
    }
    if (pendingDirection === pin.direction) {
      flashStatus(pin.direction === "input"
        ? "Помилка: не можна з'єднати два входи"
        : "Помилка: не можна з'єднати два виходи");
      markPinAsInvalid(endpoint);
      return;
    }
    const from = pendingDirection === "output" ? pendingWire : endpoint;
    const to = pendingDirection === "input" ? pendingWire : endpoint;
    const duplicate = currentCircuit().wires.some((wire) =>
      wire.from.componentId === from.componentId && wire.from.pinId === from.pinId &&
      wire.to.componentId === to.componentId && wire.to.pinId === to.pinId,
    );
    if (!duplicate) {
      snapshot();
      const fromComponent = currentCircuit().components.find((item) => item.id === from.componentId)!;
      const toComponent = currentCircuit().components.find((item) => item.id === to.componentId)!;
      const fromPoint = getPinPosition(fromComponent, from.pinId, project);
      const toPoint = getPinPosition(toComponent, to.pinId, project);
      currentCircuit().wires.push({
        id: createLocalId("wire"),
        from: { ...from },
        to: { ...to },
        bendPoints: defaultWireBends(fromPoint, toPoint),
      });
      persistProject();
      const existingDrivers = currentCircuit().wires.filter((wire) =>
        wire.to.componentId === to.componentId && wire.to.pinId === to.pinId,
      ).length;
      if (existingDrivers > 1) flashStatus("Вхід має кілька джерел; суперечливі рівні буде позначено червоним");
    }
    pendingWire = null;
    wirePreviewPath = null;
    clearPinHover();
    renderAll();
  }

  function renderAll(): void {
    evaluation = evaluateCurrent();
    renderBreadcrumb();
    renderCanvas();
    renderProperties();
    updateStatus();
  }

  function renderBreadcrumb(): void {
    breadcrumb.innerHTML = "";
    const path = circuitPath(currentCircuitId);
    breadcrumb.classList.toggle("hidden", path.length <= 1);
    path.forEach((circuit, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = circuit.name;
      button.className = index === path.length - 1 ? "active" : "";
      button.addEventListener("click", () => enterCircuit(circuit.id));
      breadcrumb.appendChild(button);
      if (index < path.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = "›";
        breadcrumb.appendChild(sep);
      }
    });
  }

  function renderCanvas(): void {
    const circuit = currentCircuit();
    svg.setAttribute("viewBox", `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);
    svg.innerHTML = "";
    const defs = svgElement("defs");
    defs.innerHTML = `
      <pattern id="logicGridSmall" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#c6ced8"/><circle cx="1" cy="1" r="1.3" fill="#727f91"/></pattern>
      <pattern id="logicGridLarge" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#logicGridSmall)"/><path d="M100 0H0V100" fill="none" stroke="#98a4b3" stroke-width="1"/></pattern>
      <filter id="logicShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/></filter>
    `;
    svg.appendChild(defs);
    const background = svgElement("rect", { x: -50000, y: -50000, width: 100000, height: 100000, fill: "url(#logicGridLarge)", class: "logicCanvasBackground" });
    svg.appendChild(background);

    const wireLayer = svgElement("g", { class: "logicWireLayer" });
    for (const wire of circuit.wires) wireLayer.appendChild(renderWire(wire));
    if (pendingWire && wireCursor) {
      const source = circuit.components.find((item) => item.id === pendingWire!.componentId);
      if (source) {
        const from = getPinPosition(source, pendingWire.pinId, project);
        const preview = svgElement("path", { d: liveWirePath(from, wireCursor), class: "logicWirePreview" });
        wirePreviewPath = preview;
        wireLayer.appendChild(preview);
      }
    } else {
      wirePreviewPath = null;
    }
    svg.appendChild(wireLayer);

    const componentLayer = svgElement("g", { class: "logicComponentLayer" });
    for (const component of circuit.components) componentLayer.appendChild(renderComponent(component));
    svg.appendChild(componentLayer);

    if (marqueeState) {
      marqueeRect = svgElement("rect", { class: "logicMarquee" });
      svg.appendChild(marqueeRect);
      updateMarqueeRect();
    } else {
      marqueeRect = null;
    }

    emptyHint.classList.toggle("hidden", circuit.components.length > 0);
  }

  function renderWire(wire: LogicWire): SVGElement {
    const fromComponent = currentCircuit().components.find((item) => item.id === wire.from.componentId);
    const toComponent = currentCircuit().components.find((item) => item.id === wire.to.componentId);
    const selected = selectedWireIds.has(wire.id);
    const group = svgElement("g", { class: `logicWireGroup${selected ? " selected" : ""}`, "data-wire-id": wire.id });
    if (!fromComponent || !toComponent) return group;
    const from = getPinPosition(fromComponent, wire.from.pinId, project);
    const to = getPinPosition(toComponent, wire.to.pinId, project);
    const route = wireRoute(wire, from, to);
    const conflict = wireHasError(wire);
    const hit = svgElement("path", { d: route.path, class: "logicWireHit", "data-wire-id": wire.id });
    const path = svgElement("path", { d: route.path, class: `logicWire${conflict ? " conflict" : ""}`, "data-wire-id": wire.id });
    const customColor = normalizeWireColor(wire.color);
    if (conflict) path.setAttribute("style", "stroke: #d74242");
    else if (customColor) path.setAttribute("style", `stroke: ${customColor}`);
    group.append(hit, path);
    if (selected) {
      route.bends.forEach((point, index) => {
        group.appendChild(svgElement("rect", {
          x: point.x - 5,
          y: point.y - 5,
          width: 10,
          height: 10,
          rx: 1,
          class: "logicWireHandle",
          "data-wire-id": wire.id,
          "data-wire-handle": index,
        }));
      });
    }
    return group;
  }

  function renderComponent(component: LogicComponent): SVGElement {
    const size = getComponentSize(component, project);
    const group = svgElement("g", {
      class: `logicComponent kind-${component.kind.toLowerCase()}${selectedComponentIds.has(component.id) ? " selected" : ""}`,
      transform: `translate(${component.x} ${component.y})`,
      "data-component-id": component.id,
    });
    const selected = selectedComponentIds.has(component.id);
    if (selected) group.appendChild(svgElement("rect", { x: -8, y: -8, width: size.width + 16, height: size.height + 16, rx: 10, class: "logicSelectionBox" }));

    if (component.kind === "SEVEN_SEG") renderSevenSegment(group, component, size);
    else if (component.kind === "HEX_DISPLAY") renderHexDisplay(group, component, size);
    else if (["AND", "OR", "NAND", "NOR", "XOR", "XNOR", "NOT", "BUFFER", "TRISTATE"].includes(component.kind)) renderGateBody(group, component, size);
    else renderBlockBody(group, component, size);

    const pins = getComponentPins(component, project);
    for (const pin of pins) {
      const absolute = getPinPosition(component, pin.id, project);
      const x = absolute.x - component.x;
      const y = absolute.y - component.y;
      const value = evaluation.pinValues.get(`${component.id}:${pin.id}`) ?? "Z";
      const pinGroup = svgElement("g", {
        class: `logicPinGroup ${pin.direction}`,
        "data-pin": pin.id,
        "data-component-id": component.id,
      });
      const circle = svgElement("circle", {
        cx: x,
        cy: y,
        r: pendingWire?.componentId === component.id && pendingWire.pinId === pin.id ? 7 : 5,
        class: `logicPin value-${value}`,
        "data-pin": pin.id,
        "data-component-id": component.id,
      });
      const label = svgElement("text", {
        x: pin.direction === "input" ? x + 12 : x - 12,
        y: y - 8,
        "text-anchor": pin.direction === "input" ? "start" : "end",
        class: "logicPinLabel",
        "data-pin": pin.id,
        "data-component-id": component.id,
      });
      label.textContent = pin.label;
      pinGroup.append(circle, label);
      group.appendChild(pinGroup);
    }
    return group;
  }

  function renderGateBody(group: SVGElement, component: LogicComponent, size: { width: number; height: number }): void {
    const bubble = component.kind === "NAND" || component.kind === "NOR" || component.kind === "XNOR" || component.kind === "NOT";
    const isTriangle = component.kind === "NOT" || component.kind === "BUFFER" || component.kind === "TRISTATE";
    const margin = 8;
    const left = margin;
    const right = size.width - margin - (bubble ? 12 : 0);
    const top = margin;
    const bottom = size.height - margin;
    const midY = size.height / 2;
    const width = right - left;
    const height = bottom - top;
    const ansiPath = (): string => {
      if (component.kind === "AND" || component.kind === "NAND") {
        const stem = left + width * 0.46;
        return `M ${left} ${top} H ${stem} A ${height / 2} ${height / 2} 0 0 1 ${stem} ${bottom} H ${left} Z`;
      }
      if (component.kind === "OR" || component.kind === "NOR" || component.kind === "XOR" || component.kind === "XNOR") {
        const lip = left + width * 0.1;
        const nose = right;
        const waist = left + width * 0.26;
        return `M ${lip} ${top} C ${left + width * 0.36} ${top} ${left + width * 0.66} ${top + height * 0.08} ${nose} ${midY} C ${left + width * 0.66} ${bottom - height * 0.08} ${left + width * 0.36} ${bottom} ${lip} ${bottom} C ${waist} ${bottom - height * 0.28} ${waist} ${top + height * 0.28} ${lip} ${top} Z`;
      }
      return `M ${left} ${top} L ${right} ${midY} L ${left} ${bottom} Z`;
    };

    if (component.kind === "XOR" || component.kind === "XNOR") {
      const arcLeft = left - 8;
      const arcMid = left + width * 0.08;
      group.appendChild(svgElement("path", {
        d: `M ${arcLeft} ${top} C ${arcMid} ${top + height * 0.28} ${arcMid} ${bottom - height * 0.28} ${arcLeft} ${bottom}`,
        class: "logicGateAccent",
      }));
    }

    for (const pin of getComponentPins(component, project)) {
      const point = getPinPosition(component, pin.id, project);
      const x = point.x - component.x;
      const y = point.y - component.y;
      if (pin.direction === "input") {
        group.appendChild(svgElement("line", { x1: x, y1: y, x2: left + 10, y2: y, class: "logicPinLeg" }));
      } else {
        group.appendChild(svgElement("line", { x1: right + (bubble ? 12 : 0), y1: y, x2: x, y2: y, class: "logicPinLeg" }));
      }
    }

    if (isTriangle) {
      const body = svgElement("path", { d: ansiPath(), class: "logicGateBody", filter: "url(#logicShadow)" });
      group.appendChild(body);
      if (bubble) group.appendChild(svgElement("circle", { cx: right + 6, cy: midY, r: 6, class: "logicInversionBubble" }));
    } else {
      const body = svgElement("path", { d: ansiPath(), class: "logicGateBody", filter: "url(#logicShadow)" });
      group.appendChild(body);
      if (bubble) group.appendChild(svgElement("circle", { cx: right + 6, cy: midY, r: 6, class: "logicInversionBubble" }));
    }
    if (component.kind === "TRISTATE") {
      const enable = svgElement("text", { x: left + 12, y: bottom - 8, "text-anchor": "start", class: "logicGateSymbol subtle" });
      enable.textContent = "EN";
      group.appendChild(enable);
    }
    const label = svgElement("text", { x: size.width / 2, y: -6, "text-anchor": "middle", class: "logicComponentLabel" });
    label.textContent = component.label;
    group.appendChild(label);
  }

  function renderBlockBody(group: SVGElement, component: LogicComponent, size: { width: number; height: number }): void {
    const value = displayComponentValue(component);
    const text = (content: string, x: number, y: number, className = "logicBlockSymbol", anchor = "middle") => {
      const node = svgElement("text", { x, y, "text-anchor": anchor, class: className });
      node.textContent = content;
      group.appendChild(node);
      return node;
    };
    const block = (radius = 7) => group.appendChild(svgElement("rect", {
      x: 7, y: 7, width: size.width - 14, height: size.height - 14, rx: radius,
      class: "logicBlockBody", filter: "url(#logicShadow)",
    }));

    if (component.kind === "MUX4") {
      const right = size.width - 14;
      group.appendChild(svgElement("path", {
        d: `M 18 8 L ${right} 24 L ${right} ${size.height - 24} L 18 ${size.height - 8} Z`,
        class: "logicBlockBody", filter: "url(#logicShadow)",
      }));
      text("MUX", size.width * 0.58, size.height / 2 - 3);
      text("4 : 1", size.width * 0.58, size.height / 2 + 15, "logicBlockCaption");
      group.appendChild(svgElement("path", { d: `M32 ${size.height - 47} H48 V${size.height - 31} H64`, class: "logicBlockDetail" }));
    } else if (component.kind === "DECODER2TO4") {
      block(3);
      text("2 → 4", size.width / 2, 31, "logicBlockSymbol");
      const top = 49;
      for (let index = 0; index < 4; index += 1) {
        const y = top + index * Math.max(12, (size.height - top - 18) / 3);
        group.appendChild(svgElement("line", { x1: 35, y1: y, x2: size.width - 25, y2: y, class: "logicBlockDetail" }));
        group.appendChild(svgElement("circle", { cx: size.width - 25, cy: y, r: 2.6, class: "logicBlockNode" }));
      }
    } else if (component.kind === "FULL_ADDER") {
      const radius = Math.min(size.width, size.height) / 2 - 11;
      group.appendChild(svgElement("circle", { cx: size.width / 2, cy: size.height / 2, r: radius, class: "logicBlockBody", filter: "url(#logicShadow)" }));
      text("Σ", size.width / 2, size.height / 2 + 9, "logicAdderSymbol");
      text("A+B+Ci", size.width / 2, size.height / 2 + 25, "logicBlockCaption");
    } else if (component.kind === "DFF") {
      block(2);
      text("D", 28, 34, "logicBlockSymbol");
      text("Q", size.width - 27, 34, "logicBlockSymbol");
      text("Q̅", size.width - 27, size.height - 18, "logicBlockCaption");
      group.appendChild(svgElement("path", { d: `M8 ${size.height / 2 - 8} L20 ${size.height / 2} L8 ${size.height / 2 + 8}`, class: "logicBlockDetail" }));
      group.appendChild(svgElement("line", { x1: size.width / 2, y1: 16, x2: size.width / 2, y2: size.height - 16, class: "logicBlockFine" }));
    } else if (component.kind === "COUNTER4") {
      block(3);
      text("CTR", size.width / 2, 31, "logicBlockSymbol");
      group.appendChild(svgElement("path", { d: `M10 ${size.height - 38} L22 ${size.height - 30} L10 ${size.height - 22}`, class: "logicBlockDetail" }));
      const cellWidth = 16;
      const startX = size.width / 2 - cellWidth * 2;
      for (let bit = 0; bit < 4; bit += 1) {
        group.appendChild(svgElement("rect", { x: startX + bit * cellWidth, y: size.height / 2, width: 13, height: 19, rx: 2, class: "logicCounterCell" }));
        text(String(bit), startX + bit * cellWidth + 6.5, size.height / 2 + 14, "logicBlockTiny");
      }
    } else if (component.kind === "CLOCK") {
      block(4);
      group.appendChild(svgElement("path", {
        d: `M18 ${size.height * 0.68} H34 V${size.height * 0.32} H54 V${size.height * 0.68} H75 V${size.height * 0.32} H${size.width - 17}`,
        class: "logicClockWave",
      }));
    } else if (component.kind === "CUSTOM") {
      block(3);
      group.appendChild(svgElement("path", { d: `M${size.width / 2 - 13} 7 A13 13 0 0 0 ${size.width / 2 + 13} 7`, class: "logicChipNotch" }));
      for (let y = 24; y < size.height - 12; y += 18) {
        group.appendChild(svgElement("line", { x1: 7, y1: y, x2: 16, y2: y, class: "logicBlockFine" }));
        group.appendChild(svgElement("line", { x1: size.width - 16, y1: y, x2: size.width - 7, y2: y, class: "logicBlockFine" }));
      }
      text("IC", size.width / 2, size.height / 2 + 7, "logicBlockSymbol");
    } else if (component.kind === "ADUC_IN" || component.kind === "ADUC_OUT") {
      block(3);
      for (let y = 19; y < size.height - 10; y += 16) {
        group.appendChild(svgElement("line", { x1: 1, y1: y, x2: 12, y2: y, class: "logicBlockFine" }));
        group.appendChild(svgElement("line", { x1: size.width - 12, y1: y, x2: size.width - 1, y2: y, class: "logicBlockFine" }));
      }
      text("ADuC841", size.width / 2, size.height / 2, "logicBlockCaption");
      text(component.kind === "ADUC_IN" ? "IN" : "OUT", size.width / 2, size.height / 2 + 18, "logicBlockSymbol");
    } else if (component.kind === "PORT_IN" || component.kind === "PORT_OUT") {
      const points = component.kind === "PORT_IN"
        ? `7,12 ${size.width - 25},12 ${size.width - 7},${size.height / 2} ${size.width - 25},${size.height - 12} 7,${size.height - 12}`
        : `${size.width - 7},12 25,12 7,${size.height / 2} 25,${size.height - 12} ${size.width - 7},${size.height - 12}`;
      group.appendChild(svgElement("polygon", { points, class: "logicBlockBody", filter: "url(#logicShadow)" }));
      text(component.kind === "PORT_IN" ? "IN" : "OUT", size.width / 2, size.height / 2 + 7, "logicBlockSymbol");
    } else {
      block();
    }

    if (component.kind === "DIP4") {
      const bits = Number(component.state.value ?? 0) & 0x0f;
      for (let bit = 0; bit < 4; bit += 1) {
        const x = 14 + bit * 27;
        const active = ((bits >>> bit) & 1) === 1;
        const bitGroup = svgElement("g", { "data-dip-bit": bit, "data-component-id": component.id, class: "logicDipBit" });
        bitGroup.appendChild(svgElement("rect", { x, y: 24, width: 20, height: 48, rx: 4, class: "logicDipWell", "data-dip-bit": bit, "data-component-id": component.id }));
        bitGroup.appendChild(svgElement("rect", { x: x + 3, y: active ? 28 : 50, width: 14, height: 18, rx: 3, class: `logicDipToggle${active ? " active" : ""}`, "data-dip-bit": bit, "data-component-id": component.id }));
        const label = svgElement("text", { x: x + 10, y: 91, "text-anchor": "middle", class: "logicDipLabel", "data-dip-bit": bit, "data-component-id": component.id });
        label.textContent = String(bit);
        bitGroup.appendChild(label);
        group.appendChild(bitGroup);
      }
    } else if (component.kind === "LED") {
      const led = svgElement("circle", { cx: size.width / 2, cy: size.height / 2, r: 14, class: `logicLed value-${value}` });
      group.appendChild(led);
      group.appendChild(svgElement("path", { d: `M${size.width / 2 + 10} ${size.height / 2 - 12} l10 -10 m-6 1 l6 -1 l-1 6 M${size.width / 2 + 14} ${size.height / 2 - 5} l10 -10 m-6 1 l6 -1 l-1 6`, class: "logicLedRays" }));
    } else if (component.kind === "SWITCH" || component.kind === "BUTTON") {
      const active = component.state.value === 1;
      group.appendChild(svgElement("rect", { x: 22, y: 18, width: size.width - 44, height: 18, rx: 9, class: `logicSwitchTrack${active ? " active" : ""}`, "data-logic-toggle": "1", "data-component-id": component.id }));
      group.appendChild(svgElement("circle", { cx: active ? size.width - 31 : 31, cy: 27, r: 11, class: "logicSwitchKnob", "data-logic-toggle": "1", "data-component-id": component.id }));
    } else if (component.kind === "PROBE") {
      const text = svgElement("text", { x: size.width / 2, y: size.height / 2 + 9, "text-anchor": "middle", class: `logicProbeValue value-${value}` });
      text.textContent = logicValueLabel(value);
      group.appendChild(text);
    } else if (!["MUX4", "DECODER2TO4", "FULL_ADDER", "DFF", "COUNTER4", "CLOCK", "CUSTOM", "ADUC_IN", "ADUC_OUT", "PORT_IN", "PORT_OUT"].includes(component.kind)) {
      const icon = svgElement("text", { x: size.width / 2, y: size.height / 2 + 8, "text-anchor": "middle", class: "logicBlockSymbol" });
      icon.textContent = symbolForKind(component.kind);
      group.appendChild(icon);
    }
    const label = svgElement("text", { x: size.width / 2, y: -6, "text-anchor": "middle", class: "logicComponentLabel" });
    label.textContent = component.label;
    group.appendChild(label);
    if (component.kind === "ADUC_IN" || component.kind === "ADUC_OUT") {
      const pin = svgElement("text", { x: size.width / 2, y: size.height - 12, "text-anchor": "middle", class: "logicPinName" });
      pin.textContent = String(component.props.pin ?? "P1.0");
      group.appendChild(pin);
    }
  }

  function renderSevenSegment(group: SVGElement, component: LogicComponent, size: { width: number; height: number }): void {
    group.appendChild(svgElement("rect", { x: 4, y: 4, width: size.width - 8, height: size.height - 8, rx: 10, class: "logicSevenBody", filter: "url(#logicShadow)" }));
    const active = (pin: string) => (evaluation.pinValues.get(`${component.id}:${pin}`) ?? "Z") === 1;
    const segments: Record<string, string> = {
      a: "M35 24 H83 L75 32 H43 Z",
      b: "M88 29 L96 37 V73 L88 80 L80 72 V39 Z",
      c: "M88 88 L96 95 V131 L88 139 L80 130 V97 Z",
      d: "M35 144 H83 L75 152 H43 Z",
      e: "M22 88 L30 97 V130 L22 139 L14 131 V95 Z",
      f: "M22 29 L30 39 V72 L22 80 L14 73 V37 Z",
      g: "M35 82 H83 L75 90 H43 Z",
    };
    for (const [name, d] of Object.entries(segments)) group.appendChild(svgElement("path", { d, class: `logicSegment${active(name) ? " active" : ""}` }));
    const label = svgElement("text", { x: size.width / 2, y: -6, "text-anchor": "middle", class: "logicComponentLabel" });
    label.textContent = component.label;
    group.appendChild(label);
  }

  function renderHexDisplay(group: SVGElement, component: LogicComponent, size: { width: number; height: number }): void {
    group.appendChild(svgElement("rect", { x: 4, y: 4, width: size.width - 8, height: size.height - 8, rx: 10, class: "logicHexBody", filter: "url(#logicShadow)" }));
    const bits = [0, 1, 2, 3].map((index) => evaluation.pinValues.get(`${component.id}:b${index}`) ?? "Z");
    const valid = bits.every((value) => value === 0 || value === 1);
    const value = valid ? bits.reduce<number>((sum, bit, index) => sum | (Number(bit) << index), 0) : null;
    const text = svgElement("text", { x: size.width / 2, y: size.height / 2 + 18, "text-anchor": "middle", class: `logicHexValue${valid ? "" : " invalid"}` });
    text.textContent = value == null ? "?" : value.toString(16).toUpperCase();
    group.appendChild(text);
    const label = svgElement("text", { x: size.width / 2, y: -6, "text-anchor": "middle", class: "logicComponentLabel" });
    label.textContent = component.label;
    group.appendChild(label);
  }

  function renderProperties(): void {
    propertiesPanel.innerHTML = "";
    const component = selectedId ? currentCircuit().components.find((item) => item.id === selectedId) : null;
    const wire = selectedWireId ? currentCircuit().wires.find((item) => item.id === selectedWireId) : null;
    if (!component && !wire) {
      closePropertiesPopover();
      return;
    }
    if (wire) {
      propertiesPanel.append(propertyColor("Колір", normalizeWireColor(wire.color) ?? "#1f2832", (value) => {
        snapshot();
        wire.color = value;
        persistProject();
        renderAll();
      }));
      propertiesPanel.append(propertyTitle("Дріт"));
      propertiesPanel.append(propertyReadOnly("Джерело", `${wire.from.componentId}.${wire.from.pinId}`));
      propertiesPanel.append(propertyReadOnly("Приймач", `${wire.to.componentId}.${wire.to.pinId}`));
      const remove = textButton("Видалити дріт", "logicDangerButton");
      remove.addEventListener("click", deleteSelection);
      propertiesPanel.appendChild(remove);
      return;
    }
    if (!component) return;
    propertiesPanel.append(propertyTitle(component.label));
    propertiesPanel.append(propertyReadOnly("Тип", component.kind));
    propertiesPanel.append(propertyInput("Назва", component.label, (value) => {
      snapshot();
      component.label = value || component.kind;
      persistProject();
      renderAll();
    }));
    if (["AND", "OR", "NAND", "NOR", "XOR", "XNOR"].includes(component.kind)) {
      propertiesPanel.append(propertyNumber("Кількість входів", Number(component.props.inputCount ?? 2), 2, 8, (value) => {
        snapshot();
        component.props.inputCount = value;
        removeInvalidWires(component);
        persistProject();
        renderAll();
      }));
    }
    if (component.kind === "CLOCK") {
      propertiesPanel.append(propertyNumber("Частота, Гц", Number(component.props.frequencyHz ?? 1), 0.1, 100, (value) => {
        component.props.frequencyHz = value;
        persistProject();
      }, 0.1));
    }
    if (component.kind === "DIP4") {
      propertiesPanel.append(propertyNumber("Значення 0…15", Number(component.state.value ?? 0), 0, 15, (value) => {
        snapshot();
        component.state.value = Math.round(value) & 0x0f;
        persistProject();
        renderAll();
      }));
      const note = div("logicPropertyNote");
      note.textContent = "Біти Q0…Q3 можна перемикати безпосередньо натисканням на тумблери на схемі.";
      propertiesPanel.appendChild(note);
    }
    if (component.kind === "ADUC_IN" || component.kind === "ADUC_OUT") {
      propertiesPanel.append(propertySelect("Контакт", String(component.props.pin ?? "P1.0"), PIN_OPTIONS, (value) => {
        snapshot();
        component.props.pin = value;
        persistProject();
        renderAll();
      }));
      const note = div("logicPropertyNote");
      note.textContent = component.kind === "ADUC_IN"
        ? "Зовнішня логіка може тягнути контакт у 0 або подавати 1. Для GPIO вхідного режиму програма має відпустити лінію одиницею."
        : "Блок читає фактичний рівень контакту ADuC841/ST841.";
      propertiesPanel.appendChild(note);
    }
    if (EDITABLE_BUILTIN_KINDS.has(component.kind)) {
      const expand = textButton("Розкрити внутрішню схему", "logicPrimaryButton");
      expand.addEventListener("click", () => {
        snapshot();
        const circuitId = expandBuiltinComponent(project, currentCircuitId, component.id);
        if (!circuitId) return;
        persistProject();
        renderAll();
        enterCircuit(circuitId);
      });
      propertiesPanel.appendChild(expand);
      const note = div("logicPropertyNote");
      note.textContent = "Блок буде перетворено на редаговану вкладену мікросхему без розриву зовнішніх з’єднань.";
      propertiesPanel.appendChild(note);
    }
    if (component.kind === "CUSTOM" && component.subcircuitId) {
      const enter = textButton("Відкрити мікросхему", "logicPrimaryButton");
      enter.addEventListener("click", () => enterCircuit(component.subcircuitId!));
      propertiesPanel.appendChild(enter);
    }
    if (component.kind === "PORT_IN" || component.kind === "PORT_OUT") {
      const note = div("logicPropertyNote");
      note.textContent = "Це зовнішній контакт поточної мікросхеми. Його назва відображається на блоці у батьківській схемі.";
      propertiesPanel.appendChild(note);
    }
    propertiesPanel.append(propertyReadOnly("X / Y", `${Math.round(component.x)} / ${Math.round(component.y)}`));
    const actions = div("logicPropertyActions");
    const duplicate = textButton("Дублювати", "logicSecondaryButton");
    const remove = textButton("Видалити", "logicDangerButton");
    duplicate.addEventListener("click", duplicateSelection);
    remove.addEventListener("click", deleteSelection);
    actions.append(duplicate, remove);
    propertiesPanel.appendChild(actions);
  }

  function evaluateCurrent(): EvaluationResult {
    if (currentCircuitId === project.rootCircuitId) adapter.releaseAll();
    return stepLogicProject(project, currentCircuitId, currentCircuitId === project.rootCircuitId ? adapter : undefined);
  }

  function displayComponentValue(component: LogicComponent): LogicValue {
    if (component.kind === "LED" || component.kind === "PROBE" || component.kind === "PORT_OUT" || component.kind === "ADUC_IN") {
      return evaluation.pinValues.get(`${component.id}:in`) ?? "Z";
    }
    if (component.kind === "SWITCH" || component.kind === "BUTTON" || component.kind === "CLOCK") {
      return component.state.value === 1 ? 1 : 0;
    }
    return "Z";
  }

  function tick(now: number): void {
    if (running) {
      let clocksChanged = false;
      for (const circuit of Object.values(project.circuits)) {
        for (const component of circuit.components.filter((item) => item.kind === "CLOCK")) {
          const frequency = clamp(Number(component.props.frequencyHz ?? 1), 0.1, 100);
          const halfPeriod = 500 / frequency;
          const last = Number(component.state.lastToggleMs ?? lastClockTime);
          if (now - last >= halfPeriod) {
            component.state.value = component.state.value === 1 ? 0 : 1;
            component.state.lastToggleMs = now;
            clocksChanged = true;
          }
        }
      }
      if (open && (clocksChanged || now - lastClockTime > 100)) {
        evaluation = evaluateCurrent();
        const interactionActive = pendingWire || wireBendDragState || dragState || marqueeState || panState;
        if (!interactionActive) renderCanvas();
        if (!wireBendDragState && !dragState) updateStatus();
        lastClockTime = now;
      } else if (!open) {
        // Keep autonomous clocks, sequential blocks and optional ADuC
        // connections alive while the editor window is hidden.
        adapter.releaseAll();
        stepLogicProject(project, project.rootCircuitId, adapter);
      }
    }
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  function showTruthTable(): void {
    const circuit = currentCircuit();
    const inputs = circuit.components.filter((item) => item.kind === "SWITCH");
    const outputs = circuit.components.filter((item) => item.kind === "LED" || item.kind === "PROBE" || item.kind === "PORT_OUT");
    if (!inputs.length || !outputs.length) {
      showInfoDialog("Таблиця істинності", "Додайте хоча б один «Логічний перемикач» і один LED або логічний пробник.");
      return;
    }
    if (inputs.length > 10) {
      showInfoDialog("Таблиця істинності", "Автоматична таблиця обмежена 10 входами (1024 комбінації).");
      return;
    }
    const saved = inputs.map((item) => item.state.value);
    const rows: string[][] = [];
    const combinations = 1 << inputs.length;
    for (let combination = 0; combination < combinations; combination += 1) {
      inputs.forEach((input, index) => { input.state.value = (combination >>> (inputs.length - index - 1)) & 1; });
      const result = evaluateCircuit(project, currentCircuitId);
      const inputCells = inputs.map((input) => String(input.state.value));
      const outputCells = outputs.map((output) => String(result.pinValues.get(`${output.id}:in`) ?? "Z"));
      rows.push([...inputCells, ...outputCells]);
    }
    inputs.forEach((input, index) => { input.state.value = saved[index]; });
    evaluation = evaluateCurrent();
    const header = [...inputs.map((item) => item.label), ...outputs.map((item) => item.label)];
    showTableDialog("Таблиця істинності", header, rows);
    renderCanvas();
  }

  function showVectorVerifier(): void {
    const circuit = currentCircuit();
    const inputs = circuit.components.filter((item) => item.kind === "SWITCH");
    const outputs = circuit.components.filter((item) => item.kind === "LED" || item.kind === "PROBE" || item.kind === "PORT_OUT");
    if (!inputs.length || !outputs.length) {
      showInfoDialog("Перевірка схеми", "Додайте логічні перемикачі як входи та LED, пробники або OUT-порти як виходи.");
      return;
    }
    const form = div("logicPromptForm");
    const hint = div("logicPropertyNote");
    hint.textContent = `Порядок входів: ${inputs.map((item) => item.label).join(", ")}. Виходи: ${outputs.map((item) => item.label).join(", ")}. Один рядок: ${"0".repeat(inputs.length)} -> ${"-".repeat(outputs.length)}. Символ - означає «довільне значення».`;
    const vectors = textareaControl("Тестові вектори", "");
    vectors.input.placeholder = `${"0".repeat(inputs.length)} -> ${"0".repeat(outputs.length)}\n${"1".repeat(inputs.length)} -> ${"1".repeat(outputs.length)}`;
    form.append(hint, vectors.wrap);
    showCustomDialog("Перевірити за тестовими векторами", form, "Перевірити", () => {
      const parsed: Array<{ input: string; expected: string; line: number }> = [];
      const diagnostics: string[] = [];
      vectors.input.value.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.replace(/#.*/, "").trim();
        if (!line) return;
        const match = /^([01]+)\s*(?:->|=>|:)\s*([01xXzZ*?-]+)$/.exec(line);
        if (!match) {
          diagnostics.push(`Рядок ${index + 1}: очікується формат 010 -> 1-`);
          return;
        }
        if (match[1].length !== inputs.length) diagnostics.push(`Рядок ${index + 1}: потрібно ${inputs.length} вхідних бітів`);
        if (match[2].length !== outputs.length) diagnostics.push(`Рядок ${index + 1}: потрібно ${outputs.length} вихідних символів`);
        if (match[1].length === inputs.length && match[2].length === outputs.length) parsed.push({ input: match[1], expected: match[2].toUpperCase(), line: index + 1 });
      });
      if (!parsed.length || diagnostics.length) {
        showInfoDialog("Помилка тестових векторів", diagnostics.length ? diagnostics.join("\n") : "Не введено жодного тестового вектора.");
        return;
      }
      const saved = inputs.map((item) => item.state.value);
      const rows: string[][] = [];
      let passed = 0;
      for (const vector of parsed) {
        inputs.forEach((input, index) => { input.state.value = Number(vector.input[index]); });
        const result = evaluateCircuit(project, currentCircuitId);
        const actual = outputs.map((output) => String(result.pinValues.get(`${output.id}:in`) ?? "Z")).join("");
        const ok = [...vector.expected].every((expected, index) => expected === "-" || expected === "*" || expected === "?" || expected === actual[index]);
        if (ok) passed += 1;
        rows.push([String(vector.line), vector.input, vector.expected, actual, ok ? "PASS" : "FAIL"]);
      }
      inputs.forEach((input, index) => { input.state.value = saved[index]; });
      evaluation = evaluateCurrent();
      closeDialog();
      showTableDialog(`Перевірка: ${passed}/${parsed.length} пройдено`, ["Рядок", "Входи", "Очікується", "Отримано", "Результат"], rows);
      renderCanvas();
    }, true, true);
  }

  function createChipDialog(): void {
    const form = div("logicPromptForm");
    const name = inputControl("Назва", "Моя мікросхема");
    const inputs = inputControl("Кількість входів", "2", "number");
    const outputs = inputControl("Кількість виходів", "1", "number");
    form.append(name.wrap, inputs.wrap, outputs.wrap);
    showCustomDialog("Створити вкладену мікросхему", form, "Створити", () => {
      const inputCount = Math.round(clamp(Number(inputs.input.value), 1, 16));
      const outputCount = Math.round(clamp(Number(outputs.input.value), 1, 16));
      const chipName = name.input.value.trim() || "Моя мікросхема";
      snapshot();
      const component = createCustomChip(project, currentCircuitId, chipName, inputCount, outputCount, 260, 180);
      setSingleComponentSelection(component.id);
      persistProject();
      closeDialog();
      buildLibraryPanel();
      renderAll();
      enterCircuit(component.subcircuitId!);
    });
  }

  function enterCircuit(circuitId: string): void {
    if (!project.circuits[circuitId]) return;
    currentCircuitId = circuitId;
    clearSelection();
    viewport = { x: 0, y: 0, width: 1400, height: 900 };
    renderAll();
  }

  function circuitPath(circuitId: string): CircuitDefinition[] {
    if (circuitId === project.rootCircuitId) return [project.circuits[project.rootCircuitId]];
    const parentPath = findCircuitPath(project.rootCircuitId, circuitId, new Set());
    return parentPath ?? [project.circuits[project.rootCircuitId], project.circuits[circuitId]].filter(Boolean);
  }

  function findCircuitPath(fromId: string, targetId: string, visited: Set<string>): CircuitDefinition[] | null {
    if (visited.has(fromId)) return null;
    visited.add(fromId);
    const circuit = project.circuits[fromId];
    if (!circuit) return null;
    if (fromId === targetId) return [circuit];
    for (const component of circuit.components.filter((item) => item.kind === "CUSTOM" && item.subcircuitId)) {
      const nested = findCircuitPath(component.subcircuitId!, targetId, visited);
      if (nested) return [circuit, ...nested];
    }
    return null;
  }

  function newProject(): void {
    showConfirmDialog("Нова схема", "Очистити поточну схему та створити нову?", () => {
      snapshot();
      adapter.releaseAll();
      project = createEmptyLogicProject();
      currentCircuitId = project.rootCircuitId;
      clearSelection();
      history = [];
      future = [];
      persistProject();
      closeDialog();
      renderAll();
      fitCircuit();
    });
  }

  function exportProject(): void {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFileName(project.name)}.logic.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
    flashStatus("JSON схеми завантажено");
  }

  function fitCircuit(): void {
    const components = currentCircuit().components;
    if (!components.length) {
      viewport = { x: 0, y: 0, width: 1400, height: 900 };
    } else {
      const minX = Math.min(...components.map((item) => item.x)) - 160;
      const minY = Math.min(...components.map((item) => item.y)) - 120;
      const maxX = Math.max(...components.map((item) => item.x + getComponentSize(item, project).width)) + 160;
      const maxY = Math.max(...components.map((item) => item.y + getComponentSize(item, project).height)) + 120;
      const width = Math.max(600, maxX - minX);
      const height = Math.max(380, maxY - minY);
      const aspect = Math.max(1, svg.clientWidth) / Math.max(1, svg.clientHeight);
      const targetWidth = Math.max(width, height * aspect);
      const targetHeight = targetWidth / aspect;
      viewport = { x: minX - (targetWidth - width) / 2, y: minY - (targetHeight - height) / 2, width: targetWidth, height: targetHeight };
    }
    renderCanvas();
  }

  function deleteSelection(): void {
    if (!selectedComponentIds.size && !selectedWireIds.size) return;
    snapshot();
    const componentIds = new Set(selectedComponentIds);
    const wireIds = new Set(selectedWireIds);
    currentCircuit().components = currentCircuit().components.filter((item) => !componentIds.has(item.id));
    currentCircuit().wires = currentCircuit().wires.filter((wire) =>
      !wireIds.has(wire.id) && !componentIds.has(wire.from.componentId) && !componentIds.has(wire.to.componentId),
    );
    clearSelection();
    persistProject();
    renderAll();
  }

  function duplicateSelection(): void {
    if (!selectedComponentIds.size && !selectedWireIds.size) return;
    const previousClipboard = clipboard;
    const previousOffset = pasteOffset;
    copySelection(false);
    pasteSelection();
    clipboard = previousClipboard;
    pasteOffset = previousOffset;
  }

  function copySelection(showMessage = true): void {
    const componentIds = new Set(selectedComponentIds);
    const wireIds = new Set(selectedWireIds);
    for (const wire of currentCircuit().wires) {
      if (componentIds.has(wire.from.componentId) && componentIds.has(wire.to.componentId)) wireIds.add(wire.id);
    }
    const components = currentCircuit().components
      .filter((component) => componentIds.has(component.id))
      .map((component) => JSON.parse(JSON.stringify(component)) as LogicComponent);
    const wires = currentCircuit().wires
      .filter((wire) => wireIds.has(wire.id))
      .map((wire) => JSON.parse(JSON.stringify(wire)) as LogicWire);
    if (!components.length && !wires.length) {
      if (showMessage) flashStatus("Нічого копіювати");
      return;
    }
    clipboard = { components, wires };
    pasteOffset = 0;
    if (showMessage) flashStatus(`Скопійовано: ${components.length} елементів, ${wires.length} дротів`);
  }

  function cutSelection(): void {
    if (!selectedComponentIds.size && !selectedWireIds.size) return;
    copySelection(false);
    deleteSelection();
    flashStatus("Вибране вирізано");
  }

  function pasteSelection(): void {
    if (!clipboard || (!clipboard.components.length && !clipboard.wires.length)) {
      flashStatus("Буфер редактора порожній");
      return;
    }
    snapshot();
    pasteOffset += GRID_SIZE * 2;
    const circuit = currentCircuit();
    const idMap = new Map<string, string>();
    const insertedComponents: LogicComponent[] = [];
    for (const source of clipboard.components) {
      const copy = JSON.parse(JSON.stringify(source)) as LogicComponent;
      copy.id = createLocalId(source.kind.toLowerCase());
      copy.x += pasteOffset;
      copy.y += pasteOffset;
      idMap.set(source.id, copy.id);
      insertedComponents.push(copy);
      circuit.components.push(copy);
    }
    const validComponentIds = new Set(circuit.components.map((component) => component.id));
    const insertedWires: LogicWire[] = [];
    for (const source of clipboard.wires) {
      const fromId = idMap.get(source.from.componentId) ?? source.from.componentId;
      const toId = idMap.get(source.to.componentId) ?? source.to.componentId;
      if (!validComponentIds.has(fromId) || !validComponentIds.has(toId)) continue;
      const copy = JSON.parse(JSON.stringify(source)) as LogicWire;
      copy.id = createLocalId("wire");
      copy.from.componentId = fromId;
      copy.to.componentId = toId;
      if (copy.bendPoints && idMap.has(source.from.componentId) && idMap.has(source.to.componentId)) {
        copy.bendPoints = copy.bendPoints.map((point) => ({ x: point.x + pasteOffset, y: point.y + pasteOffset }));
      }
      insertedWires.push(copy);
      circuit.wires.push(copy);
    }
    selectedComponentIds = new Set(insertedComponents.map((component) => component.id));
    selectedWireIds = new Set(insertedWires.map((wire) => wire.id));
    syncPrimarySelection();
    persistProject();
    renderAll();
  }

  function selectAll(): void {
    selectedComponentIds = new Set(currentCircuit().components.map((component) => component.id));
    selectedWireIds = new Set(currentCircuit().wires.map((wire) => wire.id));
    syncPrimarySelection();
    renderCanvas();
    renderProperties();
    updateStatus();
  }

  function removeComponent(componentId: string): void {
    const circuit = currentCircuit();
    circuit.components = circuit.components.filter((item) => item.id !== componentId);
    circuit.wires = circuit.wires.filter((wire) => wire.from.componentId !== componentId && wire.to.componentId !== componentId);
  }

  function removeInvalidWires(component: LogicComponent): void {
    const valid = new Set(getComponentPins(component, project).map((pin) => pin.id));
    currentCircuit().wires = currentCircuit().wires.filter((wire) =>
      (wire.from.componentId !== component.id || valid.has(wire.from.pinId)) &&
      (wire.to.componentId !== component.id || valid.has(wire.to.pinId)),
    );
  }

  function clearSelection(): void {
    selectedId = null;
    selectedWireId = null;
    selectedComponentIds.clear();
    selectedWireIds.clear();
    pendingWire = null;
    clearPinHover();
  }

  function setSingleComponentSelection(componentId: string): void {
    selectedComponentIds = new Set([componentId]);
    selectedWireIds.clear();
    selectedId = componentId;
    selectedWireId = null;
  }

  function setSingleWireSelection(wireId: string): void {
    selectedWireIds = new Set([wireId]);
    selectedComponentIds.clear();
    selectedWireId = wireId;
    selectedId = null;
  }

  function selectComponent(componentId: string, additive: boolean): void {
    if (!additive) {
      if (!selectedComponentIds.has(componentId)) setSingleComponentSelection(componentId);
      else selectedId = componentId;
      return;
    }
    if (selectedComponentIds.has(componentId)) selectedComponentIds.delete(componentId);
    else selectedComponentIds.add(componentId);
    selectedId = selectedComponentIds.has(componentId) ? componentId : [...selectedComponentIds].at(-1) ?? null;
  }

  function selectWire(wireId: string, additive: boolean): void {
    if (!additive) {
      if (!selectedWireIds.has(wireId)) setSingleWireSelection(wireId);
      else selectedWireId = wireId;
      return;
    }
    if (selectedWireIds.has(wireId)) selectedWireIds.delete(wireId);
    else selectedWireIds.add(wireId);
    selectedWireId = selectedWireIds.has(wireId) ? wireId : [...selectedWireIds].at(-1) ?? null;
  }

  function syncPrimarySelection(): void {
    selectedId = [...selectedComponentIds].at(-1) ?? null;
    selectedWireId = [...selectedWireIds].at(-1) ?? null;
  }

  function snapshot(): void {
    pushHistorySnapshot(cloneProject(project));
  }

  function pushHistorySnapshot(before: LogicProject): void {
    history.push(before);
    if (history.length > 50) history.shift();
    future = [];
  }


  function undo(): void {
    const previous = history.pop();
    if (!previous) return;
    future.push(cloneProject(project));
    project = previous;
    currentCircuitId = project.circuits[currentCircuitId] ? currentCircuitId : project.rootCircuitId;
    clearSelection();
    persistProject();
    renderAll();
  }

  function redo(): void {
    const next = future.pop();
    if (!next) return;
    history.push(cloneProject(project));
    project = next;
    currentCircuitId = project.circuits[currentCircuitId] ? currentCircuitId : project.rootCircuitId;
    clearSelection();
    persistProject();
    renderAll();
  }

  function addComponentAtNextClick(component: LogicComponent): void {
    pendingCustomCircuitId = component.subcircuitId ?? null;
    tool = "select";
    pendingWire = null;
    flashStatus(`Клацніть на полі, щоб розмістити ${component.label}`);
    renderCanvas();
  }

  function persistProject(immediate = false): void {
    if (saveTimer != null) window.clearTimeout(saveTimer);
    const save = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      saveTimer = null;
      if (immediate) flashStatus("Схему збережено у браузері");
    };
    if (immediate) save();
    else saveTimer = window.setTimeout(save, 120);
  }

  function updateStatus(): void {
    const circuit = currentCircuit();
    const issues: string[] = [];
    if (evaluation.conflicts.size) issues.push(`${evaluation.conflicts.size} конфліктів`);
    if (evaluation.warnings.length) issues.push(`${evaluation.warnings.length} попереджень`);
    statusLeft.textContent = `${running ? "Симуляція активна" : "Симуляція призупинена"}${issues.length ? ` • ${issues.join(" • ")}` : " • схема стабільна"}`;
    statusLeft.classList.toggle("hasIssues", issues.length > 0);
    const pending = pendingWire ? ` • вибрано ${pendingWire.componentId}.${pendingWire.pinId}` : pendingCustomCircuitId ? " • розміщення мікросхеми" : "";
    const selectedCount = selectedComponentIds.size + selectedWireIds.size;
    const selection = selectedCount ? ` • виділено ${selectedCount}` : "";
    statusRight.textContent = `${circuit.components.length} елементів • ${circuit.wires.length} з'єднань${selection} • ${toolLabel(tool)}${pending}`;
  }

  function flashStatus(message: string): void {
    statusLeft.textContent = message;
    window.setTimeout(updateStatus, 1800);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!open || dialogLayer.classList.contains("hidden") === false) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const editing = isEditingTarget(event.target);
    if (editing && event.key !== "Escape" && !modifier) return;
    if (modifier && key === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (modifier && key === "y") {
      event.preventDefault();
      redo();
    } else if (modifier && key === "c" && !editing) {
      event.preventDefault();
      copySelection();
    } else if (modifier && key === "v" && !editing) {
      event.preventDefault();
      pasteSelection();
    } else if (modifier && key === "x" && !editing) {
      event.preventDefault();
      cutSelection();
    } else if (modifier && key === "a" && !editing) {
      event.preventDefault();
      selectAll();
    } else if (modifier && key === "s") {
      event.preventDefault();
      exportProject();
    } else if (modifier && key === "o") {
      event.preventDefault();
      importInput.click();
    } else if (modifier && key === "d" && !editing) {
      event.preventDefault();
      duplicateSelection();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if ((event.target as HTMLElement).tagName !== "INPUT") {
        event.preventDefault();
        deleteSelection();
      }
    } else if (event.key === "Escape") {
      pendingWire = null;
      pendingCustomCircuitId = null;
      wireCursor = null;
      wireBendDragState = null;
      marqueeState = null;
      closeDropdown();
      closeWireColorPopover();
      closePropertiesPopover();
      clearPinHover();
      setTool("select");
      renderCanvas();
    } else if (!editing && key === "v") {
      setTool("select");
    } else if (!editing && key === "w") {
      setTool("wire");
    }
  }

  function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    return {
      x: viewport.x + ((clientX - rect.left) / Math.max(1, rect.width)) * viewport.width,
      y: viewport.y + ((clientY - rect.top) / Math.max(1, rect.height)) * viewport.height,
    };
  }

  function openMenu(anchor: HTMLElement, items: Array<[string, () => void]>): void {
    const rect = anchor.getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 2, items);
  }

  function openMenuAt(clientX: number, clientY: number, items: Array<[string, () => void]>): void {
    dropdown.innerHTML = "";
    for (const [label, handler] of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        closeDropdown();
        handler();
      });
      dropdown.appendChild(button);
    }
    dropdown.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - 230))}px`;
    dropdown.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - 260))}px`;
    dropdown.classList.remove("hidden");
  }

  function closeDropdown(): void {
    dropdown.classList.add("hidden");
  }

  function showInfoDialog(dialogTitle: string, message: string): void {
    const content = div("logicDialogMessage");
    content.textContent = message;
    showCustomDialog(dialogTitle, content, "Закрити", closeDialog, false);
  }

  function showConfirmDialog(dialogTitle: string, message: string, onConfirm: () => void): void {
    const content = div("logicDialogMessage");
    content.textContent = message;
    showCustomDialog(dialogTitle, content, "Підтвердити", onConfirm, true);
  }

  function showTableDialog(dialogTitle: string, headers: string[], rows: string[][]): void {
    const wrap = div("logicTruthWrap");
    const table = document.createElement("table");
    table.className = "logicTruthTable";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    headers.forEach((header) => { const th = document.createElement("th"); th.textContent = header; trh.appendChild(th); });
    thead.appendChild(trh);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => { const td = document.createElement("td"); td.textContent = cell; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    showCustomDialog(dialogTitle, wrap, "Закрити", closeDialog, false, true);
  }

  function showCustomDialog(
    dialogTitle: string,
    content: HTMLElement,
    primaryLabel: string,
    onPrimary: () => void,
    showCancel = true,
    wide = false,
  ): void {
    dialogLayer.innerHTML = "";
    const card = div(`logicDialogCard${wide ? " wide" : ""}`);
    const head = div("logicDialogHead");
    const heading = document.createElement("h2");
    heading.textContent = dialogTitle;
    const x = textButton("✕", "logicDialogClose");
    x.addEventListener("click", closeDialog);
    head.append(heading, x);
    const body = div("logicDialogBody");
    body.appendChild(content);
    const footer = div("logicDialogFooter");
    if (showCancel) {
      const cancel = textButton("Скасувати", "logicSecondaryButton");
      cancel.addEventListener("click", closeDialog);
      footer.appendChild(cancel);
    }
    const primary = textButton(primaryLabel, "logicPrimaryButton");
    primary.addEventListener("click", onPrimary);
    footer.appendChild(primary);
    card.append(head, body, footer);
    dialogLayer.appendChild(card);
    dialogLayer.classList.remove("hidden");
  }

  function closeDialog(): void {
    dialogLayer.classList.add("hidden");
    dialogLayer.innerHTML = "";
  }

  return { element: modal, open: openEditor, close: closeEditor };
}

function restoreProject(): LogicProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyLogicProject();
    const project = JSON.parse(raw) as LogicProject;
    return validateProject(project).length ? createEmptyLogicProject() : project;
  } catch {
    return createEmptyLogicProject();
  }
}

function symbolForKind(kind: LogicComponentKind): string {
  const symbols: Record<LogicComponentKind, string> = {
    SWITCH: "SW", BUTTON: "BTN", CLOCK: "CLK", CONST0: "0", CONST1: "1", DIP4: "DIP",
    PORT_IN: "IN", PORT_OUT: "OUT", LED: "LED", PROBE: "0/1", SEVEN_SEG: "8.", HEX_DISPLAY: "0x",
    AND: "&", OR: "≥1", NOT: "1", NAND: "&○", NOR: "≥1○", XOR: "=1", XNOR: "=○",
    BUFFER: "▷", TRISTATE: "▷Z", MUX4: "MUX", DECODER2TO4: "DEC", FULL_ADDER: "Σ", DFF: "D", COUNTER4: "CTR",
    ADUC_OUT: "MCU→", ADUC_IN: "→MCU", CUSTOM: "▣",
  };
  return symbols[kind];
}

function toolLabel(tool: Tool): string {
  if (tool === "select") return "Вибір";
  if (tool === "wire") return "Дріт";
  if (tool === "delete") return "Видалення";
  return COMPONENT_LIBRARY.find((item) => item.kind === tool)?.title ?? tool;
}

function isComponentTool(tool: Tool): tool is LogicComponentKind {
  return tool !== "select" && tool !== "wire" && tool !== "delete";
}

function toolbarButton(icon: string, label: string, title: string, compact = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `logicToolbarButton${compact ? " compact" : ""}`;
  button.title = title;
  const iconNode = document.createElement("span");
  iconNode.className = "logicToolIcon";
  iconNode.textContent = icon;
  const labelNode = document.createElement("span");
  labelNode.className = "logicToolLabel";
  labelNode.textContent = label;
  button.append(iconNode, labelNode);
  return button;
}

function menuButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "logicMenuButton";
  button.textContent = label;
  return button;
}

function textButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

function propertyTitle(text: string): HTMLElement {
  const node = div("logicPropertyTitle");
  node.textContent = text;
  return node;
}

function propertyReadOnly(label: string, value: string): HTMLElement {
  const row = div("logicPropertyRow");
  const name = document.createElement("span");
  name.textContent = label;
  const val = document.createElement("code");
  val.textContent = value;
  row.append(name, val);
  return row;
}

function propertyInput(label: string, value: string, onChange: (value: string) => void): HTMLElement {
  const wrap = div("logicPropertyField");
  const name = document.createElement("label");
  name.textContent = label;
  const input = document.createElement("input");
  input.value = value;
  input.addEventListener("change", () => onChange(input.value));
  wrap.append(name, input);
  return wrap;
}

function propertyColor(label: string, value: string, onChange: (value: string) => void): HTMLElement {
  const wrap = div("logicPropertyField logicPropertyColor");
  const name = document.createElement("label");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = normalizeWireColor(value) ?? "#1f2832";
  input.addEventListener("input", () => onChange(input.value));
  wrap.append(name, input);
  return wrap;
}

function propertyNumber(label: string, value: number, min: number, max: number, onChange: (value: number) => void, step = 1): HTMLElement {
  const wrap = div("logicPropertyField");
  const name = document.createElement("label");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.addEventListener("change", () => onChange(clamp(Number(input.value), min, max)));
  wrap.append(name, input);
  return wrap;
}

function propertySelect(label: string, value: string, options: string[], onChange: (value: string) => void): HTMLElement {
  const wrap = div("logicPropertyField");
  const name = document.createElement("label");
  name.textContent = label;
  const select = document.createElement("select");
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === value;
    select.appendChild(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  wrap.append(name, select);
  return wrap;
}

function normalizeWireColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : null;
}

function textareaControl(label: string, value: string): { wrap: HTMLElement; input: HTMLTextAreaElement } {
  const wrap = div("logicPromptField");
  const name = document.createElement("label");
  name.textContent = label;
  const input = document.createElement("textarea");
  input.value = value;
  input.rows = 10;
  wrap.append(name, input);
  return { wrap, input };
}

function inputControl(label: string, value: string, type = "text"): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = div("logicPromptField");
  const name = document.createElement("label");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  wrap.append(name, input);
  return { wrap, input };
}

function div(className: string): HTMLDivElement {
  const node = document.createElement("div");
  node.className = className;
  return node;
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

function defaultWireBends(from: WirePoint, to: WirePoint): WirePoint[] {
  if (nearlyEqual(from.x, to.x) || nearlyEqual(from.y, to.y)) return [];
  const midX = snap((from.x + to.x) / 2);
  return [{ x: midX, y: from.y }, { x: midX, y: to.y }];
}

function wireRoute(
  wire: Pick<LogicWire, "bendPoints">,
  from: WirePoint,
  to: WirePoint,
): { path: string; bends: WirePoint[]; points: WirePoint[] } {
  const stored = wire.bendPoints === undefined ? defaultWireBends(from, to) : wire.bendPoints;
  const bends = stored
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }));
  const requested = [...bends, { ...to }];
  const points: WirePoint[] = [{ ...from }];
  for (const target of requested) {
    const previous = points[points.length - 1];
    if (!nearlyEqual(previous.x, target.x) && !nearlyEqual(previous.y, target.y)) {
      points.push({ x: target.x, y: previous.y });
    }
    const last = points[points.length - 1];
    if (!nearlyEqual(last.x, target.x) || !nearlyEqual(last.y, target.y)) points.push({ ...target });
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    path += nearlyEqual(previous.y, point.y) ? ` H ${point.x}` : ` V ${point.y}`;
  }
  return { path, bends, points };
}

function liveWirePath(from: WirePoint, to: WirePoint): string {
  return wireRoute({ bendPoints: defaultWireBends(from, to) }, from, to).path;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

function normalizedRect(from: WirePoint, to: WirePoint): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function routeIntersectsRect(
  points: WirePoint[],
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (nearlyEqual(a.y, b.y)) {
      if (a.y >= rect.y && a.y <= bottom && Math.max(Math.min(a.x, b.x), rect.x) <= Math.min(Math.max(a.x, b.x), right)) return true;
    } else if (nearlyEqual(a.x, b.x)) {
      if (a.x >= rect.x && a.x <= right && Math.max(Math.min(a.y, b.y), rect.y) <= Math.min(Math.max(a.y, b.y), bottom)) return true;
    }
  }
  return false;
}

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function toolbarLabelForKind(kind: LogicComponentKind): string {
  const labels: Partial<Record<LogicComponentKind, string>> = {
    SWITCH: "SW", BUTTON: "BTN", CLOCK: "CLK", CONST0: "0", CONST1: "1", DIP4: "DIP",
    PORT_IN: "IN", PORT_OUT: "OUT", LED: "LED", PROBE: "PROBE", SEVEN_SEG: "7SEG", HEX_DISPLAY: "HEX",
    MUX4: "MUX", DECODER2TO4: "DEC", FULL_ADDER: "SUM", COUNTER4: "CTR", TRISTATE: "3S",
    ADUC_OUT: "MCU→", ADUC_IN: "→MCU", CUSTOM: "IC",
  };
  return labels[kind] ?? kind;
}

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function safeFileName(value: string): string {
  return (value || "logic-circuit").replace(/[\\/:*?"<>|]+/g, "_").trim() || "logic-circuit";
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
