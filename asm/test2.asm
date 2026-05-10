.module test2
.area CSEG (CODE)
run:
  mov p3,#0xff
  mov a,#0x12
  sjmp run
