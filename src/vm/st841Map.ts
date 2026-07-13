import { ADUC841_SFR } from "../mcu/aduc841";

export const ST841_MAP = {
  ledBarAddr: 0x07,
  sevenSegAddrs: [0x01, 0x02, 0x03, 0x04] as const,
  matrixRowsAddr: 0x05,
  matrixColsAddr: 0x06,
  lcdAddr: 0x08,
  keypadColumnAddrs: [0xef, 0xdf, 0xbf] as const,
  keypadColumnAddrsFromExample: [0x60, 0x50, 0x30] as const,
  stepperMotorAddr: 0x09,
  adc: {
    adcon1: 0xef,
    adcon2: 0xd8,
    dataLow: 0xd9,
    dataHigh: 0xda,
    adciMask: 0x80,
    sconvMask: 0x10,
    // Working assumption for the current simulator:
    // ADC6 -> joystick X, ADC7 -> joystick Y.
    xChannel: 0x06,
    yChannel: 0x07,
  },
} as const;

export const SFR = ADUC841_SFR;
