const SEG_ON = "rgba(255,69,63,1)";
const SEG_OFF = "rgba(255,255,255,0.10)";
class SevenSegDigit {
    constructor(state) {
        this.state = state;
    }
    write(data) {
        this.state.raw = data & 0xff;
    }
}
export class SevenSeg4 {
    constructor() {
        this.digits = [
            { raw: 0xff },
            { raw: 0xff },
            { raw: 0xff },
            { raw: 0xff },
        ];
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
        // Gap between neighbouring segments. Plain rectangles butted together made
        // "0" read as a solid block and let the middle bar run straight through
        // the b/c columns; real displays leave a clear gap and mitre the ends.
        const gap = 1.6;
        const half = t / 2;
        // A segment drawn as a hexagon: a bar of thickness t whose ends taper to a
        // point, so adjacent segments meet at a diagonal seam like real LED bars.
        const bar = (cx0, cy0, cx1, cy1, colour) => {
            const on = colour === SEG_ON;
            const horizontal = cy0 === cy1;
            ctx.shadowColor = on ? "rgba(255, 55, 48, 0.9)" : "transparent";
            ctx.shadowBlur = on ? 10 : 0;
            ctx.fillStyle = colour;
            ctx.beginPath();
            if (horizontal) {
                ctx.moveTo(cx0, cy0);
                ctx.lineTo(cx0 + half, cy0 - half);
                ctx.lineTo(cx1 - half, cy0 - half);
                ctx.lineTo(cx1, cy0);
                ctx.lineTo(cx1 - half, cy0 + half);
                ctx.lineTo(cx0 + half, cy0 + half);
            }
            else {
                ctx.moveTo(cx0, cy0);
                ctx.lineTo(cx0 + half, cy0 + half);
                ctx.lineTo(cx0 + half, cy1 - half);
                ctx.lineTo(cx0, cy1);
                ctx.lineTo(cx0 - half, cy1 - half);
                ctx.lineTo(cx0 - half, cy0 + half);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        };
        // Centre lines of the digit skeleton.
        const left = x + half;
        const right = x + w - half;
        const top = y + half;
        const middle = y + h / 2;
        const bottom = y + h - half;
        bar(left + gap, top, right - gap, top, seg(0)); // a
        bar(right, top + gap, right, middle - gap, seg(1)); // b
        bar(right, middle + gap, right, bottom - gap, seg(2)); // c
        bar(left + gap, bottom, right - gap, bottom, seg(3)); // d
        bar(left, middle + gap, left, bottom - gap, seg(4)); // e
        bar(left, top + gap, left, middle - gap, seg(5)); // f
        bar(left + gap, middle, right - gap, middle, seg(6)); // g
        // Decimal point, clear of the digit body so it cannot sit on segment c.
        ctx.beginPath();
        ctx.arc(x + w + 5, bottom, 3, 0, Math.PI * 2);
        const dp = seg(7);
        ctx.shadowColor = dp === SEG_ON ? "rgba(255, 55, 48, 0.9)" : "transparent";
        ctx.shadowBlur = dp === SEG_ON ? 10 : 0;
        ctx.fillStyle = dp; // dp
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
