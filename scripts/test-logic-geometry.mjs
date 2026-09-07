// Rotation geometry for the schematic editor.
//
// Components can be rotated in 90-degree steps. Pin positions, bounding boxes
// and the outward lead direction all have to follow, otherwise wires attach to
// the wrong side of a symbol and marquee selection misses rotated parts.

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createComponent,
  createEmptyLogicProject,
  evaluateCircuit,
  getComponentBaseSize,
  getComponentPins,
  getComponentSize,
  getPinDirectionVector,
  getPinPosition,
  normalizeRotation,
} from "../web/ui/logicCircuit.js";

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const near = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message} (got ${actual}, expected ~${expected})`);
  assertions += 1;
};

// --- normalizeRotation clamps anything to the four legal steps -------------
eq(normalizeRotation(undefined), 0, "missing rotation defaults to 0");
eq(normalizeRotation(0), 0, "0 stays 0");
eq(normalizeRotation(90), 90, "90 stays 90");
eq(normalizeRotation(360), 0, "360 wraps to 0");
eq(normalizeRotation(450), 90, "450 wraps to 90");
eq(normalizeRotation(-90), 270, "negative rotation wraps forward");
eq(normalizeRotation(-450), 270, "large negative rotation wraps forward");

const project = createEmptyLogicProject();

// --- Bounding box swaps axes on the quarter turns ---------------------------
{
  const gate = createComponent("AND", 100, 100);
  const base = getComponentBaseSize(gate, project);
  ok(base.width !== base.height, "AND gate body is not square, so the swap is observable");

  gate.rotation = 0;
  eq(getComponentSize(gate, project), base, "0 degrees keeps the base size");
  gate.rotation = 180;
  eq(getComponentSize(gate, project), base, "180 degrees keeps the base size");
  gate.rotation = 90;
  eq(getComponentSize(gate, project), { width: base.height, height: base.width }, "90 degrees swaps the axes");
  gate.rotation = 270;
  eq(getComponentSize(gate, project), { width: base.height, height: base.width }, "270 degrees swaps the axes");
}

// --- Pins stay inside the bounding box at every rotation --------------------
for (const kind of ["AND", "OR", "NOT", "TRISTATE", "DFF", "MUX4", "SEVEN_SEG"]) {
  for (const rotation of [0, 90, 180, 270]) {
    const component = createComponent(kind, 200, 140);
    component.rotation = rotation;
    const size = getComponentSize(component, project);
    for (const pin of getComponentPins(component, project)) {
      const point = getPinPosition(component, pin.id, project);
      const insideX = point.x >= component.x - 0.01 && point.x <= component.x + size.width + 0.01;
      const insideY = point.y >= component.y - 0.01 && point.y <= component.y + size.height + 0.01;
      ok(insideX && insideY, `${kind} @${rotation}: pin ${pin.id} stays within the bounding box`);
    }
  }
}

// --- Pins remain distinct after rotation (no collapsing onto one point) -----
for (const rotation of [0, 90, 180, 270]) {
  const gate = createComponent("AND", 0, 0);
  gate.rotation = rotation;
  const points = getComponentPins(gate, project)
    .map((pin) => { const p = getPinPosition(gate, pin.id, project); return `${p.x.toFixed(2)}:${p.y.toFixed(2)}`; });
  eq(new Set(points).size, points.length, `AND @${rotation}: every pin has a distinct position`);
}

// --- Outward lead direction follows the rotation ----------------------------
{
  const gate = createComponent("AND", 0, 0);
  const inputId = getComponentPins(gate, project).find((pin) => pin.direction === "input").id;
  const outputId = getComponentPins(gate, project).find((pin) => pin.direction === "output").id;

  const expected = {
    0: { input: { x: -1, y: 0 }, output: { x: 1, y: 0 } },
    90: { input: { x: 0, y: -1 }, output: { x: 0, y: 1 } },
    180: { input: { x: 1, y: 0 }, output: { x: -1, y: 0 } },
    270: { input: { x: 0, y: 1 }, output: { x: 0, y: -1 } },
  };
  for (const rotation of [0, 90, 180, 270]) {
    gate.rotation = rotation;
    eq(getPinDirectionVector(gate, inputId, project), expected[rotation].input, `input lead points outward @${rotation}`);
    eq(getPinDirectionVector(gate, outputId, project), expected[rotation].output, `output lead points outward @${rotation}`);
  }
  // Inputs and outputs must always face opposite ways.
  for (const rotation of [0, 90, 180, 270]) {
    gate.rotation = rotation;
    const a = getPinDirectionVector(gate, inputId, project);
    const b = getPinDirectionVector(gate, outputId, project);
    eq({ x: a.x + b.x, y: a.y + b.y }, { x: 0, y: 0 }, `input and output leads are opposed @${rotation}`);
  }
}

// --- Four quarter turns return a component to its starting geometry ---------
{
  const gate = createComponent("OR", 60, 60);
  const before = getComponentPins(gate, project).map((pin) => getPinPosition(gate, pin.id, project));
  gate.rotation = normalizeRotation((gate.rotation ?? 0) + 90 * 4);
  const after = getComponentPins(gate, project).map((pin) => getPinPosition(gate, pin.id, project));
  eq(after, before, "rotating a full turn restores the original pin positions");
}

// --- Rotation is purely visual: it must not change simulation results -------
{
  const rotated = createEmptyLogicProject();
  const circuit = rotated.circuits[rotated.rootCircuitId];
  const a = createComponent("SWITCH", 0, 0);
  const b = createComponent("SWITCH", 0, 100);
  const gate = createComponent("AND", 200, 40);
  const led = createComponent("LED", 400, 40);
  a.state.value = 1;
  b.state.value = 1;
  gate.rotation = 90;
  led.rotation = 180;
  circuit.components.push(a, b, gate, led);

  const inputs = getComponentPins(gate, rotated).filter((pin) => pin.direction === "input");
  const output = getComponentPins(gate, rotated).find((pin) => pin.direction === "output");
  circuit.wires.push(
    { id: "w1", from: { componentId: a.id, pinId: "out" }, to: { componentId: gate.id, pinId: inputs[0].id } },
    { id: "w2", from: { componentId: b.id, pinId: "out" }, to: { componentId: gate.id, pinId: inputs[1].id } },
    { id: "w3", from: { componentId: gate.id, pinId: output.id }, to: { componentId: led.id, pinId: "in" } },
  );

  eq(evaluateCircuit(rotated, rotated.rootCircuitId).pinValues.get(`${led.id}:in`), 1,
    "1 AND 1 lights the LED even when the gate is rotated");
  b.state.value = 0;
  eq(evaluateCircuit(rotated, rotated.rootCircuitId).pinValues.get(`${led.id}:in`), 0,
    "1 AND 0 stays low when the gate is rotated");
}


// --- Seven-segment artwork ---------------------------------------------------
// The digit must be built from segments of a single uniform thickness,
// otherwise numerals look lopsided. Parse the paths straight out of the
// editor source so the test tracks the real artwork.
{
  const source = fs.readFileSync(new URL("../src/ui/logicEditor.ts", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("const segments: Record<string, string>"));
  const paths = {};
  for (const match of block.slice(0, block.indexOf("};")).matchAll(/([a-g]):\s*"([^"]+)"/g)) {
    paths[match[1]] = match[2];
  }
  eq(Object.keys(paths).sort().join(""), "abcdefg", "all seven segments are defined");

  const bounds = (d) => {
    const xs = [];
    const ys = [];
    let x = 0;
    let y = 0;
    for (const token of d.match(/[MLHV][^MLHVZ]*/g) ?? []) {
      const numbers = (token.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
      if (token[0] === "M" || token[0] === "L") { [x, y] = numbers; xs.push(x); ys.push(y); }
      else if (token[0] === "H") { [x] = numbers; xs.push(x); }
      else if (token[0] === "V") { [y] = numbers; ys.push(y); }
    }
    return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
      left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  };

  const horizontal = ["a", "d", "g"].map((key) => bounds(paths[key]));
  const vertical = ["b", "c", "e", "f"].map((key) => bounds(paths[key]));
  const thickness = horizontal[0].height;
  for (const box of horizontal) eq(box.height, thickness, "every horizontal segment has the same thickness");
  for (const box of vertical) eq(box.width, thickness, "vertical segments are as thick as horizontal ones");

  // Symmetry: the two vertical columns must mirror about the digit centre.
  const [b, c, e, f] = vertical;
  eq(b.left, c.left, "the two right-hand segments share a column");
  eq(e.left, f.left, "the two left-hand segments share a column");
  const centre = (horizontal[0].left + horizontal[0].right) / 2;
  near((b.left + b.right) / 2 - centre, centre - (f.left + f.right) / 2, 0.01,
    "left and right columns are symmetric about the digit centre");

  // Segment g must sit exactly midway between a and d.
  const [a, d, g] = horizontal;
  near((g.top + g.bottom) / 2, ((a.top + a.bottom) / 2 + (d.top + d.bottom) / 2) / 2, 0.01,
    "the middle bar is centred between the top and bottom bars");

  // Everything has to stay inside the 118x170 body.
  for (const [name, path] of Object.entries(paths)) {
    const box = bounds(path);
    ok(box.left >= 4 && box.right <= 114 && box.top >= 4 && box.bottom <= 166,
      `segment ${name} stays inside the component body`);
  }
}

console.log(`Logic geometry/rotation tests: PASS (${assertions} assertions)`);
