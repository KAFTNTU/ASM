import { PeripheralBus } from "./peripheralBus.js";
export class Board {
    constructor() {
        this.bus = new PeripheralBus();
        this.ports = {
            P0: 0xff,
            P2: 0x00,
            P3: 0xff,
        };
        this.abortSignal = null;
        this.extraDevices = {};
        this.joystick = { x: 2048, y: 2048 };
        this.keypadPressed = new Set();
    }
    reset() {
        this.ports = { P0: 0xff, P2: 0x00, P3: 0xff };
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
                return busVal == null ? 0xff : busVal & 0xff;
            }
        }
        return this.ports[name] & 0xff;
    }
    getPortRaw(name) {
        return this.ports[name] & 0xff;
    }
    writePort(name, value) {
        const v = value & 0xff;
        if (name === "P2") {
            const prev = this.ports.P2 & 0xff;
            this.ports.P2 = v;
            // ST841 latch write: P2 transition ADR -> 0 in TX mode.
            if (prev !== 0x00 && v === 0x00 && this.readBit("P3", 6) === 1) {
                this.bus.write(prev, this.ports.P0 & 0xff);
            }
            return;
        }
        this.ports[name] = v;
    }
    applyCpuPorts(ports) {
        // Keep write latch semantics centralized in writePort("P2", ...).
        this.ports.P3 = ports.p3 & 0xff;
        this.ports.P0 = ports.p0 & 0xff;
        this.writePort("P2", ports.p2 & 0xff);
    }
    readBit(name, bit) {
        const v = (this.ports[name] >>> bit) & 1;
        return (v ? 1 : 0);
    }
    writeBit(name, bit, value) {
        const mask = 1 << bit;
        const cur = this.ports[name] & 0xff;
        this.ports[name] = value ? cur | mask : cur & ~mask;
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
