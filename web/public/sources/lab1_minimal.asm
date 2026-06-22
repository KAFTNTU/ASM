DAT EQU R0
ADR EQU R1

ORG 0x0000

run:
  mov P3, #0FFh
  mov DAT, #0FEh
  mov ADR, #007h
  call write

loop:
  sjmp loop

write:
  setb P3.6
  mov P0, DAT
  mov P2, ADR
  mov P2, #000h
  ret

END

