export const MOTOR_PWM_SAMPLE = `$include (mod841)

PWMCON   DATA  0D7H
PWM0L    DATA  0FAH
PWM0H    DATA  0FBH
PWM1L    DATA  0FCH
PWM1H    DATA  0FDH
ADCCON1  DATA  0EFH
ADCCON2  DATA  0D8H
ADCDATAL DATA  0D9H
ADCDATAH DATA  0DAH
ADCI     BIT   0DFH

ORG 0000H
LJMP Start

ORG 0030H
Start:
  ACALL Init_PWM
  ACALL ADCInit

  MOV PWM1H, #00FH
  MOV PWM1L, #0FFH
  MOV PWM0H, #007H
  MOV PWM0L, #0FFH

MainLoop:
  ACALL Measurev
  MOV PWM0H, R7
  MOV PWM0L, R6
  SJMP MainLoop

Init_PWM:
  MOV PWMCON, #00010111B
  RET

ADCInit:
  MOV ADCCON1, #10111100B
  RET

Measurev:
  MOV ADCCON2, #00010110B
WaitAdc:
  JNB ADCI, WaitAdc
  MOV A, ADCDATAH
  ANL A, #0FH
  MOV R7, A
  MOV R6, ADCDATAL
  RET

END
`;
export const MOTOR_PWM_C_SAMPLE = `#include <mod841.h>

void init_pwm(void) {
  PWMCON = 0x17;
  PWM1H = 0x0F;
  PWM1L = 0xFF;
}

void set_speed(unsigned char hi, unsigned char lo) {
  PWM0H = hi;
  PWM0L = lo;
}

void main(void) {
  init_pwm();
  while (1) {
    set_speed(0x07, 0xFF);
    _nop_();
  }
}
`;
