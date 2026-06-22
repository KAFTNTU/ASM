export const AUDIO_PCM_ASM_SAMPLE = `DAC0L   DATA 0F9H
DAC0H   DATA 0FAH
DAC1L   DATA 0FBH
DAC1H   DATA 0FCH
DACCON  DATA 0FDH

ORG 0000H
LJMP Start

ORG 0030H
Start:
  MOV DACCON, #03H

Loop:
  MOV DAC0H, #0FH
  MOV DAC0L, #0FFH
  MOV DAC1H, #0FH
  MOV DAC1L, #0FFH
  ACALL Delay
  MOV DAC0H, #00H
  MOV DAC0L, #00H
  MOV DAC1H, #00H
  MOV DAC1L, #00H
  ACALL Delay
  SJMP Loop

Delay:
  MOV R7, #35
DelayOuter:
  MOV R6, #200
DelayInner:
  DJNZ R6, DelayInner
  DJNZ R7, DelayOuter
  RET

END
`;
export const AUDIO_PCM_C_SAMPLE = `#include <mod841.h>

void wait_short(void) {
  unsigned int i;
  for (i = 0; i < 180; i++) {
    _nop_();
  }
}

void write_pair(unsigned char leftH, unsigned char leftL, unsigned char rightH, unsigned char rightL) {
  daccon = 0x03;
  dac0h = leftH;
  dac0l = leftL;
  dac1h = rightH;
  dac1l = rightL;
}

void main(void) {
  while (1) {
    write_pair(0x0F, 0xFF, 0x0F, 0xFF);
    wait_short();

    write_pair(0x00, 0x00, 0x00, 0x00);
    wait_short();
  }
}
`;
