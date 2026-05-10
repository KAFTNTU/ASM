                                      1 .module lab3_matrix_s
                                      2 .area HOME (CODE)
                                      3 
      000000                          4 run:
      000000 75 B0 FF         [24]    5   mov p3, #0xff
                                      6 
      000003                          7 loop:
      000003 78 BE            [12]    8   mov r0, #0b10111110
      000005 79 05            [12]    9   mov r1, #0x05
      000007 11 55            [12]   10   acall writ
      000009 78 0E            [12]   11   mov r0, #0b00001110
      00000B 79 06            [12]   12   mov r1, #0x06
      00000D 11 55            [12]   13   acall writ
      00000F 11 77            [12]   14   acall ldelay
      000011 11 61            [12]   15   acall off
                                     16 
      000013 78 DD            [12]   17   mov r0, #0b11011101
      000015 79 05            [12]   18   mov r1, #0x05
      000017 11 55            [12]   19   acall writ
      000019 78 11            [12]   20   mov r0, #0b00010001
      00001B 79 06            [12]   21   mov r1, #0x06
      00001D 11 55            [12]   22   acall writ
      00001F 11 77            [12]   23   acall ldelay
      000021 11 61            [12]   24   acall off
                                     25 
      000023 78 FB            [12]   26   mov r0, #0b11111011
      000025 79 05            [12]   27   mov r1, #0x05
      000027 11 55            [12]   28   acall writ
      000029 78 10            [12]   29   mov r0, #0b00010000
      00002B 79 06            [12]   30   mov r1, #0x06
      00002D 11 55            [12]   31   acall writ
      00002F 11 77            [12]   32   acall ldelay
      000031 11 61            [12]   33   acall off
                                     34 
      000033 78 EF            [12]   35   mov r0, #0b11101111
      000035 79 05            [12]   36   mov r1, #0x05
      000037 11 55            [12]   37   acall writ
      000039 78 01            [12]   38   mov r0, #0b00000001
      00003B 79 06            [12]   39   mov r1, #0x06
      00003D 11 55            [12]   40   acall writ
      00003F 11 77            [12]   41   acall ldelay
      000041 11 61            [12]   42   acall off
                                     43 
      000043 78 F7            [12]   44   mov r0, #0b11110111
      000045 79 05            [12]   45   mov r1, #0x05
      000047 11 55            [12]   46   acall writ
      000049 78 0E            [12]   47   mov r0, #0b00001110
      00004B 79 06            [12]   48   mov r1, #0x06
      00004D 11 55            [12]   49   acall writ
      00004F 11 77            [12]   50   acall ldelay
      000051 11 61            [12]   51   acall off
                                     52 
      000053 80 AE            [24]   53   sjmp loop
                                     54 
      000055                         55 writ:
      000055 D2 B6            [12]   56   setb p3.6
      000057 88 80            [24]   57   mov p0, r0
      000059 89 A0            [24]   58   mov p2, r1
      00005B 00               [12]   59   nop
      00005C 00               [12]   60   nop
      00005D 75 A0 00         [24]   61   mov p2, #0x00
      000060 22               [24]   62   ret
                                     63 
      000061                         64 off:
      000061 78 FF            [12]   65   mov r0, #0xff
      000063 79 05            [12]   66   mov r1, #0x05
      000065 11 55            [12]   67   acall writ
      000067 78 00            [12]   68   mov r0, #0x00
      000069 79 06            [12]   69   mov r1, #0x06
      00006B 11 55            [12]   70   acall writ
      00006D 22               [24]   71   ret
                                     72 
      00006E                         73 delay:
      00006E 7A FF            [12]   74   mov r2, #0xff
      000070                         75 delay_outer:
      000070 7B FF            [12]   76   mov r3, #0xff
      000072                         77 delay_inner:
      000072 DB FE            [24]   78   djnz r3, delay_inner
      000074 DA FA            [24]   79   djnz r2, delay_outer
      000076 22               [24]   80   ret
                                     81 
      000077                         82 ldelay:
      000077 11 6E            [12]   83   acall delay
      000079 11 6E            [12]   84   acall delay
      00007B 22               [24]   85   ret
