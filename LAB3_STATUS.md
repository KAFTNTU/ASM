# Lab 3 status

- `asm/lab3_matrix_s.asm` is a real 8051 assembly sample compiled with `SDCC` / `sdas8051`.
- `public/samples/lab3_matrix_s.hex` runs through the browser `WASM` core.
- The sample writes to `0x05` (rows, active-low) and `0x06` (cols, active-high) exactly like the course example.
- `src/vm/devices/matrix5x7.ts` now keeps short pixel persistence so multiplexed rows stay visible on the virtual stand.
- Path covered: `ASM -> HEX -> 8051 core -> P0/P2/P3.6 bus -> matrix`.
