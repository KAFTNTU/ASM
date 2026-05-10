import { Board } from "../vm/board";
import { LedBar } from "../vm/devices/ledBar";
import { SevenSeg4 } from "../vm/devices/sevenSeg";
import { Matrix5x7 } from "../vm/devices/matrix5x7";
import { Keypad4x3 } from "../vm/devices/keypad4x3";
import { Lcd16x2 } from "../vm/devices/lcd16x2";
import { AdcJoystick } from "../vm/devices/adcJoystick";
import { ST841_MAP } from "../vm/st841Map";
import { renderStand } from "./standView";
import { exampleScripts } from "./examples";

export function createApp(root: HTMLDivElement): void {
  const board = new Board();

  const ledBar = new LedBar();
  const sevenSeg = new SevenSeg4();
  const matrix = new Matrix5x7();
  const keypad = new Keypad4x3();
  const lcd = new Lcd16x2();
  const adc = new AdcJoystick();

  // Addresses from the PDF examples:
  // - LED line: addr 0x07
  // - 7-seg digits: addr 0x01..0x04
  // - LED matrix rows: addr 0x05 (active-low), cols: addr 0x06 (active-high)
  board.bus.registerDevice(ST841_MAP.ledBarAddr, ledBar);
  // Manual mapping says 0x01 is the rightmost digit and 0x04 is the leftmost.
  board.bus.registerDevice(ST841_MAP.sevenSegAddrs[0], sevenSeg.digit(3));
  board.bus.registerDevice(ST841_MAP.sevenSegAddrs[1], sevenSeg.digit(2));
  board.bus.registerDevice(ST841_MAP.sevenSegAddrs[2], sevenSeg.digit(1));
  board.bus.registerDevice(ST841_MAP.sevenSegAddrs[3], sevenSeg.digit(0));
  board.bus.registerDevice(ST841_MAP.matrixRowsAddr, matrix.rowsDevice());
  board.bus.registerDevice(ST841_MAP.matrixColsAddr, matrix.colsDevice());
  // 1:1 lab mode: LCD protocol goes through 0x08 (RS is encoded in DAT bit0).
  board.bus.registerDevice(ST841_MAP.lcdAddr, lcd);
  // Compatibility with lab snippets using split LCD addr:
  // 0x08 for commands, 0x09 for data.
  board.bus.registerDevice((ST841_MAP.lcdAddr + 1) & 0xff, {
    write(data: number) {
      lcd.writeDataByte(data);
    },
  });

  // Keypad is read-only from the MCU side, driven by current P2 address.
  board.bus.registerReadProvider((addr, ctx) => keypad.read(addr, ctx.keypadPressed ?? new Set()));

  board.extraDevices = { lcd, adc, keypad, sevenSeg, matrix, ledBar };

  root.innerHTML = "";
  root.appendChild(renderStand({ board, exampleScripts }));
}
