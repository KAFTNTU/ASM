export class AdcJoystick {
    constructor() {
        this.x = 512;
        this.y = 512;
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
