import assert from 'node:assert/strict';
import {
  cloneProject,
  createComponent,
  createEmptyLogicProject,
  evaluateCircuit,
  validateProject,
} from '../web/ui/logicCircuit.js';

let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };

const project = createEmptyLogicProject();
const circuit = project.circuits[project.rootCircuitId];
const source = createComponent('SWITCH', 40, 40);
const target = createComponent('LED', 260, 40);
source.state.value = 1;
circuit.components.push(source, target);

const legacyWire = {
  id: 'legacy-wire',
  from: { componentId: source.id, pinId: 'out' },
  to: { componentId: target.id, pinId: 'in' },
};
circuit.wires.push(legacyWire);

eq(validateProject(project).length, 0, 'legacy wire without routing metadata remains valid');
ok(!('bendPoints' in legacyWire), 'legacy wire may omit bend points');

legacyWire.color = '#123456';
legacyWire.bendPoints = [{ x: 140, y: 80 }, { x: 200, y: 80 }];
const saved = cloneProject(project);
const savedWire = saved.circuits[saved.rootCircuitId].wires[0];
eq(savedWire.color, '#123456', 'wire colour survives JSON cloning');
eq(savedWire.bendPoints.length, 2, 'wire bend points survive JSON cloning');
eq(evaluateCircuit(saved, saved.rootCircuitId).pinValues.get(`${target.id}:in`), 1, 'routing metadata does not change circuit evaluation');

savedWire.bendPoints = [{ x: Number.NaN, y: 80 }];
ok(validateProject(saved).some((error) => error.includes('координати маршруту')), 'invalid bend-point coordinates are rejected');

console.log(`Logic-wire routing tests: PASS (${assertions} assertions)`);
