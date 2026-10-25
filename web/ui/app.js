import { Board } from "../vm/board.js?v=mvoawuqj";
import { LedBar } from "../vm/devices/ledBar.js?v=mvoawuqj";
import { SevenSeg4 } from "../vm/devices/sevenSeg.js?v=mvoawuqj";
import { Matrix5x7 } from "../vm/devices/matrix5x7.js?v=mvoawuqj";
import { Keypad4x3 } from "../vm/devices/keypad4x3.js?v=mvoawuqj";
import { Lcd16x2 } from "../vm/devices/lcd16x2.js?v=mvoawuqj";
import { AdcJoystick } from "../vm/devices/adcJoystick.js?v=mvoawuqj";
import { PwmMotor } from "../vm/devices/pwmMotor.js?v=mvoawuqj";
import { AudioCodec } from "../vm/devices/audioCodec.js?v=mvoawuqj";
import { ST841_MAP } from "../vm/st841Map.js?v=mvoawuqj";
import { renderStand } from "./standView.js?v=mvoawuqj";
export function createApp(root) {
    const board = new Board();
    const ledBar = new LedBar();
    const sevenSeg = new SevenSeg4();
    const matrix = new Matrix5x7();
    const keypad = new Keypad4x3();
    const lcd = new Lcd16x2();
    const adc = new AdcJoystick();
    const motor = new PwmMotor();
    const audio = new AudioCodec();
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
    // 1:1 lab mode: LCD protocol goes through 0x08 only.
    board.bus.registerDevice(ST841_MAP.lcdAddr, lcd);
    // Methodical stepper-motor snippets write phases to 0x09.
    board.bus.registerDevice(ST841_MAP.stepperMotorAddr, motor);
    // Keypad is read-only from the MCU side, driven by current P2 address.
    board.bus.registerReadProvider((addr, ctx) => keypad.read(addr, ctx.keypadPressed ?? new Set()));
    board.extraDevices = { lcd, adc, keypad, sevenSeg, matrix, ledBar, motor, audio };
    root.innerHTML = "";
    root.appendChild(renderStand({ board }));
}
