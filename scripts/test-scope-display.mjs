// Does the oscilloscope draw the truth?
//
// The recorder is tested elsewhere; this checks the *display* maths, by
// rendering into a stub 2D context and measuring the geometry that comes out:
// volts/div scaling, timebase scaling, coupling, and triggered sweeps.

import assert from "node:assert/strict";
import { drawRecordedScope } from "../web/ui/realScope.js";
import { ScopeRecorder, ADUC841_MACHINE_CYCLE_HZ } from "../web/vm/scopeRecorder.js";

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const near = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message} (got ${actual}, expected ~${expected})`);
  assertions += 1;
};

const WIDTH = 1000;
const HEIGHT = 400;

/** Minimal canvas stub that records each stroked path. */
function render(signal, overrides = {}) {
  const paths = [];
  const texts = [];
  let current = null;
  const ctx = {
    lineWidth: 1, strokeStyle: "", fillStyle: "", font: "", shadowColor: "", shadowBlur: 0,
    clearRect() {}, fillRect() {}, setLineDash() {},
    fillText(text) { texts.push(text); },
    beginPath() { current = { points: [], blur: 0 }; },
    moveTo(x, y) { current?.points.push([x, y]); },
    lineTo(x, y) { current?.points.push([x, y]); },
    stroke() { if (current) { current.blur = this.shadowBlur; paths.push(current); current = null; } },
  };
  const view = {
    signalColor: "#0f0", timebaseDivSeconds: 1e-3, voltsDiv: 2.5, scopePanSeconds: 0,
    scopeYOffsetDivs: 0, reverseWave: false, cursorT1Div: 2, cursorT2Div: 8,
    couplingMode: "DC", showAverage: false, triggerEdge: "rising", triggerSource: "A",
    triggerMode: "None", triggerLevelVolts: 2.5, ...overrides,
  };
  drawRecordedScope({ width: WIDTH, height: HEIGHT, getContext: () => ctx }, signal, view);
  // The waveform is the only path drawn with a glow.
  return { wave: paths.find((path) => path.blur > 0), texts };
}

const countEdges = (wave) => wave.points.filter((point, index) =>
  index > 0 && point[0] === wave.points[index - 1][0] && point[1] !== wave.points[index - 1][1]).length;

const risingEdgeXs = (wave) => wave.points.filter((point, index) =>
  index > 0 && point[0] === wave.points[index - 1][0] && point[1] < wave.points[index - 1][1])
  .map((point) => point[0]);

/** A square wave of `frequency` Hz built from real machine cycles. */
function squareWave(frequency, duty = 0.5, periods = 300) {
  const recorder = new ScopeRecorder();
  const cycles = ADUC841_MACHINE_CYCLE_HZ / frequency;
  let cursor = 0;
  for (let index = 0; index < periods; index += 1) {
    recorder.captureDigital("s", 1, Math.round(cursor));
    recorder.captureDigital("s", 0, Math.round(cursor + cycles * duty));
    cursor += cycles;
  }
  recorder.setCycle(Math.round(cursor));
  return { recorder, signal: recorder.getSignal("s"), endCycle: Math.round(cursor) };
}

const { recorder, signal, endCycle } = squareWave(1000);

// --- Vertical axis: volts/div must scale exactly ----------------------------
{
  // zero sits mid-screen (y=200); one division is HEIGHT/8 = 50 px.
  const levels = [...new Set(render(signal, { voltsDiv: 2.5 }).wave.points.map((p) => p[1]))].sort((a, b) => a - b);
  eq(levels, [100, 200], "at 2.5 V/div a 0/5 V square spans exactly two divisions");

  const halved = [...new Set(render(signal, { voltsDiv: 5 }).wave.points.map((p) => p[1]))].sort((a, b) => a - b);
  eq(halved, [150, 200], "doubling volts/div halves the on-screen amplitude");

  const offset = [...new Set(render(signal, { voltsDiv: 2.5, scopeYOffsetDivs: 1 }).wave.points.map((p) => p[1]))].sort((a, b) => a - b);
  eq(offset, [50, 150], "a one-division vertical offset shifts the trace by exactly 50 px");

  const inverted = [...new Set(render(signal, { voltsDiv: 2.5, reverseWave: true }).wave.points.map((p) => p[1]))].sort((a, b) => a - b);
  eq(inverted, [200, 300], "invert mirrors the trace about the zero line");
}

// --- Coupling ---------------------------------------------------------------
{
  const ac = [...new Set(render(signal, { couplingMode: "AC" }).wave.points.map((p) => p[1]))].sort((a, b) => a - b);
  eq(ac, [150, 250], "AC coupling removes the 2.5 V mean, centring the square on zero");

  const gnd = [...new Set(render(signal, { couplingMode: "GND" }).wave.points.map((p) => p[1]))];
  eq(gnd, [200], "GND coupling parks the trace on the zero line");
}

// --- Horizontal axis: timebase must scale exactly ---------------------------
{
  // A 10 ms window of a 1 kHz square holds 10 periods, i.e. 20 transitions.
  near(countEdges(render(signal, { timebaseDivSeconds: 1e-3 }).wave), 20, 1,
    "1 ms/div shows ten periods of a 1 kHz square");
  near(countEdges(render(signal, { timebaseDivSeconds: 5e-4 }).wave), 10, 1,
    "halving the timebase halves the number of periods on screen");
  near(countEdges(render(signal, { timebaseDivSeconds: 2e-3 }).wave), 40, 1,
    "doubling the timebase doubles the number of periods on screen");

  const xs = render(signal, {}).wave.points.map((p) => p[0]);
  ok(Math.min(...xs) >= -0.01 && Math.max(...xs) <= WIDTH + 0.01, "the trace stays within the screen");
}

// --- Triggering -------------------------------------------------------------
{
  // Regression: the sweep used to latch onto the newest edge, which pinned it
  // at the 20 % mark and left the rest of the screen empty because that time
  // had not been recorded yet. A triggered view must be as full as a free one.
  const triggered = render(signal, { triggerMode: "Normal" }).wave;
  const free = render(signal, { triggerMode: "None" }).wave;
  near(countEdges(triggered), countEdges(free), 2,
    "a triggered sweep shows as much of the waveform as an untriggered one");
  ok(countEdges(triggered) >= 18, "a triggered 10 ms sweep of a 1 kHz square is full of edges");

  // The trigger event belongs at 20 % of the sweep.
  ok(risingEdgeXs(triggered).some((x) => Math.abs(x - WIDTH * 0.2) < 1),
    "the triggering edge sits at the 20 % point of the sweep");

  // Stability: repainting at arbitrary later times must not move the picture.
  const positions = new Set();
  for (const extra of [0, 137, 311, 594, 806, 1223]) {
    recorder.setCycle(endCycle + extra);
    const wave = render(recorder.getSignal("s"), { triggerMode: "Normal" }).wave;
    positions.add(risingEdgeXs(wave)[0].toFixed(2));
  }
  eq(positions.size, 1, "the triggered trace is rock steady as time advances");
  recorder.setCycle(endCycle);

  // Falling-edge triggering picks a falling edge.
  const falling = render(signal, { triggerMode: "Normal", triggerEdge: "falling" }).wave;
  const fallingXs = falling.points.filter((point, index) =>
    index > 0 && point[0] === falling.points[index - 1][0] && point[1] > falling.points[index - 1][1])
    .map((point) => point[0]);
  ok(fallingXs.some((x) => Math.abs(x - WIDTH * 0.2) < 1), "a falling-edge trigger lands on a falling edge");

  // Normal mode with nothing to trigger on must refuse to draw, not fake it.
  const flat = new ScopeRecorder();
  flat.captureDigital("dc", 0, 0);
  flat.setCycle(Math.round(ADUC841_MACHINE_CYCLE_HZ * 0.01));
  const dc = flat.getSignal("dc");
  const waiting = render(dc, { triggerMode: "Normal" });
  ok(!waiting.wave, "Normal mode draws no trace while untriggered");
  ok(waiting.texts.includes("WAITING FOR TRIGGER"), "Normal mode says it is waiting");
  ok(render(dc, { triggerMode: "Auto" }).wave, "Auto mode free-runs and still shows the signal");
}

// --- Honesty: never draw a reading that was not measured --------------------
{
  // Recording starts 5 ms into a 10 ms window. The first half of the screen
  // has no data, so nothing may be drawn there.
  const late = new ScopeRecorder();
  late.captureDigital("late", 1, Math.round(ADUC841_MACHINE_CYCLE_HZ * 0.005));
  late.setCycle(Math.round(ADUC841_MACHINE_CYCLE_HZ * 0.010));
  const wave = render(late.getSignal("late"), {}).wave;
  near(wave.points[0][0], 500, 1, "the trace begins where the recording begins, not at the screen edge");
  ok(wave.points.every((point) => point[0] >= 499), "nothing is drawn before the first real sample");

  // A signal with full history must still be drawn edge to edge.
  eq(render(signal, {}).wave.points[0][0], 0, "a fully recorded signal is drawn from the left edge");
}

console.log(`Oscilloscope display tests: PASS (${assertions} assertions)`);
