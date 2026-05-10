                                      1 .module test
                                      2 .area CSEG (CODE)
      000000                          3 run:
      000000 74 12            [12]    4   mov a,#0x12
      000002 80 FC            [24]    5   sjmp run
