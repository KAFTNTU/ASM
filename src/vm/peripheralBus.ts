export type BusContext = {
  joystick: { x: number; y: number };
  keypadPressed: Set<number>;
};

export interface BusDevice {
  write(data: number): void;
  reset?(): void;
  clear?(): void;
}

export type BusReadProvider = (addr: number, ctx: BusContext) => number | null;

export class PeripheralBus {
  private devices = new Map<number, BusDevice>();
  private readProviders: BusReadProvider[] = [];

  registerDevice(addr: number, device: BusDevice): void {
    this.devices.set(addr & 0xff, device);
  }

  registerReadProvider(provider: BusReadProvider): void {
    this.readProviders.push(provider);
  }

  write(addr: number, data: number): void {
    this.devices.get(addr & 0xff)?.write(data & 0xff);
  }

  read(addr: number, ctx: BusContext = { joystick: { x: 2048, y: 2048 }, keypadPressed: new Set<number>() }): number | null {
    for (const p of this.readProviders) {
      const v = p(addr & 0xff, ctx);
      if (v != null) return v & 0xff;
    }
    return null;
  }
}
