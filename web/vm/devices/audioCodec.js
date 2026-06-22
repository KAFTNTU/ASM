const CPU_CLOCK_HZ = 11059200;
export class AudioCodec {
    constructor() {
        this.state = {
            daccon: 0,
            dac0: 0x800,
            dac1: 0x800,
            p34: 1,
            p35: 1,
            tick: 0,
        };
        this.peak = 0;
        this.armed = false;
        this.micLevel = 0.35;
        this.changeIntervals = [];
        this.lastChangeTick = 0;
    }
    reset() {
        this.state = {
            daccon: 0,
            dac0: 0x800,
            dac1: 0x800,
            p34: 1,
            p35: 1,
            tick: 0,
        };
        this.peak = 0;
        this.armed = false;
        this.micLevel = 0.35;
        this.changeIntervals = [];
        this.lastChangeTick = 0;
    }
    clear() {
        this.reset();
    }
    setState(next) {
        const changed = Math.abs((next.dac0 & 0x0fff) - this.state.dac0) > 2 ||
            Math.abs((next.dac1 & 0x0fff) - this.state.dac1) > 2 ||
            next.p34 !== this.state.p34 ||
            next.p35 !== this.state.p35;
        if (changed) {
            if (this.lastChangeTick > 0 && next.tick > this.lastChangeTick) {
                this.changeIntervals.push(next.tick - this.lastChangeTick);
                if (this.changeIntervals.length > 24)
                    this.changeIntervals.shift();
            }
            this.lastChangeTick = next.tick;
        }
        // F9 (DAC0L low byte) is unique for the DAC path and does not overlap with PWM.
        // Once user code writes real DAC samples here we treat the audio path as armed.
        if ((next.dac0 & 0xff) !== 0 || (next.dac1 & 0xff) !== 0 || next.p34 !== 1 || next.p35 !== 1) {
            this.armed = true;
        }
        this.state = {
            daccon: next.daccon & 0xff,
            dac0: next.dac0 & 0x0fff,
            dac1: next.dac1 & 0x0fff,
            p34: next.p34,
            p35: next.p35,
            tick: Math.max(0, next.tick | 0),
        };
        const amplitude = this.computeAmplitude();
        this.peak = Math.max(amplitude, this.peak * 0.94);
    }
    getTelemetry() {
        const leftVolts = codeToVolts(this.state.dac0);
        const rightVolts = codeToVolts(this.state.dac1);
        const averageVolts = (leftVolts + rightVolts) * 0.5;
        const amplitude = this.computeAmplitude();
        const avgInterval = this.changeIntervals.length
            ? this.changeIntervals.reduce((sum, value) => sum + value, 0) / this.changeIntervals.length
            : 0;
        const frequencyHz = avgInterval > 0 ? Math.min(24000, CPU_CLOCK_HZ / avgInterval / 2) : 0;
        const dacEnabled = this.armed || (this.state.daccon & 0x03) !== 0;
        const active = dacEnabled && (amplitude > 0.02 || frequencyHz > 1 || this.state.p34 === 0 || this.state.p35 === 0);
        return {
            active,
            dacEnabled,
            leftCode: this.state.dac0,
            rightCode: this.state.dac1,
            leftVolts,
            rightVolts,
            averageVolts,
            amplitude,
            peak: this.peak,
            frequencyHz,
            codecClock: this.state.p34,
            codecData: this.state.p35,
            routeLabel: this.state.p34 === 0 || this.state.p35 === 0
                ? "TLV320 / speaker / phones"
                : "DAC0 / DAC1 direct",
            micLevel: this.micLevel,
            micVolts: this.micLevel * 5,
            speakerLevel: amplitude,
            phonesLevel: clamp01(amplitude * 0.92 + (this.state.p34 === 0 || this.state.p35 === 0 ? 0.08 : 0)),
        };
    }
    getScopeSignal() {
        const telemetry = this.getTelemetry();
        return {
            active: telemetry.active,
            duty: clamp01(telemetry.averageVolts / 5),
            frequencyHz: telemetry.frequencyHz,
        };
    }
    setMicLevel(level) {
        if (!Number.isFinite(level))
            return;
        this.micLevel = clamp01(level);
    }
    computeAmplitude() {
        const center = 2.5;
        const left = Math.abs(codeToVolts(this.state.dac0) - center) / center;
        const right = Math.abs(codeToVolts(this.state.dac1) - center) / center;
        return clamp01((left + right) * 0.5);
    }
}
function codeToVolts(value) {
    return ((value & 0x0fff) / 0x0fff) * 5;
}
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
