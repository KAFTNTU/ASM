# Lab 1 Status

This note captures the current simulator support for lab 1 only.

## Implemented hardware path

- 8051 ROM executes in-browser through `public/emu8051.wasm`
- `P3.6` selects bus direction
- `P0` carries data
- `P2` carries peripheral address
- `P2 -> 0x00` latches the current write
- peripheral address `0x07` drives the LED bar
- LED bar is modeled as active-low, matching the examples

## Ready-to-run sample

Files:

- `asm/lab1_minimal.asm`
- `public/samples/lab1_minimal.hex`

Behavior:

- initializes the bus
- writes `0xFE` to peripheral `0x07`
- leaves one LED active and loops forever

## What counts as "working" for lab 1 right now

- assembly compiled to Intel HEX can be loaded into the CPU
- writes to the LED latch show up on the stand
- stepping and continuous CPU execution both work

## Remaining gap for richer lab 1 tasks

- no in-browser 8051 assembler yet
- no stock pack of multiple lab1 variants yet
- timing is CPU-driven, but we still need a nicer workflow for loading more user programs

