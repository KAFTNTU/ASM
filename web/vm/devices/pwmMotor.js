const MAX_RPM = 18;
const STEPPER_SEQUENCE = [0x01, 0x05, 0x04, 0x06, 0x02, 0x0a, 0x08, 0x09];
const STEPPER_STEPS_PER_REVOLUTION = 2048;
const STEPPER_ACTIVITY_HOLD_SECONDS = 0.7;
export class PwmMotor {
    constructor() {
        this.pwm = {
            active: false,
            mode: 0,
            duty: 0,
            frequencyHz: 0,
            periodCounts: 0,
            compareCounts: 0,
            sourceLabel: "PWM off",
            dividerLabel: "/1",
        };
        this.currentRpm = 0;
        this.angleRad = 0;
        this.stepperPhase = 0;
        this.stepperPattern = 0;
        this.stepperModeLabel = "Stepper idle";
        this.stepperCooldown = 0;
        this.stepperStepRateHz = 0;
        this.lastStepperStamp = 0;
        this.stepperIntervals = [];
    }
    reset() {
        this.pwm = {
            active: false,
            mode: 0,
            duty: 0,
            frequencyHz: 0,
            periodCounts: 0,
            compareCounts: 0,
            sourceLabel: "PWM off",
            dividerLabel: "/1",
        };
        this.currentRpm = 0;
        this.angleRad = 0;
        this.stepperPhase = 0;
        this.stepperPattern = 0;
        this.stepperModeLabel = "Stepper idle";
        this.stepperCooldown = 0;
        this.stepperStepRateHz = 0;
        this.lastStepperStamp = 0;
        this.stepperIntervals = [];
    }
    clear() {
        this.reset();
    }
    setPwmState(state) {
        this.pwm = {
            active: state.active,
            mode: state.mode | 0,
            duty: clamp01(state.duty),
            frequencyHz: Math.max(0, state.frequencyHz),
            periodCounts: Math.max(0, state.periodCounts | 0),
            compareCounts: Math.max(0, state.compareCounts | 0),
            sourceLabel: state.sourceLabel,
            dividerLabel: state.dividerLabel,
        };
    }
    write(data) {
        this.applyStepperPattern(data & 0x0f);
    }
    advance(dtSeconds) {
        const dt = Math.max(0, Math.min(0.25, dtSeconds));
        this.stepperCooldown = Math.max(0, this.stepperCooldown - dt);
        const targetRpm = this.computeTargetRpm();
        const settle = Math.min(1, dt * 7.5);
        this.currentRpm += (targetRpm - this.currentRpm) * settle;
        if (!this.isStepperActive()) {
            this.angleRad = normalizeAngle(this.angleRad + ((this.currentRpm / 60) * Math.PI * 2 * dt));
        }
    }
    getTelemetry() {
        const targetRpm = this.computeTargetRpm();
        const stepperActive = this.isStepperActive();
        const active = stepperActive
            ? this.stepperPattern !== 0 || targetRpm > 0.05
            : this.pwm.active;
        const duty = stepperActive
            ? energizedCoils(this.stepperPattern) / 4
            : this.pwm.duty;
        const frequencyHz = stepperActive ? this.stepperStepRateHz : this.pwm.frequencyHz;
        return {
            active,
            duty,
            frequencyHz,
            currentRpm: this.currentRpm,
            targetRpm,
            angleRad: this.angleRad,
            sourceLabel: stepperActive ? "Latch 0x09" : this.pwm.sourceLabel,
            dividerLabel: stepperActive ? `Phase 0x${this.stepperPattern.toString(16).toUpperCase()}` : this.pwm.dividerLabel,
            periodCounts: stepperActive ? STEPPER_SEQUENCE.length : this.pwm.periodCounts,
            compareCounts: stepperActive ? energizedCoils(this.stepperPattern) : this.pwm.compareCounts,
            modeLabel: stepperActive
                ? this.stepperModeLabel
                : (this.pwm.mode === 1 ? "Mode 1 single PWM" : `Mode ${this.pwm.mode}`),
        };
    }
    getScopeSamples(sampleCount = 96) {
        const count = Math.max(8, Math.min(256, sampleCount | 0));
        const duty = clamp01(this.pwm.active ? this.pwm.duty : 0);
        return Array.from({ length: count }, (_, index) => {
            const phase = index / count;
            return phase < duty ? 1 : 0;
        });
    }
    render(ctx, x, y) {
        const telemetry = this.getTelemetry();
        const active = telemetry.currentRpm > 0.15 || telemetry.active;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(6, 10, 16, 0.72)";
        roundRect(ctx, 0, 0, 122, 84, 12, true, false);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        roundRect(ctx, 0.5, 0.5, 121, 83, 12, false, true);
        ctx.fillStyle = "#cfd5df";
        roundRect(ctx, 18, 24, 62, 30, 8, true, false);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        roundRect(ctx, 18.5, 24.5, 61, 29, 8, false, true);
        ctx.fillStyle = "#9aa2af";
        ctx.beginPath();
        ctx.arc(22, 39, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#dfe6f0";
        ctx.fillRect(80, 36, 18, 6);
        ctx.save();
        ctx.translate(98, 39);
        ctx.rotate(telemetry.angleRad);
        ctx.strokeStyle = active ? "#f7b955" : "#8fa0b6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, 0);
        ctx.stroke();
        ctx.fillStyle = active ? "#ffd17d" : "#8fa0b6";
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(8, -5);
        ctx.lineTo(8, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#dde7f8";
        ctx.font = "10px ui-monospace, Consolas, monospace";
        ctx.fillText("MOTOR", 12, 15);
        ctx.fillStyle = active ? "#83e2a5" : "#98a7bc";
        ctx.fillText(`${Math.round(telemetry.currentRpm)} rpm`, 12, 72);
        ctx.restore();
    }
    computeTargetRpm() {
        if (this.isStepperActive()) {
            return Math.min(MAX_RPM, (this.stepperStepRateHz * 60) / STEPPER_STEPS_PER_REVOLUTION);
        }
        if (!this.pwm.active || this.pwm.duty <= 0.001)
            return 0;
        const dutyCurve = Math.pow(this.pwm.duty, 0.92);
        const freqFactor = clamp01(this.pwm.frequencyHz / 450);
        return MAX_RPM * dutyCurve * (0.5 + freqFactor * 0.5);
    }
    isStepperActive() {
        return this.stepperCooldown > 0;
    }
    applyStepperPattern(pattern) {
        const normalized = pattern & 0x0f;
        if (normalized === 0) {
            this.stepperPattern = 0;
            return;
        }
        const index = STEPPER_SEQUENCE.indexOf(normalized);
        if (index < 0) {
            this.stepperPattern = normalized;
            this.stepperModeLabel = "Stepper custom";
            this.stepperCooldown = STEPPER_ACTIVITY_HOLD_SECONDS;
            return;
        }
        if (this.stepperPattern !== 0) {
            const prevIndex = STEPPER_SEQUENCE.indexOf(this.stepperPattern);
            if (prevIndex >= 0) {
                let delta = index - prevIndex;
                if (delta > STEPPER_SEQUENCE.length / 2)
                    delta -= STEPPER_SEQUENCE.length;
                if (delta < -STEPPER_SEQUENCE.length / 2)
                    delta += STEPPER_SEQUENCE.length;
                if (delta !== 0 && Math.abs(delta) <= 2) {
                    this.stepperPhase += delta;
                    this.angleRad = normalizeAngle((this.stepperPhase / STEPPER_STEPS_PER_REVOLUTION) * Math.PI * 2);
                    const stamp = nowSeconds();
                    if (this.lastStepperStamp > 0 && stamp > this.lastStepperStamp) {
                        const interval = stamp - this.lastStepperStamp;
                        this.stepperIntervals.push(interval / Math.abs(delta));
                        if (this.stepperIntervals.length > 12) {
                            this.stepperIntervals.shift();
                        }
                        const avgInterval = this.stepperIntervals.reduce((sum, value) => sum + value, 0) /
                            this.stepperIntervals.length;
                        this.stepperStepRateHz = avgInterval > 0 ? 1 / avgInterval : 0;
                    }
                    this.lastStepperStamp = stamp;
                }
            }
        }
        else {
            this.lastStepperStamp = nowSeconds();
        }
        this.stepperPattern = normalized;
        this.stepperModeLabel = energizedCoils(normalized) >= 2 ? "Stepper half-step" : "Stepper full-step";
        this.stepperCooldown = STEPPER_ACTIVITY_HOLD_SECONDS;
    }
}
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function normalizeAngle(value) {
    const full = Math.PI * 2;
    let out = value % full;
    if (out < 0)
        out += full;
    return out;
}
function energizedCoils(pattern) {
    const bits = pattern & 0x0f;
    return ((bits >> 0) & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1) + ((bits >> 3) & 1);
}
function nowSeconds() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now() / 1000;
    }
    return Date.now() / 1000;
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
