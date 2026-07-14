export const ADUC841_XTAL_HZ = 11059200;
export const ADUC841_MACHINE_CYCLE_HZ = ADUC841_XTAL_HZ / 12;
const MAX_SAMPLES_PER_SOURCE = 25000;
const MAX_HISTORY_SECONDS = 120;
const EPSILON = 1e-9;
/**
 * Event-based signal history for the virtual ST841/ADuC841 stand.
 *
 * The recorder never invents a waveform. A point is appended only when a
 * simulated port, device-select line or analog output actually changes.
 */
export class ScopeRecorder {
    constructor() {
        this.cycle = 0;
        this.traces = new Map();
    }
    reset() {
        this.cycle = 0;
        this.traces.clear();
    }
    setCycle(cycle) {
        this.cycle = Math.max(0, Math.floor(cycle));
    }
    getCycle() {
        return this.cycle;
    }
    getNowSeconds() {
        return this.cycle / ADUC841_MACHINE_CYCLE_HZ;
    }
    captureDigital(source, level, cycle = this.cycle) {
        this.captureVoltage(source, level ? 5 : 0, cycle);
    }
    captureAnalog(source, voltage, cycle = this.cycle) {
        this.captureVoltage(source, Number.isFinite(voltage) ? voltage : 0, cycle);
    }
    captureVoltage(source, voltage, cycle = this.cycle) {
        const key = String(source);
        const timeSeconds = Math.max(0, cycle) / ADUC841_MACHINE_CYCLE_HZ;
        const value = Number.isFinite(voltage) ? voltage : 0;
        let samples = this.traces.get(key);
        if (!samples) {
            samples = [];
            this.traces.set(key, samples);
        }
        const last = samples[samples.length - 1];
        if (last && Math.abs(last.voltage - value) <= EPSILON)
            return;
        samples.push({ timeSeconds, voltage: value });
        this.trim(samples, timeSeconds);
    }
    getSignal(source) {
        const samples = this.traces.get(source) ?? [];
        const nowSeconds = this.getNowSeconds();
        const copied = samples.slice();
        const currentVoltage = copied.length ? copied[copied.length - 1].voltage : 0;
        const metrics = calculateMetrics(copied, nowSeconds);
        return {
            source,
            samples: copied,
            nowSeconds,
            currentVoltage,
            active: metrics.active,
            duty: metrics.duty,
            frequencyHz: metrics.frequencyHz,
        };
    }
    trim(samples, nowSeconds) {
        const cutoff = nowSeconds - MAX_HISTORY_SECONDS;
        let remove = 0;
        while (remove < samples.length - 1 && samples[remove + 1].timeSeconds < cutoff) {
            remove += 1;
        }
        if (remove > 0)
            samples.splice(0, remove);
        if (samples.length > MAX_SAMPLES_PER_SOURCE) {
            samples.splice(0, samples.length - MAX_SAMPLES_PER_SOURCE);
        }
    }
}
function calculateMetrics(samples, nowSeconds) {
    if (!samples.length)
        return { active: false, duty: 0, frequencyHz: 0 };
    const recentStart = Math.max(samples[0].timeSeconds, nowSeconds - 1);
    const transitions = samples.filter((sample) => sample.timeSeconds >= recentStart);
    const currentVoltage = samples[samples.length - 1].voltage;
    const active = transitions.length > 1 || Math.abs(currentVoltage) > EPSILON;
    const risingEdges = [];
    for (let index = 1; index < samples.length; index += 1) {
        const previous = samples[index - 1];
        const current = samples[index];
        if (current.timeSeconds < recentStart)
            continue;
        if (previous.voltage < 2.5 && current.voltage >= 2.5) {
            risingEdges.push(current.timeSeconds);
        }
    }
    let frequencyHz = 0;
    if (risingEdges.length >= 2) {
        const intervals = [];
        for (let index = 1; index < risingEdges.length; index += 1) {
            const interval = risingEdges[index] - risingEdges[index - 1];
            if (interval > 0)
                intervals.push(interval);
        }
        if (intervals.length) {
            const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
            frequencyHz = average > 0 ? 1 / average : 0;
        }
    }
    const windowEnd = Math.max(nowSeconds, recentStart);
    const duration = Math.max(EPSILON, windowEnd - recentStart);
    let highTime = 0;
    let value = sampleAt(samples, recentStart);
    let cursor = recentStart;
    for (const sample of samples) {
        if (sample.timeSeconds <= recentStart)
            continue;
        if (sample.timeSeconds > windowEnd)
            break;
        if (value >= 2.5)
            highTime += sample.timeSeconds - cursor;
        cursor = sample.timeSeconds;
        value = sample.voltage;
    }
    if (value >= 2.5)
        highTime += windowEnd - cursor;
    return {
        active,
        duty: clamp01(highTime / duration),
        frequencyHz: Number.isFinite(frequencyHz) ? frequencyHz : 0,
    };
}
function sampleAt(samples, timeSeconds) {
    if (!samples.length)
        return 0;
    let low = 0;
    let high = samples.length - 1;
    let result = samples[0].voltage;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const sample = samples[middle];
        if (sample.timeSeconds <= timeSeconds) {
            result = sample.voltage;
            low = middle + 1;
        }
        else {
            high = middle - 1;
        }
    }
    return result;
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
