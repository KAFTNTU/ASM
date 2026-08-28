.module lab4_keypad_led
.area HOME (CODE)

run:
  mov p3, #0xff
  acall clear_leds

loop:
  acall column_1
  cjne a, #0x0e, key_4
  mov r0, #0xfe
  acall show_leds
  sjmp loop

key_4:
  cjne a, #0x0d, key_7
  mov r0, #0xfb
  acall show_leds
  sjmp loop

key_7:
  cjne a, #0x0b, key_star
  mov r0, #0xf8
  acall show_leds
  sjmp loop

key_star:
  cjne a, #0x07, scan_col2
  mov r0, #0x55
  acall show_leds
  sjmp loop

scan_col2:
  acall column_2
  cjne a, #0x0e, key_5
  mov r0, #0xfd
  acall show_leds
  sjmp loop

key_5:
  cjne a, #0x0d, key_8
  mov r0, #0xfa
  acall show_leds
  sjmp loop

key_8:
  cjne a, #0x0b, key_0
  mov r0, #0xf7
  acall show_leds
  sjmp loop

key_0:
  cjne a, #0x07, scan_col3
  mov r0, #0x00
  acall show_leds
  sjmp loop

scan_col3:
  acall column_3
  cjne a, #0x0e, key_6
  mov r0, #0xfc
  acall show_leds
  sjmp loop

key_6:
  cjne a, #0x0d, key_9
  mov r0, #0xf9
  acall show_leds
  sjmp loop

key_9:
  cjne a, #0x0b, key_hash
  mov r0, #0xf6
  acall show_leds
  sjmp loop

key_hash:
  cjne a, #0x07, no_key
  mov r0, #0xaa
  acall show_leds
  sjmp loop

no_key:
  acall clear_leds
  acall ldelay
  sjmp loop

column_1:
  clr p3.6
  mov p2, #0x60
  mov a, p0
  anl a, #0x0f
  ret

column_2:
  clr p3.6
  mov p2, #0x50
  mov a, p0
  anl a, #0x0f
  ret

column_3:
  clr p3.6
  mov p2, #0x30
  mov a, p0
  anl a, #0x0f
  ret

show_leds:
  setb p3.6
  mov p0, r0
  mov p2, #0x07
  nop
  nop
  mov p2, #0x00
  acall ldelay
  ret

clear_leds:
  mov r0, #0xff
  acall show_leds
  ret

delay:
  mov r2, #0x80
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
