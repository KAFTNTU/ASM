export class LedBar {
    constructor() {
        this.value = 0xff; // active-low
    }
    write(data) {
        this.value = data & 0xff;
    }
    reset() {
        this.value = 0xff;
    }
    render(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.64)";
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x, y, 232, 56);
        ctx.strokeRect(x + 0.5, y + 0.5, 231, 55);
        for (let i = 0; i < 8; i++) {
            const on = ((this.value >>> i) & 1) === 0;
            const cx = x + 20 + i * 27;
            const cy = y + 28;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fillStyle = on ? "rgba(120, 255, 140, 1)" : "rgba(45, 60, 62, 0.45)";
            ctx.fill();
            ctx.strokeStyle = on ? "rgba(210, 255, 220, 1)" : "rgba(120, 140, 140, 0.35)";
            ctx.stroke();
        }
        ctx.restore();
    }
}
