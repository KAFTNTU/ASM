export class AdcJoystick {
    constructor() {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 512
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 512
        });
    }
    set(x, y) {
        this.x = clamp(x);
        this.y = clamp(y);
    }
    read() {
        return { x: this.x, y: this.y };
    }
}
function clamp(v) {
    return Math.max(0, Math.min(1023, v | 0));
}
