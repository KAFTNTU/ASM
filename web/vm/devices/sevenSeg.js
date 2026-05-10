const SEG_ON = "rgba(255,204,102,0.95)";
const SEG_OFF = "rgba(255,255,255,0.10)";
class SevenSegDigit {
    constructor(state) {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: state
        });
    }
    write(data) {
        this.state.raw = data & 0xff;
    }
}
export class SevenSeg4 {
    constructor() {
        Object.defineProperty(this, "digits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                { raw: 0xff },
                { raw: 0xff },
                { raw: 0xff },
                { raw: 0xff },
            ]
        });
    }
    digit(index) {
        return new SevenSegDigit(this.digits[index]);
    }
    reset() {
        for (const d of this.digits)
            d.raw = 0xff;
    }
    render(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.64)";
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x, y, 232, 104);
        ctx.strokeRect(x + 0.5, y + 0.5, 231, 103);
        for (let i = 0; i < 4; i++) {
            this.renderDigit(ctx, x + 16 + i * 53, y + 22, this.digits[i].raw);
        }
        ctx.restore();
    }
    renderDigit(ctx, x, y, raw) {
        // MVP convention: bit0..bit6 = segments a..g, bit7 = dp, active-low.
        const seg = (n) => (((raw >>> n) & 1) === 0 ? SEG_ON : SEG_OFF);
        const w = 34;
        const h = 58;
        const t = 6;
        const rect = (rx, ry, rw, rh, c) => {
            ctx.fillStyle = c;
            ctx.fillRect(rx, ry, rw, rh);
        };
        rect(x + t, y, w - 2 * t, t, seg(0)); // a
        rect(x + w - t, y + t, t, h / 2 - t, seg(1)); // b
        rect(x + w - t, y + h / 2, t, h / 2 - t, seg(2)); // c
        rect(x + t, y + h - t, w - 2 * t, t, seg(3)); // d
        rect(x, y + h / 2, t, h / 2 - t, seg(4)); // e
        rect(x, y + t, t, h / 2 - t, seg(5)); // f
        rect(x + t, y + h / 2 - t / 2, w - 2 * t, t, seg(6)); // g
        ctx.beginPath();
        ctx.arc(x + w - 2, y + h - 6, 4, 0, Math.PI * 2);
        ctx.fillStyle = seg(7); // dp
        ctx.fill();
    }
}
