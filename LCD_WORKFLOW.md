# Як зараз працює РКІ/LCD у симуляторі ST841

Цей файл описує поточну реалізацію РКІ в проєкті, тобто як ASM-код через `P0`, `P2`, `P3.6` доходить до екрана.

## 1. Де підключений РКІ

РКІ створюється в:

- `src/ui/app.ts`

Там є:

```ts
const lcd = new Lcd16x2();
board.bus.registerDevice(ST841_MAP.lcdAddr, lcd);
board.bus.registerDevice((ST841_MAP.lcdAddr + 1) & 0xff, {
  write(data: number) {
    lcd.writeDataByte(data);
  },
});
```

Тобто:

- адреса `0x08` — основний режим як у методичці ST841: LCD 4-bit, RS захований у `DAT bit0`;
- адреса `0x09` — додатковий режим сумісності: прямий запис байта як символу.

Для твого коду з методички важлива саме адреса `0x08`.

## 2. Як ASM-запис доходить до пристрою

У методичці запис виглядає так:

```asm
writ:
setb p3.6
mov p0,dat
mov p2,adr
nop
mov p2,#0x00
ret
```

У симуляторі це обробляється в:

- `src/vm/board.ts`
- метод `writePort("P2", value)`

Поточна логіка така:

```ts
if (prev !== 0x00 && v === 0x00 && this.readBit("P3", 6) === 1) {
  this.bus.write(prev, this.ports.P0);
}
```

Тобто запис у пристрій відбувається не коли `P2 = adr`, а коли `P2` скидається назад у `0x00`.

Приклад:

```asm
mov p0,#0xA1
mov p2,#0x08
mov p2,#0x00
```

Симулятор робить:

```txt
bus.write(0x08, 0xA1)
```

Це майже як latch/строб на реальному стенді.

## 3. Як працює 4-бітний LCD

РКІ у методичці працює не 8-бітно, а 4-бітно.

Один байт передається двома записами:

```txt
first write  = старша тетрада
second write = молодша тетрада
```

У симуляторі це реалізовано в:

- `src/vm/devices/lcd16x2.ts`
- метод `write(data)`

Поточна логіка:

```ts
if (!this.pendingNibble) {
  this.pendingNibble = { rs, raw: data & 0xff };
  return;
}

const byte = (this.pendingNibble.raw & 0xf0) | ((data >> 4) & 0x0f);
this.pendingNibble = null;
this.processByte(byte, rs === 1);
```

Тобто перший запис тільки запам'ятовується.

Другий запис збирає повний байт.

## 4. Як збирається символ

Приклад з методички:

```asm
mov dat, #0xA1
mov adr, #0x08
call writ

mov dat, #0x01
mov adr, #0x08
call writ
```

Симулятор бачить:

```txt
first  = 0xA1
second = 0x01
```

Обчислення:

```txt
high = first & 0xF0 = 0xA0
low  = second >> 4 = 0x00
byte = 0xA0 | 0x00 = 0xA0
```

`RS` береться з `bit0`.

```txt
0xA1 & 1 = 1
```

Отже це дані/символ, не команда.

Далі:

```txt
0xA0 -> "Б"
```

## 5. Як збирається команда

Приклад:

```asm
mov dat, #10000000b
mov adr, #0x08
call writ

mov dat, #00000000b
mov adr, #0x08
call writ
```

Симулятор збирає:

```txt
0x80 + 0x00 -> 0x80
```

`RS = 0`, тому це команда.

Команда `0x80` означає:

```txt
поставити курсор на DDRAM address 0x00
```

Тобто перший рядок, перша комірка.

## 6. Адреси рядків LCD

У симуляторі зараз є дві схеми адресації:

```ts
const LCD_LINE_BASES = [0x00, 0x40, 0x0a, 0x4a];
const LCD_LINE_BASES_ALT = [0x00, 0x40, 0x14, 0x54];
```

Перша схема потрібна для твого коду:

```asm
line3:
mov dat, #10000000b
...
mov dat, #10100000b
```

Це збирається в:

```txt
0x8A
```

Команда `0x8A` означає:

```txt
DDRAM address = 0x0A
```

Тому симулятор вважає це третій рядок.

Для рядків:

```txt
line1 -> 0x80 -> row 1
line2 -> 0xC0 -> row 2
line3 -> 0x8A -> row 3
line4 -> 0xCA -> row 4
```

## 7. Таблиця символів

Символи розшифровуються в:

- `src/vm/devices/lcd16x2.ts`
- `LCD_CHAR_MAP`

Приклади:

```txt
0xA0 -> Б
0xA8 -> П
0xB1 -> Я
0xB3 -> в
0xB8 -> и
0xBF -> т
```

Якщо коду нема в таблиці:

- якщо це ASCII `0x20..0x7E`, показується звичайний символ;
- інакше показується `"."`.

## 8. Що має відбутися при натисканні кнопки

Твій ASM робить приблизно так:

```asm
call column_1
cjne a, #00001110b, scan_4
```

Тобто:

1. `column_1` переводить плату в режим читання:

```asm
clr p3.6
mov p2,#01100000b
mov a,p0
anl a,#0x0f
ret
```

2. Симулятор бачить:

```txt
P3.6 = 0
P2 = 0x60
read P0
```

3. `Keypad4x3` перевіряє, чи вибрана правильна колонка.

4. Якщо натиснута кнопка `3`, це:

```txt
column = 2
row = 0
```

Тому її має побачити `column_3`, а не `column_1`.

5. Якщо код дійшов до:

```asm
key_3:
cjne a, #00001110b, scan_6
call line1
call word1
```

то LCD має отримати:

```txt
line1 command
word1 data
```

## 9. Поточна підозра, чому твій великий код може не спрацьовувати

LCD-логіка сама по собі зараз збирає нібли правильно.

Тому якщо твій тест напряму виводить символи, але великий код не реагує на кнопку, найімовірніше проблема до LCD:

```txt
keypad -> P0 read -> CJNE -> call line/word
```

Тобто треба перевірити:

1. чи `column_3` реально читає кнопку `3`;
2. чи `A` після `anl a,#0x0f` дорівнює `0x0E`;
3. чи `CJNE` переходить правильно;
4. чи викликається `line1`;
5. чи викликається `word1`;
6. чи в Runner змінюється `LCD CELLS`.

## 10. Що дивитися в Runner

У Runner важливі поля:

```txt
INPUTS / BUS
P3.6 mode
pressed
keypad bus col1/col2/col3
```

Для кнопки `3` має бути:

```txt
pressed: 3
col3 = 0xFE
```

Для кнопки `4`:

```txt
pressed: 4
col1 = 0xFD
```

Для кнопки `5`:

```txt
pressed: 5
col2 = 0xFD
```

Для кнопки `6`:

```txt
pressed: 6
col3 = 0xFD
```

Після `anl a,#0x0f` код має порівнювати:

```txt
0x0E для першого рядка клавіатури
0x0D для другого рядка клавіатури
0x0B для третього рядка клавіатури
0x07 для четвертого рядка клавіатури
```

## 11. Короткий ланцюжок роботи

```txt
ASM:
  setb p3.6
  mov p0, dat
  mov p2, adr
  mov p2, #0

Board:
  бачить P2: adr -> 0
  робить bus.write(adr, P0)

LCD:
  якщо це перша половинка -> запам'ятати
  якщо це друга половинка -> зібрати byte

LCD command:
  RS=0 -> cursor/clear/home

LCD data:
  RS=1 -> code -> LCD_CHAR_MAP -> символ -> cell

Render:
  малює 4 рядки по 10 комірок
```

## 12. Ймовірний наступний крок для дебагу

Найкраще додати в Runner окремий лог:

```txt
LCD BUS LOG
0x08 <- 0x80 pending
0x08 <- 0x00 command 0x80 cursor row1 col0
0x08 <- 0xA1 pending
0x08 <- 0x01 data 0xA0 char Б row1 col0
```

Тоді буде видно, чи великий ASM взагалі доходить до `writ`.

Якщо в цьому логу нічого нема при натисканні кнопки, проблема не в LCD, а в клавіатурі або переходах `CJNE`.
