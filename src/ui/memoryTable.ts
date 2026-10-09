import type { EmuBoardController } from "../vm/emuBoardController";
import { ADUC841_SFR } from "../mcu/aduc841";

export type MemoryTableOptions = {
  tr: (en: string, uk: string) => string;
  onModify?: () => void;
};

// Map of canonical SFR names for 0x80..0xFF
const SFR_NAMES: Record<number, string> = {
  0x80: "P0",
  0x81: "SP",
  0x82: "DPL",
  0x83: "DPH",
  0x84: "DPP",
  0x87: "PCON",
  0x88: "TCON",
  0x89: "TMOD",
  0x8a: "TL0",
  0x8b: "TL1",
  0x8c: "TH0",
  0x8d: "TH1",
  0x90: "P1",
  0x91: "I2CADD1",
  0x92: "I2CADD2",
  0x93: "I2CADD3",
  0x98: "SCON",
  0x99: "SBUF",
  0x9a: "I2CDAT",
  0x9b: "I2CADD",
  0x9d: "T3FD",
  0x9e: "T3CON",
  0xa0: "P2",
  0xa1: "TIMECON",
  0xa2: "HTHSEC",
  0xa3: "SEC",
  0xa4: "MIN",
  0xa5: "HOUR",
  0xa6: "INTVAL",
  0xa7: "DPCON",
  0xa8: "IE",
  0xa9: "IEIP2",
  0xae: "PWMCON",
  0xaf: "CFG841",
  0xb0: "P3",
  0xb1: "PWM0L",
  0xb2: "PWM0H",
  0xb3: "PWM1L",
  0xb4: "PWM1H",
  0xb7: "SPH",
  0xb8: "IP",
  0xb9: "ECON",
  0xbc: "EDATA1",
  0xbd: "EDATA2",
  0xbe: "EDATA3",
  0xbf: "EDATA4",
  0xc0: "WDCON",
  0xc2: "CHIPID",
  0xc6: "EADRL",
  0xc7: "EADRH",
  0xc8: "T2CON",
  0xca: "RCAP2L",
  0xcb: "RCAP2H",
  0xcc: "TL2",
  0xcd: "TH2",
  0xd0: "PSW",
  0xd2: "DMAL",
  0xd3: "DMAH",
  0xd4: "DMAP",
  0xd7: "PLLCON",
  0xd8: "ADCCON2",
  0xd9: "ADCDATAL",
  0xda: "ADCDATAH",
  0xdf: "PSMCON",
  0xe0: "ACC",
  0xe8: "I2CCON",
  0xef: "ADCCON1",
  0xf0: "B",
  0xf1: "ADCOFSL",
  0xf2: "ADCOFSH",
  0xf3: "ADCGAINL",
  0xf4: "ADCGAINH",
  0xf5: "ADCCON3",
  0xf7: "SPIDAT",
  0xf8: "SPICON",
  0xf9: "DAC0L",
  0xfa: "DAC0H",
  0xfb: "DAC1L",
  0xfc: "DAC1H",
  0xfd: "DACCON",
};

export class MemoryTable {
  public readonly element: HTMLElement;
  private activeTab: "ram" | "sfr" | "stack" = "ram";
  private selectedAddr: number | null = null;
  private isEditing = false;

  private prevIram = new Uint8Array(128);
  private prevSfr = new Uint8Array(128);
  private iramChangeTs = new Float64Array(128);
  private sfrChangeTs = new Float64Array(128);
  private initialized = false;

  private tabRamBtn!: HTMLButtonElement;
  private tabSfrBtn!: HTMLButtonElement;
  private tabStackBtn!: HTMLButtonElement;
  private gridContainer!: HTMLDivElement;
  private inspectorContainer!: HTMLDivElement;
  private cellElements: Map<number, HTMLDivElement> = new Map();

  constructor(
    private cpu: EmuBoardController,
    private opts: MemoryTableOptions,
  ) {
    this.element = document.createElement("section");
    this.element.className = "runnerCard wide runnerMemCard";
    this.buildUi();
  }

  private tr(en: string, uk: string): string {
    return this.opts.tr(en, uk);
  }

  private buildUi(): void {
    this.element.innerHTML = "";

    // Header with title and tab switcher
    const head = document.createElement("div");
    head.className = "memCardHead";

    const titleWrap = document.createElement("div");
    titleWrap.className = "memTitleWrap";

    const title = document.createElement("h3");
    title.textContent = this.tr("Interactive RAM & SFR Memory", "Інтерактивна пам’ять RAM та SFR");

    titleWrap.append(title);

    const tabs = document.createElement("div");
    tabs.className = "memTabs";

    this.tabRamBtn = document.createElement("button");
    this.tabRamBtn.type = "button";
    this.tabRamBtn.className = `memTabBtn ${this.activeTab === "ram" ? "active" : ""}`;
    this.tabRamBtn.textContent = this.tr("Direct RAM (0x00–0x7F)", "Пряма RAM (0x00–0x7F)");
    this.tabRamBtn.addEventListener("click", () => this.switchTab("ram"));

    this.tabSfrBtn = document.createElement("button");
    this.tabSfrBtn.type = "button";
    this.tabSfrBtn.className = `memTabBtn ${this.activeTab === "sfr" ? "active" : ""}`;
    this.tabSfrBtn.textContent = this.tr("SFR (0x80–0xFF)", "Регістри SFR (0x80–0xFF)");
    this.tabSfrBtn.addEventListener("click", () => this.switchTab("sfr"));

    this.tabStackBtn = document.createElement("button");
    this.tabStackBtn.type = "button";
    this.tabStackBtn.className = `memTabBtn ${this.activeTab === "stack" ? "active" : ""}`;
    this.tabStackBtn.textContent = this.tr("Stack (SP)", "Стек (SP)");
    this.tabStackBtn.addEventListener("click", () => this.switchTab("stack"));

    tabs.append(this.tabRamBtn, this.tabSfrBtn, this.tabStackBtn);
    head.append(titleWrap, tabs);
    this.element.appendChild(head);

    // Grid container
    this.gridContainer = document.createElement("div");
    this.gridContainer.className = "memGridContainer";
    this.element.appendChild(this.gridContainer);

    // Inspector container
    this.inspectorContainer = document.createElement("div");
    this.inspectorContainer.className = "memInspectorContainer";
    this.element.appendChild(this.inspectorContainer);

    this.renderGridStructure();
    this.renderInspector();
    this.update();
  }

  public refreshLanguage(): void {
    this.buildUi();
  }

  private switchTab(tab: "ram" | "sfr" | "stack"): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.selectedAddr = null;
    this.tabRamBtn.classList.toggle("active", tab === "ram");
    this.tabSfrBtn.classList.toggle("active", tab === "sfr");
    this.tabStackBtn.classList.toggle("active", tab === "stack");
    this.renderGridStructure();
    this.renderInspector();
    this.update();
  }

  private renderGridStructure(): void {
    this.gridContainer.innerHTML = "";
    this.cellElements.clear();

    if (this.activeTab === "stack") {
      this.renderStackView();
      return;
    }

    const isSfr = this.activeTab === "sfr";
    const baseAddr = isSfr ? 0x80 : 0x00;

    const table = document.createElement("table");
    table.className = "memHexTable mono";

    // Table Header (+0 .. +F)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thAddr = document.createElement("th");
    thAddr.className = "memThAddr";
    thAddr.textContent = "Addr";
    headerRow.appendChild(thAddr);

    for (let col = 0; col < 16; col++) {
      const th = document.createElement("th");
      th.className = "memThCol";
      th.textContent = `+${col.toString(16).toUpperCase()}`;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table Body (8 rows of 16 bytes)
    const tbody = document.createElement("tbody");
    for (let row = 0; row < 8; row++) {
      const tr = document.createElement("tr");
      const rowBase = baseAddr + row * 16;

      const tdAddr = document.createElement("td");
      tdAddr.className = "memTdRowLabel";
      tdAddr.textContent = `0x${rowBase.toString(16).padStart(2, "0").toUpperCase()}:`;
      tr.appendChild(tdAddr);

      for (let col = 0; col < 16; col++) {
        const addr = rowBase + col;
        const td = document.createElement("td");
        td.className = "memCell";
        td.dataset.addr = String(addr);

        const valSpan = document.createElement("span");
        valSpan.className = "memVal";
        valSpan.textContent = "00";

        td.appendChild(valSpan);

        if (isSfr && SFR_NAMES[addr]) {
          const tagSpan = document.createElement("span");
          tagSpan.className = "memTag";
          tagSpan.textContent = SFR_NAMES[addr];
          td.appendChild(tagSpan);
        } else if (!isSfr && addr < 0x20) {
          const bank = Math.floor(addr / 8);
          const reg = addr % 8;
          const tagSpan = document.createElement("span");
          tagSpan.className = "memTag bankTag";
          tagSpan.textContent = `R${reg}`;
          td.appendChild(tagSpan);
        }
        if (!isSfr && addr >= 0x20 && addr <= 0x2f) {
          const firstBit = (addr - 0x20) * 8;
          td.title = `${this.tr("Bit addresses", "Бітові адреси")}: ${firstBit.toString(16).padStart(2, "0").toUpperCase()}h–${(firstBit + 7).toString(16).padStart(2, "0").toUpperCase()}h`;
        }

        td.addEventListener("click", () => {
          this.selectCell(addr);
        });

        td.addEventListener("dblclick", () => {
          this.selectCell(addr);
          this.startInlineEdit(addr, td);
        });

        this.cellElements.set(addr, td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    this.gridContainer.appendChild(table);

    // Legend bar
    const legend = document.createElement("div");
    legend.className = "memLegend";
    if (isSfr) {
      legend.innerHTML = `
        <span class="legendItem"><span class="legendDot sfr"></span>${this.tr("Core SFRs", "Базові SFR")}</span>
        <span class="legendItem"><span class="legendDot changed"></span>${this.tr("Recently Changed (glow)", "Нещодавно змінено")}</span>
        <span class="legendHint">${this.tr("Double-click any cell to edit value directly", "Двічі клацніть комірку для швидкого редагування")}</span>
      `;
    } else {
      legend.innerHTML = `
        <span class="legendItem"><span class="legendDot bank"></span>${this.tr("Active Bank R0-R7", "Активний банк R0-R7")}</span>
        <span class="legendItem"><span class="legendDot sp"></span>${this.tr("Stack Pointer (SP)", "Вершина стека (SP)")}</span>
        <span class="legendItem"><span class="legendDot bitram"></span>${this.tr("Bit-addressable 20h..2Fh", "Бітова область 20h..2Fh")}</span>
        <span class="legendItem"><span class="legendDot changed"></span>${this.tr("Recently Changed", "Нещодавно змінено")}</span>
      `;
    }
    this.gridContainer.appendChild(legend);
  }

  private renderStackView(): void {
    this.gridContainer.replaceChildren();
    this.cellElements.clear();
    const sp = this.cpu.getSfr(ADUC841_SFR.sp) & 0xff;
    const stackWrap = document.createElement("div");
    stackWrap.className = "memStackWrap";

    const head = document.createElement("div");
    head.className = "memStackHead";
    head.innerHTML = `
      <div>
        <b>${this.tr("Current SP", "Поточний вказівник SP")}:</b> <code class="mono">0x${sp.toString(16).padStart(2, "0").toUpperCase()} (${sp})</code>
        <span class="stackDepthInfo">${this.tr("Nearby RAM; SP alone does not show used depth", "Сусідня RAM; сам SP не показує зайняту глибину")}</span>
      </div>
      <div class="stackQuickBtns">
        <button type="button" class="memSmallBtn" id="btnResetSp" title="${this.tr("Changes the pointer only; RAM bytes remain", "Змінює лише вказівник; байти RAM залишаються")}">${this.tr("Set SP to 0x07", "Встановити SP = 0x07")}</button>
      </div>
    `;
    stackWrap.appendChild(head);

    const table = document.createElement("table");
    table.className = "runnerTable mono memStackTable";
    table.innerHTML = `
      <thead>
        <tr>
          <th>${this.tr("Offset", "Зміщення")}</th>
          <th>${this.tr("Address", "Адреса")}</th>
          <th>${this.tr("Hex Value", "Значення Hex")}</th>
          <th>${this.tr("Dec", "Dec")}</th>
          <th>${this.tr("Binary", "Двійкове")}</th>
          <th>${this.tr("ASCII", "Символ")}</th>
          <th>${this.tr("Marker", "Позначка")}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody")!;
    const windowTop = Math.min(0x7f, sp);
    const minAddr = Math.max(0x00, Math.min(windowTop - 12, 0x80 - 20));
    const maxAddr = Math.min(0x7f, minAddr + 19);

    for (let addr = maxAddr; addr >= minAddr; addr--) {
      const val = this.cpu.readIram(addr) & 0xff;
      const isSpTop = addr === sp;
      const isResetBase = addr === 0x07;

      const tr = document.createElement("tr");
      tr.className = isSpTop ? "stackRowTop" : "";
      if (addr === this.selectedAddr) tr.classList.add("selectedRow");

      const ascii = val >= 32 && val <= 126 ? String.fromCharCode(val) : "•";
      const bin = val.toString(2).padStart(8, "0");

      tr.innerHTML = `
        <td>${addr >= sp ? `SP+${addr - sp}` : `SP-${sp - addr}`}</td>
        <td><b>0x${addr.toString(16).padStart(2, "0").toUpperCase()}</b></td>
        <td class="stackValCell" data-addr="${addr}">${val.toString(16).padStart(2, "0").toUpperCase()}</td>
        <td>${val}</td>
        <td><code>${bin}</code></td>
        <td><code>${escapeHtml(ascii)}</code></td>
        <td>
          ${isSpTop ? `<span class="stackPill top">◀ ${this.tr("SP TOP", "ВЕРШИНА SP")}</span>` : ""}
          ${isResetBase ? `<span class="stackPill base">${this.tr("RESET", "ПОЧАТОК")} (07h)</span>` : ""}
        </td>
      `;

      tr.addEventListener("click", () => {
        this.selectCell(addr);
      });

      tbody.appendChild(tr);
    }

    stackWrap.appendChild(table);
    this.gridContainer.appendChild(stackWrap);
    if (sp > 0x7f) {
      const note = document.createElement("p");
      note.className = "memStackNote";
      note.textContent = this.tr("SP is above the RAM range modeled by this simulator (0x00–0x7F).", "SP вище діапазону RAM, змодельованого цим симулятором (0x00–0x7F).");
      stackWrap.appendChild(note);
    }

    const resetSpBtn = stackWrap.querySelector("#btnResetSp");
    resetSpBtn?.addEventListener("click", () => {
      this.cpu.setSfr(ADUC841_SFR.sp, 0x07);
      this.opts.onModify?.();
      this.renderStackView();
      this.renderInspector();
    });
  }

  private selectCell(addr: number): void {
    this.selectedAddr = addr;
    this.renderInspector();
    this.highlightSelectedCell();
  }

  private highlightSelectedCell(): void {
    for (const [cellAddr, el] of this.cellElements.entries()) {
      el.classList.toggle("selectedCell", cellAddr === this.selectedAddr);
    }
  }

  private startInlineEdit(addr: number, td: HTMLElement): void {
    if (this.isEditing) return;
    this.isEditing = true;

    const currentVal = this.getByteValue(addr);
    const prevHtml = td.innerHTML;
    td.innerHTML = "";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "memInlineInput mono";
    input.value = `0x${currentVal.toString(16).padStart(2, "0").toUpperCase()}`;
    input.maxLength = 10;
    td.appendChild(input);
    input.focus();
    input.select();

    const finish = (apply: boolean) => {
      if (!this.isEditing) return;
      this.isEditing = false;
      if (apply) {
        const parsed = parseByteInput(input.value);
        if (parsed != null) {
          this.setByteValue(addr, parsed);
        }
      }
      td.innerHTML = prevHtml;
      this.renderGridValues();
      this.renderInspector();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => {
      finish(true);
    });
  }

  private getByteValue(addr: number): number {
    if (addr >= 0x80) {
      return this.cpu.getSfr(addr) & 0xff;
    }
    return this.cpu.readIram(addr) & 0xff;
  }

  private setByteValue(addr: number, value: number): void {
    const val = value & 0xff;
    if (addr >= 0x80) {
      this.cpu.setSfr(addr, val);
      this.sfrChangeTs[addr - 0x80] = performance.now();
      this.prevSfr[addr - 0x80] = val;
    } else {
      this.cpu.writeIram(addr, val);
      this.iramChangeTs[addr] = performance.now();
      this.prevIram[addr] = val;
    }
    this.opts.onModify?.();
  }

  private renderInspector(): void {
    if (this.selectedAddr == null) {
      this.inspectorContainer.innerHTML = `
        <div class="memInspectorPlaceholder">
          <span>${this.tr(
            "Click any cell in the table above to view detailed representations and edit bits directly",
            "Клацніть на будь-яку комірку в таблиці, щоб переглянути детальні дані та змінити байти або біти",
          )}</span>
        </div>
      `;
      return;
    }

    const addr = this.selectedAddr;
    const isSfr = addr >= 0x80;
    const val = this.getByteValue(addr);

    const name = isSfr
      ? SFR_NAMES[addr] ?? "SFR (unnamed)"
      : this.getRamDescription(addr);

    const bin = val.toString(2).padStart(8, "0");
    const signed = val > 127 ? val - 256 : val;
    const ascii = val >= 32 && val <= 126 ? `'${String.fromCharCode(val)}'` : this.tr("non-printable", "недрукований");

    this.inspectorContainer.innerHTML = `
      <div class="memInspectorBox">
        <div class="memInspectorMeta">
          <div class="memMetaTitle">
            <span class="memBadge addr">0x${addr.toString(16).padStart(2, "0").toUpperCase()}</span>
            <b>${escapeHtml(name)}</b>
            <span class="memAddrDec">(${addr})</span>
          </div>
          <div class="memMetaValues mono">
            <span>HEX: <b>0x${val.toString(16).padStart(2, "0").toUpperCase()}</b></span>
            <span>BIN: <b>${bin}</b></span>
            <span>DEC: <b>${val}</b></span>
            <span>SIGNED: <b>${signed}</b></span>
            <span>ASCII: <b>${escapeHtml(ascii)}</b></span>
          </div>
        </div>

        <div class="memBitEditor">
          <span class="bitLabel">${this.tr("Bits", "Біти")} (b7..b0):</span>
          <div class="bitButtons">
            ${Array.from({ length: 8 }, (_, i) => {
              const bitIdx = 7 - i;
              const bitVal = (val >> bitIdx) & 1;
              return `<button type="button" class="memBitBtn mono ${bitVal ? "active" : ""}" data-bit="${bitIdx}" title="Bit ${bitIdx}">b${bitIdx}: <b>${bitVal}</b></button>`;
            }).join("")}
          </div>
        </div>

        <div class="memDirectEdit">
          <label class="memInputLabel">${this.tr("Write new value", "Ввести значення")}:</label>
          <div class="memInputRow">
            <input type="text" class="memPokeInput mono" id="memInputVal" value="0x${val.toString(16).padStart(2, "0").toUpperCase()}" placeholder="0xFF, 255, 0b101" />
            <button type="button" class="memBtn apply" id="btnMemApply">${this.tr("Apply", "Застосувати")}</button>
            <button type="button" class="memBtn" id="btnMemZero">0x00</button>
            <button type="button" class="memBtn" id="btnMemFull">0xFF</button>
            <button type="button" class="memBtn" id="btnMemPlus">+1</button>
            <button type="button" class="memBtn" id="btnMemMinus">-1</button>
            <button type="button" class="memBtn" id="btnMemInvert">NOT (~)</button>
          </div>
        </div>
      </div>
    `;

    // Hook bit buttons
    const bitBtns = this.inspectorContainer.querySelectorAll<HTMLButtonElement>(".memBitBtn");
    bitBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const bitIdx = Number(btn.dataset.bit);
        const nextVal = val ^ (1 << bitIdx);
        this.setByteValue(addr, nextVal);
        this.renderGridValues();
        this.renderInspector();
      });
    });

    const inputVal = this.inspectorContainer.querySelector<HTMLInputElement>("#memInputVal");
    const applyBtn = this.inspectorContainer.querySelector<HTMLButtonElement>("#btnMemApply");
    const applyAction = () => {
      if (!inputVal) return;
      const parsed = parseByteInput(inputVal.value);
      if (parsed != null) {
        this.setByteValue(addr, parsed);
        this.renderGridValues();
        this.renderInspector();
      } else {
        inputVal.classList.add("inputError");
        setTimeout(() => inputVal.classList.remove("inputError"), 600);
      }
    };

    applyBtn?.addEventListener("click", applyAction);
    inputVal?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyAction();
    });

    // Quick helper buttons
    this.inspectorContainer.querySelector("#btnMemZero")?.addEventListener("click", () => {
      this.setByteValue(addr, 0x00);
      this.renderGridValues();
      this.renderInspector();
    });
    this.inspectorContainer.querySelector("#btnMemFull")?.addEventListener("click", () => {
      this.setByteValue(addr, 0xff);
      this.renderGridValues();
      this.renderInspector();
    });
    this.inspectorContainer.querySelector("#btnMemPlus")?.addEventListener("click", () => {
      this.setByteValue(addr, (val + 1) & 0xff);
      this.renderGridValues();
      this.renderInspector();
    });
    this.inspectorContainer.querySelector("#btnMemMinus")?.addEventListener("click", () => {
      this.setByteValue(addr, (val - 1) & 0xff);
      this.renderGridValues();
      this.renderInspector();
    });
    this.inspectorContainer.querySelector("#btnMemInvert")?.addEventListener("click", () => {
      this.setByteValue(addr, (~val) & 0xff);
      this.renderGridValues();
      this.renderInspector();
    });
  }

  private getRamDescription(addr: number): string {
    if (addr < 0x20) {
      const bank = Math.floor(addr / 8);
      const reg = addr % 8;
      return `${this.tr("Register Bank", "Банк регістрів")} ${bank} - R${reg}`;
    }
    if (addr < 0x30) {
      const bitStart = (addr - 0x20) * 8;
      return `${this.tr("Bit-addressable Byte", "Бітовий байт")} 20h..2Fh (bits ${bitStart.toString(16).toUpperCase()}h..${(bitStart + 7).toString(16).toUpperCase()}h)`;
    }
    return this.tr("General-purpose Scratchpad RAM", "Загальна пам’ять даних RAM");
  }

  public update(): void {
    const now = performance.now();

    // Check changes for RAM
    for (let i = 0; i < 128; i++) {
      const current = this.cpu.readIram(i) & 0xff;
      if (this.initialized && current !== this.prevIram[i]) {
        this.iramChangeTs[i] = now;
      }
      this.prevIram[i] = current;
    }

    // Check changes for SFR
    for (let i = 0; i < 128; i++) {
      const addr = 0x80 + i;
      const current = this.cpu.getSfr(addr) & 0xff;
      if (this.initialized && current !== this.prevSfr[i]) {
        this.sfrChangeTs[i] = now;
      }
      this.prevSfr[i] = current;
    }

    this.initialized = true;

    if (this.activeTab === "stack") {
      this.renderStackView();
    } else {
      this.renderGridValues();
    }

    // If an inspector is open and user is NOT typing, refresh inspector values
    if (this.selectedAddr != null && !this.isEditing) {
      const activeEl = document.activeElement;
      if (activeEl?.id !== "memInputVal") {
        this.renderInspector();
      }
    }
  }

  private renderGridValues(): void {
    if (this.cellElements.size === 0) return;
    const now = performance.now();
    const isSfr = this.activeTab === "sfr";
    const psw = this.cpu.getSfr(ADUC841_SFR.psw) & 0xff;
    const activeBank = (psw >> 3) & 0x03;
    const activeBankStart = activeBank * 8;
    const sp = this.cpu.getSfr(ADUC841_SFR.sp) & 0xff;

    for (const [addr, td] of this.cellElements.entries()) {
      if (this.isEditing && addr === this.selectedAddr) continue;

      const val = this.getByteValue(addr);
      const valSpan = td.querySelector<HTMLSpanElement>(".memVal");
      if (valSpan) {
        valSpan.textContent = val.toString(16).padStart(2, "0").toUpperCase();
      }

      // Change highlight
      const changedTs = isSfr ? this.sfrChangeTs[addr - 0x80] : this.iramChangeTs[addr];
      const isChanged = changedTs > 0 && now - changedTs < 1200;
      td.classList.toggle("memChanged", isChanged);

      // Special semantic highlights
      if (!isSfr) {
        const isActiveBank = addr >= activeBankStart && addr < activeBankStart + 8;
        td.classList.toggle("isBankReg", isActiveBank);
        td.classList.toggle("isSpCell", addr === sp);
        td.classList.toggle("isBitRam", addr >= 0x20 && addr < 0x30);
      } else {
        td.classList.toggle("isKeySfr", addr === ADUC841_SFR.acc || addr === ADUC841_SFR.p0 || addr === ADUC841_SFR.p2 || addr === ADUC841_SFR.sp);
      }
    }
  }
}

export function parseByteInput(input: string): number | null {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  let digits: string;
  let radix: number;
  if (/^0x[0-9a-f]+$/.test(clean)) { digits = clean.slice(2); radix = 16; }
  else if (/^[0-9a-f]+h$/.test(clean)) { digits = clean.slice(0, -1); radix = 16; }
  else if (/^0b[01]+$/.test(clean)) { digits = clean.slice(2); radix = 2; }
  else if (/^[01]+b$/.test(clean)) { digits = clean.slice(0, -1); radix = 2; }
  else if (/^#?[0-9]+$/.test(clean)) { digits = clean.replace(/^#/, ""); radix = 10; }
  else if (/^[a-f][0-9a-f]?$/.test(clean)) { digits = clean; radix = 16; }
  else return null;
  const value = Number.parseInt(digits, radix);
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
