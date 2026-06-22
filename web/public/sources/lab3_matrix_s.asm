.module lab3_matrix_s
.area HOME (CODE)

run:
  mov p3, #0xff

loop:
  mov r0, #0b10111110
  mov r1, #0x05
  acall writ
  mov r0, #0b00001110
  mov r1, #0x06
  acall writ
  acall ldelay
  acall off

  mov r0, #0b11011101
  mov r1, #0x05
  acall writ
  mov r0, #0b00010001
  mov r1, #0x06
  acall writ
  acall ldelay
  acall off

  mov r0, #0b11111011
  mov r1, #0x05
  acall writ
  mov r0, #0b00010000
  mov r1, #0x06
  acall writ
  acall ldelay
  acall off

  mov r0, #0b11101111
  mov r1, #0x05
  acall writ
  mov r0, #0b00000001
  mov r1, #0x06
  acall writ
  acall ldelay
  acall off

  mov r0, #0b11110111
  mov r1, #0x05
  acall writ
  mov r0, #0b00001110
  mov r1, #0x06
  acall writ
  acall ldelay
  acall off

  sjmp loop

writ:
  setb p3.6
  mov p0, r0
  mov p2, r1
  nop
  nop
  mov p2, #0x00
  ret

off:
  mov r0, #0xff
  mov r1, #0x05
  acall writ
  mov r0, #0x00
  mov r1, #0x06
  acall writ
  ret

delay:
  mov r2, #0xff
delay_outer:
  mov r3, #0xff
delay_inner:
  djnz r3, delay_inner
  djnz r2, delay_outer
  ret

ldelay:
  acall delay
  acall delay
  ret
