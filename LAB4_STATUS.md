# Lab 4 status

- `asm/lab4_keypad_led.asm` is a real 8051 assembly sample compiled with `SDCC` / `sdas8051`.
- `public/samples/lab4_keypad_led.hex` runs through the browser `WASM` core.
- The sample scans keypad columns with `P3.6 = 0` using `0x60 / 0x50 / 0x30`, reads `P0.0..P0.3`, then switches back to TX mode and writes a unique LED pattern to `0x07`.
- Path covered: `ASM -> HEX -> 8051 core -> keypad scan -> bus write -> LED line`.
