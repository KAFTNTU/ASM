import { EmuBoardController, type CpuTraceEntry } from "../vm/emuBoardController";
import type { Board, BoardDrawnLayout, DrawnDeviceId } from "../vm/board";
import {
    flashAduc841,
    isAduc841SerialSupported,
    type Aduc841FlashTraceEvent,
} from "../vm/aduc841Serial";
import { SFR } from "../vm/st841Map";
import { compileAsm, type AsmDiagnostic } from "./asmCompiler";
import { checkC } from "./cChecker";
import { transpileCToAsm } from "./cTranspiler";
import { createMotorPanel, type ScopeSource } from "./motorPanel";
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
    type CodeCompletion,
} from "./codeCompletions";
import { MemoryTable } from "./memoryTable";
import { createFloatingWindow } from "./floatingWindow";
import {
    LAYOUT_STORAGE_KEY,
    STAND_ITEMS,
    STAND_ITEM_IDS,
    TOOLBAR_CONTROL_IDS,
    TOOLBAR_CONTROLS,
    TOOLBAR_GROUP_IDS,
    TOOLBAR_GROUPS,
    clampStandPlacement,
    defaultInterfaceLayout,
    loadInterfaceLayout,
    type StandItemId,
    type ToolbarGroupId,
} from "./interfaceLayout";

type UiLanguage = "en" | "uk";
type ThemeViewTransition = {
  finished: Promise<void>;
};
type ThemeTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => ThemeViewTransition;
};
type EditorSnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const EDITOR_UNDO_GROUP_MS = 700;
const EDITOR_HISTORY_LIMIT = 300;

const UI_LANGUAGE_KEY = "st841.ui.language";
const PERSONAL_SETTINGS_KEY = "st841.ui.personal.v1";
type PersonalSettings = {
    accent: string;
    frameDark: string;
    frameLight: string;
    pageDark: string;
    pageLight: string;
    boardDark: string;
    boardLight: string;
    outputDark: string;
    outputLight: string;
    editorFontSize: number;
    editorLineHeight: number;
    speed: number;
    memoryRefreshMs: number;
    stepRepeatHz: number;
    reduceMotion: boolean;
};
const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
    accent: "#2da5b5",
    frameDark: "#1a2028",
    frameLight: "#dce5ee",
    pageDark: "#080c12",
    pageLight: "#c7d2df",
    boardDark: "#0c121a",
    boardLight: "#d9e1e9",
    outputDark: "#0d141e",
    outputLight: "#d2dce7",
    editorFontSize: 13,
    editorLineHeight: 1.55,
    speed: 1,
    memoryRefreshMs: 250,
    stepRepeatHz: 10,
    reduceMotion: false,
};

function loadPersonalSettings(): PersonalSettings {
    let saved: Partial<PersonalSettings> = {};
    try {
        const value = JSON.parse(localStorage.getItem(PERSONAL_SETTINGS_KEY) || "{}");
        if (value && typeof value === "object") saved = value;
    } catch { /* defaults */ }
    const color = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    return {
        accent: color(saved.accent, DEFAULT_PERSONAL_SETTINGS.accent),
        frameDark: color(saved.frameDark, DEFAULT_PERSONAL_SETTINGS.frameDark),
        frameLight: color(saved.frameLight, DEFAULT_PERSONAL_SETTINGS.frameLight),
        pageDark: color(saved.pageDark, DEFAULT_PERSONAL_SETTINGS.pageDark),
        pageLight: color(saved.pageLight, DEFAULT_PERSONAL_SETTINGS.pageLight),
        boardDark: color(saved.boardDark, DEFAULT_PERSONAL_SETTINGS.boardDark),
        boardLight: color(saved.boardLight, DEFAULT_PERSONAL_SETTINGS.boardLight),
        outputDark: color(saved.outputDark, DEFAULT_PERSONAL_SETTINGS.outputDark),
        outputLight: color(saved.outputLight, DEFAULT_PERSONAL_SETTINGS.outputLight),
        editorFontSize: Number.isFinite(saved.editorFontSize) ? Math.max(8, Math.min(22, saved.editorFontSize!)) : 13,
        editorLineHeight: Number.isFinite(saved.editorLineHeight) ? Math.max(1, Math.min(1.9, saved.editorLineHeight!)) : 1.55,
        speed: [1, 10, 100, 1000, 10000].includes(saved.speed ?? 0) ? saved.speed! : 1,
        memoryRefreshMs: [100, 250, 500].includes(saved.memoryRefreshMs ?? 0) ? saved.memoryRefreshMs! : 250,
        stepRepeatHz: [2, 5, 10, 20, 50].includes(saved.stepRepeatHz ?? 0) ? saved.stepRepeatHz! : 10,
        reduceMotion: saved.reduceMotion === true,
    };
}

function contrastText(hex: string): string {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    const luminance = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] > 0.4 ? "#142033" : "#f4f8ff";
}

const UI_TEXT = {
    en: {
        start: "Start",
        stop: "Stop",
        reset: "Reset",
        step: "Step",
        runner: "Runner",
        oscilloscope: "Oscilloscope",
        logicCircuits: "Circuits",
        file: "File",
        openFile: "Open file",
        download: "Download",
        downloadHex: "Download HEX",
        flashTitle: "ADuC841 Flash diagnostics",
        flashHint: "The log records every UART packet. After choosing the COM port, press RESET during the reset window.",
        flashCopy: "Copy log",
        flashCopied: "Copied",
        flashCopyFailed: "Copy failed",
        flashDriver: "Driver (.ZIP)",
        flashDriverHint: "Download from Silicon Labs; extract the ZIP and run CP210xVCPInstaller_x64.exe on 64-bit Windows.",
        flashWaiting: "Waiting for a flash session…",
        memory: "Memory",
        popoutStand: "Stand ↗",
        dockBack: "Stand ↩",
        focusStandWindow: "Focus stand window",
        settings: "Settings",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        accentColor: "Accent color",
        frameColor: "Toolbar and window headers",
        pageColor: "App background",
        boardColor: "Stand area background",
        outputColor: "Output area background",
        editStand: "Arrange stand devices",
        editToolbar: "Arrange top toolbar",
        editorFontSize: "Code font size",
        editorLineHeight: "Code line spacing",
        defaultSpeed: "Simulation speed",
        memoryRefresh: "Memory refresh",
        reduceMotion: "Reduce animations",
        resetPreferences: "Reset settings and window positions",
        settingsSaved: "Changes save automatically on this device.",
        autosave: "Autosave",
        speed: "Speed",
        fileName: "File name",
        fullscreen: "Fullscreen",
        exitFullscreen: "Exit fullscreen",
        lightTheme: "Switch to light theme",
        darkTheme: "Switch to dark theme",
        close: "Close",
        runnerTitle: "Runner / registers",
        output: "Output",
        currentInstruction: "Current instruction",
        resize: "Resize",
        motor: "Motor 28BYJ-48",
        stepperMotor: "Stepper motor",
        errors: "Errors",
        language: "Interface language",
        autosaved: "autosaved",
        restored: "restored",
    },
    uk: {
        start: "Старт",
        stop: "Стоп",
        reset: "Скинути",
        step: "Крок",
        runner: "Виконання",
        oscilloscope: "Осцилограф",
        logicCircuits: "Схеми",
        file: "Файл",
        openFile: "Відкрити файл",
        download: "Завантажити",
        downloadHex: "Завантажити HEX",
        flashTitle: "Діагностика прошивки ADuC841",
        flashHint: "Журнал показує кожен пакет UART. Після вибору COM-порту натисніть RESET, поки триває очікування скидання.",
        flashCopy: "Скопіювати журнал",
        flashCopied: "Скопійовано",
        flashCopyFailed: "Не вдалося скопіювати",
        flashDriver: "Драйвер (.ZIP)",
        flashDriverHint: "Завантажте з Silicon Labs, розпакуйте ZIP і запустіть CP210xVCPInstaller_x64.exe для 64-бітної Windows.",
        flashWaiting: "Очікування запуску прошивки…",
        memory: "Пам’ять",
        popoutStand: "Стенд ↗",
        dockBack: "Стенд ↩",
        focusStandWindow: "Показати вікно стенда",
        settings: "Налаштування",
        theme: "Тема",
        light: "Світла",
        dark: "Темна",
        accentColor: "Колір акцентів",
        frameColor: "Колір панелі та заголовків вікон",
        pageColor: "Фон застосунку",
        boardColor: "Фон області стенда",
        outputColor: "Фон області виводу",
        editStand: "Розташувати пристрої стенда",
        editToolbar: "Налаштувати верхню панель",
        editorFontSize: "Розмір шрифту коду",
        editorLineHeight: "Міжряддя коду",
        defaultSpeed: "Швидкість симуляції",
        memoryRefresh: "Оновлення пам’яті",
        reduceMotion: "Менше анімацій",
        resetPreferences: "Скинути налаштування та позиції вікон",
        settingsSaved: "Зміни автоматично зберігаються на цьому пристрої.",
        autosave: "Автозбереження",
        speed: "Швидкість",
        fileName: "Назва файлу",
        fullscreen: "Повноекранний режим",
        exitFullscreen: "Вийти з повноекранного режиму",
        lightTheme: "Увімкнути світлу тему",
        darkTheme: "Увімкнути темну тему",
        close: "Закрити",
        runnerTitle: "Виконання / регістри",
        output: "Вивід",
        currentInstruction: "Поточна інструкція",
        resize: "Змінити розмір",
        motor: "Двигун 28BYJ-48",
        stepperMotor: "Кроковий двигун",
        errors: "Помилки",
        language: "Мова інтерфейсу",
        autosaved: "автозбережено",
        restored: "відновлено",
    },
} as const;

const FLASH_TRACE_LABEL_UK: Record<string, string> = {
    "Opening serial port": "Відкриття послідовного порту",
    "Waiting for board RESET": "Очікування RESET на платі",
    "UART received": "Отримано через UART",
    "UART receive stream failed": "Збій приймання UART",
    "No automatic ID received": "Автоматичний ID не отримано",
    "Interrogate Version 2 loader": "Запит до завантажувача Version 2",
    "Loader ID accepted": "ID завантажувача підтверджено",
    "Erase CODE Flash": "Стирання програмної Flash",
    "Programming image": "Запис програми",
    "Run user code at 0x0000": "Запуск програми з 0x0000",
    "Flash session completed": "Прошивку завершено",
    "Flash session failed": "Збій прошивки",
    "Serial port closed": "Послідовний порт закрито",
};

function translateFlashTraceText(text: string, language: UiLanguage): string {
    if (language === "en") return text;
    if (FLASH_TRACE_LABEL_UK[text]) return FLASH_TRACE_LABEL_UK[text];
    const write = text.match(/^Write (\d+)\/(\d+) at (0x[\dA-F]+)$/i);
    if (write) return `Запис блоку ${write[1]}/${write[2]} за адресою ${write[3]}`;
    const waiting = text.match(/^Waiting for ACK: (.+)$/);
    if (waiting) return `Очікування ACK: ${translateFlashTraceText(waiting[1], language)}`;
    const ack = text.match(/^ACK received: (.+)$/);
    if (ack) return `ACK отримано: ${translateFlashTraceText(ack[1], language)}`;
    const nak = text.match(/^NAK received: (.+)$/);
    if (nak) return `NAK отримано: ${translateFlashTraceText(nak[1], language)}`;
    if (text.startsWith("Press RESET now; listening 5 seconds")) {
        return "Натисніть RESET зараз; очікування автоматичного ID завантажувача протягом 5 секунд.";
    }
    if (text === "Trying the documented Version 2 interrogation packet next.") {
        return "Далі буде надіслано документований запит до завантажувача Version 2.";
    }
    const portSettings = text.match(/^(\d+) baud, 8N1, RTS\/DTR inactive, RX buffer (\d+) bytes$/);
    if (portSettings) return `${portSettings[1]} бод, 8N1, RTS/DTR неактивні, буфер RX ${portSettings[2]} байтів`;
    if (text.startsWith("automatic reset ID:")) return text.replace("automatic reset ID:", "автоматичний ID після RESET:").replace("checksum OK", "контрольна сума правильна");
    if (text.startsWith("interrogation response:")) return text.replace("interrogation response:", "відповідь на запит:").replace("checksum OK", "контрольна сума правильна");
    const packets = text.match(/^(\d+) bytes in (\d+) packet\(s\)\.$/);
    if (packets) return `${packets[1]} байтів у ${packets[2]} пакетах.`;
    const written = text.match(/^(\d+) bytes written and acknowledged\.$/);
    if (written) return `${written[1]} байтів записано й підтверджено.`;
    if (text === "Buffer overrun") return "Переповнення буфера (Buffer overrun)";
    if (text.startsWith("ADuC841 loader returned NAK (0x07) after: ")) {
        return text.replace("ADuC841 loader returned NAK (0x07) after: ", "Завантажувач ADuC841 повернув NAK (0x07) після: ").replace("Erase CODE Flash.", "стирання програмної Flash.");
    }
    return text;
}

const SUBTREE_TRANSLATIONS: Array<[string, string]> = [
    ["Start", "Старт"],
    ["Stop", "Стоп"],
    ["Close", "Закрити"],
    ["Oscilloscope", "Осцилограф"],
    ["Hide oscilloscope", "Сховати осцилограф"],
    ["Signal source", "Джерело сигналу"],
    ["Resize motor panel", "Змінити розмір панелі двигуна"],
    ["Peripheral write gate", "Строб запису периферії"],
    ["Motor PWM output", "Вихід PWM двигуна"],
    ["DAC0 audio output", "Аудіовихід DAC0"],
    ["7-segment select", "Вибір 7-сегментного індикатора"],
    ["LED bar select", "Вибір світлодіодної лінійки"],
    ["LED matrix select", "Вибір LED-матриці"],
    ["Joystick X voltage", "Напруга X джойстика"],
    ["Keypad read select", "Вибір читання клавіатури"],
    ["LCD select", "Вибір LCD"],
    ["Live model", "Модель наживо"],
    ["Front", "Спереду"],
    ["Back", "Ззаду"],
    ["Top", "Зверху"],
    ["Bottom", "Знизу"],
    ["Audio subsystem", "Звукова підсистема"],
    ["Microphone level", "Рівень мікрофона"],
    ["Parameters", "Параметри"],
    ["Motor parameters", "Параметри двигуна"],
    ["Audio parameters", "Параметри звуку"],
    ["Signal parameters", "Параметри сигналу"],
    ["Reverse", "Інвертувати"],
    ["Save", "Зберегти"],
    ["Ext. trigger", "Зовнішній запуск"],
    ["Time", "Час"],
    ["Channel A", "Канал A"],
    ["Channel_A", "Канал_A"],
    ["Timebase", "Розгортка"],
    ["Scale:", "Масштаб:"],
    ["X pos.(Div):", "Позиція X (под.):"],
    ["Y pos.(Div):", "Позиція Y (под.):"],
    ["Add", "Додати"],
    ["Trigger", "Запуск"],
    ["Edge:", "Фронт:"],
    ["Level:", "Рівень:"],
    ["Ext", "Зовн."],
    ["Single", "Одиночний"],
    ["Normal", "Звичайний"],
    ["Auto", "Авто"],
    ["None", "Немає"],
    ["Logic circuit editor", "Редактор логічних схем"],
    ["File", "Файл"],
    ["Edit", "Редагування"],
    ["View", "Вигляд"],
    ["Fullscreen", "Повноекранний режим"],
    ["Exit fullscreen", "Вийти з повноекранного режиму"],
    ["Wire color", "Колір дроту"],
    ["Components", "Компоненти"],
    ["Properties", "Властивості"],
    ["Close editor", "Закрити редактор"],
    ["Run or pause simulation", "Запустити або призупинити симуляцію"],
    ["Build truth table", "Побудувати таблицю істинності"],
    ["Verify test vectors", "Перевірити тестові вектори"],
    ["Create nested circuit", "Створити вкладену мікросхему"],
    ["Fit entire circuit", "Умістити всю схему"],
    ["Build a circuit", "Складіть схему"],
    ["Select a component on the toolbar and click the canvas. Connect pins with the Wire tool.", "Виберіть елемент на панелі та клацніть по полю. З'єднуйте контакти інструментом «Дріт»."],
    ["New circuit", "Нова схема"],
    ["Open JSON…", "Відкрити JSON…"],
    ["Save JSON", "Зберегти JSON"],
    ["Save in browser", "Зберегти у браузері"],
    ["Undo", "Скасувати"],
    ["Redo", "Повторити"],
    ["Copy", "Копіювати"],
    ["Cut", "Вирізати"],
    ["Paste", "Вставити"],
    ["Select all", "Виділити все"],
    ["Delete selected", "Видалити вибране"],
    ["Duplicate", "Дублювати"],
    ["Fit circuit", "Умістити схему"],
    ["Zoom 100%", "Масштаб 100%"],
    ["Show truth table", "Показати таблицю істинності"],
    ["Logic switch", "Логічний перемикач"],
    ["Button", "Кнопка"],
    ["Clock generator", "Генератор імпульсів"],
    ["Constant 0", "Константа 0"],
    ["Constant 1", "Константа 1"],
    ["4-bit DIP switch", "DIP-перемикач 4 біти"],
    ["Buffer", "Буфер"],
    ["Tri-state buffer", "Тристабільний буфер"],
    ["Multiplexer 4:1", "Мультиплексор 4:1"],
    ["Decoder 2→4", "Дешифратор 2→4"],
    ["Full adder", "Повний суматор"],
    ["D flip-flop", "D-тригер"],
    ["4-bit counter", "Лічильник 4 біти"],
    ["Logic probe", "Логічний пробник"],
    ["Seven-segment display", "Семисегментник"],
    ["HEX display", "HEX-індикатор"],
    ["ADuC841 output", "Вихід ADuC841"],
    ["ADuC841 input", "Вхід ADuC841"],
    ["Custom circuits", "Власні мікросхеми"],
    ["+ Create circuit", "+ Створити мікросхему"],
    ["Nested editable circuit", "Вкладена редагована схема"],
];

export function renderStand(params: { board: Board }): HTMLElement {
    const { board } = params;
    const cpu = new EmuBoardController(board);
    const liveAudio = new LiveAudioMonitor();
    const root = el("div", { class: "minimalShell" });
    let personalSettings = loadPersonalSettings();
    let interfaceLayout = loadInterfaceLayout();
    let uiTheme: "light" | "dark" = localStorage.getItem("st841.ui.theme") === "light" ? "light" : "dark";
    let uiLanguage: UiLanguage = localStorage.getItem(UI_LANGUAGE_KEY) === "uk" ? "uk" : "en";
    const t = <K extends keyof typeof UI_TEXT.en>(key: K): (typeof UI_TEXT)[UiLanguage][K] => UI_TEXT[uiLanguage][key];
    const tr = (english: string, ukrainian: string): string => uiLanguage === "uk" ? ukrainian : english;
    root.dataset.theme = uiTheme;
    root.dataset.language = uiLanguage;
    const popoutControls = new Map<string, HTMLButtonElement>();
    let syncPopoutState = (): void => {};
    function applyPersonalSettings(): void {
        root.style.setProperty("--user-accent", personalSettings.accent);
        root.style.setProperty("--user-accent-ink", contrastText(personalSettings.accent));
        const frame = uiTheme === "light" ? personalSettings.frameLight : personalSettings.frameDark;
        root.style.setProperty("--user-frame", frame);
        root.style.setProperty("--user-frame-ink", contrastText(frame));
        const light = uiTheme === "light";
        const page = light ? personalSettings.pageLight : personalSettings.pageDark;
        const boardColor = light ? personalSettings.boardLight : personalSettings.boardDark;
        const outputColor = light ? personalSettings.outputLight : personalSettings.outputDark;
        root.style.setProperty("--user-page", page);
        root.style.setProperty("--user-board", boardColor);
        root.style.setProperty("--user-output", outputColor);
        root.style.setProperty("--user-output-ink", contrastText(outputColor));
        root.style.setProperty("--code-font-size", `${personalSettings.editorFontSize}px`);
        root.style.setProperty("--code-line-height", String(personalSettings.editorLineHeight));
        root.style.setProperty("--code-gutter-width", `${Math.round(personalSettings.editorFontSize * 3.2)}px`);
        root.dataset.reduceMotion = personalSettings.reduceMotion ? "true" : "false";
        syncPopoutState();
    }
    const savePersonalSettings = () => {
        localStorage.setItem(PERSONAL_SETTINGS_KEY, JSON.stringify(personalSettings));
        applyPersonalSettings();
    };
    applyPersonalSettings();
    document.documentElement.style.colorScheme = uiTheme;
    document.documentElement.lang = uiLanguage === "uk" ? "uk" : "en";
    const windowCard = el("div", { class: "windowCard" });
    root.appendChild(windowCard);
    const toolbar = el("div", { class: "toolbar" });
    const runBtn = button(t("start"), "green");
    const resetBtn = button(t("reset"));
    resetBtn.title = t("reset");
    resetBtn.setAttribute("aria-label", t("reset"));
    const stepBtn = button(t("step"));
    stepBtn.title = t("step");
    stepBtn.setAttribute("aria-label", t("step"));
    runBtn.classList.add("runControl");
    resetBtn.classList.add("resetControl");
    stepBtn.classList.add("stepControl");
    const traceBtn = button(t("runner"), "runnerControl");
    traceBtn.title = t("runner");
    traceBtn.setAttribute("aria-label", t("runner"));
    const memoryBtn = button(t("memory"), "memoryControl");
    memoryBtn.title = t("memory");
    memoryBtn.setAttribute("aria-label", t("memory"));
    const popoutStandBtn = button("↗", "popoutStandControl iconOnlyBtn");
    popoutStandBtn.title = t("popoutStand");
    popoutStandBtn.setAttribute("aria-label", t("popoutStand"));
    const settingsBtn = button("⚙", "settingsControl");
    settingsBtn.title = t("settings");
    settingsBtn.setAttribute("aria-label", t("settings"));
    const oscilloscopeBtn = button(t("oscilloscope"), "scopeControl");
    oscilloscopeBtn.title = t("oscilloscope");
    oscilloscopeBtn.setAttribute("aria-label", t("oscilloscope"));
    const logicEditorBtn = button(t("logicCircuits"), "logicControl");
    logicEditorBtn.title = t("logicCircuits");
    logicEditorBtn.setAttribute("aria-label", t("logicCircuits"));
    const modeSelect = el("select", { class: "samplePicker" });
    modeSelect.append(option("asm", "ASM"), option("c", "C"));
    const fileNameInput = el("input", { class: "fileNameInput mono", value: "main", title: t("fileName") });
    const fileMenuWrap = el("div", { class: "fileMenuWrap" });
    const fileMenuBtn = button(t("file"));
    fileMenuBtn.classList.add("fileMenuBtn");
    const fileMenu = el("div", { class: "fileMenu hidden" });
    const openFileBtn = el("button", { class: "fileMenuItem", type: "button" });
    openFileBtn.textContent = t("openFile");
    const downloadFileBtn = el("button", { class: "fileMenuItem", type: "button" });
    downloadFileBtn.textContent = t("download");
    const saveAsBtn = el("button", { class: "fileMenuItem", type: "button" });
    saveAsBtn.textContent = tr("Save as…", "Зберегти як…");
    const downloadHexBtn = el("button", { class: "fileMenuItem", type: "button" });
    downloadHexBtn.textContent = t("downloadHex");
    const autosaveBtn = el("button", { class: "fileMenuItem autosaveMenuItem", type: "button" });
    autosaveBtn.textContent = t("autosave");
    const fileInput = el("input", { type: "file", accept: ".c,.h,.asm,.a51,.txt", class: "hiddenFileInput" });
    fileMenu.append(openFileBtn, downloadFileBtn, saveAsBtn, downloadHexBtn, autosaveBtn);
    fileMenuWrap.append(fileMenuBtn, fileMenu, fileInput);
    const speedGroup = el("div", { class: "speedGroup" });
    const speedSelect = el("select", { class: "speedSelect", title: t("speed") });
    for (const speed of [1, 10, 100, 1000, 10000]) {
        speedSelect.append(option(String(speed), `${speed}x`));
    }
    speedSelect.value = String(personalSettings.speed);
    speedSelect.addEventListener("change", () => setSpeed(Number(speedSelect.value)));
    speedGroup.append(speedSelect);
    const fullscreenBtn = button("⛶", "fullscreenBtn");
    fullscreenBtn.title = t("fullscreen");
    const themeBtn = button("☀", "themeBtn");
    const languageBtn = button(uiLanguage === "uk" ? "UK" : "EN", "languageBtn");
    languageBtn.title = t("language");
    languageBtn.setAttribute("aria-label", t("language"));
    const runGroup = el("div", { class: "toolbarGroup runGroup" });
    runGroup.append(runBtn, stepBtn, resetBtn);
    const projectGroup = el("div", { class: "toolbarGroup projectGroup" });
    projectGroup.append(fileNameInput, modeSelect, fileMenuWrap);
    const toolsGroup = el("div", { class: "toolbarGroup toolsGroup" });
    const moreWrap = el("div", { class: "toolbarMore" });
    const moreBtn = button(tr("More ⋯", "Ще ⋯"));
    moreBtn.setAttribute("aria-expanded", "false");
    const moreMenu = el("div", { class: "toolbarMoreMenu hidden" });
    const extraActions = el("div", { class: "toolbarExtraActions" });
    moreWrap.append(moreBtn, moreMenu);
    moreBtn.addEventListener("click", () => {
        const open = moreMenu.classList.contains("hidden");
        moreMenu.classList.toggle("hidden", !open);
        moreBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("pointerdown", (event) => {
        if (event.target instanceof Node && !moreWrap.contains(event.target)) {
            moreMenu.classList.add("hidden");
            moreBtn.setAttribute("aria-expanded", "false");
        }
    });
    const flashBtn = button("↑", "flashControl iconOnlyBtn");
    flashBtn.title = "Flash ADuC841";
    flashBtn.setAttribute("aria-label", "Flash ADuC841");
    toolsGroup.append(flashBtn, traceBtn, memoryBtn, oscilloscopeBtn, logicEditorBtn);
    toolbar.append(runGroup, toolsGroup, speedGroup, moreWrap, settingsBtn);
    const toolbarGroups = {
        run: runGroup,
        project: projectGroup,
        tools: toolsGroup,
        speed: speedGroup,
        theme: themeBtn,
        language: languageBtn,
        fullscreen: fullscreenBtn,
    } as const;
    const toolbarControls = {
        start: runBtn,
        reset: resetBtn,
        step: stepBtn,
        fileName: fileNameInput,
        languageMode: modeSelect,
        fileMenu: fileMenuWrap,
        flash: flashBtn,
        runner: traceBtn,
        memory: memoryBtn,
        oscilloscope: oscilloscopeBtn,
        circuits: logicEditorBtn,
    } as const;
    function applyToolbarLayout(): void {
        const compact = root.dataset.standPopped === "true";
        moreWrap.classList.toggle("layoutHidden", !compact);
        moreMenu.classList.add("hidden");
        moreBtn.setAttribute("aria-expanded", "false");
        if (compact) {
            extraActions.prepend(stepBtn, logicEditorBtn);
        } else {
            runGroup.insertBefore(stepBtn, resetBtn);
            toolsGroup.appendChild(logicEditorBtn);
        }
        for (const id of interfaceLayout.toolbar.order) {
            if (compact && id === "project") moreMenu.appendChild(projectGroup);
            else if (compact && (id === "theme" || id === "language" || id === "fullscreen")) extraActions.appendChild(toolbarGroups[id]);
            else toolbar.insertBefore(toolbarGroups[id], moreWrap);
        }
        moreMenu.appendChild(extraActions);
        for (const id of TOOLBAR_GROUP_IDS) toolbarGroups[id].classList.toggle("layoutHidden", !interfaceLayout.toolbar.visible[id]);
        for (const id of TOOLBAR_CONTROL_IDS) toolbarControls[id].classList.toggle("layoutHidden", !interfaceLayout.toolbar.controls[id]);
        const scale = interfaceLayout.toolbar.scale;
        toolbar.style.zoom = String(scale);
        windowCard.style.setProperty("--user-toolbar-height", `${Math.round(58 * scale)}px`);
        settingsBtn.classList.remove("layoutHidden");
    }
    applyToolbarLayout();
    syncThemeButton();
    windowCard.appendChild(toolbar);
    // Escape the toolbar's horizontal scroll clipping.
    windowCard.appendChild(fileMenu);
    const floatingWindows: HTMLElement[] = [];
    const focusFloatingWindow = (element: HTMLElement) => {
        windowCard.querySelectorAll<HTMLElement>(".floatingWindow").forEach((item) => item.style.zIndex = "70");
        element.style.zIndex = "71";
    };
    const runnerWindow = createFloatingWindow(windowCard, "runnerWindow", "st841.ui.runnerWindow", focusFloatingWindow);
    const debugModal = runnerWindow.element;
    const debugTitle = runnerWindow.title;
    debugTitle.textContent = t("runnerTitle");
    const debugClose = runnerWindow.closeButton;
    const debugHead = debugModal.querySelector(".floatingWindowHead")!;
    const runnerSettingsBtn = button("⚙", "runnerSettingsButton");
    runnerSettingsBtn.title = tr("Runner settings", "Налаштування Runner");
    debugHead.insertBefore(runnerSettingsBtn, debugClose);
    const debugBody = el("div", { class: "debugBody" });
    const runnerPreferences = el("div", { class: "runnerPreferences layoutHidden" });
    const runnerBlocks = [
        ["current", "Current instruction", "Поточна інструкція"], ["inputs", "Inputs / buses", "Ввід / шини"],
        ["cpu", "CPU registers", "Регістри CPU"], ["ports", "Ports / SFR", "Порти / SFR"],
        ["bank", "R0–R7", "R0–R7"], ["motor", "Motor", "Двигун"], ["lcd", "LCD cells", "Комірки LCD"],
        ["flow", "Execution flow", "Потік виконання"], ["trace", "Trace", "Трасування"],
    ] as const;
    let runnerHidden: string[] = [];
    try { const saved = JSON.parse(localStorage.getItem("st841.ui.runnerHidden") || "[]"); if (Array.isArray(saved)) runnerHidden = saved.filter((id) => typeof id === "string"); } catch { /* defaults */ }
    function applyRunnerPreferences(): void {
        for (const [id] of runnerBlocks) debugBody.querySelectorAll(`[data-runner-block="${id}"]`).forEach((node) => node.classList.toggle("layoutHidden", runnerHidden.includes(id)));
    }
    function renderRunnerPreferences(): void {
        runnerPreferences.innerHTML = runnerBlocks.map(([id, en, uk]) => `<label><input type="checkbox" data-runner-toggle="${id}" ${runnerHidden.includes(id) ? "" : "checked"}> ${escapeHtml(tr(en, uk))}</label>`).join("");
    }
    runnerSettingsBtn.addEventListener("click", () => { renderRunnerPreferences(); runnerPreferences.classList.toggle("layoutHidden"); });
    runnerPreferences.addEventListener("change", (event) => {
        const input = event.target as HTMLInputElement;
        const id = input.dataset.runnerToggle;
        if (!id) return;
        runnerHidden = runnerHidden.filter((item) => item !== id);
        if (!input.checked) runnerHidden.push(id);
        localStorage.setItem("st841.ui.runnerHidden", JSON.stringify(runnerHidden));
        applyRunnerPreferences();
    });
    runnerWindow.body.append(runnerPreferences, debugBody);
    const flashLogModal = el("div", { class: "debugModal flashLogModal hidden" });
    const flashLogCard = el("div", { class: "debugCard flashLogCard" });
    const flashLogHead = el("div", { class: "debugHead" });
    const flashLogTitle = el("div", { class: "debugTitle" });
    flashLogTitle.textContent = t("flashTitle");
    const flashLogActions = el("div", { class: "flashLogActions" });
    const flashDriverLink = el("a", { class: "topBtn flashDriverLink" }) as HTMLAnchorElement;
    flashDriverLink.href = "https://www.silabs.com/documents/public/software/CP210x_VCP_Windows.zip";
    flashDriverLink.target = "_blank";
    flashDriverLink.rel = "noopener noreferrer";
    flashDriverLink.download = "CP210x_VCP_Windows.zip";
    flashDriverLink.title = t("flashDriverHint");
    flashDriverLink.textContent = t("flashDriver");
    const flashLogCopy = button(t("flashCopy"));
    const flashLogClose = button("×", "windowIconButton");
    flashLogClose.title = t("close");
    flashLogClose.setAttribute("aria-label", t("close"));
    flashLogActions.append(flashDriverLink, flashLogCopy, flashLogClose);
    flashLogHead.append(flashLogTitle, flashLogActions);
    const flashLogHint = el("div", { class: "flashLogHint" });
    flashLogHint.textContent = t("flashHint");
    const flashLogBody = el("pre", { class: "flashLogBody mono" });
    flashLogCard.append(flashLogHead, flashLogHint, flashLogBody);
    flashLogModal.appendChild(flashLogCard);
    windowCard.appendChild(flashLogModal);
    const motorPanel = createMotorPanel({
        windowParent: windowCard,
        focusWindow: focusFloatingWindow,
        motor: board.extraDevices.motor,
        audio: board.extraDevices.audio,
        getScopeSignal: (source) => board.scope.getSignal(source),
        setScopeRecording: (enabled) => board.scope.setRecordingEnabled(enabled),
        setScopeSource: (source) => board.scope.setActiveSource(source),
    });
    const memoryTable = new MemoryTable(cpu, {
        tr,
        onModify: () => {
            syncDeviceBadges();
            renderDebugPanel();
            if (memoryWindow.isOpen()) memoryTable.update();
        },
    });
    const memoryWindow = createFloatingWindow(windowCard, "memoryWindow", "st841.ui.memoryWindow", focusFloatingWindow);
    const settingsWindow = createFloatingWindow(windowCard, "settingsWindow", "st841.ui.settingsWindow", focusFloatingWindow);
    const layoutWindow = createFloatingWindow(windowCard, "layoutWindow", "st841.ui.layoutWindow", focusFloatingWindow);
    const saveAsWindow = createFloatingWindow(windowCard, "saveAsWindow", "st841.ui.saveAsWindow", focusFloatingWindow);
    const saveAsForm = el("form", { class: "saveAsForm" });
    const saveAsLabel = el("label");
    const saveAsLabelText = el("span");
    const saveAsName = el("input", { type: "text", required: "", class: "saveAsName" });
    saveAsLabel.append(saveAsLabelText, saveAsName);
    const saveAsSubmit = el("button", { type: "submit", class: "topBtn" });
    saveAsForm.append(saveAsLabel, saveAsSubmit);
    saveAsWindow.body.append(saveAsForm);
    saveAsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = saveAsName.value.trim();
        if (!name) return;
        fileNameInput.value = name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\.(c|asm|a51|txt)$/i, "");
        scheduleAutosave();
        saveAsWindow.close();
        downloadFileBtn.click();
    });
    floatingWindows.push(runnerWindow.element, memoryWindow.element, settingsWindow.element, layoutWindow.element);
    let layoutMode: "stand" | "toolbar" | null = null;
    let selectedStandItem: StandItemId = "lcd";
    memoryWindow.body.appendChild(memoryTable.element);
    // Do not accumulate high-frequency scope samples until the user opens it.
    board.scope.setRecordingEnabled(false);
    windowCard.appendChild(motorPanel.element);
    const logicEditor = createLogicEditor({ board });
    windowCard.appendChild(logicEditor.element);
    const relocalizePanels = () => window.queueMicrotask(() => {
        localizeStaticSubtree(motorPanel.element, uiLanguage);
        localizeStaticSubtree(motorPanel.scopeElement, uiLanguage);
        localizeStaticSubtree(logicEditor.element, uiLanguage);
    });
    motorPanel.element.addEventListener("click", relocalizePanels);
    motorPanel.scopeElement.addEventListener("click", relocalizePanels);
    logicEditor.element.addEventListener("click", relocalizePanels);
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
    const standWindow = createFloatingWindow(windowCard, "standFloatingWindow", "st841.ui.standWindow", focusFloatingWindow);
    let standFloating = false;
    let popupReturnsFloating = false;
    standWindow.title.textContent = tr("Virtual stand", "Віртуальний стенд");
    const standReturnBtn = button("↩", "topBtn floatingWindowClose");
    standReturnBtn.title = tr("Return stand to layout", "Повернути стенд у макет");
    standReturnBtn.setAttribute("aria-label", standReturnBtn.title);
    standWindow.closeButton.before(standReturnBtn);
    standReturnBtn.addEventListener("click", dockStandInPage);
    standWindow.closeButton.addEventListener("click", dockStandInPage);
    const boardOverlays = el("div", { class: "boardOverlayMini" });
    boardSurface.appendChild(boardOverlays);
    const PENCIL_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    const POPOUT_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
    const DOCK_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v1"/></svg>`;
    const standQuickActions = el("div", { class: "standQuickActions" });
    const standEditBtn = el("button", { class: "standQuickBtn standQuickEditBtn", type: "button", title: t("editStand") }) as HTMLButtonElement;
    standEditBtn.innerHTML = PENCIL_SVG;
    standEditBtn.setAttribute("aria-label", t("editStand"));
    const standPopoutBtn = el("button", { class: "standQuickBtn standQuickPopoutBtn", type: "button", title: t("popoutStand") }) as HTMLButtonElement;
    standPopoutBtn.innerHTML = POPOUT_SVG;
    standPopoutBtn.setAttribute("aria-label", t("popoutStand"));
    const standFloatBtn = el("button", { class: "standQuickBtn", type: "button", title: tr("Float stand inside this page", "Плаваючий стенд на цій сторінці") }) as HTMLButtonElement;
    standFloatBtn.textContent = "▣";
    standFloatBtn.setAttribute("aria-label", standFloatBtn.title);
    standFloatBtn.addEventListener("click", (event) => { event.stopPropagation(); if (standFloating) dockStandInPage(); else openFloatingStand(); });
    standQuickActions.append(standEditBtn, standFloatBtn, standPopoutBtn);
    boardPane.insertBefore(standQuickActions, boardSurface);
    const updateBoardScale = () => {
        if (standFloating && boardSurface.parentElement === standWindow.body) {
            const width = Math.max(1, Math.min(standWindow.body.clientWidth - 16, (standWindow.body.clientHeight - 16) * .78));
            boardSurface.style.width = `${width}px`;
        }
        const width = boardSurface.clientWidth;
        if (width > 0) {
            // Keep the backup's 1.1 scale at 462px and scale every DOM device
            // together with the canvas when either window is resized.
            const scale = width / 420;
            boardSurface.style.setProperty("--board-scale", scale.toFixed(3));
            if (layoutMode === "stand") {
                applyStandLayout();
            }
        }
    };
    const boardResizeObserver = new ResizeObserver(() => {
        updateBoardScale();
    });
    boardResizeObserver.observe(boardSurface);
    boardResizeObserver.observe(standWindow.body);
    standEditBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (layoutMode === "stand") {
            closeLayoutEditor();
        } else {
            openLayoutEditor("stand");
        }
    });
    standPopoutBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleStandPopout();
    });
    boardSurface.addEventListener("pointerdown", () => {
        editor.blur();
    });
    const drawnDeviceIds: DrawnDeviceId[] = ["sevenSeg", "ledBar", "matrix", "lcd"];
    const scopeSourceAtPointer = (event: MouseEvent | PointerEvent): ScopeSource | null => {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
        const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
        for (const id of drawnDeviceIds) {
            const item = interfaceLayout.stand[id];
            if (!item.visible) continue;
            const meta = STAND_ITEMS[id];
            const left = item.customized ? item.x * canvas.width / 100 : meta.x * canvas.width / 100;
            const top = item.customized ? item.y * canvas.height / 100 : meta.y * canvas.height / 100;
            const scale = item.customized ? item.scale : 1;
            if (x >= left && x <= left + meta.w * scale && y >= top && y <= top + meta.h * scale) return id;
        }
        return null;
    };
    canvas.addEventListener("click", (event) => {
        if (layoutMode === "stand") return;
        const source = scopeSourceAtPointer(event);
        if (source)
            motorPanel.open(source);
    });
    canvas.addEventListener("pointermove", (event) => {
        canvas.style.cursor = layoutMode === "stand" ? "default" : scopeSourceAtPointer(event) ? "pointer" : "default";
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
    motorWrap.appendChild(caption(t("motor")));
    const motorStatus = el("div", { class: "motorPreview mono" });
    motorStatus.textContent = "0% \u2022 0 \u043e\u0431/\u0445\u0432";
    const motorHint = el("div", { class: "motorHint" });
    motorHint.textContent = t("stepperMotor");
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
    const standDomNodes: Partial<Record<StandItemId, HTMLElement>> = {
        keypad: keypadWrap,
        joystick: joystickWrap,
        motor: motorWrap,
        audio: audioWrap,
    };
    const layoutHandles = {} as Record<StandItemId, HTMLButtonElement>;
    for (const id of STAND_ITEM_IDS) {
        const handle = el("button", { class: "standLayoutHandle", type: "button" }) as HTMLButtonElement;
        handle.dataset.item = id;
        handle.setAttribute("aria-label", uiLanguage === "uk" ? STAND_ITEMS[id].uk : STAND_ITEMS[id].en);
        boardOverlays.appendChild(handle);
        layoutHandles[id] = handle;
        let moving: { pointerId: number; clientX: number; clientY: number; x: number; y: number } | null = null;
        handle.addEventListener("pointerdown", (event) => {
            if (layoutMode !== "stand" || event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            selectedStandItem = id;
            const rect = boardOverlays.getBoundingClientRect();
            const handleRect = handle.getBoundingClientRect();
            const placement = interfaceLayout.stand[id];
            const x = (handleRect.left - rect.left) / Math.max(1, rect.width) * 100;
            const y = (handleRect.top - rect.top) / Math.max(1, rect.height) * 100;
            interfaceLayout.stand[id] = clampStandPlacement(id, { ...placement, x, y, customized: true });
            moving = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
            handle.setPointerCapture(event.pointerId);
            applyStandLayout();
            renderLayoutEditor();
        });
        handle.addEventListener("pointermove", (event) => {
            if (!moving || moving.pointerId !== event.pointerId) return;
            const rect = boardOverlays.getBoundingClientRect();
            interfaceLayout.stand[id] = clampStandPlacement(id, {
                ...interfaceLayout.stand[id],
                x: moving.x + (event.clientX - moving.clientX) / Math.max(1, rect.width) * 100,
                y: moving.y + (event.clientY - moving.clientY) / Math.max(1, rect.height) * 100,
                customized: true,
            });
            applyStandLayout();
            syncStandLayoutControls();
        });
        const stop = (event: PointerEvent) => {
            if (!moving || moving.pointerId !== event.pointerId) return;
            moving = null;
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
            saveInterfaceLayout();
        };
        handle.addEventListener("pointerup", stop);
        handle.addEventListener("pointercancel", stop);
    }
    const editorBox = el("div", { class: "editorBox" });
    const editorTop = el("div", { class: "editorTopMini" });
    const modeTag = el("div", { class: "editorTag mono" });
    modeTag.textContent = "ASM";
    editorTop.append(modeTag);
    editorBox.appendChild(editorTop);
    const editorShell = el("div", { class: "editorShell" });
    const lineNumbers = el("pre", { class: "lineNumbers mono" });
    const execMarker = el("div", { class: "execMarker", title: t("currentInstruction") });
    const editorStack = el("div", { class: "editorStack" });
    const codeHighlight = el("pre", { class: "codeHighlight mono" });
    const editor = el("textarea", {
        class: "editorText spellcheck-false",
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        spellcheck: "false",
        writingsuggestions: "false",
        "data-gramm": "false",
        "data-gramm_editor": "false",
        "data-enable-grammarly": "false",
    });
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
    const editorStatusRow = el("div", { class: "editorStatusRow" });
    const outputToggle = button(t("output"), "outputToggle");
    outputToggle.className = "outputToggle";
    outputToggle.type = "button";
    editorStatusRow.append(statusStrip, outputToggle);
    editorBox.appendChild(editorStatusRow);
    editorPane.appendChild(editorBox);
    const splitHandle = el("div", { class: "splitHandle", title: t("resize") });
    splitHandle.appendChild(el("div", { class: "splitDot" }));
    windowCard.appendChild(splitHandle);
    const messagesPane = el("section", { class: "messagesPane" });
    const messagesHead = el("div", { class: "messagesHead" });
    const messagesTitle = el("div", { class: "messagesTitle" });
    messagesTitle.textContent = t("output");
    const messagesMeta = el("div", { class: "messagesMeta mono" });
    const outputClose = button("×", "outputClose");
    outputClose.className = "outputClose";
    outputClose.type = "button";
    outputClose.title = tr("Close output", "Закрити вивід");
    outputClose.setAttribute("aria-label", outputClose.title);
    messagesHead.append(messagesTitle, messagesMeta, outputClose);
    messagesPane.appendChild(messagesHead);
    const messagesBody = el("div", { class: "messagesBody" });
    messagesPane.appendChild(messagesBody);
    windowCard.appendChild(messagesPane);
    const setOutputVisible = (visible: boolean) => {
        root.dataset.outputHidden = String(!visible);
        messagesPane.style.display = visible ? "" : "none";
        splitHandle.style.display = visible ? "" : "none";
        windowCard.style.setProperty("grid-template-rows", "var(--user-toolbar-height, 58px) minmax(0, 1fr) 0 0", "important");
        outputToggle.setAttribute("aria-expanded", String(visible));
        outputToggle.hidden = visible;
        outputToggle.style.display = visible ? "none" : "";
        localStorage.setItem("st841.ui.outputHidden", String(!visible));
    };
    outputClose.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); setOutputVisible(false); });
    outputToggle.addEventListener("click", () => setOutputVisible(root.dataset.outputHidden === "true"));
    setOutputVisible(localStorage.getItem("st841.ui.outputHidden") !== "true");
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
    let currentSpeed = personalSettings.speed;
    let sourceMode: "asm" | "c" = "asm";
    let programLoaded = false;
    const flashLogEvents: Aduc841FlashTraceEvent[] = [];
    let flashCopyState: "ready" | "copied" | "failed" = "ready";
    const renderFlashLog = () => {
        const previousScrollTop = flashLogBody.scrollTop;
        const followLatest = flashLogBody.scrollHeight - previousScrollTop - flashLogBody.clientHeight < 32;
        if (!flashLogEvents.length) {
            flashLogBody.textContent = t("flashWaiting");
            return;
        }
        flashLogBody.textContent = flashLogEvents.map((event) => {
            const elapsed = `${(event.atMs / 1000).toFixed(3)}s`.padStart(9, " ");
            const kind = tr(
                event.kind.toUpperCase(),
                ({ state: "СТАН", tx: "TX", rx: "RX", error: "ПОМИЛКА" } as const)[event.kind],
            ).padEnd(7, " ");
            const bytes = event.bytes?.length ? `  ${event.bytes.map(hexByte).join(" ")}` : "";
            const detail = event.detail ? `  — ${translateFlashTraceText(event.detail, uiLanguage)}` : "";
            return `${elapsed}  ${kind}  ${translateFlashTraceText(event.label, uiLanguage)}${bytes}${detail}`;
        }).join("\n");
        flashLogBody.scrollTop = followLatest ? flashLogBody.scrollHeight : previousScrollTop;
    };
    const resetFlashLog = () => {
        flashLogEvents.length = 0;
        renderFlashLog();
    };
    const appendFlashTrace = (event: Aduc841FlashTraceEvent) => {
        flashLogEvents.push(event);
        if (flashLogEvents.length > 500) flashLogEvents.splice(0, flashLogEvents.length - 500);
        renderFlashLog();
    };
    cpu.setSpeed(speedToBatch(currentSpeed));
    let editorScrollDrag = false;
    let currentPcToLine: Array<{ pc: number; line: number }> = [];
    let lastUiUpdateTs = 0;
    let lastDebugUpdateTs = 0;
    let lastMemoryUpdateTs = 0;
    // The stand, motor and oscilloscope are visual feedback. 30 FPS is smooth
    // enough and leaves room for the 8051 emulator and the schematic editor.
    const visualFrameIntervalMs = 1000 / 30;
    let lastVisualFrameTs = performance.now() - visualFrameIntervalMs;
    let lastBoardVisualRevision = -1;
    let boardDrawnLayout: BoardDrawnLayout = {};
    function applyStandLayout(): void {
        const drawn: BoardDrawnLayout = {};
        const parentRect = boardOverlays.getBoundingClientRect();
        for (const id of STAND_ITEM_IDS) {
            const placement = interfaceLayout.stand[id];
            const meta = STAND_ITEMS[id];
            const handle = layoutHandles[id];
            handle.classList.toggle("layoutHidden", !placement.visible);
            handle.classList.toggle("selected", selectedStandItem === id);
            const node = standDomNodes[id];
            if (node) {
                node.classList.toggle("layoutHidden", !placement.visible);
                if (placement.customized) {
                    node.style.left = `${placement.x}%`;
                    node.style.top = `${placement.y}%`;
                    node.style.right = "auto";
                    node.style.bottom = "auto";
                    node.style.width = `${meta.w / 720 * 100}%`;
                    node.style.transform = `scale(${placement.scale})`;
                    node.style.transformOrigin = "top left";

                    handle.style.left = `${placement.x}%`;
                    handle.style.top = `${placement.y}%`;
                    handle.style.width = `${meta.w * placement.scale / 720 * 100}%`;
                    handle.style.height = `${meta.h * placement.scale / 720 * 100}%`;
                    if (parentRect.width > 0 && parentRect.height > 0) {
                        const nodeRect = node.getBoundingClientRect();
                        handle.style.left = `${(nodeRect.left - parentRect.left) / parentRect.width * 100}%`;
                        handle.style.top = `${(nodeRect.top - parentRect.top) / parentRect.height * 100}%`;
                        handle.style.width = `${nodeRect.width / parentRect.width * 100}%`;
                        handle.style.height = `${nodeRect.height / parentRect.height * 100}%`;
                    }
                } else {
                    for (const property of ["left", "top", "right", "bottom", "width", "transform", "transform-origin"]) {
                        node.style.removeProperty(property);
                    }
                    if (parentRect.width > 0 && parentRect.height > 0) {
                        const nodeRect = node.getBoundingClientRect();
                        const left = ((nodeRect.left - parentRect.left) / parentRect.width) * 100;
                        const top = ((nodeRect.top - parentRect.top) / parentRect.height) * 100;
                        const width = (nodeRect.width / parentRect.width) * 100;
                        const height = (nodeRect.height / parentRect.height) * 100;
                        handle.style.left = `${left.toFixed(2)}%`;
                        handle.style.top = `${top.toFixed(2)}%`;
                        handle.style.width = `${width.toFixed(2)}%`;
                        handle.style.height = `${height.toFixed(2)}%`;
                    } else {
                        handle.style.left = `${meta.x}%`;
                        handle.style.top = `${meta.y}%`;
                        handle.style.width = `${meta.w / 720 * 100}%`;
                        handle.style.height = `${meta.h / 720 * 100}%`;
                    }
                }
            } else if (id === "sevenSeg" || id === "ledBar" || id === "matrix" || id === "lcd") {
                const cx = placement.customized ? placement.x : meta.x;
                const cy = placement.customized ? placement.y : meta.y;
                handle.style.left = `${cx}%`;
                handle.style.top = `${cy}%`;
                handle.style.width = `${(meta.w * placement.scale / 720 * 100).toFixed(2)}%`;
                handle.style.height = `${(meta.h * placement.scale / 720 * 100).toFixed(2)}%`;
                if (!placement.visible || placement.customized) drawn[id] = placement;
            }
        }
        boardDrawnLayout = drawn;
        lastBoardVisualRevision = -1;
    }
    function saveInterfaceLayout(): void {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(interfaceLayout));
        applyStandLayout();
        applyToolbarLayout();
    }
    applyStandLayout();
    let debugOpen = false;
    let inputDebounce: number | null = null;
    let diagnosticLines = new Map();
    const savedFileKey = "st841.editor.autosave.v2";
    let autosaveTimer: number | null = null;
    let autosaveEnabled = localStorage.getItem("st841.editor.autosave.enabled") !== "0";
    let lastSavedSignature = "";
    let autocompleteOpen = false;
    let autocompleteIndex = 0;
    let autocompleteMatches: CodeCompletion[] = [];
    let autocompletePrefix = "";
    let autocompleteReplaceStart = 0;
  let autocompleteReplaceEnd = 0;
  let autocompleteUserSelected = false;
  editor.value = "";
  let editorHistoryCurrent: EditorSnapshot = captureEditorSnapshot();
  let editorUndoStack: EditorSnapshot[] = [];
  let editorRedoStack: EditorSnapshot[] = [];
  let editorLastInputKind = "";
  let editorLastInputAt = 0;

  function captureEditorSnapshot(): EditorSnapshot {
    return {
      value: editor.value,
      selectionStart: editor.selectionStart ?? editor.value.length,
      selectionEnd: editor.selectionEnd ?? editor.value.length,
    };
  }

  function resetEditorHistory(): void {
    editorHistoryCurrent = captureEditorSnapshot();
    editorUndoStack = [];
    editorRedoStack = [];
    editorLastInputKind = "";
    editorLastInputAt = 0;
  }

  function inputKind(event: Event): string {
    const type = (event as InputEvent).inputType || "programmatic";
    if (type.startsWith("insert") && type !== "insertFromPaste") return "insert";
    if (type.startsWith("delete")) return "delete";
    return type;
  }

  function recordEditorInput(event: Event): void {
    const next = captureEditorSnapshot();
    const previous = editorHistoryCurrent;
    if (next.value === previous.value && next.selectionStart === previous.selectionStart && next.selectionEnd === previous.selectionEnd) return;

    const kind = inputKind(event);
    const now = performance.now();
    const canGroup =
      kind === editorLastInputKind &&
      now - editorLastInputAt <= EDITOR_UNDO_GROUP_MS &&
      previous.selectionStart === previous.selectionEnd &&
      next.selectionStart === next.selectionEnd;
    if (!canGroup) {
      editorUndoStack.push(previous);
      if (editorUndoStack.length > EDITOR_HISTORY_LIMIT) editorUndoStack.shift();
    }
    editorHistoryCurrent = next;
    editorRedoStack = [];
    editorLastInputKind = kind;
    editorLastInputAt = now;
  }

  function applyEditorSnapshot(snapshot: EditorSnapshot): void {
    editor.value = snapshot.value;
    const start = Math.max(0, Math.min(snapshot.selectionStart, editor.value.length));
    const end = Math.max(start, Math.min(snapshot.selectionEnd, editor.value.length));
    editor.setSelectionRange(start, end);
    editor.focus();
    refreshEditorAfterChange();
  }

  function undoEditor(): void {
    const target = editorUndoStack.pop();
    if (!target) return;
    editorRedoStack.push(editorHistoryCurrent);
    editorHistoryCurrent = target;
    editorLastInputKind = "";
    editorLastInputAt = 0;
    closeAutocomplete();
    applyEditorSnapshot(target);
  }

  function redoEditor(): void {
    const target = editorRedoStack.pop();
    if (!target) return;
    editorUndoStack.push(editorHistoryCurrent);
    editorHistoryCurrent = target;
    editorLastInputKind = "";
    editorLastInputAt = 0;
    closeAutocomplete();
    applyEditorSnapshot(target);
  }

  function refreshEditorAfterChange(): void {
    programLoaded = false;
    updateLineNumbers();
    updateSyntaxHighlight();
    syncEditorScrollSlider();
    updateAutocomplete();
    updateAutosaveButton();
    scheduleAutosave();
    if (inputDebounce != null) window.clearTimeout(inputDebounce);
    inputDebounce = window.setTimeout(() => {
      updateSyntaxHighlight();
      compileAndRender(false);
      inputDebounce = null;
    }, 120);
  }

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
        const autosaveSetting = settingsWindow.body.querySelector<HTMLInputElement>('[data-setting="autosave"]');
        if (autosaveSetting) autosaveSetting.checked = autosaveEnabled;
        autosaveBtn.classList.remove("saved", "dirty", "disabled");
        if (!autosaveEnabled) {
            autosaveBtn.innerHTML = `<span>${escapeHtml(t("autosave"))}</span><span class="autosaveIcon off">X</span>`;
            autosaveBtn.classList.add("disabled");
            return;
        }
        if (isSaved) {
            autosaveBtn.innerHTML = `<span>${escapeHtml(t("autosave"))}</span><span class="autosaveIcon on">OK</span>`;
            autosaveBtn.classList.add("saved");
        }
        else {
            autosaveBtn.innerHTML = `<span>${escapeHtml(t("autosave"))}</span><span class="autosaveIcon off">!</span>`;
            autosaveBtn.classList.add("dirty");
        }
    }
    function autosaveEditor(showMessage = true) {
        const payload = { name: fileNameInput.value || "main", mode: sourceMode, text: editor.value, savedAt: Date.now() };
        localStorage.setItem(savedFileKey, JSON.stringify(payload));
        lastSavedSignature = currentEditorSignature();
        updateAutosaveButton();
        if (showMessage)
            messagesMeta.textContent = `${t("autosaved")} ${currentFileName()}`;
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
            resetEditorHistory();
            lastSavedSignature = currentEditorSignature();
            updateAutosaveButton();
            messagesMeta.textContent = `${t("restored")} ${currentFileName()}`;
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
        for (const node of Array.from(autocompleteMenu.querySelectorAll<HTMLElement>(".autocompleteItem"))) {
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
        for (const node of Array.from(autocompleteMenu.querySelectorAll<HTMLElement>(".autocompleteItem"))) {
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
        if (!fileMenu.classList.contains("hidden")) {
            const anchor = fileMenuBtn.getBoundingClientRect();
            const frame = windowCard.getBoundingClientRect();
            fileMenu.style.left = `${Math.max(8, Math.min(windowCard.clientWidth - fileMenu.offsetWidth - 8, anchor.left - frame.left))}px`;
            fileMenu.style.top = `${anchor.bottom - frame.top + 6}px`;
            fileMenu.style.maxHeight = `${Math.max(80, frame.bottom - anchor.bottom - 14)}px`;
            fileMenu.style.overflowY = "auto";
        }
    });
    toolbar.addEventListener("scroll", closeFileMenu);
    window.addEventListener("resize", closeFileMenu);
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
        resetEditorHistory();
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
    saveAsBtn.addEventListener("click", () => {
        closeFileMenu();
        saveAsName.value = currentFileName();
        saveAsWindow.open();
        saveAsName.focus();
        saveAsName.select();
    });
    downloadHexBtn.addEventListener("click", () => {
        closeFileMenu();
        const result = compileAndRender(false);
        if (!result.ok || !result.hex.trim()) return;
        const sourceName = currentFileName();
        const hexName = `${sourceName.replace(/\.[^.]+$/, "") || "main"}.hex`;
        const blob = new Blob([result.hex.endsWith("\n") ? result.hex : `${result.hex}\n`], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = hexName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
        messagesMeta.textContent = `downloaded ${hexName}`;
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
        if ((event.ctrlKey || event.metaKey) && key === "z") {
            event.preventDefault();
            if (event.shiftKey)
                redoEditor();
            else
                undoEditor();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && key === "y") {
            event.preventDefault();
            redoEditor();
            return;
        }
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
    editor.addEventListener("input", (event) => {
        recordEditorInput(event);
        refreshEditorAfterChange();
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
    let wheelRemainderY = 0;
    let wheelRemainderX = 0;
    const scrollEditorWithWheel = (event: WheelEvent) => {
        // Only scroll code when the actual event belongs to the editor.
        // Coordinate overlap alone also matches floating panels above it.
        if (!event.composedPath().includes(editorShell)) return;
        // Route both textarea and gutter through the same scroller. Native
        // textarea wheel chaining is unreliable after the stand is popped out.
        const rect = editorShell.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
        if (event.ctrlKey || (event.target instanceof Element && event.target.closest(".autocompleteMenu"))) return;
        event.preventDefault();
        event.stopPropagation();
        const unit = event.deltaMode === 1
            ? parseFloat(getComputedStyle(editor).lineHeight) || 20
            : event.deltaMode === 2 ? editor.clientHeight : 1;
        wheelRemainderY += event.deltaY * unit;
        wheelRemainderX += event.deltaX * unit;
        const dy = Math.trunc(wheelRemainderY), dx = Math.trunc(wheelRemainderX);
        wheelRemainderY -= dy;
        wheelRemainderX -= dx;
        editor.scrollTop += dy;
        editor.scrollLeft += dx;
        lineNumbers.scrollTop = editor.scrollTop;
        syncHighlightScroll();
        syncEditorScrollSlider();
        syncExecMarker();
    };
    document.addEventListener("wheel", scrollEditorWithWheel, { passive: false, capture: true });
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
        if (debugOpen) {
            debugOpen = false;
            cpu.setTraceEnabled(false);
            debugModal.classList.add("hidden");
            traceBtn.classList.remove("active");
            return;
        }
        debugOpen = true;
        cpu.setTraceEnabled(true);
        runnerWindow.open();
        traceBtn.classList.add("active");
        syncDeviceBadges();
        renderDebugPanel();
    });
    memoryBtn.addEventListener("click", () => {
        if (memoryWindow.isOpen()) {
            memoryWindow.close();
            memoryBtn.classList.remove("active");
        } else {
            memoryWindow.open();
            memoryTable.update();
            memoryBtn.classList.add("active");
        }
    });
    memoryWindow.closeButton.addEventListener("click", () => {
        memoryBtn.classList.remove("active");
    });
    settingsBtn.addEventListener("click", () => {
        if (settingsWindow.isOpen()) {
            settingsWindow.close();
            settingsBtn.classList.remove("active");
            return;
        }
        if (layoutMode) closeLayoutEditor();
        renderSettingsPanel();
        settingsWindow.open();
        settingsBtn.classList.add("active");
    });
    settingsWindow.closeButton.addEventListener("click", () => {
        settingsBtn.classList.remove("active");
    });
    oscilloscopeBtn.addEventListener("click", () => {
        motorPanel.openScope("general");
    });
    logicEditorBtn.addEventListener("click", () => {
        logicEditor.open();
    });
    popoutStandBtn.addEventListener("click", () => {
        toggleStandPopout();
    });
    flashBtn.addEventListener("click", async () => {
        if (!isAduc841SerialSupported()) {
            statusStrip.innerHTML = `<span class="statusErrorLabel">Web Serial is unavailable. Use Chrome or Edge on localhost/HTTPS.</span>`;
            return;
        }
        const result = compileAndRender(true);
        if (!result.ok || !result.hex.trim()) return;
        resetFlashLog();
        flashLogModal.classList.remove("hidden");
        flashBtn.disabled = true;
        flashBtn.textContent = "…";
        statusStrip.textContent = "Connect ADuC841: JP6=Programming, SW8=USB, then press RESET.";
        try {
            await flashAduc841(result.hex, {
                baudRate: 9600,
                runAfter: true,
                onProgress: (written, total) => {
                    statusStrip.textContent = `Flashing ADuC841… ${Math.round((written / Math.max(1, total)) * 100)}%`;
                },
                onTrace: (event) => {
                    appendFlashTrace(event);
                    if (event.label === "Waiting for board RESET") {
                        statusStrip.textContent = "COM port is open — press RESET on the board now.";
                    }
                },
            });
            statusStrip.textContent = "ADuC841 programmed successfully.";
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            statusStrip.innerHTML = `<span class="statusErrorLabel">Flash error: ${escapeHtml(message)}</span>`;
        }
        finally {
            flashBtn.disabled = false;
            flashBtn.textContent = "↥";
        }
    });
    fullscreenBtn.addEventListener("click", () => {
        toggleSimulatorFullscreen();
    });
    themeBtn.addEventListener("click", (event) => {
        switchUiThemeWithWave(uiTheme === "dark" ? "light" : "dark", event);
    });
    languageBtn.addEventListener("click", () => {
        setUiLanguage(uiLanguage === "uk" ? "en" : "uk");
    });
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    motorWrap.addEventListener("click", () => {
        motorPanel.open("motor");
    });
    audioWrap.addEventListener("click", () => {
        liveAudio.touch();
        motorPanel.openScope("audio");
    });
    debugClose.addEventListener("click", () => {
        debugOpen = false;
        cpu.setTraceEnabled(false);
        debugModal.classList.add("hidden");
        traceBtn.classList.remove("active");
    });
    flashLogClose.addEventListener("click", () => {
        flashLogModal.classList.add("hidden");
    });
    flashLogCopy.addEventListener("click", async () => {
        const logText = flashLogBody.textContent ?? "";
        try {
            await navigator.clipboard.writeText(logText);
            flashCopyState = "copied";
            flashLogCopy.textContent = t("flashCopied");
        }
        catch {
            flashCopyState = "failed";
            flashLogCopy.textContent = t("flashCopyFailed");
        }
        window.setTimeout(() => {
            flashCopyState = "ready";
            flashLogCopy.textContent = t("flashCopy");
        }, 1400);
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
    let stepHoldTimer: ReturnType<typeof setTimeout> | undefined;
    let stepRepeatTimer: ReturnType<typeof setInterval> | undefined;
    let stepHeld = false;
    let stepBusy = false;
    let suppressStepClick = false;
    const stopStepHold = () => {
        stepHeld = false;
        clearTimeout(stepHoldTimer);
        clearInterval(stepRepeatTimer);
    };
    async function performSingleStep(recompile = true): Promise<boolean> {
        if (stepBusy) return false;
        stepBusy = true;
        try {
        liveAudio.touch();
        if (recompile && !compileAndRender(false).ok) return false;
        if (!currentHex.trim()) {
            showMessages([], "", true);
            return false;
        }
        if (!programLoaded) {
            await cpu.loadHex(currentHex);
            programLoaded = true;
        }
        cpu.step(1);
        isRunning = false;
        syncRunButton();
        updateRuntimeBar();
        return true;
        } finally { stepBusy = false; }
    }
    stepBtn.addEventListener("click", (event) => {
        if (event.detail > 0 && suppressStepClick) { suppressStepClick = false; return; }
        void performSingleStep();
    });
    stepBtn.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        stopStepHold();
        stepHeld = true;
        suppressStepClick = true;
        stepBtn.setPointerCapture(event.pointerId);
        void performSingleStep().then((ok) => { if (!ok) stopStepHold(); });
        stepHoldTimer = setTimeout(() => {
            if (!stepHeld) return;
            stepRepeatTimer = setInterval(() => {
                if (stepHeld && !stepBusy) void performSingleStep(false).then((ok) => { if (!ok) stopStepHold(); });
            }, 1000 / personalSettings.stepRepeatHz);
        }, 350);
    });
    stepBtn.addEventListener("pointerup", stopStepHold);
    stepBtn.addEventListener("pointercancel", () => { suppressStepClick = false; stopStepHold(); });
    stepBtn.addEventListener("lostpointercapture", stopStepHold);
    window.addEventListener("blur", stopStepHold);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopStepHold(); });
    runBtn.addEventListener("click", stopStepHold);
    resetBtn.addEventListener("click", stopStepHold);
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
            ];
            const visibleDiagnostics = merged.filter((d) => d.level !== "hint");
            const summary = editor.value.trim() ? (asm.ok ? "ok" : "errors") : "";
            showMessages(visibleDiagnostics, summary, expand);
            updateRuntimeBar(asm.ok);
            return { ok: asm.ok, diagnostics: merged, hex: asm.hex, pcToLine: [] };
        }
        const asm = compileAsm(editor.value);
        const visibleDiagnostics = asm.diagnostics.filter((d) => d.level !== "hint");
        currentHex = asm.hex;
        currentPcToLine = asm.pcToLine;
        const summary = editor.value.trim() ? (asm.ok ? "ok" : "errors") : "";
        showMessages(visibleDiagnostics, summary, expand);
        updateRuntimeBar(asm.ok);
        return { ok: asm.ok, diagnostics: asm.diagnostics, hex: asm.hex, pcToLine: asm.pcToLine };
    }
    function showMessages(list: AsmDiagnostic[], summary: string, expand = false) {
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
        if (summary === "errors" || errors > 0) {
            statusStrip.innerHTML = `<span class="statusErrorLabel">${escapeHtml(t("errors"))}: ${errors}</span>`;
        }
        else {
            statusStrip.textContent = summary;
        }
    }
    function updateRuntimeBar(ok = true) {
        isRunning = cpu.isRunning();
        syncRunButton();
        syncDeviceBadges();
        renderDebugPanel();
        syncExecMarker();
    }
    function syncDeviceBadges() {
        const motor = board.extraDevices.motor?.getTelemetry?.();
        if (motor) {
            motorStatus.textContent = `${Math.round(motor.duty * 100)}% \u2022 ${Math.round(motor.currentRpm)} ${tr("rpm", "об/хв")}`;
            motorWrap.classList.toggle("active", motor.currentRpm > 0.2 || motor.active);
        }
        else {
            motorStatus.textContent = `0% \u2022 0 ${tr("rpm", "об/хв")}`;
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
        const exactBadge = exactLine ? tr("exact", "точно") : previousLine ? tr("nearest", "найближча") : tr("none", "немає");
        const statusText = cpu.isRunning() ? "RUN" : "STOP";
        const p36 = ((cpu.getSfr(SFR.p3) >> 6) & 1) === 1 ? tr("TX / write", "TX / запис") : tr("RX / read", "RX / читання");
        const psw = cpu.getSfr(SFR.psw);
        const bank = (psw >> 3) & 0x03;
        const regBase = bank * 8;
        const sp = cpu.getSfr(SFR.sp);
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
            [tr("P0 / data bus", "P0 / шина даних"), hexByte(cpu.getSfr(SFR.p0))],
            ["P1", hexByte(cpu.getSfr(SFR.p1))],
            [tr("P2 / address", "P2 / адреса"), hexByte(cpu.getSfr(SFR.p2))],
            ["P3", hexByte(cpu.getSfr(SFR.p3))],
            [tr("P3.6 mode", "P3.6 режим"), p36],
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
        const traceRows = trace.slice(-22).map((item) => {
            const current = (item.pc & 0xffff) === pc;
            const line = currentPcToLine.find((m) => (m.pc & 0xffff) === (item.pc & 0xffff));
            return `<tr class="${current ? "runnerCurrentRow" : ""}"><td>${escapeHtml(String(item.tick))}</td><td>${hexWord(item.pc)}</td><td>${hexByte(item.opcode)}</td><td>${line ? `L${line.line}` : "-"}</td><td>${hexByte(item.acc)}</td><td>${hexByte(item.p0)}</td><td>${hexByte(item.p2)}</td></tr>`;
        }).join("");
        const codeBytes = [0, 1, 2, 3].map((d) => hexByte(cpu.readCode(pc + d))).join(" ");
        const kv = (label: string, value: unknown, extra = "") => `<div class="runnerKv ${extra}"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`;
        const kvList = (items: ReadonlyArray<readonly [string, unknown]> | unknown[][]) => (items as unknown[][]).map(([label, value]) => kv(String(label), value)).join("");
        const card = (title: string, body: string, extra = "", id = "") => `<section class="runnerCard ${extra}" data-runner-block="${id}"><h3>${escapeHtml(title)}</h3>${body}</section>`;
        if (!debugBody.querySelector(".runnerPanel")) {
            debugBody.innerHTML = `
      <div class="runnerPanel">
        <section class="runnerHero" id="runnerHero" data-runner-block="current"></section>
        <div class="runnerGrid" id="runnerGrid"></div>
        <section class="runnerCard runnerTraceCard" id="runnerTraceCard" data-runner-block="trace"></section>
      </div>
    `;
        }

        const heroEl = debugBody.querySelector("#runnerHero");
        if (heroEl) {
            heroEl.innerHTML = `
          <div>
            <div class="runnerLabel">${tr("Currently executing", "Зараз виконується")}</div>
            <div class="runnerInstruction mono">${escapeHtml(decodeInstruction(cpu))}</div>
            <pre class="runnerSourceLine mono">${lineNo != null ? `L${lineNo}  ` : "L-  "}${escapeHtml(sourceLine || "-")}</pre>
          </div>
          <div class="runnerStatusBox mono">
            <span class="runnerPill ${cpu.isRunning() ? "run" : "stop"}">${statusText}</span>
            <span>PC ${hexWord(pc)}</span>
            <span>OP ${hexByte(op)}</span>
            <span>bytes ${codeBytes}</span>
            <span>${tr("line", "рядок")}: ${exactBadge}</span>
          </div>
        `;
        }

        const gridEl = debugBody.querySelector("#runnerGrid");
        if (gridEl) {
            gridEl.innerHTML = `
          ${card(tr("Input / buses", "Ввід / шини"), `
            ${kv("P3.6", p36, p36.startsWith("RX") ? "warn" : "ok")}
            ${kv(tr("Pressed", "Натиснуто"), pressedKeys || "-")}
            ${kv("Keypad col1", hexByte(keypadBus.col1))}
            ${kv("Keypad col2", hexByte(keypadBus.col2))}
            ${kv("Keypad col3", hexByte(keypadBus.col3))}
            ${kv("Joystick X", joy.x)}
            ${kv("Joystick Y", joy.y)}
          `, "", "inputs")}

          ${card(tr("CPU registers", "Регістри CPU"), kvList(coreRegs) + `<div class="runnerSub mono">${tr("Bank", "Банк")} ${bank} · ${tr("SP is an address, not used depth", "SP — це адреса, а не зайнята глибина")}</div>`, "", "cpu")}

          ${card(tr("Ports / SFR", "Порти / SFR"), kvList(ports) + `<hr class="runnerHr"/>` + kvList(sfrs), "", "ports")}

          ${card(tr("R0-R7 of active bank", "R0-R7 активного банку"), kvList(regsR), "", "bank")}

          ${card(tr("Motor", "Двигун"), kvList([
            [tr("active", "активний"), motor ? String(motor.active) : "-"],
            [tr("duty", "заповнення"), motor ? `${Math.round(motor.duty * 100)}%` : "-"],
            [tr("frequency", "частота"), motor ? `${motor.frequencyHz.toFixed(1)} Hz` : "-"],
            [tr("current rpm", "поточні об/хв"), motor ? motor.currentRpm.toFixed(1) : "-"],
            [tr("target rpm", "цільові об/хв"), motor ? motor.targetRpm.toFixed(1) : "-"],
            [tr("source", "джерело"), motor ? motor.sourceLabel : "-"],
        ]), "", "motor")}

          ${card(tr("LCD cells", "Комірки LCD"), `<pre class="runnerPre mono">${escapeHtml(lcdRows.join("\n") || "-")}</pre>`, "runnerLcdCard", "lcd")}

          ${card(tr("Execution flow", "Потік виконання"), `
            ${kv(tr("current PC", "поточний PC"), hexWord(pc))}
            ${kv(tr("ASM line", "рядок ASM"), lineNo != null ? `L${lineNo}` : "-")}
            ${kv(tr("last known", "останній відомий"), flow.lastKnown)}
            ${kv(tr("last CALL/RET", "останній CALL/RET"), flow.lastCallRet)}
            ${kv(tr("same-PC streak", "повторів PC"), flow.streak)}
            ${kv(tr("recent PCs", "останні PC"), flow.recent)}
          `, "wide", "flow")}
        `;
        }

        const traceEl = debugBody.querySelector("#runnerTraceCard");
        applyRunnerPreferences();
        if (traceEl) {
            traceEl.innerHTML = `
          <h3>${tr("Trace - latest instructions", "Трасування — останні інструкції")}</h3>
          <table class="runnerTrace mono">
            <thead><tr><th>tick</th><th>PC</th><th>OP</th><th>ASM</th><th>ACC</th><th>P0</th><th>P2</th></tr></thead>
            <tbody>${traceRows || `<tr><td colspan="7">-</td></tr>`}</tbody>
          </table>
        `;
        }
    }
    function syncRunButton() {
        runBtn.textContent = isRunning ? t("stop") : t("start");
        runBtn.className = `topBtn runControl ${isRunning ? "red" : "green"}`;
        const popRun = popoutControls.get("run");
        if (popRun) {
            popRun.textContent = runBtn.textContent;
            popRun.className = runBtn.className;
        }
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
        fullscreenBtn.title = active ? t("exitFullscreen") : t("fullscreen");
        fullscreenBtn.setAttribute("aria-label", fullscreenBtn.title);
        fullscreenBtn.classList.toggle("active", active);
    }
    let standPopoutWindow: Window | null = null;
    function openFloatingStand(): void {
        if (standPopoutWindow && !standPopoutWindow.closed) { popupReturnsFloating = false; dockStandBack(); }
        standFloating = true;
        root.dataset.standPopped = "true";
        boardPane.style.display = "none";
        mainRow.style.gridTemplateColumns = "1fr";
        standWindow.body.appendChild(boardSurface);
        standReturnBtn.before(standQuickActions);
        standWindow.open();
        updateBoardScale();
        syncPopoutButtons();
    }
    function dockStandInPage(): void {
        standFloating = false;
        standWindow.close();
        boardSurface.style.removeProperty("width");
        boardPane.appendChild(boardSurface);
        boardPane.insertBefore(standQuickActions, boardSurface);
        delete root.dataset.standPopped;
        boardPane.style.removeProperty("display");
        mainRow.style.removeProperty("grid-template-columns");
        updateBoardScale();
        syncPopoutButtons();
    }
    function syncPopoutButtons(): void {
        const isPopped = Boolean(standPopoutWindow && !standPopoutWindow.closed);
        applyToolbarLayout();
        popoutStandBtn.textContent = isPopped ? "↩" : "↗";
        popoutStandBtn.title = t(isPopped ? "dockBack" : "popoutStand");
        popoutStandBtn.setAttribute("aria-label", popoutStandBtn.title);
        popoutStandBtn.classList.toggle("active", isPopped);
        standPopoutBtn.textContent = isPopped ? "↩" : "↗";
        standPopoutBtn.title = t(isPopped ? "dockBack" : "popoutStand");
        standPopoutBtn.setAttribute("aria-label", standPopoutBtn.title);
        const dockBtn = popoutControls.get("dock");
        if (dockBtn) {
            dockBtn.title = t("dockBack");
            dockBtn.setAttribute("aria-label", dockBtn.title);
        }
    }
    syncPopoutState = function(): void {
        if (!standPopoutWindow || standPopoutWindow.closed) return;
        try {
            const popDoc = standPopoutWindow.document;
            for (const [id, original] of [["reset", resetBtn], ["runner", traceBtn], ["memory", memoryBtn], ["scope", oscilloscopeBtn], ["flash", flashBtn]] as const) {
                const control = popoutControls.get(id);
                if (control) {
                    control.textContent = original.textContent;
                    control.title = original.title || original.textContent || "";
                }
            }
            popDoc.documentElement.style.colorScheme = uiTheme;
            popDoc.documentElement.lang = uiLanguage === "uk" ? "uk" : "en";
            popDoc.body.dataset.theme = uiTheme;
            popDoc.body.dataset.language = uiLanguage;
            if (layoutMode) popDoc.body.dataset.layoutEdit = layoutMode;
            else delete popDoc.body.dataset.layoutEdit;
            const rootStyle = window.getComputedStyle(root);
            for (const prop of ["--user-accent", "--user-accent-ink", "--user-frame", "--user-frame-ink", "--user-page", "--user-board", "--user-output", "--user-output-ink"]) {
                popDoc.documentElement.style.setProperty(prop, rootStyle.getPropertyValue(prop));
            }
        } catch { /* ignore cross-origin or closed */ }
    }
    function toggleStandPopout(): void {
        if (standPopoutWindow && !standPopoutWindow.closed) {
            dockStandBack();
        } else {
            openStandPopout();
        }
    }
    function openStandPopout(): void {
        if (standPopoutWindow && !standPopoutWindow.closed) {
            standPopoutWindow.focus();
            return;
        }
        try {
            const popupWidth = Math.max(320, Math.round(window.screen.availWidth * 0.30));
            const popupHeight = Math.max(360, window.screen.availHeight - 60);
            standPopoutWindow = window.open("", "st841_stand_window", `width=${popupWidth},height=${popupHeight},menubar=no,toolbar=no,location=no,status=no,resizable=yes`);
        } catch {
            standPopoutWindow = null;
        }
        if (!standPopoutWindow) {
            statusStrip.innerHTML = `<span class="statusErrorLabel">${tr("Popup window was blocked by browser. Please allow popups.", "Спливаюче вікно заблоковано браузером. Дозвольте спливаючі вікна.")}</span>`;
            return;
        }
        root.dataset.standPopped = "true";
        popupReturnsFloating = standFloating;
        standFloating = false;
        standWindow.close();
        boardSurface.style.removeProperty("width");
        boardPane.style.display = "none";
        mainRow.style.gridTemplateColumns = "1fr";
        splitHandle.style.display = "";
        const popDoc = standPopoutWindow.document;
        popDoc.open();
        popDoc.write(`<!DOCTYPE html>
<html lang="${uiLanguage === "uk" ? "uk" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${document.baseURI}">
  <title>${tr("ADuC841 Virtual Stand", "Віртуальний стенд ADuC841")}</title>
</head>
<body class="standPopoutBody minimalShell" data-theme="${uiTheme}" data-language="${uiLanguage}">
</body>
</html>`);
        popDoc.close();
        for (const node of Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))) {
            if (node instanceof HTMLLinkElement) {
                const link = popDoc.createElement("link");
                link.rel = "stylesheet";
                link.href = node.href;
                popDoc.head.appendChild(link);
            } else {
                popDoc.head.appendChild(node.cloneNode(true));
            }
        }
        popDoc.documentElement.style.colorScheme = uiTheme;
        const rootStyle = window.getComputedStyle(root);
        for (const prop of ["--user-accent", "--user-accent-ink", "--user-frame", "--user-frame-ink", "--user-page", "--user-board", "--user-output", "--user-output-ink"]) {
            popDoc.documentElement.style.setProperty(prop, rootStyle.getPropertyValue(prop));
        }
        const popBar = popDoc.createElement("header");
        popBar.className = "popoutStandBar";
        const popActions = popDoc.createElement("div");
        popActions.className = "popoutStandActions";
        const popDockBtn = popDoc.createElement("button");
        popDockBtn.className = "topBtn blue";
        popDockBtn.textContent = "↩";
        popDockBtn.title = t("dockBack");
        popDockBtn.setAttribute("aria-label", popDockBtn.title);
        popoutControls.set("dock", popDockBtn);
        popDockBtn.addEventListener("click", () => dockStandBack());
        for (const [id, original] of [
            ["run", runBtn], ["reset", resetBtn], ["runner", traceBtn],
            ["memory", memoryBtn], ["scope", oscilloscopeBtn], ["flash", flashBtn],
        ] as const) {
            const control = popDoc.createElement("button");
            control.className = original.className;
            control.textContent = original.textContent;
            control.title = original.title || original.textContent || "";
            control.addEventListener("click", () => {
                if (id !== "run" && id !== "reset") window.focus();
                original.click();
            });
            popoutControls.set(id, control);
            popActions.appendChild(control);
        }
        popActions.append(popDockBtn);
        popBar.append(popActions);
        popActions.prepend(standQuickActions);
        const popStage = popDoc.createElement("main");
        popStage.className = "standPopoutStage";
        popDoc.body.append(popBar, popStage);
        popStage.appendChild(boardSurface);
        updateBoardScale();
        standPopoutWindow.addEventListener("beforeunload", () => dockStandBack());
        const pollClosedInterval = window.setInterval(() => {
            if (!standPopoutWindow || standPopoutWindow.closed) {
                window.clearInterval(pollClosedInterval);
                dockStandBack();
            }
        }, 800);
        syncPopoutButtons();
        syncPopoutState();
    }
    function dockStandBack(): void {
        if (!standPopoutWindow) return;
        const popWindow = standPopoutWindow;
        const restoreFloating = popupReturnsFloating;
        popupReturnsFloating = false;
        standPopoutWindow = null;
        popoutControls.clear();
        delete root.dataset.standPopped;
        boardPane.style.removeProperty("display");
        mainRow.style.removeProperty("grid-template-columns");
        splitHandle.style.removeProperty("display");
        if (boardSurface.parentElement !== boardPane) {
            boardPane.appendChild(boardSurface);
        }
        boardPane.insertBefore(standQuickActions, boardSurface);
        updateBoardScale();
        if (popWindow && !popWindow.closed) {
            try {
                popWindow.close();
            } catch { /* ignore */ }
        }
        syncPopoutButtons();
        if (restoreFloating) openFloatingStand();
    }
    window.addEventListener("beforeunload", () => {
        if (standPopoutWindow && !standPopoutWindow.closed) {
            standPopoutWindow.close();
        }
    });
    function setUiTheme(theme: "light" | "dark") {
        uiTheme = theme === "light" ? "light" : "dark";
        root.dataset.theme = uiTheme;
        applyPersonalSettings();
        document.documentElement.style.colorScheme = uiTheme;
        localStorage.setItem("st841.ui.theme", uiTheme);
        lastBoardVisualRevision = -1;
        syncThemeButton();
        syncPopoutState();
        renderSettingsPanel();
    }
    function switchUiThemeWithWave(theme: "light" | "dark", event: MouseEvent) {
        const nextTheme = theme === "light" ? "light" : "dark";
        const transitionDocument = document as ThemeTransitionDocument;
        const reducedMotion = personalSettings.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const buttonRect = themeBtn.getBoundingClientRect();
        const x = event.clientX || buttonRect.left + buttonRect.width / 2;
        const y = event.clientY || buttonRect.top + buttonRect.height / 2;
        const radius = Math.ceil(Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
        ));

        if (!transitionDocument.startViewTransition || reducedMotion) {
            if (!reducedMotion) playThemeRipple(nextTheme, x, y, radius);
            setUiTheme(nextTheme);
            return;
        }

        const documentRoot = document.documentElement;
        documentRoot.style.setProperty("--theme-reveal-x", `${x}px`);
        documentRoot.style.setProperty("--theme-reveal-y", `${y}px`);
        documentRoot.style.setProperty("--theme-reveal-radius", `${radius}px`);
        documentRoot.dataset.themeReveal = nextTheme;
        themeBtn.disabled = true;

        const transition = transitionDocument.startViewTransition(() => setUiTheme(nextTheme));
        void transition.finished.catch(() => undefined).finally(() => {
            delete documentRoot.dataset.themeReveal;
            themeBtn.disabled = false;
        });
    }
    function playThemeRipple(theme: "light" | "dark", x: number, y: number, radius: number) {
        const ripple = document.createElement("span");
        ripple.className = `themeRipple ${theme}`;
        ripple.style.setProperty("--theme-ripple-x", `${x}px`);
        ripple.style.setProperty("--theme-ripple-y", `${y}px`);
        ripple.style.setProperty("--theme-ripple-size", `${radius * 2}px`);
        root.appendChild(ripple);
        requestAnimationFrame(() => ripple.classList.add("is-running"));
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    }
    function syncThemeButton() {
        const light = uiTheme === "light";
        themeBtn.textContent = light ? "☾" : "☀";
        themeBtn.title = light ? t("darkTheme") : t("lightTheme");
        themeBtn.setAttribute("aria-label", themeBtn.title);
        themeBtn.classList.toggle("active", light);
    }
    function renderSettingsPanel() {
        const body = settingsWindow.body;
        body.innerHTML = `
          <div class="personalSettings">
            <p class="settingsHelp">${t("settingsSaved")}</p>
            <label class="settingsField"><span>${t("theme")}</span><select data-setting="theme"><option value="dark">${t("dark")}</option><option value="light">${t("light")}</option></select></label>
            <label class="settingsField"><span>${t("language")}</span><select data-setting="language"><option value="uk">Українська</option><option value="en">English</option></select></label>
            <label class="settingsField"><span>${t("accentColor")}</span><input type="color" data-setting="accent" /></label>
            <label class="settingsField"><span>${t("frameColor")}</span><input type="color" data-setting="frame" /></label>
            <label class="settingsField"><span>${t("pageColor")}</span><input type="color" data-setting="page" /></label>
            <label class="settingsField"><span>${t("boardColor")}</span><input type="color" data-setting="board" /></label>
            <label class="settingsField"><span>${t("outputColor")}</span><input type="color" data-setting="output" /></label>
            <label class="settingsField"><span>${t("editorFontSize")} <output data-value="font"></output></span><input type="range" min="8" max="22" step="1" data-setting="font" /></label>
            <label class="settingsField"><span>${t("editorLineHeight")} <output data-value="line"></output></span><input type="range" min="1" max="1.9" step="0.05" data-setting="line" /></label>
            <label class="settingsField"><span>${t("defaultSpeed")}</span><select data-setting="speed">${[1, 10, 100, 1000, 10000].map((speed) => `<option value="${speed}">×${speed}</option>`).join("")}</select></label>
            <label class="settingsField"><span>${t("memoryRefresh")}</span><select data-setting="refresh"><option value="100">100 ms</option><option value="250">250 ms</option><option value="500">500 ms</option></select></label>
            <label class="settingsField"><span>${tr("Hold Step: steps per second", "Утримання Step: кроків за секунду")}</span><select data-setting="stepRepeat">${[2, 5, 10, 20, 50].map((hz) => `<option value="${hz}">${hz}</option>`).join("")}</select></label>
            <label class="settingsCheck"><input type="checkbox" data-setting="autosave" /><span>${t("autosave")}</span></label>
            <label class="settingsCheck"><input type="checkbox" data-setting="motion" /><span>${t("reduceMotion")}</span></label>
            <div class="settingsLayoutActions">
              <button type="button" data-layout-open="stand">${t("editStand")}</button>
              <button type="button" data-layout-open="toolbar">${t("editToolbar")}</button>
            </div>
            <div class="settingsLayoutActions">
              <button type="button" data-panel-open="runner">${t("runnerTitle")}</button>
              <button type="button" data-panel-open="runner-settings">${tr("Runner settings", "Налаштування Runner")}</button>
              <button type="button" data-panel-open="memory">${t("memory")}</button>
              <button type="button" data-panel-open="scope">${t("oscilloscope")}</button>
              <button type="button" data-panel-open="motor">${tr("Motor panel", "Панель двигуна")}</button>
              <button type="button" data-panel-open="stand">${tr("Floating stand", "Плаваючий стенд")}</button>
              <button type="button" data-panel-open="reset">${tr("Reset panel positions and sizes", "Скинути розташування та розміри панелей")}</button>
            </div>
            <button type="button" class="settingsReset">${t("resetPreferences")}</button>
          </div>
        `;
        const select = (name: string) => body.querySelector<HTMLSelectElement>(`[data-setting="${name}"]`)!;
        const color = (name: string) => body.querySelector<HTMLInputElement>(`[data-setting="${name}"]`)!;
        select("theme").value = uiTheme;
        select("language").value = uiLanguage;
        color("accent").value = personalSettings.accent;
        color("frame").value = uiTheme === "light" ? personalSettings.frameLight : personalSettings.frameDark;
        color("page").value = uiTheme === "light" ? personalSettings.pageLight : personalSettings.pageDark;
        color("board").value = uiTheme === "light" ? personalSettings.boardLight : personalSettings.boardDark;
        color("output").value = uiTheme === "light" ? personalSettings.outputLight : personalSettings.outputDark;
        color("font").value = String(personalSettings.editorFontSize);
        color("line").value = String(personalSettings.editorLineHeight);
        body.querySelector<HTMLOutputElement>('[data-value="font"]')!.textContent = `${personalSettings.editorFontSize}px`;
        body.querySelector<HTMLOutputElement>('[data-value="line"]')!.textContent = personalSettings.editorLineHeight.toFixed(2);
        select("speed").value = String(currentSpeed);
        select("refresh").value = String(personalSettings.memoryRefreshMs);
        select("stepRepeat").value = String(personalSettings.stepRepeatHz);
        color("autosave").checked = autosaveEnabled;
        color("motion").checked = personalSettings.reduceMotion;

        select("theme").addEventListener("change", () => setUiTheme(select("theme").value === "light" ? "light" : "dark"));
        select("language").addEventListener("change", () => setUiLanguage(select("language").value === "uk" ? "uk" : "en"));
        color("accent").addEventListener("input", () => { personalSettings.accent = color("accent").value; savePersonalSettings(); });
        color("frame").addEventListener("input", () => {
            if (uiTheme === "light") personalSettings.frameLight = color("frame").value;
            else personalSettings.frameDark = color("frame").value;
            savePersonalSettings();
        });
        color("page").addEventListener("input", () => {
            if (uiTheme === "light") personalSettings.pageLight = color("page").value;
            else personalSettings.pageDark = color("page").value;
            savePersonalSettings();
        });
        color("board").addEventListener("input", () => {
            if (uiTheme === "light") personalSettings.boardLight = color("board").value;
            else personalSettings.boardDark = color("board").value;
            savePersonalSettings();
        });
        color("output").addEventListener("input", () => {
            if (uiTheme === "light") personalSettings.outputLight = color("output").value;
            else personalSettings.outputDark = color("output").value;
            savePersonalSettings();
        });
        color("font").addEventListener("input", () => {
            personalSettings.editorFontSize = Number(color("font").value);
            body.querySelector<HTMLOutputElement>('[data-value="font"]')!.textContent = `${personalSettings.editorFontSize}px`;
            savePersonalSettings();
            syncExecMarker();
            syncEditorScrollSlider();
        });
        color("line").addEventListener("input", () => {
            personalSettings.editorLineHeight = Number(color("line").value);
            body.querySelector<HTMLOutputElement>('[data-value="line"]')!.textContent = personalSettings.editorLineHeight.toFixed(2);
            savePersonalSettings();
            syncExecMarker();
            syncEditorScrollSlider();
        });
        select("speed").addEventListener("change", () => setSpeed(Number(select("speed").value)));
        select("refresh").addEventListener("change", () => { personalSettings.memoryRefreshMs = Number(select("refresh").value); savePersonalSettings(); });
        select("stepRepeat").addEventListener("change", () => { stopStepHold(); personalSettings.stepRepeatHz = Number(select("stepRepeat").value); savePersonalSettings(); });
        color("autosave").addEventListener("change", () => {
            autosaveEnabled = color("autosave").checked;
            localStorage.setItem("st841.editor.autosave.enabled", autosaveEnabled ? "1" : "0");
            updateAutosaveButton();
            if (autosaveEnabled) autosaveEditor();
        });
        color("motion").addEventListener("change", () => { personalSettings.reduceMotion = color("motion").checked; savePersonalSettings(); });
        body.querySelector<HTMLButtonElement>('[data-layout-open="stand"]')!.addEventListener("click", () => openLayoutEditor("stand"));
        body.querySelector<HTMLButtonElement>('[data-layout-open="toolbar"]')!.addEventListener("click", () => openLayoutEditor("toolbar"));
        body.querySelectorAll<HTMLButtonElement>("[data-panel-open]").forEach((button) => button.addEventListener("click", () => {
            const panel = button.dataset.panelOpen;
            settingsWindow.close();
            if (panel === "runner" || panel === "runner-settings") {
                traceBtn.click();
                if (!runnerWindow.isOpen()) traceBtn.click();
                if (panel === "runner-settings") { renderRunnerPreferences(); runnerPreferences.classList.remove("layoutHidden"); }
            } else if (panel === "memory") { memoryWindow.open(); memoryBtn.classList.add("active"); }
            else if (panel === "scope") motorPanel.openScope("general");
            else if (panel === "motor") motorPanel.open("motor");
            else if (panel === "stand") openFloatingStand();
            else if (panel === "reset") {
                [runnerWindow, memoryWindow, settingsWindow, layoutWindow, saveAsWindow, standWindow].forEach((panel) => panel.resetPosition());
                motorPanel.resetWindows();
                settingsWindow.open();
            }
        }));
        body.querySelector<HTMLButtonElement>(".settingsReset")!.addEventListener("click", () => {
            personalSettings = { ...DEFAULT_PERSONAL_SETTINGS };
            interfaceLayout = defaultInterfaceLayout();
            saveInterfaceLayout();
            savePersonalSettings();
            setSpeed(personalSettings.speed);
            autosaveEnabled = true;
            localStorage.setItem("st841.editor.autosave.enabled", "1");
            updateAutosaveButton();
            memoryWindow.resetPosition();
            runnerWindow.resetPosition();
            motorPanel.resetWindows();
            settingsWindow.resetPosition();
            layoutWindow.resetPosition();
            setUiTheme("dark");
            setUiLanguage("en");
        });
    }
    function openLayoutEditor(mode: "stand" | "toolbar"): void {
        layoutMode = mode;
        root.dataset.layoutEdit = mode;
        settingsWindow.close();
        memoryWindow.close();
        standEditBtn.classList.toggle("active", mode === "stand");
        applyStandLayout();
        syncPopoutState();
        renderLayoutEditor();
        layoutWindow.open();
        if (!localStorage.getItem("st841.ui.layoutWindow")) {
            layoutWindow.element.style.left = `${Math.max(8, windowCard.clientWidth - layoutWindow.element.offsetWidth - 12)}px`;
            layoutWindow.element.style.top = "68px";
        }
    }
    function closeLayoutEditor(): void {
        layoutMode = null;
        delete root.dataset.layoutEdit;
        standEditBtn.classList.remove("active");
        syncPopoutState();
        layoutWindow.close();
    }
    layoutWindow.closeButton.addEventListener("click", closeLayoutEditor);
    function syncStandLayoutControls(): void {
        if (layoutMode !== "stand") return;
        const body = layoutWindow.body;
        const placement = interfaceLayout.stand[selectedStandItem];
        for (const name of ["x", "y", "scale"] as const) {
            const slider = body.querySelector<HTMLInputElement>(`[data-stand-value="${name}"]`);
            const output = body.querySelector<HTMLOutputElement>(`[data-stand-output="${name}"]`);
            if (slider) slider.value = String(name === "scale" ? Math.round(placement.scale * 100) : Math.round(placement[name]));
            if (output) output.textContent = `${name === "scale" ? Math.round(placement.scale * 100) : Math.round(placement[name])}%`;
        }
        for (const id of STAND_ITEM_IDS) {
            const checkbox = body.querySelector<HTMLInputElement>(`[data-stand-visible="${id}"]`);
            if (checkbox) checkbox.checked = interfaceLayout.stand[id].visible;
            body.querySelector(`[data-stand-select="${id}"]`)?.classList.toggle("selected", selectedStandItem === id);
        }
    }
    function renderLayoutEditor(): void {
        if (!layoutMode) return;
        const body = layoutWindow.body;
        const oldScrollTop = body.scrollTop;
        layoutWindow.title.textContent = layoutMode === "stand" ? t("editStand") : t("editToolbar");
        if (layoutMode === "stand") {
            const rows = STAND_ITEM_IDS.map((id) => `
              <div class="layoutItemRow">
                <button type="button" data-stand-select="${id}">${uiLanguage === "uk" ? STAND_ITEMS[id].uk : STAND_ITEMS[id].en}</button>
                <label title="${tr("Show on stand", "Показувати на стенді")}"><input type="checkbox" data-stand-visible="${id}" /> ${tr("Show", "Показати")}</label>
              </div>
            `).join("");
            body.innerHTML = `
              <div class="layoutEditor">
                <p class="settingsHelp">${tr("Drag a device directly on the stand, or use the precise controls below. Hidden devices continue working in the simulation.", "Перетягуйте сам пристрій на стенді або змінюйте точні значення нижче. Приховані пристрої продовжують працювати в симуляції.")}</p>
                <div class="layoutItemList">${rows}</div>
                <div class="layoutPositionControls">
                  <strong>${uiLanguage === "uk" ? STAND_ITEMS[selectedStandItem].uk : STAND_ITEMS[selectedStandItem].en}</strong>
                  <label>X <output data-stand-output="x"></output><input type="range" min="0" max="100" step="1" data-stand-value="x" /></label>
                  <label>Y <output data-stand-output="y"></output><input type="range" min="0" max="100" step="1" data-stand-value="y" /></label>
                  <label>${tr("Size", "Розмір")} <output data-stand-output="scale"></output><input type="range" min="50" max="180" step="5" data-stand-value="scale" /></label>
                  <button type="button" data-layout-reset-item>${tr("Reset selected device", "Скинути вибраний пристрій")}</button>
                </div>
                <div class="layoutFooter">
                  <button type="button" data-layout-reset-all>${tr("Restore all devices", "Повернути всі пристрої")}</button>
                  <button type="button" data-layout-done>${tr("Done", "Готово")}</button>
                </div>
              </div>`;
            for (const id of STAND_ITEM_IDS) {
                body.querySelector<HTMLButtonElement>(`[data-stand-select="${id}"]`)!.addEventListener("click", () => {
                    selectedStandItem = id;
                    applyStandLayout();
                    renderLayoutEditor();
                });
                body.querySelector<HTMLInputElement>(`[data-stand-visible="${id}"]`)!.addEventListener("change", (event) => {
                    interfaceLayout.stand[id].visible = (event.currentTarget as HTMLInputElement).checked;
                    saveInterfaceLayout();
                    syncStandLayoutControls();
                });
            }
            for (const name of ["x", "y", "scale"] as const) {
                body.querySelector<HTMLInputElement>(`[data-stand-value="${name}"]`)!.addEventListener("input", (event) => {
                    const value = Number((event.currentTarget as HTMLInputElement).value);
                    const placement = interfaceLayout.stand[selectedStandItem];
                    interfaceLayout.stand[selectedStandItem] = clampStandPlacement(selectedStandItem, {
                        ...placement,
                        [name]: name === "scale" ? value / 100 : value,
                        customized: true,
                    });
                    saveInterfaceLayout();
                    syncStandLayoutControls();
                });
            }
            body.querySelector<HTMLButtonElement>("[data-layout-reset-item]")!.addEventListener("click", () => {
                interfaceLayout.stand[selectedStandItem] = defaultInterfaceLayout().stand[selectedStandItem];
                saveInterfaceLayout();
                renderLayoutEditor();
            });
            body.querySelector<HTMLButtonElement>("[data-layout-reset-all]")!.addEventListener("click", () => {
                interfaceLayout.stand = defaultInterfaceLayout().stand;
                saveInterfaceLayout();
                renderLayoutEditor();
            });
            syncStandLayoutControls();
        } else {
            const groups = interfaceLayout.toolbar.order.map((id, index) => `
              <div class="layoutItemRow">
                <label><input type="checkbox" data-toolbar-visible="${id}" ${interfaceLayout.toolbar.visible[id] ? "checked" : ""} /> ${uiLanguage === "uk" ? TOOLBAR_GROUPS[id].uk : TOOLBAR_GROUPS[id].en}</label>
                <div class="layoutOrderButtons">
                  <button type="button" data-toolbar-move="${id}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="${tr("Move left", "Пересунути ліворуч")}">←</button>
                  <button type="button" data-toolbar-move="${id}" data-direction="1" ${index === interfaceLayout.toolbar.order.length - 1 ? "disabled" : ""} aria-label="${tr("Move right", "Пересунути праворуч")}">→</button>
                </div>
              </div>
            `).join("");
            const controls = TOOLBAR_CONTROL_IDS.map((id) => `
              <label class="settingsCheck"><input type="checkbox" data-toolbar-control="${id}" ${interfaceLayout.toolbar.controls[id] ? "checked" : ""} /><span>${uiLanguage === "uk" ? TOOLBAR_CONTROLS[id].uk : TOOLBAR_CONTROLS[id].en}</span></label>
            `).join("");
            body.innerHTML = `
              <div class="layoutEditor">
                <p class="settingsHelp">${tr("Reorder groups with arrows. Uncheck buttons to hide them; the settings button always stays visible so you can restore them.", "Стрілками міняйте порядок груп. Галочкою ховайте кнопки; кнопка налаштувань завжди залишається, щоб їх повернути.")}</p>
                <div class="layoutSectionTitle">${tr("Toolbar groups", "Групи панелі")}</div>
                <div class="layoutItemList">${groups}</div>
                <label class="settingsField"><span>${tr("Toolbar size", "Розмір панелі")} <output data-toolbar-size>${Math.round(interfaceLayout.toolbar.scale * 100)}%</output></span><input type="range" min="80" max="125" step="5" data-toolbar-scale value="${Math.round(interfaceLayout.toolbar.scale * 100)}" /></label>
                <div class="layoutSectionTitle">${tr("Individual buttons", "Окремі кнопки")}</div>
                <div class="layoutControlList">${controls}</div>
                <div class="layoutFooter">
                  <button type="button" data-layout-reset-all>${tr("Restore toolbar", "Повернути панель")}</button>
                  <button type="button" data-layout-done>${tr("Done", "Готово")}</button>
                </div>
              </div>`;
            for (const id of TOOLBAR_GROUP_IDS) {
                body.querySelector<HTMLInputElement>(`[data-toolbar-visible="${id}"]`)!.addEventListener("change", (event) => {
                    interfaceLayout.toolbar.visible[id] = (event.currentTarget as HTMLInputElement).checked;
                    saveInterfaceLayout();
                });
                body.querySelectorAll<HTMLButtonElement>(`[data-toolbar-move="${id}"]`).forEach((node) => {
                    node.addEventListener("click", () => {
                        const order = interfaceLayout.toolbar.order;
                        const index = order.indexOf(id);
                        const next = index + Number(node.dataset.direction);
                        if (next < 0 || next >= order.length) return;
                        [order[index], order[next]] = [order[next], order[index]];
                        saveInterfaceLayout();
                        renderLayoutEditor();
                    });
                });
            }
            for (const id of TOOLBAR_CONTROL_IDS) {
                body.querySelector<HTMLInputElement>(`[data-toolbar-control="${id}"]`)!.addEventListener("change", (event) => {
                    interfaceLayout.toolbar.controls[id] = (event.currentTarget as HTMLInputElement).checked;
                    saveInterfaceLayout();
                });
            }
            body.querySelector<HTMLInputElement>("[data-toolbar-scale]")!.addEventListener("input", (event) => {
                interfaceLayout.toolbar.scale = Number((event.currentTarget as HTMLInputElement).value) / 100;
                body.querySelector<HTMLOutputElement>("[data-toolbar-size]")!.textContent = `${Math.round(interfaceLayout.toolbar.scale * 100)}%`;
                saveInterfaceLayout();
            });
            body.querySelector<HTMLButtonElement>("[data-layout-reset-all]")!.addEventListener("click", () => {
                interfaceLayout.toolbar = defaultInterfaceLayout().toolbar;
                saveInterfaceLayout();
                renderLayoutEditor();
            });
        }
        body.querySelector<HTMLButtonElement>("[data-layout-done]")!.addEventListener("click", closeLayoutEditor);
        body.scrollTop = oldScrollTop;
    }
    function setUiLanguage(language: UiLanguage) {
        uiLanguage = language;
        localStorage.setItem(UI_LANGUAGE_KEY, uiLanguage);
        applyUiLanguage();
    }
    function applyUiLanguage() {
        root.dataset.language = uiLanguage;
        document.documentElement.lang = uiLanguage === "uk" ? "uk" : "en";
        languageBtn.textContent = uiLanguage === "uk" ? "UK" : "EN";
        languageBtn.title = t("language");
        languageBtn.setAttribute("aria-label", t("language"));
        resetBtn.textContent = t("reset");
        moreBtn.textContent = tr("More ⋯", "Ще ⋯");
        resetBtn.title = t("reset");
        resetBtn.setAttribute("aria-label", t("reset"));
        stepBtn.textContent = t("step");
        stepBtn.title = t("step");
        stepBtn.setAttribute("aria-label", t("step"));
        traceBtn.textContent = t("runner");
        traceBtn.title = t("runner");
        traceBtn.setAttribute("aria-label", t("runner"));
        memoryBtn.textContent = t("memory");
        memoryBtn.title = t("memory");
        memoryBtn.setAttribute("aria-label", t("memory"));
        popoutStandBtn.textContent = standPopoutWindow && !standPopoutWindow.closed ? "↩" : "↗";
        popoutStandBtn.title = t(standPopoutWindow && !standPopoutWindow.closed ? "dockBack" : "popoutStand");
        popoutStandBtn.setAttribute("aria-label", popoutStandBtn.title);
        settingsBtn.title = t("settings");
        settingsBtn.setAttribute("aria-label", t("settings"));
        oscilloscopeBtn.textContent = t("oscilloscope");
        oscilloscopeBtn.title = t("oscilloscope");
        oscilloscopeBtn.setAttribute("aria-label", t("oscilloscope"));
        logicEditorBtn.textContent = t("logicCircuits");
        logicEditorBtn.title = t("logicCircuits");
        logicEditorBtn.setAttribute("aria-label", t("logicCircuits"));
        flashBtn.textContent = "↑";
        flashBtn.title = "Flash ADuC841";
        flashBtn.setAttribute("aria-label", "Flash ADuC841");
        fileNameInput.title = t("fileName");
        fileMenuBtn.textContent = t("file");
        openFileBtn.textContent = t("openFile");
        downloadFileBtn.textContent = t("download");
        saveAsBtn.textContent = tr("Save as…", "Зберегти як…");
        saveAsWindow.title.textContent = tr("Save as…", "Зберегти як…");
        saveAsLabelText.textContent = tr("File name", "Назва файлу");
        saveAsSubmit.textContent = tr("Save file", "Зберегти файл");
        runnerSettingsBtn.title = tr("Runner settings", "Налаштування Runner");
        renderRunnerPreferences();
        downloadHexBtn.textContent = t("downloadHex");
        speedSelect.title = t("speed");
        standEditBtn.title = t("editStand");
        standEditBtn.setAttribute("aria-label", t("editStand"));
        standPopoutBtn.title = t(standPopoutWindow && !standPopoutWindow.closed ? "dockBack" : "popoutStand");
        standPopoutBtn.setAttribute("aria-label", standPopoutBtn.title);
        standFloatBtn.title = tr("Float stand inside this page", "Плаваючий стенд на цій сторінці");
        standFloatBtn.setAttribute("aria-label", standFloatBtn.title);
        standWindow.title.textContent = tr("Virtual stand", "Віртуальний стенд");
        standReturnBtn.title = tr("Return stand to layout", "Повернути стенд у макет");
        standReturnBtn.setAttribute("aria-label", standReturnBtn.title);
        syncPopoutButtons();
        syncPopoutState();
        debugTitle.textContent = t("runnerTitle");
        debugClose.textContent = "×";
        debugClose.title = t("close");
        debugClose.setAttribute("aria-label", t("close"));
        memoryWindow.title.textContent = t("memory");
        memoryWindow.closeButton.title = t("close");
        memoryWindow.closeButton.setAttribute("aria-label", t("close"));
        settingsWindow.title.textContent = t("settings");
        settingsWindow.closeButton.title = t("close");
        settingsWindow.closeButton.setAttribute("aria-label", t("close"));
        layoutWindow.closeButton.title = t("close");
        layoutWindow.closeButton.setAttribute("aria-label", t("close"));
        for (const id of STAND_ITEM_IDS) layoutHandles[id].setAttribute("aria-label", uiLanguage === "uk" ? STAND_ITEMS[id].uk : STAND_ITEMS[id].en);
        if (layoutMode) renderLayoutEditor();
        memoryTable.refreshLanguage();
        renderSettingsPanel();
        flashLogTitle.textContent = t("flashTitle");
        flashLogHint.textContent = t("flashHint");
        flashDriverLink.title = t("flashDriverHint");
        flashDriverLink.textContent = t("flashDriver");
        flashLogClose.title = t("close");
        flashLogClose.setAttribute("aria-label", t("close"));
        flashLogCopy.textContent = t(flashCopyState === "copied" ? "flashCopied" : flashCopyState === "failed" ? "flashCopyFailed" : "flashCopy");
        renderFlashLog();
        messagesTitle.textContent = t("output");
        outputToggle.textContent = t("output");
        outputClose.title = tr("Close output", "Закрити вивід");
        outputClose.setAttribute("aria-label", outputClose.title);
        execMarker.title = t("currentInstruction");
        splitHandle.title = t("resize");
        const motorCaption = motorWrap.querySelector<HTMLElement>(".boardCaption");
        if (motorCaption)
            motorCaption.textContent = t("motor");
        motorHint.textContent = t("stepperMotor");
        localizeStaticSubtree(motorPanel.element, uiLanguage);
        localizeStaticSubtree(motorPanel.scopeElement, uiLanguage);
        localizeStaticSubtree(logicEditor.element, uiLanguage);
        syncRunButton();
        syncThemeButton();
        syncFullscreenButton();
        syncDeviceBadges();
        updateAutosaveButton();
        if (debugOpen)
            renderDebugPanel();
        window.dispatchEvent(new CustomEvent("st841:languagechange", { detail: { language: uiLanguage } }));
    }
    function setSpeed(speed: number) {
        currentSpeed = speed;
        personalSettings.speed = speed;
        savePersonalSettings();
        cpu.setSpeed(speedToBatch(currentSpeed));
        speedSelect.value = String(speed);
        const speedSetting = settingsWindow.body.querySelector<HTMLSelectElement>('[data-setting="speed"]');
        if (speedSetting) speedSetting.value = String(speed);
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
        const lineHeight = personalSettings.editorFontSize * personalSettings.editorLineHeight;
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
        const now = performance.now();
        if (memoryWindow.isOpen() && now - lastMemoryUpdateTs >= personalSettings.memoryRefreshMs) {
            memoryTable.update();
            lastMemoryUpdateTs = now;
        }
        if (now - lastVisualFrameTs >= visualFrameIntervalMs) {
            const visualDtSeconds = Math.max(0.001, Math.min(0.05, (now - lastVisualFrameTs) / 1000));
            lastVisualFrameTs = now;
            board.extraDevices.motor?.advance?.(visualDtSeconds);
            liveAudio.update(board.extraDevices.audio?.getTelemetry?.() ?? null);
            const boardVisualRevision = board.getVisualRevision();
            if (boardVisualRevision !== lastBoardVisualRevision) {
                board.render(drawContext, canvas.width, canvas.height, uiTheme, boardDrawnLayout);
                lastBoardVisualRevision = boardVisualRevision;
            }
            motorPanel.renderFrame(visualDtSeconds);
        }
        if (!cpu.isRunning() || now - lastUiUpdateTs >= 100) {
            updateRuntimeBar();
            lastUiUpdateTs = now;
        }
        window.requestAnimationFrame(draw);
    }
    applyUiLanguage();
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

function localizeStaticSubtree(root: HTMLElement, language: UiLanguage): void {
    const translated = (value: string): string => {
        const leading = value.match(/^\s*/)?.[0] ?? "";
        const trailing = value.match(/\s*$/)?.[0] ?? "";
        const content = value.trim();
        if (!content)
            return value;
        const pinMatch = content.match(/^(P[0-3]\.[0-7])\s+(?:pin|контакт)$/i);
        if (pinMatch)
            return `${leading}${pinMatch[1]} ${language === "uk" ? "контакт" : "pin"}${trailing}`;
        const pair = SUBTREE_TRANSLATIONS.find(([en, uk]) => content === en || content === uk);
        if (!pair)
            return value;
        return `${leading}${language === "uk" ? pair[1] : pair[0]}${trailing}`;
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode())
        nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.matches("textarea, pre, code, script, style"))
            continue;
        const next = translated(node.nodeValue ?? "");
        if (next !== node.nodeValue)
            node.nodeValue = next;
    }
    for (const node of Array.from(root.querySelectorAll<HTMLElement>("[title], [aria-label]"))) {
        for (const attribute of ["title", "aria-label"]) {
            const current = node.getAttribute(attribute);
            if (!current)
                continue;
            const next = translated(current);
            if (next !== current)
                node.setAttribute(attribute, next);
        }
    }
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
    const node = el("button", { class: `topBtn ${tone}`.trim() });
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
function formatCount(value: number): string {
    if (value < 1000)
        return String(value);
    if (value < 1000000)
        return `${(value / 1000).toFixed(1)}k`;
    if (value < 1000000000)
        return `${(value / 1000000).toFixed(1)}M`;
    return `${(value / 1000000000).toFixed(1)}G`;
}
function decodeInstruction(cpu: EmuBoardController): string {
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
function buildExecFlow(trace: CpuTraceEntry[], currentPc: number, pcToLine: Array<{ pc: number; line: number }>) {
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
function isCallRetOpcode(op: number): boolean {
    const code = op & 0xff;
    if (code === 0x12 || code === 0x22 || code === 0x32)
        return true;
    return (code & 0x1f) === 0x11;
}
function decodeOpcodeName(op: number): string {
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
function trimTrailingEmptyLines(text: string): string {
    const normalized = text.replace(/\r/g, "");
    const trimmed = normalized.replace(/\n+$/g, "");
    return trimmed.length ? trimmed : "";
}
function normalizeEditorText(text: string): string {
    const normalized = text.replace(/\r\n?/g, "\n");
    return normalized.replace(/\n{3,}/g, "\n\n");
}
function completionPreview(text: string): string {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}
function decorateHighlightedLines(highlighted: string, diagnosticLines: Map<number, string>, endsWithNewline: boolean): string {
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
function buildDiagnosticLineMap(list: AsmDiagnostic[]): Map<number, string> {
    const map = new Map<number, string>();
    for (const item of list) {
        if (item.line == null)
            continue;
        if (item.level !== "error")
            continue;
        map.set(item.line, "error");
    }
    return map;
}
function highlightAsm(source: string): string {
    return source
        .split("\n")
        .map((line) => highlightAsmLine(line))
        .join("\n");
}
function highlightC(source: string): string {
    return highlightCLines(source);
}
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function highlightAsmLine(line: string): string {
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
function highlightCLines(source: string): string {
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
// Typed element factory. The untyped version returned `any`, which disabled
// checking at every call site and made `querySelector<T>()` on the result a
// TS2347 error ("untyped function calls may not accept type arguments").
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
