export class PeripheralBus {
    constructor() {
        Object.defineProperty(this, "devices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "readProviders", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    registerDevice(addr, device) {
        this.devices.set(addr & 0xff, device);
    }
    registerReadProvider(provider) {
        this.readProviders.push(provider);
    }
    write(addr, data) {
        this.devices.get(addr & 0xff)?.write(data & 0xff);
    }
    read(addr, ctx = { joystick: { x: 2048, y: 2048 }, keypadPressed: new Set() }) {
        for (const p of this.readProviders) {
            const v = p(addr & 0xff, ctx);
            if (v != null)
                return v & 0xff;
        }
        return null;
    }
}
