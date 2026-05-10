DAT EQU R0
ADR EQU R1
ORG 0x0000
Temp0 EQU R2
_Temp0 EQU 0x02
run:
CALL LCD_INIT
loop:
call column_1
scan_1:
cjne a, #00001110b ,scan_4
jmp loop
scan_4:
cjne a, #00001101b ,scan_7
call line2
call word3
jmp loop
scan_7:
cjne a, #00001011b ,scan_st
jmp loop
scan_st:
cjne a, #00000111b ,scan_2col
jmp loop
scan_2col:
call column_2
scan_2:
cjne a, #00001110b,scan_5
CALL LCD_INIT
jmp loop
scan_5:
cjne a, #00001101b,scan_8
call line3
call word2
jmp loop
scan_8:
cjne a ,#00001011b,scan_0
jmp loop
scan_0:
cjne a, #00000111b,scan_3col
jmp loop
scan_3col:
call column_3
key_3:
cjne a, #00001110b, scan_6
call line1
call word1
jmp loop
scan_6:
cjne a, #00001101b, scan_9
call line4
call word4
jmp loop
scan_9:
cjne a ,#00001011b, scan_h
jmp loop
scan_h:
cjne a ,#00000111b, res
call line4
call word4
res:
jmp loop
LCD_INIT:
mov dat, #0x00
mov adr, #0x08
call writ
call ldelay
RET
column_1:
clr p3.6
mov p2,#01100000b
mov a,p0
anl a,#0x0f
ret
column_2:
clr p3.6
mov p2,#01010000b
mov a,p0
anl a,#0x0f
ret
column_3:
clr p3.6
mov p2,#00110000b
mov a,p0
anl a,#0x0f
ret
writ:
write:
setb p3.6
mov p0,dat
mov p2,adr
nop
mov p2,#0x00
ret
LDelay:
    MOV Temp0,#0FFh
LD1:
    DJNZ Temp0,LD1
    RET
WLDelay:
    MOV Temp0,#019h
WL2:
    ACALL LDelay
    DJNZ Temp0,WL2
    RET
line1:
ret
line2:
ret
line3:
ret
line4:
ret
word1:
ret
word2:
ret
word3:
ret
word4:
ret
end
