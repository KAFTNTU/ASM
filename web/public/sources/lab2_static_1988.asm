DAT EQU R0
ADR EQU R1

ORG 0x0000

run:
  mov P3, #0FFh

  mov DAT, #0FFh
  mov ADR, #001h
  call strob
  mov DAT, #0FFh
  mov ADR, #002h
  call strob
  mov DAT, #0FFh
  mov ADR, #003h
  call strob
  mov DAT, #0FFh
  mov ADR, #004h
  call strob

  mov DAT, #0CFh
  mov ADR, #004h
  call strob

  mov DAT, #090h
  mov ADR, #003h
  call strob

  mov DAT, #080h
  mov ADR, #002h
  call strob

  mov DAT, #080h
  mov ADR, #001h
  call strob

loop:
  sjmp loop

strob:
  setb P3.6
  mov P0, DAT
  mov P2, ADR
  mov P2, #000h
  ret

END

