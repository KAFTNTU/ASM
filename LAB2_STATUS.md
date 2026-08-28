# Lab 2 Status

This note captures the current simulator support for lab 2.

## Implemented hardware path

- Static seven-segment display is connected through latches at `0x01..0x04`
- Mapping follows the manual exactly:
  - `0x01` -> rightmost digit
  - `0x02` -> next digit
  - `0x03` -> next digit
  - `0x04` -> leftmost digit
- Segment bits follow the manual table:
  - `bit0=a`
  - `bit1=b`
  - `bit2=c`
  - `bit3=d`
  - `bit4=e`
  - `bit5=f`
  - `bit6=g`
  - `bit7=dp`
- Segment logic is active-low
- Writing `0xFF` blanks a digit

## Ready-to-run sample

Files:

- `asm/lab2_static_1988.asm`
- `public/samples/lab2_static_1988.hex`

Behavior:

- clears all four digits
- writes `1 9 8 8` across the display
- loops forever so the content stays latched

## Lab 1 recheck

Lab 1 still looks good after the lab 2 audit.
The bus path and LED latch remain unchanged.

