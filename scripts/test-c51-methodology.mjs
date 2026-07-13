import assert from "node:assert/strict";
import { transpileCToAsm } from "../web/ui/cTranspiler.js";
import { compileAsm } from "../web/ui/asmCompiler.js";

const cases = [
  {
    name: "lab2 bus write and operators",
    source: `
#include <ADUC841.H>
void write(unsigned char Addr, unsigned char Dat) {
  WR = 1;
  P0 = Dat;
  P2 &= 0xF0;
  P2 |= (Addr & 0x0F);
  P2 &= 0xF0;
}
void main(void) {
  write(7, ~5);
  while (1) { }
}`,
  },
  {
    name: "lab3 code array and 16-bit shifts",
    source: `
#include "ADUC841.h"
void write(unsigned char Addr, unsigned char Dat) {
  WR=1; P0=Dat; P2&=0xF0; P2|=(Addr&0x0F); P2&=0xF0;
}
const unsigned char code Hto7[16] = {
  0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,
  0x80,0x98,0x88,0x83,0xC6,0xA1,0x86,0x8E
};
void Static(unsigned int A) {
  write(1,Hto7[(A)&0x0F]);
  write(2,Hto7[(A>>4)&0x0F]);
  write(3,Hto7[(A>>8)&0x0F]);
  write(4,Hto7[(A>>12)&0x0F]);
}
void main(void) { Static(0x1234); while(1){} }
`,
    contains: ["movc a,@a+dptr", "hto7:", "call static"],
  },
  {
    name: "if switch and keyboard decoding",
    source: `
unsigned char readkey(void) {
  unsigned char Key;
  Key = P0 & 0x0F;
  switch (Key) {
    case 1: return 1;
    case 2: return 4;
    case 4: return 7;
    case 8: return 10;
    default: return 255;
  }
}
void main(void) {
  unsigned char key;
  key=readkey();
  if (key!=255) { P0=key; } else { P0=0; }
  while(1){}
}`,
  },
  {
    name: "for while do break continue",
    source: `
void main(void) {
  unsigned char i=0,j=8,sum=0;
  for (i=0,j=8; i<=j; i++,j--) {
    if (i==3) continue;
    sum += i;
    if (sum>30) break;
  }
  do { sum--; } while (sum!=0);
  while (!T0) { P1 ^= 1; }
}`,
  },
  {
    name: "C51 interrupt vectors and using bank",
    source: `
unsigned int Counter=0;
void onINT0(void) interrupt 0 {
  Counter++;
  TH0=0; TL0=0; TR0=1;
}
void OnT0(void) interrupt 1 using 1 {
  Counter=0; TR0=0;
}
void main(void) {
  TMOD=1; IT0=1; EX0=1; ET0=1; EA=1;
  while(1) { if(Counter!=0) P0=Counter; }
}`,
    contains: ["org 0x3", "org 0xb", "reti", "anl psw,#0xe7"],
  },
  {
    name: "operator and constant matrix",
    source: `
#define N 020
const unsigned char code msg[]="A\\n";
void main(void) {
  unsigned char a='A',b='\\x02',c=0;
  signed char s=-2;
  unsigned int w=0x1234;
  unsigned char data buffer[N];
  c = a+b; c-=1; c*=2; c/=3; c%=5;
  c&=0x0F; c|=0x80; c^=1; c<<=1; c>>=1;
  ++c; c++; --c; c--;
  c=(a>b && b!=0) ? sizeof(buffer) : sizeof(int);
  if (!c || ~c) P1=c;
  if (s<0) P2=1;
  if (w==0x1234) P3=1;
}`,
  },
  {
    name: "ADuC841 ADC 12-bit result and wide conditions",
    source: `
unsigned int ADCget(unsigned char channel) {
  unsigned int rslt;
  ADCCON2 = 0x10 | (channel & 0x0F);
  while (ADCI) { }
  rslt = ((ADCDATAH & 0x0F) << 8) | ADCDATAL;
  return rslt;
}
void main(void) {
  unsigned int sum=0;
  ADCCON1=0xBC;
  sum=ADCget(7);
  if(sum<32768) P0=sum;
  sum<<=1;
  while(1){}
}`,
    contains: ["mov adccon1,#0xbc", "mov adccon2", "mov a,adcdatah", "mov a,adcdatal"],
  },
  {
    name: "RAM arrays, pointers and dereference",
    source: `
void main(void) {
  unsigned char data values[4]={1,2,3,4};
  unsigned char *p;
  unsigned char i=0;
  p=&values[0];
  *p=9;
  values[2]=values[0]+values[1];
  for(i=0;i<4;i++) P0=values[i];
}`,
  },
  {
    name: "fixed-width types casts macros enums and extended interrupts",
    source: `
#include <stdint.h>
#include <stdbool.h>
#define LEVEL 2
#define BITSET(value, bit) ((value) | (1 << (bit)))
#if defined(LEVEL) && LEVEL == 1
#define START 1
#elif defined(LEVEL) && LEVEL == 2
#define START 2
#else
#define START 3
#endif
enum Mode { MODE_OFF, MODE_ON = 5, MODE_AUTO };
const uint8_t code table[] = { 0x11, 0x22 };
sbit FLAG = P1^0;
uint8_t narrow(uint16_t value) { return (uint8_t)value; }
int16_t widen(int8_t value) { return (int16_t)value; }
void tick(void) interrupt 10 { P0 = MODE_AUTO; }
void watchdog(void) interrupt 11 { P1 = 1; }
void main(void) {
  register uint8_t value = BITSET(START, 2);
  _Bool ready = false;
  bool enabled = true;
  int8_t negative = -1;
  uint16_t wide = 0x1234;
  int16_t signedWide = -2;
  short count = MODE_AUTO;
  unsigned short limit = 7;
  value = _crol_(value, 1);
  wide = _irol_(wide, 1);
  value = (uint8_t)wide;
  signedWide = widen(negative);
  if (_testbit_(FLAG)) goto done;
  value = table[MODE_OFF];
done:
  WDCON = 0x10;
  WDE = enabled;
  P2 = sizeof(uint8_t);
  P2 = sizeof(uint16_t);
  P2 = sizeof(uint32_t);
  P0 = narrow(wide) + value + ready + signedWide + count + limit;
}`,
    contains: [
      "org 0x53", "org 0x5b", "mov p0,#0x6", "rl a", "__c_user_main_done:", "mov wdcon,#0x10",
      "mov a,#0x1\nmov p2,a", "mov a,#0x2\nmov p2,a", "mov a,#0x4\nmov p2,a",
    ],
    omits: ["org 0x4b"],
  },
  {
    name: "sfr16 pairs reverse rotates and preprocessor diagnostics",
    source: `
#define TEMP_VALUE 1
#undef TEMP_VALUE
#ifndef TEMP_VALUE
#define WORD_VALUE 0x1234
#endif
#pragma SAVE
#warning expected methodology warning
sfr16 TIMER2 = 0xCC;
void main(void) {
  unsigned int snapshot;
  unsigned char octet = 0x81;
  TIMER2 = WORD_VALUE;
  snapshot = TIMER2;
  octet = _cror_(octet, 1);
  TIMER2 = _iror_(snapshot, 1);
  TIMER2 += 1;
  TIMER2++;
  if (TIMER2 == WORD_VALUE) P0 = (unsigned char)TIMER2;
}`,
    contains: ["mov 0xcc,#0x34", "mov 0xcd,#0x12", "mov a,0xcc", "mov b,0xcd", "rr a", "rrc a"],
    omits: ["timer2 data"],
    diagnostics: [
      { level: "hint", message: "#pragma accepted and ignored" },
      { level: "warning", message: "expected methodology warning" },
    ],
  },
];

for (const sample of cases) {
  const transpiled = transpileCToAsm(sample.source);
  const cErrors = transpiled.diagnostics.filter((d) => d.level === "error");
  assert.deepEqual(cErrors, [], `${sample.name}: C errors\n${cErrors.map((d) => `${d.line ?? ""}: ${d.message}`).join("\n")}\n\n${transpiled.asm}`);
  for (const text of sample.contains ?? []) assert.ok(transpiled.asm.includes(text), `${sample.name}: missing ${text}`);
  for (const text of sample.omits ?? []) assert.ok(!transpiled.asm.includes(text), `${sample.name}: unexpectedly contains ${text}`);
  for (const expected of sample.diagnostics ?? []) {
    assert.ok(
      transpiled.diagnostics.some((item) => item.level === expected.level && item.message.includes(expected.message)),
      `${sample.name}: missing ${expected.level} diagnostic containing ${expected.message}`,
    );
  }
  const compiled = compileAsm(transpiled.asm);
  const asmErrors = compiled.diagnostics.filter((d) => d.level === "error");
  assert.deepEqual(asmErrors, [], `${sample.name}: ASM errors\n${asmErrors.map((d) => `${d.line ?? ""}: ${d.message}`).join("\n")}\n\n${transpiled.asm}`);
  assert.ok(compiled.hex.includes(":"), `${sample.name}: no HEX emitted`);
}

const invalidConst = transpileCToAsm(`const unsigned char x=5; void main(){x=1;}`);
assert.equal(invalidConst.ok, false, "assignment to const must be rejected");

const reservedInterrupt = transpileCToAsm(`void reserved(void) interrupt 9 { } void main(void) { }`);
assert.equal(reservedInterrupt.ok, false, "ADuC841 interrupt 9 must remain reserved");
assert.ok(
  reservedInterrupt.diagnostics.some((item) => item.level === "error" && item.message.includes("interrupt number 9")),
  "reserved interrupt diagnostic must identify interrupt 9",
);

const explicitPreprocessorError = transpileCToAsm(`#error deliberate test failure\nvoid main(void) { }`);
assert.equal(explicitPreprocessorError.ok, false, "active #error must reject the translation");
assert.ok(
  explicitPreprocessorError.diagnostics.some((item) => item.level === "error" && item.message.includes("deliberate test failure")),
  "#error text must be preserved in the diagnostic",
);

const invalidSfr16Address = transpileCToAsm(`sfr16 BADPAIR = 0x8C00; void main(void) { }`);
assert.equal(invalidSfr16Address.ok, false, "sfr16 must use the low-byte SFR address, not a packed 0xHHLL pair");
assert.ok(
  invalidSfr16Address.diagnostics.some((item) => item.level === "error" && item.message.includes("0x80..0xFE")),
  "out-of-range sfr16 declarations must explain the valid low-byte address range",
);

console.log(`C51 methodology test passed (${cases.length} embedded programs)`);
