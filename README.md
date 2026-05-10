# ST841 Virtual Stand (MVP)

Це **онлайн (web) MVP** віртуального стенда під методичку `Metodychka_ST841-3_CPLD_v4.1-2.pdf`.

Зараз фокус: **логіка стенда + відповідність адресам з прикладів** (P0/P2 шина, DIR на P3.6) і 6 лабораторних як демо-сценарії.

## Запуск

Через PowerShell `npm` може не запускатись (ExecutionPolicy). Тому запускай напряму:

- Dev сервер:
  - `node .\\node_modules\\vite\\bin\\vite.js dev`
- Plain HTML/JS export for Live Server:
  - `npm run export:web`
- Build:
  - `node .\\node_modules\\vite\\bin\\vite.js build`
- Full static build for GitHub Pages:
  - `npm run build:all`
- Preview:
  - `node .\\node_modules\\vite\\bin\\vite.js preview`

> Якщо хочеш відкривати проєкт прямо через `Live Server`, використовуй кореневий `index.html` разом з папкою `web/` — це plain HTML/JS експорт без Vite.

Папка проєкту:
- `C:\\Users\\Admin\\OneDrive\\Робочий стіл\\simulator`

## Що вже відповідає методичці (з текстових прикладів у PDF)

Логіка шини як у підпрограмі `write/strob/writ`:

- `P3.6 = 1` → **TX режим** (MCU пише на шину)
- `P0 = DAT`
- `P2 = ADR`
- `P2 = 0x00` → **імпульс защіпки (latch)**: `DAT` записується в пристрій за адресою `ADR`

Адреси з прикладів:

- `0x07` → LED line (active-low)
- `0x01..0x04` → 7-seg розряди (active-low сегменти, MVP-конвенція: a..g = bit0..6, dp=bit7)
- `0x05` → матриця rows (active-low)
- `0x06` → матриця cols (active-high)
- клавіатура: читання `P0.0..P0.3` в RX режимі, при `P2 = 0x60/0x50/0x30` (як у прикладі) або `0xEF/0xDF/0xBF` (як в тексті)

## Обмеження MVP

- Це **ще не емулятор 8051/ADuC841**, а швидкий MVP стенда: ти керуєш портами через “скрипт” (JS), який повторює послідовність портових операцій з методички.
- LCD у PDF в текстовому шарі майже не витягнулось (ймовірно там схеми/картинки), тому LCD поки **як high-level пристрій** (окремий API `devices.lcd.*`).
- ADC/джойстик поки **high-level** (`devices.adc.read()`), без моделювання `ADCCON*` регістрів.

## 8051 в браузері (без сервера) — старт інтеграції

Я підключив **відкритий 8051 core** як vendor:
- `C:\\Users\\Admin\\OneDrive\\Робочий стіл\\simulator\\vendor\\emu8051` (jarikomppa/emu8051)

Щоб зібрати **WebAssembly модуль** (працює в браузері через WASI shim):

1) Переконайся що є `wasi-sdk` у:
- `C:\\Users\\Admin\\OneDrive\\Робочий стіл\\simulator\\tools\\wasi-sdk`

2) Збірка wasm:
- `node .\\scripts\\build-emu8051-wasm.mjs`

Після цього зʼявиться файл:
- `C:\\Users\\Admin\\OneDrive\\Робочий стіл\\simulator\\public\\emu8051.wasm`

Далі (наступний етап) — підʼєднати цей core до нашої шини P0/P2/P3.6 і до пристроїв стенда.

## Що вже працює зараз

- Browser-side `8051 WASM` mode in the UI
- Intel HEX paste/load into ROM
- CPU run loop and single-step execution
- Port sync between CPU `P0/P2/P3` and the stand
- Latch behavior for `P0 data -> P2 addr -> P2 = 0x00`
- Keypad input path back into `P0` while `P3.6 = 0`

## Lab 1 starter

There is now a minimal first-lab sample in the project:

- `asm/lab1_minimal.asm`
- `public/samples/lab1_minimal.hex`
- `LAB1_STATUS.md`

The sample exercises the real hardware path:

- CPU executes code
- code writes through `P0/P2/P3.6`
- LED bar latch at `0x07` updates on the stand

## Lab 2 starter

There is now a minimal second-lab sample in the project:

- `asm/lab2_static_1988.asm`
- `public/samples/lab2_static_1988.hex`
- `LAB2_STATUS.md`

The sample drives the real static seven-segment hardware path and matches the manual digit order:

- `0x01` rightmost
- `0x04` leftmost

## Lab 3 starter

There is now a third-lab sample in the project:

- `asm/lab3_matrix_s.asm`
- `public/samples/lab3_matrix_s.hex`
- `LAB3_STATUS.md`

To rebuild the compiled lab samples:

- `node .\\scripts\\build-asm-samples.mjs`

## Lab 4 starter

There is now a fourth-lab sample in the project:

- `asm/lab4_keypad_led.asm`
- `public/samples/lab4_keypad_led.hex`
- `LAB4_STATUS.md`

## Що ще не завершено

- Full ADuC841 SFR map
- ADC registers `ADCCON1 / ADCCON2 / ADCDATAH / ADCDATAL`
- LCD bus mapping from the manual
- Accurate CPLD model from the original stand
- C toolchain in-browser (`C -> HEX`) without external compiler help
