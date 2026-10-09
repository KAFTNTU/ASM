export const LAYOUT_STORAGE_KEY = "st841.ui.interfaceLayout.v1";

export const STAND_ITEMS = {
  sevenSeg: { en: "7-segment display", uk: "7-сегментний індикатор", x: 438 / 720 * 100, y: 34 / 720 * 100, w: 232, h: 104 },
  ledBar: { en: "LED bar", uk: "Світлодіодна лінійка", x: 28 / 720 * 100, y: 178 / 720 * 100, w: 232, h: 56 },
  matrix: { en: "LED matrix", uk: "LED-матриця", x: 72 / 720 * 100, y: 256 / 720 * 100, w: 132, h: 186 },
  lcd: { en: "LCD screen", uk: "Екран LCD", x: 414 / 720 * 100, y: 252 / 720 * 100, w: 268, h: 184 },
  keypad: { en: "Keypad", uk: "Клавіатура", x: 62, y: 75, w: 254, h: 175 },
  joystick: { en: "Joystick", uk: "Джойстик", x: 2.4, y: 74, w: 237, h: 191 },
  motor: { en: "Motor", uk: "Двигун", x: 57, y: 21, w: 284, h: 80 },
  audio: { en: "Speaker", uk: "Динамік", x: 6.2, y: 3.3, w: 175, h: 128 },
} as const;

export type StandItemId = keyof typeof STAND_ITEMS;
export const STAND_ITEM_IDS = Object.keys(STAND_ITEMS) as StandItemId[];
export type StandPlacement = { visible: boolean; x: number; y: number; scale: number; customized: boolean };

export const TOOLBAR_GROUPS = {
  run: { en: "Run controls", uk: "Запуск і крок" },
  project: { en: "Project / file", uk: "Проєкт і файл" },
  tools: { en: "Tools", uk: "Інструменти" },
  speed: { en: "Speed", uk: "Швидкість" },
  theme: { en: "Theme", uk: "Тема" },
  language: { en: "Language", uk: "Мова" },
  fullscreen: { en: "Fullscreen", uk: "Повний екран" },
} as const;
export type ToolbarGroupId = keyof typeof TOOLBAR_GROUPS;
export const TOOLBAR_GROUP_IDS = Object.keys(TOOLBAR_GROUPS) as ToolbarGroupId[];

export const TOOLBAR_CONTROLS = {
  start: { en: "Start / Stop", uk: "Старт / Стоп" },
  reset: { en: "Reset", uk: "Скинути" },
  step: { en: "Step", uk: "Крок" },
  fileName: { en: "File name", uk: "Назва файлу" },
  languageMode: { en: "ASM / C selector", uk: "Перемикач ASM / C" },
  fileMenu: { en: "File menu", uk: "Меню файлу" },
  flash: { en: "Flash board", uk: "Прошити плату" },
  runner: { en: "Runner", uk: "Виконання" },
  memory: { en: "Memory", uk: "Пам’ять" },
  oscilloscope: { en: "Oscilloscope", uk: "Осцилограф" },
  circuits: { en: "Logic circuits", uk: "Логічні схеми" },
} as const;
export type ToolbarControlId = keyof typeof TOOLBAR_CONTROLS;
export const TOOLBAR_CONTROL_IDS = Object.keys(TOOLBAR_CONTROLS) as ToolbarControlId[];

export type InterfaceLayout = {
  stand: Record<StandItemId, StandPlacement>;
  toolbar: {
    order: ToolbarGroupId[];
    visible: Record<ToolbarGroupId, boolean>;
    controls: Record<ToolbarControlId, boolean>;
    scale: number;
  };
};

export function defaultInterfaceLayout(): InterfaceLayout {
  return {
    stand: Object.fromEntries(STAND_ITEM_IDS.map((id) => [id, {
      visible: true,
      x: STAND_ITEMS[id].x,
      y: STAND_ITEMS[id].y,
      scale: 1,
      customized: false,
    }])) as Record<StandItemId, StandPlacement>,
    toolbar: {
      order: [...TOOLBAR_GROUP_IDS],
      visible: Object.fromEntries(TOOLBAR_GROUP_IDS.map((id) => [id, true])) as Record<ToolbarGroupId, boolean>,
      controls: Object.fromEntries(TOOLBAR_CONTROL_IDS.map((id) => [id, true])) as Record<ToolbarControlId, boolean>,
      scale: 1,
    },
  };
}

export function clampStandPlacement(id: StandItemId, placement: StandPlacement): StandPlacement {
  const item = STAND_ITEMS[id];
  const scale = Math.max(0.5, Math.min(1.8, Number.isFinite(placement.scale) ? placement.scale : 1));
  const maxX = Math.max(0, 100 - item.w * scale / 720 * 100);
  const maxY = Math.max(0, 100 - item.h * scale / 720 * 100);
  return {
    visible: placement.visible !== false,
    x: Math.max(0, Math.min(maxX, Number.isFinite(placement.x) ? placement.x : item.x)),
    y: Math.max(0, Math.min(maxY, Number.isFinite(placement.y) ? placement.y : item.y)),
    scale,
    customized: placement.customized === true,
  };
}

export function loadInterfaceLayout(storage: Pick<Storage, "getItem"> = localStorage): InterfaceLayout {
  const layout = defaultInterfaceLayout();
  let saved: Partial<InterfaceLayout> = {};
  try {
    const value = JSON.parse(storage.getItem(LAYOUT_STORAGE_KEY) || "{}");
    if (value && typeof value === "object") saved = value;
  } catch { /* keep defaults */ }
  for (const id of STAND_ITEM_IDS) {
    const value = saved.stand?.[id];
    if (value && typeof value === "object") {
      layout.stand[id] = clampStandPlacement(id, { ...layout.stand[id], ...value });
    }
  }
  const order = saved.toolbar?.order;
  if (Array.isArray(order)) {
    const valid = order.filter((id): id is ToolbarGroupId => TOOLBAR_GROUP_IDS.includes(id as ToolbarGroupId));
    layout.toolbar.order = [...new Set(valid), ...TOOLBAR_GROUP_IDS.filter((id) => !valid.includes(id))];
  }
  for (const id of TOOLBAR_GROUP_IDS) {
    if (typeof saved.toolbar?.visible?.[id] === "boolean") layout.toolbar.visible[id] = saved.toolbar.visible[id];
  }
  for (const id of TOOLBAR_CONTROL_IDS) {
    if (typeof saved.toolbar?.controls?.[id] === "boolean") layout.toolbar.controls[id] = saved.toolbar.controls[id];
  }
  const scale = saved.toolbar?.scale;
  if (typeof scale === "number" && Number.isFinite(scale)) layout.toolbar.scale = Math.max(0.8, Math.min(1.25, scale));
  return layout;
}
