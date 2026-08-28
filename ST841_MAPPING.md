# ST841 Mapping Notes

This file captures the current stand mapping extracted from
`Metodychka_ST841-3_CPLD_v4.1-2.pdf` and the assumptions used in the simulator.

## Bus protocol

- `P3.6 = 1` puts the external bus in transmit mode.
- `P0` carries data.
- `P2` carries the peripheral address.
- A transition `P2 -> 0x00` latches the previously selected address with the current `P0` value.

This is the write pattern used throughout the examples:

```asm
setb P3.6
mov  P0, DAT
mov  P2, ADDR
mov  P2, #0x00
```

## Peripheral addresses

- `0x01` -> seven-segment digit 1 (rightmost)
- `0x02` -> seven-segment digit 2
- `0x03` -> seven-segment digit 3
- `0x04` -> seven-segment digit 4 (leftmost)
- `0x05` -> LED matrix row register, active-low
- `0x06` -> LED matrix column register, active-high
- `0x07` -> LED bar register, active-low
- `0x08` -> LCD latch
- `0x09` -> stepper motor latch in later labs

## Keypad read mode

When the bus is switched to receive mode (`P3.6 = 0`), the keypad drives `P0.0..P0.3`.

Documented column addresses:

- `0xEF` -> first column
- `0xDF` -> second column
- `0xBF` -> third column

The example code also uses these shorthand values:

- `0x60`
- `0x50`
- `0x30`

The simulator accepts both sets because the PDF contains both.

## ADC / joystick

The guide explicitly lists these ADuC841 ADC registers:

- `ADCCON1 = 0xEF`
- `ADCCON2 = 0xD8`
- `ADCDATAL = 0xD9`
- `ADCDATAH = 0xDA`

Bit behavior used in the simulator:

- `ADCCON2.7` -> `ADCI`, conversion complete
- `ADCCON2.4` -> `SCONV`, single conversion trigger
- `ADCCON2.3..0` -> channel select

Current simulator assumption:

- `ADC6` -> joystick X
- `ADC7` -> joystick Y

This assumption is documented because the extracted PDF text around the joystick example
references channel 7 explicitly, but the full channel-to-axis wiring is not cleanly exposed
in the text layer.

## Known mismatch in the source material

The user-provided lab list says lab 5 is LCD work, but the extracted PDF pages label
lab 5 as keypad scanning. Because of that:

- keypad behavior is implemented from the PDF examples
- LCD remains a placeholder device until a cleaner source for the LCD wiring is available

## LCD bus mapping from the provided example

The user shared a working LCD example. From that code we can now infer:

- LCD is written through address `0x08`
- The display is used as a `4-line` character LCD
- The provided photo matches a `10x4` style layout well
- Commands/data are sent in `4-bit mode`
- The upper nibble of each bus byte carries the LCD nibble payload
- Bit `0` acts like `RS`
  - `0` -> command nibble
  - `1` -> data nibble
- Two writes build one LCD byte

Example:

```asm
mov dat, #0x31
mov adr, #0x08
call writ

mov dat, #0x11
mov adr, #0x08
call writ
```

This produces the character `0x31` (`'1'`) because:

- first write -> high nibble `0x3`, `RS=1`
- second write -> low nibble `0x1`, `RS=1`

Cursor positioning used in the example:

- line 1 -> `0x80 0x00`
- line 2 -> `0xC0 0x00`
- line 3 -> `0x80 0xA0`
- line 4 -> `0xC0 0xA0`

These addresses match a 4-line character LCD addressing pattern and are now safe to model in the simulator.

## LCD character set note

The provided LCD example and screenshot show Ukrainian/Cyrillic output. The byte values used in
the example are therefore not plain ASCII text bytes from a browser font perspective.

For the simulator this means:

- bus timing and cursor positioning can be modeled confidently now
- exact glyph rendering should use an LCD-style character ROM mapping if we want pixel-perfect text
- until that mapping is added, a browser UI may show placeholder Latin/dot characters for some bytes
