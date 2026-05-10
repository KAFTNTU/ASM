# Prompt для Claude (щоб допоміг доробити стенд “як у методиці”)

Ти — асистент-розробник. Працюєш в репозиторії:
`C:\\Users\\Admin\\OneDrive\\Робочий стіл\\simulator`

Ціль: довести MVP веб-симулятор стенда ST841 (ADuC841 + CPLD) до максимальної відповідності методиці `Metodychka_ST841-3_CPLD_v4.1-2.pdf` для 6 лабораторних:
1) LED line
2) 7-seg static
3) LED matrix dynamic
4) Keypad scan
5) LCD
6) ADC joystick

## Поточний стан (вже зроблено)

- Веб-апка на Vite + TS.
- Реалізована шина “P0 data / P2 addr + latch pulse to 0x00”, DIR на `P3.6`.
- Пристрої:
  - LED line addr `0x07`
  - 7-seg digits addr `0x01..0x04`
  - LED matrix rows/cols addr `0x05/0x06`
  - keypad read через `P2` (підтримані `0x60/0x50/0x30` та `0xEF/0xDF/0xBF`)
  - LCD 16x2 (тільки high-level API)
  - ADC joystick (тільки high-level API)
- Приклади “лабораторних” запускаються як JS-скрипти вбудованим раннером.

Файли:
- `src/vm/board.ts` (портова модель + latch-логіка)
- `src/vm/peripheralBus.ts`
- `src/vm/devices/*`
- `src/ui/examples.ts` (скрипти під лаби)

## Твої задачі (пріоритет)

### A) LCD “як у методичці”
1. Дістати з PDF **точну адресацію LCD через P2/P0** (можливо в схемах/картинках).
2. Реалізувати LCD як bus-пристрій (або кілька адрес) і підключити в `src/ui/app.ts` через `board.bus.registerDevice(...)`.
3. Додати приклад “Lab5” який повторює реальні портові операції (а не `devices.lcd.print`).

### B) ADC “як у методичці”
1. Підвʼязати ADC під `ADCCON1/ADCCON2/ADCDATAH/ADCDATAL` з методички (addresses: `ADCCON1=0xEF`, `ADCCON2=0xD8`, `ADCDATAL=0xD9`, `ADCDATAH=0xDA` згадуються в прикладі).
2. Зробити мінімальну модель:
   - запис в `ADCCON2` з `SCONV` запускає конверсію
   - через короткий час виставляє “готово”
   - читаються `ADCDATAH/L` як 10-бітне значення з джойстика.

### C) Перехід від “JS скриптів” до “C workflow”
Як мінімум запропонувати 1 реалістичний шлях:
- або `sdcc` (8051) компіляція в `.hex` + інтеграція 8051 емулятора
- або WebAssembly toolchain
- або Node backend, який компілює C → hex і подає в емулятор.

Важливо: якщо повна емуляція 8051 зараз занадто важка, зроби roadmap (MVP → beta).

## Правила

- Не ламай існуючу latch-логіку P0/P2/P3.6.
- Пиши мінімальні, читабельні зміни.
- Винось логіку в `src/vm/devices/*`.
- Не додавай великі фреймворки без потреби.

## Що повернути як результат

- Список змінених/доданих файлів.
- Коротко: що саме стало працювати з LCD/ADC.
- Команди для запуску: `node .\\node_modules\\vite\\bin\\vite.js dev`.

