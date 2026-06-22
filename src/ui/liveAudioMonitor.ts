import type { AudioTelemetry } from "../vm/devices/audioCodec";

export class LiveAudioMonitor {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftPan: StereoPannerNode | null = null;
  private rightPan: StereoPannerNode | null = null;
  private armed = false;

  touch(): void {
    this.ensureGraph();
    void this.context?.resume();
  }

  update(telemetry: AudioTelemetry | null): void {
    this.ensureGraph();
    if (!this.context || !this.masterGain || !this.leftGain || !this.rightGain || !this.leftOsc || !this.rightOsc) {
      return;
    }

    const now = this.context.currentTime;
    const targetGain = telemetry?.active ? 0.18 : 0;
    const audibleFrequency = toAudibleFrequency(telemetry?.frequencyHz ?? 0);
    const leftLevel = telemetry ? Math.min(1, Math.abs(telemetry.leftVolts - 2.5) / 2.5) : 0;
    const rightLevel = telemetry ? Math.min(1, Math.abs(telemetry.rightVolts - 2.5) / 2.5) : 0;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.015);

    this.leftGain.gain.cancelScheduledValues(now);
    this.leftGain.gain.linearRampToValueAtTime(leftLevel * 0.8, now + 0.015);
    this.rightGain.gain.cancelScheduledValues(now);
    this.rightGain.gain.linearRampToValueAtTime(rightLevel * 0.8, now + 0.015);

    this.leftOsc.frequency.cancelScheduledValues(now);
    this.leftOsc.frequency.linearRampToValueAtTime(audibleFrequency, now + 0.015);
    this.rightOsc.frequency.cancelScheduledValues(now);
    this.rightOsc.frequency.linearRampToValueAtTime(audibleFrequency, now + 0.015);
  }

  private ensureGraph(): void {
    if (this.armed) return;
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    this.context = new Ctx();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0;

    this.leftGain = this.context.createGain();
    this.rightGain = this.context.createGain();
    this.leftGain.gain.value = 0;
    this.rightGain.gain.value = 0;

    this.leftPan = this.context.createStereoPanner();
    this.rightPan = this.context.createStereoPanner();
    this.leftPan.pan.value = -0.35;
    this.rightPan.pan.value = 0.35;

    this.leftOsc = this.context.createOscillator();
    this.rightOsc = this.context.createOscillator();
    this.leftOsc.type = "square";
    this.rightOsc.type = "square";
    this.leftOsc.frequency.value = 440;
    this.rightOsc.frequency.value = 440;

    this.leftOsc.connect(this.leftGain);
    this.rightOsc.connect(this.rightGain);
    this.leftGain.connect(this.leftPan);
    this.rightGain.connect(this.rightPan);
    this.leftPan.connect(this.masterGain);
    this.rightPan.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    this.leftOsc.start();
    this.rightOsc.start();
    this.armed = true;
  }
}

function toAudibleFrequency(rawHz: number): number {
  if (!Number.isFinite(rawHz) || rawHz <= 1) return 110;
  let hz = Math.max(20, rawHz);
  while (hz > 12000) hz *= 0.5;
  while (hz < 40) hz *= 2;
  return hz;
}
