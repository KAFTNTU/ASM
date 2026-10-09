export type FloatingWindow = {
  element: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  closeButton: HTMLButtonElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  resetPosition: () => void;
};

export function createFloatingWindow(
  parent: HTMLElement,
  className: string,
  storageKey: string,
  focus: (element: HTMLElement) => void,
  customHeader?: { element: HTMLElement; title: HTMLElement; closeButton: HTMLButtonElement },
): FloatingWindow {
  const element = document.createElement("section");
  element.className = `floatingWindow ${className} hidden`;
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");

  const header = customHeader?.element ?? document.createElement("div");
  header.classList.add("floatingWindowHead");
  const title = customHeader?.title ?? document.createElement("strong");
  title.classList.add("floatingWindowTitle");
  const closeButton = customHeader?.closeButton ?? document.createElement("button");
  closeButton.type = "button";
  closeButton.classList.add("topBtn", "floatingWindowClose");
  closeButton.textContent = "×";
  if (!customHeader) header.append(title, closeButton);
  const dockButton = document.createElement("button");
  dockButton.type = "button";
  dockButton.className = "topBtn floatingWindowDock floatingWindowClose";
  dockButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z"/><path d="M12 15v7"/></svg>';
  closeButton.parentElement!.insertBefore(dockButton, closeButton);

  const body = document.createElement("div");
  body.className = "floatingWindowBody";
  element.append(header, body);
  parent.appendChild(element);

  let positioned = false;
  type Geometry = { left: number; top: number; width: number; height: number };
  let floatingGeometry: Geometry | null = null;
  let docked = false;
  let dockWidth: number | null = null;
  let dockHeight: number | null = null;
  let dockLeft = 8;
  let wantsDock = false;
  const toolbarBottom = () => parent.querySelector<HTMLElement>(".toolbar")?.offsetHeight || 58;
  const syncDockButton = () => {
    const uk = document.documentElement.lang === "uk";
    dockButton.setAttribute("aria-pressed", String(docked));
    dockButton.title = docked ? (uk ? "Відкріпити вікно" : "Undock window") : (uk ? "Закріпити зверху" : "Dock at top");
    dockButton.setAttribute("aria-label", dockButton.title);
  };
  const readGeometry = (): Geometry => ({ left: parseFloat(element.style.left) || 8, top: parseFloat(element.style.top) || 62, width: element.offsetWidth, height: element.offsetHeight });
  const applyGeometry = (g: Geometry) => Object.assign(element.style, { left: `${g.left}px`, top: `${g.top}px`, width: `${g.width}px`, height: `${g.height}px` });
  const fitDocked = () => {
    const top = toolbarBottom() + 8;
    const availableHeight = Math.max(180, parent.clientHeight - top - 8);
    // Restore the original side-panel sizes, independently of floating resize state.
    const originalSize = element.classList.contains("runnerWindow")
      ? { width: Math.max(560, Math.min(window.innerWidth * .56, 860)), height: availableHeight }
      : element.classList.contains("scopeFloatingWindow")
        ? { width: Math.min(window.innerWidth * .62, 860), height: availableHeight }
        : element.classList.contains("memoryWindow")
          ? { width: 980, height: 650 }
          : { width: floatingGeometry?.width || element.offsetWidth, height: floatingGeometry?.height || element.offsetHeight };
    const width = Math.min(parent.clientWidth - 16, dockWidth ?? originalSize.width);
    const height = Math.min(availableHeight, dockHeight ?? originalSize.height);
    dockLeft = Math.max(8, Math.min(parent.clientWidth - width - 8, dockLeft));
    applyGeometry({ left: dockLeft, top, width, height });
  };
  const dock = () => {
    if (!docked) {
      floatingGeometry = readGeometry();
      dockLeft = floatingGeometry.left;
    }
    docked = true;
    element.dataset.docked = "true";
    fitDocked();
    syncDockButton();
  };
  const undock = () => {
    docked = false;
    delete element.dataset.docked;
    if (floatingGeometry) applyGeometry(floatingGeometry);
    syncDockButton();
  };
  syncDockButton();
  let drag: { pointerId: number; x: number; y: number; left: number; top: number } | null = null;

  const clampPosition = () => {
    if (!positioned || element.classList.contains("hidden")) return;
    if (docked) { fitDocked(); return; }
    const maxLeft = Math.max(8, parent.clientWidth - element.offsetWidth - 8);
    const maxTop = Math.max(8, parent.clientHeight - element.offsetHeight - 8);
    element.style.left = `${Math.max(8, Math.min(maxLeft, Number.parseFloat(element.style.left) || 8))}px`;
    element.style.top = `${Math.max(8, Math.min(maxTop, Number.parseFloat(element.style.top) || 8))}px`;
  };

  const savePosition = () => {
    if (!positioned || element.classList.contains("hidden")) return;
    localStorage.setItem(storageKey, JSON.stringify({
      left: Number.parseFloat(element.style.left),
      top: Number.parseFloat(element.style.top),
      width: element.offsetWidth,
      height: element.offsetHeight,
      docked,
      dockWidth,
      dockHeight,
      floatingGeometry,
    }));
  };

  const placeInitially = () => {
    if (positioned) return;
    let saved: { left?: number; top?: number; width?: number; height?: number; docked?: boolean; dockWidth?: number; dockHeight?: number; floatingGeometry?: Geometry } | null = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { /* use centered layout */ }
    if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
      element.style.width = `${Math.max(320, saved.width!)}px`;
      element.style.height = `${Math.max(240, saved.height!)}px`;
    }
    element.style.left = `${Number.isFinite(saved?.left) ? saved!.left : Math.max(8, Math.round((parent.clientWidth - element.offsetWidth) / 2))}px`;
    element.style.top = `${Number.isFinite(saved?.top) ? saved!.top : 62}px`;
    positioned = true;
    dockWidth = Number.isFinite(saved?.dockWidth) ? Math.max(340, saved!.dockWidth!) : null;
    dockHeight = Number.isFinite(saved?.dockHeight) ? Math.max(230, saved!.dockHeight!) : null;
    if (saved?.docked) {
      dock();
      if (saved.floatingGeometry && Object.values(saved.floatingGeometry).every(Number.isFinite)) floatingGeometry = saved.floatingGeometry;
    }
    clampPosition();
  };

  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, input, select, a, summary"))) return;
    focus(element);
    event.preventDefault();
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: Number.parseFloat(element.style.left) || 0,
      top: Number.parseFloat(element.style.top) || 0,
    };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (docked) {
      if (event.clientY - drag.y <= 24) {
        dockLeft = drag.left + event.clientX - drag.x;
        fitDocked();
        return;
      }
      const rect = element.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      undock();
      const parentRect = parent.getBoundingClientRect();
      element.style.left = `${event.clientX - parentRect.left - ratio * element.offsetWidth}px`;
      element.style.top = `${event.clientY - parentRect.top - 20}px`;
      clampPosition();
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        left: parseFloat(element.style.left), top: parseFloat(element.style.top) };
    }
    element.style.left = `${drag.left + event.clientX - drag.x}px`;
    element.style.top = `${drag.top + event.clientY - drag.y}px`;
    clampPosition();
    const parentRect = parent.getBoundingClientRect();
    wantsDock = event.clientY - parentRect.top <= toolbarBottom() + 18;
  });
  const finishDrag = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    if (wantsDock && event.type !== "pointercancel") dock();
    wantsDock = false;
    savePosition();
  };
  header.addEventListener("pointerup", finishDrag);
  header.addEventListener("pointercancel", finishDrag);
  dockButton.addEventListener("click", () => {
    if (docked) { undock(); clampPosition(); }
    else dock();
    focus(element);
    savePosition();
  });
  for (const side of ["left", "right"] as const) {
    const grip = document.createElement("div");
    grip.className = `floatingSideResize floatingSideResize-${side}`;
    grip.setAttribute("role", "separator");
    grip.setAttribute("aria-orientation", "vertical");
    grip.setAttribute("aria-label", document.documentElement.lang === "uk" ? `Змінити ширину: ${side === "left" ? "лівий" : "правий"} край` : `Resize ${side} edge`);
    grip.tabIndex = 0;
    element.appendChild(grip);
    let start: { id: number; x: number; geometry: Geometry } | null = null;
    const resizeSide = (g: Geometry, dx: number) => {
      const minWidth = Math.min(docked ? 340 : parseFloat(getComputedStyle(element).minWidth) || 340, parent.clientWidth - 16);
      const right = g.left + g.width;
      const left = side === "left" ? Math.max(8, Math.min(right - minWidth, g.left + dx)) : g.left;
      const width = side === "left" ? right - left : Math.max(minWidth, Math.min(parent.clientWidth - left - 8, g.width + dx));
      if (docked) { dockLeft = left; dockWidth = width; fitDocked(); }
      else applyGeometry({ ...g, left, width });
      savePosition();
    };
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); focus(element);
      start = { id: event.pointerId, x: event.clientX, geometry: readGeometry() };
      grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointermove", (event) => {
      if (start?.id === event.pointerId) resizeSide(start.geometry, event.clientX - start.x);
    });
    const finish = (event: PointerEvent) => {
      if (start?.id !== event.pointerId) return;
      start = null;
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      savePosition();
    };
    grip.addEventListener("pointerup", finish);
    grip.addEventListener("pointercancel", finish);
    grip.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); resizeSide(readGeometry(), event.key === "ArrowLeft" ? -20 : 20);
    });
  }
  for (const corner of ["nw", "ne", "sw", "se"] as const) {
    const grip = document.createElement("div");
    grip.className = `floatingResizeCorner floatingResize-${corner}`;
    grip.setAttribute("aria-hidden", "true");
    element.appendChild(grip);
    let resizing: { id: number; x: number; y: number; left: number; top: number; width: number; height: number } | null = null;
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      focus(element);
      resizing = { id: event.pointerId, x: event.clientX, y: event.clientY,
        left: parseFloat(element.style.left) || 8, top: parseFloat(element.style.top) || 8,
        width: element.offsetWidth, height: element.offsetHeight };
      grip.setPointerCapture(event.pointerId);
    });
    grip.addEventListener("pointermove", (event) => {
      const start = resizing;
      if (!start || start.id !== event.pointerId) return;
      const style = getComputedStyle(element);
      const minW = Math.min(parseFloat(style.minWidth) || 340, parent.clientWidth - 16);
      const minH = Math.min(parseFloat(style.minHeight) || 230, parent.clientHeight - 16);
      const west = corner.endsWith("w"), north = corner.startsWith("n");
      const right = start.left + start.width, bottom = start.top + start.height;
      const left = west ? Math.max(8, Math.min(right - minW, start.left + event.clientX - start.x)) : start.left;
      const top = north ? Math.max(8, Math.min(bottom - minH, start.top + event.clientY - start.y)) : start.top;
      const width = west ? right - left : Math.max(minW, Math.min(parent.clientWidth - left - 8, start.width + event.clientX - start.x));
      const height = north ? bottom - top : Math.max(minH, Math.min(parent.clientHeight - top - 8, start.height + event.clientY - start.y));
      if (docked) { dockLeft = left; dockWidth = width; dockHeight = height; fitDocked(); }
      else Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    });
    const finishResize = (event: PointerEvent) => {
      if (!resizing || resizing.id !== event.pointerId) return;
      resizing = null;
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      savePosition();
    };
    grip.addEventListener("pointerup", finishResize);
    grip.addEventListener("pointercancel", finishResize);
  }
  element.addEventListener("pointerdown", () => focus(element));
  closeButton.addEventListener("click", () => element.classList.add("hidden"));
  window.addEventListener("resize", clampPosition);
  new ResizeObserver(() => { clampPosition(); savePosition(); }).observe(element);

  return {
    element,
    title,
    body,
    closeButton,
    open: () => {
      element.classList.remove("hidden");
      placeInitially();
      syncDockButton();
      clampPosition();
      focus(element);
    },
    close: () => element.classList.add("hidden"),
    isOpen: () => !element.classList.contains("hidden"),
    resetPosition: () => {
      localStorage.removeItem(storageKey);
      docked = false;
      dockWidth = null;
      dockHeight = null;
      floatingGeometry = null;
      delete element.dataset.docked;
      syncDockButton();
      element.style.removeProperty("width");
      element.style.removeProperty("height");
      positioned = false;
      if (!element.classList.contains("hidden")) placeInitially();
    },
  };
}
