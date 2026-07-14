import assert from 'node:assert/strict';
import {
  createEmptyLogicProject,
  createComponent,
  createCustomChip,
  evaluateCircuit,
  stepLogicProject,
  createBoardLogicAdapter,
  expandBuiltinComponent,
  validateProject,
} from '../web/ui/logicCircuit.js';
import { Board } from '../web/vm/board.js';

let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };

function connect(circuit, from, fromPin, to, toPin) {
  circuit.wires.push({
    id: `w${circuit.wires.length}`,
    from: { componentId: from.id, pinId: fromPin },
    to: { componentId: to.id, pinId: toPin },
  });
}

function add(circuit, kind, label = kind) {
  const component = createComponent(kind, 0, 0);
  component.label = label;
  circuit.components.push(component);
  return component;
}

function pin(result, component, pinId) {
  return result.pinValues.get(`${component.id}:${pinId}`);
}

function evaluateGate(kind, values) {
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const inputs = values.map((value, index) => {
    const input = add(circuit, 'SWITCH', `I${index}`);
    input.state.value = value;
    return input;
  });
  const gate = add(circuit, kind);
  if ('inputCount' in gate.props) gate.props.inputCount = values.length;
  inputs.forEach((input, index) => connect(circuit, input, 'out', gate, kind === 'NOT' || kind === 'BUFFER' ? 'in' : `in${index}`));
  return pin(evaluateCircuit(project, circuit.id), gate, 'out');
}

// Basic combinational gate truth tables.
eq(evaluateGate('AND', [1, 1]), 1, 'AND 11');
eq(evaluateGate('AND', [1, 0]), 0, 'AND 10');
eq(evaluateGate('OR', [0, 1]), 1, 'OR 01');
eq(evaluateGate('NAND', [1, 1]), 0, 'NAND 11');
eq(evaluateGate('NOR', [0, 0]), 1, 'NOR 00');
eq(evaluateGate('XOR', [1, 0, 1, 1]), 1, 'four-input XOR parity');
eq(evaluateGate('XNOR', [1, 0]), 0, 'XNOR 10');
eq(evaluateGate('NOT', [1]), 0, 'NOT 1');
eq(evaluateGate('BUFFER', [1]), 1, 'BUFFER 1');

// Full adder covers task 2 and the same carry bit used by majority / bit count.
for (let bits = 0; bits < 8; bits += 1) {
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const inputs = ['a', 'b', 'cin'].map((name, index) => {
    const item = add(circuit, 'SWITCH', name);
    item.state.value = (bits >>> index) & 1;
    return item;
  });
  const adder = add(circuit, 'FULL_ADDER');
  inputs.forEach((input, index) => connect(circuit, input, 'out', adder, ['a', 'b', 'cin'][index]));
  const result = evaluateCircuit(project, circuit.id);
  const total = inputs.reduce((sum, item) => sum + Number(item.state.value), 0);
  eq(pin(result, adder, 'sum'), total & 1, `full-adder sum ${bits}`);
  eq(pin(result, adder, 'cout'), total >= 2 ? 1 : 0, `full-adder carry ${bits}`);
}

// 4:1 MUX and decoder are sufficient for truth-table based functions / 7-seg logic.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const mux = add(circuit, 'MUX4');
  const data = [0, 1, 0, 1].map((value, index) => {
    const item = add(circuit, value ? 'CONST1' : 'CONST0', `D${index}`);
    connect(circuit, item, 'out', mux, `d${index}`);
    return item;
  });
  const s0 = add(circuit, 'SWITCH', 'S0');
  const s1 = add(circuit, 'SWITCH', 'S1');
  connect(circuit, s0, 'out', mux, 's0');
  connect(circuit, s1, 'out', mux, 's1');
  for (let index = 0; index < 4; index += 1) {
    s0.state.value = index & 1;
    s1.state.value = (index >>> 1) & 1;
    eq(pin(evaluateCircuit(project, circuit.id), mux, 'out'), index & 1, `MUX select ${index}`);
  }
}

{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const dec = add(circuit, 'DECODER2TO4');
  const a0 = add(circuit, 'SWITCH', 'A0');
  const a1 = add(circuit, 'SWITCH', 'A1');
  connect(circuit, a0, 'out', dec, 'a0');
  connect(circuit, a1, 'out', dec, 'a1');
  for (let code = 0; code < 4; code += 1) {
    a0.state.value = code & 1;
    a1.state.value = (code >>> 1) & 1;
    const result = evaluateCircuit(project, circuit.id);
    for (let output = 0; output < 4; output += 1) {
      eq(pin(result, dec, `y${output}`), output === code ? 1 : 0, `decoder ${code}/${output}`);
    }
  }
}


// The ten assignment families from the ST841 logic task list can be built
// entirely from the editor primitives. These are engine tests, not bundled
// ready-made user schematics.
function buildSopCircuit(inputCount, minterms) {
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const inputs = Array.from({ length: inputCount }, (_, index) => add(circuit, 'SWITCH', `X${inputCount - index - 1}`));
  const inverted = inputs.map((input, index) => {
    const gate = add(circuit, 'NOT', `nX${index}`);
    connect(circuit, input, 'out', gate, 'in');
    return gate;
  });
  const terms = minterms.map((minterm, termIndex) => {
    const gate = add(circuit, 'AND', `M${termIndex}`);
    gate.props.inputCount = inputCount;
    inputs.forEach((input, index) => {
      const bit = (minterm >>> (inputCount - index - 1)) & 1;
      connect(circuit, bit ? input : inverted[index], 'out', gate, `in${index}`);
    });
    return gate;
  });
  let output;
  if (terms.length === 1) output = terms[0];
  else {
    output = add(circuit, 'OR', 'Y');
    output.props.inputCount = terms.length;
    terms.forEach((term, index) => connect(circuit, term, 'out', output, `in${index}`));
  }
  return { project, circuit, inputs, output };
}

// 0: BCD-to-seven-segment, segment a (active high) for decimal digits 0..9.
{
  const activeDigits = [0, 2, 3, 5, 6, 7, 8, 9];
  const { project, circuit, inputs, output } = buildSopCircuit(4, activeDigits);
  for (let digit = 0; digit <= 9; digit += 1) {
    inputs.forEach((input, index) => { input.state.value = (digit >>> (3 - index)) & 1; });
    eq(pin(evaluateCircuit(project, circuit.id), output, 'out'), activeDigits.includes(digit) ? 1 : 0, `segment a digit ${digit}`);
  }
}

// 1: three-input majority vote.
{
  const active = [3, 5, 6, 7];
  const { project, circuit, inputs, output } = buildSopCircuit(3, active);
  for (let code = 0; code < 8; code += 1) {
    inputs.forEach((input, index) => { input.state.value = (code >>> (2 - index)) & 1; });
    eq(pin(evaluateCircuit(project, circuit.id), output, 'out'), active.includes(code) ? 1 : 0, `majority ${code}`);
  }
}

// 3: calendar of 31-day months. Four bits are required to encode 1..12.
{
  const active = [1, 3, 5, 7, 8, 10, 12];
  const { project, circuit, inputs, output } = buildSopCircuit(4, active);
  for (let month = 1; month <= 12; month += 1) {
    inputs.forEach((input, index) => { input.state.value = (month >>> (3 - index)) & 1; });
    eq(pin(evaluateCircuit(project, circuit.id), output, 'out'), active.includes(month) ? 1 : 0, `month ${month}`);
  }
}

// 4: weekends, codes 110 and 111.
{
  const { project, circuit, inputs, output } = buildSopCircuit(3, [6, 7]);
  for (let day = 1; day <= 7; day += 1) {
    inputs.forEach((input, index) => { input.state.value = (day >>> (2 - index)) & 1; });
    eq(pin(evaluateCircuit(project, circuit.id), output, 'out'), day >= 6 ? 1 : 0, `weekend ${day}`);
  }
}

// 5/6: even and odd parity bits for four inputs.
for (let code = 0; code < 16; code += 1) {
  const values = [3, 2, 1, 0].map((bit) => (code >>> bit) & 1);
  const ones = values.reduce((sum, value) => sum + value, 0);
  eq(evaluateGate('XOR', values), ones & 1, `even parity bit ${code}`);
  eq(evaluateGate('XNOR', values), (ones & 1) ? 0 : 1, `odd parity bit ${code}`);
}

// 7/9: thermometer decoder and population count share the full-adder outputs.
for (const [code, expected] of [[0b000, 0], [0b001, 1], [0b011, 2], [0b111, 3]]) {
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const inputs = [0, 1, 2].map((bit) => {
    const input = add(circuit, 'SWITCH', `X${bit}`);
    input.state.value = (code >>> bit) & 1;
    return input;
  });
  const adder = add(circuit, 'FULL_ADDER');
  connect(circuit, inputs[0], 'out', adder, 'a');
  connect(circuit, inputs[1], 'out', adder, 'b');
  connect(circuit, inputs[2], 'out', adder, 'cin');
  const result = evaluateCircuit(project, circuit.id);
  const actual = Number(pin(result, adder, 'sum')) | (Number(pin(result, adder, 'cout')) << 1);
  eq(actual, expected, `thermometer decoder ${code.toString(2)}`);
}

// 8: thermometer-code error (valid: 000, 001, 011, 111).
{
  const invalid = [0b010, 0b100, 0b101, 0b110];
  const { project, circuit, inputs, output } = buildSopCircuit(3, invalid);
  for (let code = 0; code < 8; code += 1) {
    inputs.forEach((input, index) => { input.state.value = (code >>> (2 - index)) & 1; });
    eq(pin(evaluateCircuit(project, circuit.id), output, 'out'), invalid.includes(code) ? 1 : 0, `thermometer error ${code}`);
  }
}

// Editable nested microchip: external A/B/Y pins map to an internal AND gate.
{
  const project = createEmptyLogicProject();
  const root = project.circuits[project.rootCircuitId];
  const chip = createCustomChip(project, root.id, 'MAJ_PART', 2, 1, 300, 200);
  const nested = project.circuits[chip.subcircuitId];
  const [a, b] = nested.components.filter((item) => item.kind === 'PORT_IN');
  const [y] = nested.components.filter((item) => item.kind === 'PORT_OUT');
  const gate = add(nested, 'AND');
  connect(nested, a, 'out', gate, 'in0');
  connect(nested, b, 'out', gate, 'in1');
  connect(nested, gate, 'out', y, 'in');
  const swA = add(root, 'SWITCH', 'A');
  const swB = add(root, 'SWITCH', 'B');
  const led = add(root, 'LED', 'Y');
  connect(root, swA, 'out', chip, 'in0');
  connect(root, swB, 'out', chip, 'in1');
  connect(root, chip, 'out0', led, 'in');
  swA.state.value = 1;
  swB.state.value = 1;
  eq(pin(evaluateCircuit(project, root.id), led, 'in'), 1, 'nested custom chip evaluates');
  swB.state.value = 0;
  eq(pin(evaluateCircuit(project, root.id), led, 'in'), 0, 'nested custom chip updates');
}

// D flip-flop and 4-bit counter update only on rising edges.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const d = add(circuit, 'SWITCH', 'D');
  const clk = add(circuit, 'SWITCH', 'CLK');
  const reset = add(circuit, 'CONST0', 'R');
  const ff = add(circuit, 'DFF');
  connect(circuit, d, 'out', ff, 'd');
  connect(circuit, clk, 'out', ff, 'clk');
  connect(circuit, reset, 'out', ff, 'reset');
  d.state.value = 1;
  clk.state.value = 0;
  stepLogicProject(project, circuit.id);
  clk.state.value = 1;
  let result = stepLogicProject(project, circuit.id);
  eq(pin(result, ff, 'q'), 1, 'DFF captures D on rise');
  d.state.value = 0;
  result = stepLogicProject(project, circuit.id);
  eq(pin(result, ff, 'q'), 1, 'DFF holds without new rise');
}

{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const clk = add(circuit, 'SWITCH', 'CLK');
  const reset = add(circuit, 'CONST0', 'R');
  const counter = add(circuit, 'COUNTER4');
  connect(circuit, clk, 'out', counter, 'clk');
  connect(circuit, reset, 'out', counter, 'reset');
  for (let pulse = 0; pulse < 5; pulse += 1) {
    clk.state.value = 0; stepLogicProject(project, circuit.id);
    clk.state.value = 1; stepLogicProject(project, circuit.id);
  }
  const result = evaluateCircuit(project, circuit.id);
  const count = [0, 1, 2, 3].reduce((sum, bit) => sum | (Number(pin(result, counter, `q${bit}`)) << bit), 0);
  eq(count, 5, 'four-bit counter counts rising edges');
}

// Multiple active drivers create X and a conflict marker.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const zero = add(circuit, 'CONST0');
  const one = add(circuit, 'CONST1');
  const led = add(circuit, 'LED');
  connect(circuit, zero, 'out', led, 'in');
  connect(circuit, one, 'out', led, 'in');
  const result = evaluateCircuit(project, circuit.id);
  eq(pin(result, led, 'in'), 'X', 'driver conflict becomes X');
  ok(result.conflicts.has(`${led.id}:in`), 'driver conflict is reported');
}

// ADuC/ST841 integration adapter reads pins and applies external quasi-bidirectional drive.
{
  const board = new Board();
  board.reset();
  const adapter = createBoardLogicAdapter(board);
  board.writeBit('P1', 0, 1);
  eq(adapter.readPin('P1.0'), 1, 'adapter reads ADuC pin');
  adapter.drivePin('P1.0', 0);
  eq(board.readBit('P1', 0), 0, 'external low drives released GPIO low');
  adapter.drivePin('P1.0', 'Z');
  eq(board.readBit('P1', 0), 1, 'release restores MCU latch level');
  board.writeBit('P1', 0, 0);
  adapter.drivePin('P1.0', 1);
  eq(board.readBit('P1', 0), 0, 'external high does not override MCU low');
  adapter.releaseAll();
}


// v7: four-state propagation uses controlling values instead of turning every Z into X.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const zero = add(circuit, 'CONST0');
  const one = add(circuit, 'CONST1');
  const and = add(circuit, 'AND');
  const or = add(circuit, 'OR');
  connect(circuit, zero, 'out', and, 'in0'); // in1 remains Z
  connect(circuit, one, 'out', or, 'in0');  // in1 remains Z
  let result = evaluateCircuit(project, circuit.id);
  eq(pin(result, and, 'out'), 0, 'AND controlling zero dominates Z');
  eq(pin(result, or, 'out'), 1, 'OR controlling one dominates Z');
}

// v7: tri-state buffer releases the line and can share it with another driver.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const data = add(circuit, 'CONST1');
  const enable = add(circuit, 'SWITCH');
  const tri = add(circuit, 'TRISTATE');
  const zero = add(circuit, 'CONST0');
  const probe = add(circuit, 'PROBE');
  connect(circuit, data, 'out', tri, 'in');
  connect(circuit, enable, 'out', tri, 'en');
  connect(circuit, tri, 'out', probe, 'in');
  connect(circuit, zero, 'out', probe, 'in');
  enable.state.value = 0;
  let result = evaluateCircuit(project, circuit.id);
  eq(pin(result, tri, 'out'), 'Z', 'tri-state disabled output is Z');
  eq(pin(result, probe, 'in'), 0, 'released tri-state does not conflict');
  enable.state.value = 1;
  result = evaluateCircuit(project, circuit.id);
  eq(pin(result, probe, 'in'), 'X', 'enabled opposite driver creates conflict');
}

// v7: four-bit DIP source exposes independent bits for compact code entry.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const dip = add(circuit, 'DIP4');
  dip.state.value = 0b1010;
  const result = evaluateCircuit(project, circuit.id);
  eq(pin(result, dip, 'q0'), 0, 'DIP bit 0');
  eq(pin(result, dip, 'q1'), 1, 'DIP bit 1');
  eq(pin(result, dip, 'q2'), 0, 'DIP bit 2');
  eq(pin(result, dip, 'q3'), 1, 'DIP bit 3');
}

// v7: built-in full adder can be expanded to a nested editable circuit without breaking external wires.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const a = add(circuit, 'SWITCH', 'A');
  const b = add(circuit, 'SWITCH', 'B');
  const cin = add(circuit, 'SWITCH', 'Cin');
  const adder = add(circuit, 'FULL_ADDER', 'Adder');
  const sum = add(circuit, 'PROBE', 'S');
  const carry = add(circuit, 'PROBE', 'Co');
  connect(circuit, a, 'out', adder, 'a');
  connect(circuit, b, 'out', adder, 'b');
  connect(circuit, cin, 'out', adder, 'cin');
  connect(circuit, adder, 'sum', sum, 'in');
  connect(circuit, adder, 'cout', carry, 'in');
  a.state.value = 1; b.state.value = 1; cin.state.value = 0;
  const before = evaluateCircuit(project, circuit.id);
  eq(pin(before, sum, 'in'), 0, 'expanded adder baseline sum');
  eq(pin(before, carry, 'in'), 1, 'expanded adder baseline carry');
  const nestedId = expandBuiltinComponent(project, circuit.id, adder.id);
  ok(Boolean(nestedId), 'full adder expanded');
  eq(adder.kind, 'CUSTOM', 'expanded block becomes custom chip');
  eq(validateProject(project).length, 0, 'expanded project validates');
  const after = evaluateCircuit(project, circuit.id);
  eq(pin(after, sum, 'in'), 0, 'expanded adder keeps sum');
  eq(pin(after, carry, 'in'), 1, 'expanded adder keeps carry');
}

// v7: unstable combinational feedback is reported instead of silently presenting a result.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const inverter = add(circuit, 'NOT');
  connect(circuit, inverter, 'out', inverter, 'in');
  const result = evaluateCircuit(project, circuit.id);
  ok(result.warnings.some((warning) => warning.includes('комбінаційний цикл')), 'feedback instability warning');
}

// v7: imported projects reject malformed pin directions.
{
  const project = createEmptyLogicProject();
  const circuit = project.circuits[project.rootCircuitId];
  const a = add(circuit, 'SWITCH');
  const b = add(circuit, 'SWITCH');
  circuit.wires.push({ id: 'bad', from: { componentId: a.id, pinId: 'out' }, to: { componentId: b.id, pinId: 'out' } });
  ok(validateProject(project).some((error) => error.includes('закінчується не на вході')), 'invalid destination pin rejected');
}

console.log(`Logic-circuit editor tests: PASS (${assertions} assertions)`);
