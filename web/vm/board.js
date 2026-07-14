import { PeripheralBus } from "./peripheralBus.js";
import { ScopeRecorder } from "./scopeRecorder.js";
import { ST841_MAP } from "./st841Map.js";
export class Board {
    constructor() {
        this.bus = new PeripheralBus();
        this.scope = new ScopeRecorder();
        this.ports = {
            P0: 0xff,
            P1: 0xff,
            P2: 0x00,
            P3: 0xff,
        };
        // Optional external digital drivers used by the logic-schematic editor.
        // A set mask bit means that an external circuit is actively driving that pin.
        this.externalDriveMask = { P0: 0, P1: 0, P2: 0, P3: 0 };
        this.externalDriveValue = { P0: 0, P1: 0, P2: 0, P3: 0 };
        this.abortSignal = null;
        this.extraDevices = {};
        this.joystick = { x: 2048, y: 2048 };
        this.keypadPressed = new Set();
    }
    reset() {
        this.scope.reset();
        this.ports = { P0: 0xff, P1: 0xff, P2: 0x00, P3: 0xff };
        this.externalDriveMask = { P0: 0, P1: 0, P2: 0, P3: 0 };
        this.externalDriveValue = { P0: 0, P1: 0, P2: 0, P3: 0 };
        this.joystick = { x: 2048, y: 2048 };
        this.abortSignal = null;
        this.keypadPressed.clear();
        for (const device of Object.values(this.extraDevices)) {
            if (device && typeof device.reset === "function") {
                device.reset();
            }
            else if (device && typeof device.clear === "function") {
                device.clear();
            }
        }
        this.captureAllPortBits();
        this.refreshScopeDerivedSignals();
        this.scope.captureAnalog("joystick", (this.joystick.x / 4095) * 5);
        this.scope.captureDigital("motor", 0);
        this.scope.captureAnalog("audio", 0);
    }
    setSimulationCycle(cycle) {
        this.scope.setCycle(cycle);
    }
    setAbortSignal(signal) {
        this.abortSignal = signal;
    }
    formatHex8(v) {
        return "0x" + (v & 0xff).toString(16).padStart(2, "0").toUpperCase();
    }
    readPort(name) {
        if (name === "P0") {
            const p36 = this.readBit("P3", 6);
            if (p36 === 0) {
                const busVal = this.bus.read(this.ports.P2, {
                    joystick: this.joystick,
                    keypadPressed: this.getReadableKeys(),
                });
                return this.applyExternalDrive(name, busVal == null ? 0xff : busVal & 0xff);
            }
        }
        return this.applyExternalDrive(name, this.ports[name] & 0xff);
    }
    getPortRaw(name) {
        return this.ports[name] & 0xff;
    }
    writePort(name, value) {
        const v = value & 0xff;
        const previous = this.ports[name] & 0xff;
        if (previous === v)
            return;
        this.ports[name] = v;
        this.captureChangedPortBits(name, previous, v);
        if (name === "P2") {
            // ST841 latch write: P2 transition ADR -> 0 in TX mode.
            if (previous !== 0x00 && v === 0x00 && this.readBit("P3", 6) === 1) {
                this.bus.write(previous, this.ports.P0 & 0xff);
            }
        }
        if (name === "P2" || name === "P3") {
            this.refreshScopeDerivedSignals();
        }
    }
    applyCpuPorts(ports) {
        // Keep latch semantics and oscilloscope recording centralized in writePort().
        this.writePort("P3", ports.p3 & 0xff);
        this.writePort("P1", ports.p1 & 0xff);
        this.writePort("P0", ports.p0 & 0xff);
        this.writePort("P2", ports.p2 & 0xff);
    }
    readBit(name, bit) {
        const v = (this.readPort(name) >>> bit) & 1;
        return (v ? 1 : 0);
    }
    setExternalDigitalDrive(name, bit, value) {
        if (bit < 0 || bit > 7)
            return;
        const mask = 1 << bit;
        if (value == null) {
            this.externalDriveMask[name] &= ~mask;
        }
        else {
            this.externalDriveMask[name] |= mask;
            if (value)
                this.externalDriveValue[name] |= mask;
            else
                this.externalDriveValue[name] &= ~mask;
        }
        this.captureEffectivePortBit(name, bit);
    }
    getExternalDigitalDrive(name, bit) {
        const mask = 1 << bit;
        if ((this.externalDriveMask[name] & mask) === 0)
            return null;
        return (this.externalDriveValue[name] & mask) !== 0 ? 1 : 0;
    }
    writeBit(name, bit, value) {
        const mask = 1 << bit;
        const cur = this.ports[name] & 0xff;
        this.writePort(name, value ? cur | mask : cur & ~mask);
    }
    async delay(ms) {
        const clamped = Math.max(0, Math.min(60000, ms | 0));
        await new Promise((resolve, reject) => {
            const t = window.setTimeout(resolve, clamped);
            const sig = this.abortSignal;
            if (!sig)
                return;
            const onAbort = () => {
                window.clearTimeout(t);
                sig.removeEventListener("abort", onAbort);
                reject(new Error("Aborted"));
            };
            if (sig.aborted)
                return onAbort();
            sig.addEventListener("abort", onAbort);
        });
    }
    setJoystick(x, y) {
        this.joystick.x = clamp(x);
        this.joystick.y = clamp(y);
        this.extraDevices.adc?.set(this.joystick.x, this.joystick.y);
        this.scope.captureAnalog("joystick", (this.joystick.x / 4095) * 5);
    }
    getJoystick() {
        return { ...this.joystick };
    }
    keypadPress(index, hold = true) {
        this.keypadPressed.add(index);
        this.extraDevices.keypad?.press(index);
        if (!hold) {
            this.keypadPressed.delete(index);
            this.extraDevices.keypad?.release(index);
        }
    }
    keypadRelease(index) {
        this.keypadPressed.delete(index);
        this.extraDevices.keypad?.release(index);
    }
    getPressedKeys() {
        return Array.from(this.keypadPressed).sort((a, b) => a - b);
    }
    getKeypadBusPreview() {
        const pressed = this.getReadableKeys();
        const ctx = { joystick: this.joystick, keypadPressed: pressed };
        const col1 = this.bus.read(0x60, ctx);
        const col2 = this.bus.read(0x50, ctx);
        const col3 = this.bus.read(0x30, ctx);
        return {
            col1: (col1 ?? 0xff) & 0xff,
            col2: (col2 ?? 0xff) & 0xff,
            col3: (col3 ?? 0xff) & 0xff,
        };
    }
    applyExternalDrive(name, latchValue) {
        const mask = this.externalDriveMask[name] & 0xff;
        const external = this.externalDriveValue[name] & 0xff;
        // 8051 GPIO is quasi-bidirectional: an externally driven low always wins;
        // a driven high cannot force a pin high while the MCU latch drives it low.
        return (latchValue & (~mask | external)) & 0xff;
    }
    captureEffectivePortBit(name, bit) {
        this.scope.captureDigital(`${name}.${bit}`, this.readBit(name, bit) === 1);
    }
    captureAllPortBits() {
        for (const name of ["P0", "P1", "P2", "P3"]) {
            const value = this.ports[name] & 0xff;
            for (let bit = 0; bit < 8; bit += 1) {
                this.scope.captureDigital(`${name}.${bit}`, ((value >>> bit) & 1) === 1);
            }
        }
    }
    captureChangedPortBits(name, previous, next) {
        const changed = (previous ^ next) & 0xff;
        for (let bit = 0; bit < 8; bit += 1) {
            if (((changed >>> bit) & 1) === 0)
                continue;
            this.scope.captureDigital(`${name}.${bit}`, ((next >>> bit) & 1) === 1);
        }
    }
    refreshScopeDerivedSignals() {
        const address = this.ports.P2 & 0xff;
        const txMode = this.readBit("P3", 6) === 1;
        const rxMode = !txMode;
        const writeSelected = txMode && address !== 0;
        // General channel is the real peripheral address/write gate, not a template.
        this.scope.captureDigital("general", writeSelected);
        this.scope.captureDigital("sevenSeg", writeSelected && ST841_MAP.sevenSegAddrs.some((item) => item === address));
        this.scope.captureDigital("ledBar", writeSelected && address === ST841_MAP.ledBarAddr);
        this.scope.captureDigital("matrix", writeSelected && (address === ST841_MAP.matrixRowsAddr || address === ST841_MAP.matrixColsAddr));
        this.scope.captureDigital("lcd", writeSelected && address === ST841_MAP.lcdAddr);
        this.scope.captureDigital("keypad", rxMode && isKeypadAddress(address));
    }
    getReadableKeys() {
        return new Set(this.keypadPressed);
    }
    render(ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#101723";
        ctx.fillRect(0, 0, w, h);
        const boardX = 10;
        const boardY = 10;
        const boardW = w - 20;
        const boardH = h - 20;
        const boardFill = ctx.createLinearGradient(boardX, boardY, boardX + boardW, boardY + boardH);
        boardFill.addColorStop(0, "#245748");
        boardFill.addColorStop(0.55, "#296353");
        boardFill.addColorStop(1, "#193d34");
        ctx.fillStyle = boardFill;
        roundRect(ctx, boardX, boardY, boardW, boardH, 14, true, false);
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, boardX, boardY, boardW, boardH, 14, false, false);
        ctx.clip();
        this.extraDevices.sevenSeg?.render(ctx, boardX + boardW - 282, boardY + 34);
        this.extraDevices.ledBar?.render(ctx, boardX + 28, boardY + 154);
        this.extraDevices.matrix?.render(ctx, boardX + 72, boardY + 256);
        this.extraDevices.lcd?.render(ctx, boardX + boardW - 306, boardY + 252);
        ctx.restore();
    }
}
function isKeypadAddress(address) {
    const value = address & 0xff;
    return (value === 0xef ||
        value === 0xdf ||
        value === 0xbf ||
        value === 0x60 ||
        value === 0x50 ||
        value === 0x30);
}
function clamp(v) {
    return Math.max(0, Math.min(4095, v | 0));
}
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill)
        ctx.fill();
    if (stroke)
        ctx.stroke();
}
