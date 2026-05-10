#include "../vendor/emu8051/emu8051.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// Minimal WASM-facing wrapper around jarikomppa/emu8051 core.
// Goal: run 8051 CPU in-browser (WASI), and let JS map P0/P2/P3.6 to the stand.

static uint16_t pow2_mask(uint32_t size_pow2)
{
  // size must be a power of 2 and >= 1024
  if (size_pow2 < 1024) size_pow2 = 1024;
  // Make sure it's power of 2 (best-effort).
  // If not, round up to next power of two.
  uint32_t v = size_pow2;
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  v++;
  if (v > 65536) v = 65536;
  return (uint16_t)(v - 1);
}

// Exported API

__attribute__((export_name("emu_create")))
struct em8051 *emu_create(uint32_t code_mem_size, uint32_t xdata_size)
{
  struct em8051 *cpu = (struct em8051 *)calloc(1, sizeof(struct em8051));
  if (!cpu) return 0;

  uint16_t codeMask = pow2_mask(code_mem_size);
  uint16_t xMask = pow2_mask(xdata_size);

  cpu->mCodeMemMaxIdx = codeMask;
  cpu->mCodeMem = (unsigned char *)calloc((size_t)codeMask + 1, 1);
  if (!cpu->mCodeMem) {
    free(cpu);
    return 0;
  }

  cpu->mExtDataMaxIdx = xMask;
  cpu->mExtData = (unsigned char *)calloc((size_t)xMask + 1, 1);
  if (!cpu->mExtData) {
    free(cpu->mCodeMem);
    free(cpu);
    return 0;
  }

  reset(cpu, true);
  return cpu;
}

__attribute__((export_name("emu_destroy")))
void emu_destroy(struct em8051 *cpu)
{
  if (!cpu) return;
  if (cpu->mCodeMem) free(cpu->mCodeMem);
  if (cpu->mExtData) free(cpu->mExtData);
  free(cpu);
}

__attribute__((export_name("emu_reset")))
void emu_reset(struct em8051 *cpu, int wipe)
{
  if (!cpu) return;
  reset(cpu, wipe ? true : false);
}

__attribute__((export_name("emu_tick")))
int emu_tick(struct em8051 *cpu)
{
  if (!cpu) return 0;
  return tick(cpu) ? 1 : 0;
}

__attribute__((export_name("emu_get_pc")))
uint16_t emu_get_pc(struct em8051 *cpu)
{
  if (!cpu) return 0;
  return cpu->mPC;
}

__attribute__((export_name("emu_get_sfr")))
uint8_t emu_get_sfr(struct em8051 *cpu, uint8_t sfr_addr)
{
  if (!cpu) return 0;
  if (sfr_addr < 0x80) return 0;
  return cpu->mSFR[sfr_addr - 0x80];
}

__attribute__((export_name("emu_set_sfr")))
void emu_set_sfr(struct em8051 *cpu, uint8_t sfr_addr, uint8_t value)
{
  if (!cpu) return;
  if (sfr_addr < 0x80) return;
  cpu->mSFR[sfr_addr - 0x80] = value;
}

__attribute__((export_name("emu_write_code")))
void emu_write_code(struct em8051 *cpu, uint16_t addr, uint8_t value)
{
  if (!cpu) return;
  cpu->mCodeMem[addr & cpu->mCodeMemMaxIdx] = value;
}

__attribute__((export_name("emu_read_code")))
uint8_t emu_read_code(struct em8051 *cpu, uint16_t addr)
{
  if (!cpu) return 0;
  return cpu->mCodeMem[addr & cpu->mCodeMemMaxIdx];
}

__attribute__((export_name("emu_read_iram")))
uint8_t emu_read_iram(struct em8051 *cpu, uint8_t addr)
{
  if (!cpu) return 0;
  if (addr < 0x80) return cpu->mLowerData[addr];
  if (cpu->mUpperData) return cpu->mUpperData[addr - 0x80];
  return 0;
}

__attribute__((export_name("emu_read_xram")))
uint8_t emu_read_xram(struct em8051 *cpu, uint16_t addr)
{
  if (!cpu || !cpu->mExtData) return 0;
  return cpu->mExtData[addr & cpu->mExtDataMaxIdx];
}
