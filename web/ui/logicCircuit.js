export const COMPONENT_LIBRARY = [
    { category: "Входи", kind: "SWITCH", title: "Логічний перемикач", description: "Інтерактивний рівень 0/1" },
    { category: "Входи", kind: "BUTTON", title: "Кнопка", description: "Рівень 1, доки кнопку натиснуто" },
    { category: "Входи", kind: "CLOCK", title: "Генератор імпульсів", description: "Періодичний тактовий сигнал" },
    { category: "Входи", kind: "CONST0", title: "Константа 0", description: "Постійний логічний нуль" },
    { category: "Входи", kind: "CONST1", title: "Константа 1", description: "Постійна логічна одиниця" },
    { category: "Входи", kind: "DIP4", title: "DIP-перемикач 4 біти", description: "Чотири інтерактивні цифрові виходи" },
    { category: "Логічні елементи", kind: "AND", title: "AND / І", description: "Одиниця, коли всі входи дорівнюють 1" },
    { category: "Логічні елементи", kind: "OR", title: "OR / АБО", description: "Одиниця, коли хоча б один вхід дорівнює 1" },
    { category: "Логічні елементи", kind: "NOT", title: "NOT / НЕ", description: "Інверсія логічного рівня" },
    { category: "Логічні елементи", kind: "NAND", title: "NAND / І-НЕ", description: "Інверсія AND" },
    { category: "Логічні елементи", kind: "NOR", title: "NOR / АБО-НЕ", description: "Інверсія OR" },
    { category: "Логічні елементи", kind: "XOR", title: "XOR", description: "Нерівнозначність входів" },
    { category: "Логічні елементи", kind: "XNOR", title: "XNOR", description: "Рівнозначність входів" },
    { category: "Логічні елементи", kind: "BUFFER", title: "Буфер", description: "Повторює вхідний рівень" },
    { category: "Логічні елементи", kind: "TRISTATE", title: "Тристабільний буфер", description: "Видає A при EN=1, інакше стан Z" },
    { category: "Складні блоки", kind: "MUX4", title: "Мультиплексор 4:1", description: "Вибирає один із чотирьох входів" },
    { category: "Складні блоки", kind: "DECODER2TO4", title: "Дешифратор 2→4", description: "Перетворює 2-бітний код у 4 виходи" },
    { category: "Складні блоки", kind: "FULL_ADDER", title: "Повний суматор", description: "A + B + Cin → Sum, Cout" },
    { category: "Складні блоки", kind: "DFF", title: "D-тригер", description: "Запам’ятовує D за переднім фронтом CLK" },
    { category: "Складні блоки", kind: "COUNTER4", title: "Лічильник 4 біти", description: "Рахує передні фронти CLK" },
    { category: "Виходи", kind: "LED", title: "LED", description: "Візуальний логічний вихід" },
    { category: "Виходи", kind: "PROBE", title: "Логічний пробник", description: "Показує 0, 1, X або Z" },
    { category: "Виходи", kind: "SEVEN_SEG", title: "Семисегментник", description: "Входи сегментів a…g" },
    { category: "Виходи", kind: "HEX_DISPLAY", title: "HEX-індикатор", description: "Показує 4-бітне значення 0…F" },
    { category: "Підключення", kind: "ADUC_OUT", title: "Вихід ADuC841", description: "Читає реальний контакт P0…P3" },
    { category: "Підключення", kind: "ADUC_IN", title: "Вхід ADuC841", description: "Подає зовнішній рівень на контакт" },
];
const GATE_INPUT_KINDS = new Set(["AND", "OR", "NAND", "NOR", "XOR", "XNOR"]);
export const EDITABLE_BUILTIN_KINDS = new Set(["MUX4", "DECODER2TO4", "FULL_ADDER"]);
export function createEmptyLogicProject(name = "Нова логічна схема") {
    const rootId = createId("circuit");
    return {
        version: 1,
        name,
        rootCircuitId: rootId,
        circuits: {
            [rootId]: { id: rootId, name: "Головна схема", components: [], wires: [] },
        },
    };
}
export function createComponent(kind, x, y) {
    const defaults = defaultComponentData(kind);
    return {
        id: createId(kind.toLowerCase()),
        kind,
        x,
        y,
        label: defaults.label,
        props: { ...defaults.props },
        state: { ...defaults.state },
    };
}
export function createCustomChip(project, parentCircuitId, name, inputCount, outputCount, x, y) {
    const circuitId = createId("chip");
    const circuit = { id: circuitId, name, components: [], wires: [] };
    for (let index = 0; index < inputCount; index += 1) {
        const port = createComponent("PORT_IN", 80, 100 + index * 90);
        port.label = String.fromCharCode(65 + index);
        port.props.portIndex = index;
        circuit.components.push(port);
    }
    for (let index = 0; index < outputCount; index += 1) {
        const port = createComponent("PORT_OUT", 820, 100 + index * 90);
        port.label = outputCount === 1 ? "Y" : `Y${index}`;
        port.props.portIndex = index;
        circuit.components.push(port);
    }
    project.circuits[circuitId] = circuit;
    const component = createComponent("CUSTOM", x, y);
    component.label = name;
    component.subcircuitId = circuitId;
    project.circuits[parentCircuitId].components.push(component);
    return component;
}
export function getComponentPins(component, project) {
    if (component.kind === "CUSTOM") {
        const circuit = component.subcircuitId ? project?.circuits[component.subcircuitId] : undefined;
        if (!circuit)
            return [];
        const inputs = circuit.components
            .filter((item) => item.kind === "PORT_IN")
            .sort(comparePortIndex)
            .map((item, index) => ({ id: `in${index}`, label: item.label || `I${index}`, direction: "input" }));
        const outputs = circuit.components
            .filter((item) => item.kind === "PORT_OUT")
            .sort(comparePortIndex)
            .map((item, index) => ({ id: `out${index}`, label: item.label || `O${index}`, direction: "output" }));
        return [...inputs, ...outputs];
    }
    if (GATE_INPUT_KINDS.has(component.kind)) {
        const count = clampInt(Number(component.props.inputCount ?? 2), 2, 8);
        return [
            ...Array.from({ length: count }, (_, index) => ({ id: `in${index}`, label: String(index + 1), direction: "input" })),
            { id: "out", label: "Y", direction: "output" },
        ];
    }
    switch (component.kind) {
        case "SWITCH":
        case "BUTTON":
        case "CLOCK":
        case "CONST0":
        case "CONST1":
        case "PORT_IN":
        case "ADUC_OUT":
            return [{ id: "out", label: component.kind === "ADUC_OUT" ? String(component.props.pin ?? "P1.0") : "Y", direction: "output" }];
        case "DIP4":
            return [0, 1, 2, 3].map((index) => ({ id: `q${index}`, label: `Q${index}`, direction: "output" }));
        case "PORT_OUT":
        case "LED":
        case "PROBE":
        case "ADUC_IN":
            return [{ id: "in", label: component.kind === "ADUC_IN" ? String(component.props.pin ?? "P3.2") : "A", direction: "input" }];
        case "NOT":
        case "BUFFER":
            return [
                { id: "in", label: "A", direction: "input" },
                { id: "out", label: "Y", direction: "output" },
            ];
        case "MUX4":
            return [
                ...[0, 1, 2, 3].map((index) => ({ id: `d${index}`, label: `D${index}`, direction: "input" })),
                { id: "s0", label: "S0", direction: "input" },
                { id: "s1", label: "S1", direction: "input" },
                { id: "out", label: "Y", direction: "output" },
            ];
        case "DECODER2TO4":
            return [
                { id: "a0", label: "A0", direction: "input" },
                { id: "a1", label: "A1", direction: "input" },
                ...[0, 1, 2, 3].map((index) => ({ id: `y${index}`, label: `Y${index}`, direction: "output" })),
            ];
        case "FULL_ADDER":
            return [
                { id: "a", label: "A", direction: "input" },
                { id: "b", label: "B", direction: "input" },
                { id: "cin", label: "Cin", direction: "input" },
                { id: "sum", label: "S", direction: "output" },
                { id: "cout", label: "Co", direction: "output" },
            ];
        case "DFF":
            return [
                { id: "d", label: "D", direction: "input" },
                { id: "clk", label: "CLK", direction: "input" },
                { id: "reset", label: "R", direction: "input" },
                { id: "q", label: "Q", direction: "output" },
                { id: "nq", label: "/Q", direction: "output" },
            ];
        case "COUNTER4":
            return [
                { id: "clk", label: "CLK", direction: "input" },
                { id: "reset", label: "R", direction: "input" },
                ...[0, 1, 2, 3].map((index) => ({ id: `q${index}`, label: `Q${index}`, direction: "output" })),
            ];
        case "TRISTATE":
            return [
                { id: "in", label: "A", direction: "input" },
                { id: "en", label: "EN", direction: "input" },
                { id: "out", label: "Y", direction: "output" },
            ];
        case "SEVEN_SEG":
            return ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, label: id.toUpperCase(), direction: "input" }));
        case "HEX_DISPLAY":
            return [0, 1, 2, 3].map((index) => ({ id: `b${index}`, label: `B${index}`, direction: "input" }));
        default:
            return [];
    }
}
export function getComponentSize(component, project) {
    const pins = getComponentPins(component, project);
    const inputCount = pins.filter((pin) => pin.direction === "input").length;
    const outputCount = pins.filter((pin) => pin.direction === "output").length;
    if (component.kind === "SEVEN_SEG")
        return { width: 118, height: 170 };
    if (component.kind === "HEX_DISPLAY")
        return { width: 104, height: 112 };
    if (component.kind === "DIP4")
        return { width: 124, height: 112 };
    if (component.kind === "SWITCH" || component.kind === "BUTTON" || component.kind === "CONST0" || component.kind === "CONST1")
        return { width: 84, height: 54 };
    if (component.kind === "LED" || component.kind === "PROBE")
        return { width: 82, height: 58 };
    if (component.kind === "CLOCK")
        return { width: 108, height: 58 };
    if (component.kind === "NOT" || component.kind === "BUFFER")
        return { width: 92, height: 64 };
    if (component.kind === "TRISTATE")
        return { width: 104, height: 78 };
    return { width: component.kind === "CUSTOM" ? 136 : 120, height: Math.max(72, 34 + Math.max(inputCount, outputCount) * 25) };
}
export function getPinPosition(component, pinId, project) {
    const size = getComponentSize(component, project);
    const pins = getComponentPins(component, project);
    const pin = pins.find((item) => item.id === pinId);
    if (!pin)
        return { x: component.x, y: component.y };
    const group = pins.filter((item) => item.direction === pin.direction);
    const index = Math.max(0, group.findIndex((item) => item.id === pinId));
    const spacing = size.height / (group.length + 1);
    return {
        x: component.x + (pin.direction === "input" ? 0 : size.width),
        y: component.y + spacing * (index + 1),
    };
}
export function evaluateCircuit(project, circuitId, adapter, inputOverrides = {}, depth = 0, stack = []) {
    const circuit = project.circuits[circuitId];
    if (!circuit)
        return { pinValues: new Map(), conflicts: new Set(), warnings: [`Схему ${circuitId} не знайдено`] };
    if (depth > 12 || stack.includes(circuitId)) {
        return { pinValues: new Map(), conflicts: new Set(), warnings: ["Рекурсивне вкладення мікросхем не підтримується"] };
    }
    const pinValues = new Map();
    const conflicts = new Set();
    const warnings = [];
    if (hasCombinationalCycle(circuit))
        warnings.push(`${circuit.name}: виявлено комбінаційний цикл або зворотний зв’язок без тригера`);
    const key = (componentId, pinId) => `${componentId}:${pinId}`;
    const sourceByInput = new Map();
    for (const wire of circuit.wires) {
        const destinationKey = key(wire.to.componentId, wire.to.pinId);
        const list = sourceByInput.get(destinationKey) ?? [];
        list.push(wire);
        sourceByInput.set(destinationKey, list);
    }
    const readInput = (component, pinId) => {
        const wires = sourceByInput.get(key(component.id, pinId)) ?? [];
        if (!wires.length)
            return "Z";
        const values = wires.map((wire) => pinValues.get(key(wire.from.componentId, wire.from.pinId)) ?? "Z");
        const driven = values.filter((value) => value !== "Z");
        if (!driven.length)
            return "Z";
        if (driven.some((value) => value === "X"))
            return "X";
        const first = driven[0];
        if (driven.some((value) => value !== first)) {
            conflicts.add(key(component.id, pinId));
            return "X";
        }
        return first;
    };
    const writeOutput = (component, pinId, value) => {
        const outputKey = key(component.id, pinId);
        const previous = pinValues.get(outputKey);
        if (previous === value)
            return false;
        pinValues.set(outputKey, value);
        return true;
    };
    for (const component of circuit.components) {
        for (const pin of getComponentPins(component, project)) {
            pinValues.set(key(component.id, pin.id), pin.direction === "output" ? "X" : "Z");
        }
    }
    const maxPasses = Math.max(8, circuit.components.length * 3);
    let stabilized = false;
    for (let pass = 0; pass < maxPasses; pass += 1) {
        let changed = false;
        for (const component of circuit.components) {
            const output = (pinId, value) => {
                changed = writeOutput(component, pinId, value) || changed;
            };
            const input = (pinId) => readInput(component, pinId);
            switch (component.kind) {
                case "SWITCH":
                case "BUTTON":
                    output("out", component.state.value === 1 ? 1 : 0);
                    break;
                case "CLOCK":
                    output("out", component.state.value === 1 ? 1 : 0);
                    break;
                case "DIP4": {
                    const value = Number(component.state.value ?? 0) & 0x0f;
                    for (let index = 0; index < 4; index += 1)
                        output(`q${index}`, ((value >>> index) & 1));
                    break;
                }
                case "CONST0":
                    output("out", 0);
                    break;
                case "CONST1":
                    output("out", 1);
                    break;
                case "PORT_IN": {
                    const portIndex = Number(component.props.portIndex ?? 0);
                    output("out", inputOverrides[`in${portIndex}`] ?? "Z");
                    break;
                }
                case "ADUC_OUT":
                    output("out", adapter?.readPin(String(component.props.pin ?? "P1.0")) ?? "Z");
                    break;
                case "NOT":
                    output("out", invert(input("in")));
                    break;
                case "BUFFER":
                    output("out", normalizeUnary(input("in")));
                    break;
                case "TRISTATE": {
                    const enable = input("en");
                    if (enable === 0)
                        output("out", "Z");
                    else if (enable === 1)
                        output("out", normalizeUnary(input("in")));
                    else
                        output("out", "X");
                    break;
                }
                case "AND":
                case "OR":
                case "NAND":
                case "NOR":
                case "XOR":
                case "XNOR": {
                    const values = getComponentPins(component, project)
                        .filter((pin) => pin.direction === "input")
                        .map((pin) => input(pin.id));
                    output("out", evaluateGate(component.kind, values));
                    break;
                }
                case "MUX4": {
                    const s0 = input("s0");
                    const s1 = input("s1");
                    if (!isBinary(s0) || !isBinary(s1))
                        output("out", "X");
                    else
                        output("out", input(`d${s0 + s1 * 2}`));
                    break;
                }
                case "DECODER2TO4": {
                    const a0 = input("a0");
                    const a1 = input("a1");
                    if (!isBinary(a0) || !isBinary(a1)) {
                        for (let index = 0; index < 4; index += 1)
                            output(`y${index}`, "X");
                    }
                    else {
                        const selected = a0 + a1 * 2;
                        for (let index = 0; index < 4; index += 1)
                            output(`y${index}`, index === selected ? 1 : 0);
                    }
                    break;
                }
                case "FULL_ADDER": {
                    const a = input("a");
                    const b = input("b");
                    const cin = input("cin");
                    if (!isBinary(a) || !isBinary(b) || !isBinary(cin)) {
                        output("sum", "X");
                        output("cout", "X");
                    }
                    else {
                        const total = a + b + cin;
                        output("sum", (total & 1));
                        output("cout", total >= 2 ? 1 : 0);
                    }
                    break;
                }
                case "DFF": {
                    const q = component.state.q === 1 ? 1 : 0;
                    output("q", q);
                    output("nq", q ? 0 : 1);
                    break;
                }
                case "COUNTER4": {
                    const count = Number(component.state.count ?? 0) & 0x0f;
                    for (let index = 0; index < 4; index += 1)
                        output(`q${index}`, ((count >>> index) & 1));
                    break;
                }
                case "CUSTOM": {
                    if (!component.subcircuitId)
                        break;
                    const inputPins = getComponentPins(component, project).filter((pin) => pin.direction === "input");
                    const overrides = {};
                    inputPins.forEach((pin, index) => { overrides[`in${index}`] = input(pin.id); });
                    const nested = evaluateCircuit(project, component.subcircuitId, adapter, overrides, depth + 1, [...stack, circuitId]);
                    warnings.push(...nested.warnings);
                    const nestedCircuit = project.circuits[component.subcircuitId];
                    const outputPorts = nestedCircuit.components.filter((item) => item.kind === "PORT_OUT").sort(comparePortIndex);
                    outputPorts.forEach((port, index) => {
                        output(`out${index}`, nested.pinValues.get(`${port.id}:in`) ?? "Z");
                    });
                    break;
                }
                case "LED":
                case "PROBE":
                case "SEVEN_SEG":
                case "HEX_DISPLAY":
                case "PORT_OUT":
                case "ADUC_IN":
                    break;
            }
        }
        if (!changed) {
            stabilized = true;
            break;
        }
    }
    if (!stabilized && circuit.components.length)
        warnings.push(`${circuit.name}: комбінаційна схема не стабілізувалася; перевірте зворотний зв’язок`);
    for (const component of circuit.components) {
        for (const pin of getComponentPins(component, project).filter((item) => item.direction === "input")) {
            pinValues.set(key(component.id, pin.id), readInput(component, pin.id));
        }
        if (component.kind === "ADUC_IN") {
            adapter?.drivePin(String(component.props.pin ?? "P3.2"), readInput(component, "in"));
        }
    }
    return { pinValues, conflicts, warnings };
}
export function advanceSequentialState(project, circuitId, result) {
    const circuit = project.circuits[circuitId];
    if (!circuit)
        return false;
    let changed = false;
    const value = (component, pinId) => result.pinValues.get(`${component.id}:${pinId}`) ?? "Z";
    for (const component of circuit.components) {
        if (component.kind !== "DFF" && component.kind !== "COUNTER4")
            continue;
        const clk = value(component, "clk");
        const reset = value(component, "reset");
        const previous = component.state.prevClock === 1 ? 1 : 0;
        const current = clk === 1 ? 1 : 0;
        if (reset === 1) {
            if (component.kind === "DFF")
                component.state.q = 0;
            else
                component.state.count = 0;
            changed = true;
        }
        else if (previous === 0 && current === 1) {
            if (component.kind === "DFF") {
                const d = value(component, "d");
                component.state.q = d === 1 ? 1 : 0;
            }
            else {
                component.state.count = (Number(component.state.count ?? 0) + 1) & 0x0f;
            }
            changed = true;
        }
        component.state.prevClock = current;
    }
    return changed;
}
export function stepLogicProject(project, circuitId, adapter) {
    let result = evaluateCircuit(project, circuitId, adapter);
    const changed = advanceSequentialTree(project, circuitId, adapter, result, new Set());
    if (changed)
        result = evaluateCircuit(project, circuitId, adapter);
    return result;
}
function advanceSequentialTree(project, circuitId, adapter, result, visited) {
    if (visited.has(circuitId))
        return false;
    visited.add(circuitId);
    const circuit = project.circuits[circuitId];
    if (!circuit)
        return false;
    let changed = advanceSequentialState(project, circuitId, result);
    for (const component of circuit.components) {
        if (component.kind !== "CUSTOM" || !component.subcircuitId)
            continue;
        const overrides = {};
        getComponentPins(component, project)
            .filter((pin) => pin.direction === "input")
            .forEach((pin, index) => {
            overrides[`in${index}`] = result.pinValues.get(`${component.id}:${pin.id}`) ?? "Z";
        });
        const nestedResult = evaluateCircuit(project, component.subcircuitId, adapter, overrides);
        changed = advanceSequentialTree(project, component.subcircuitId, adapter, nestedResult, visited) || changed;
    }
    return changed;
}
export function expandBuiltinComponent(project, parentCircuitId, componentId) {
    const parent = project.circuits[parentCircuitId];
    const component = parent?.components.find((item) => item.id === componentId);
    if (!parent || !component || !EDITABLE_BUILTIN_KINDS.has(component.kind))
        return null;
    const originalKind = component.kind;
    const originalPins = getComponentPins(component, project);
    const inputPins = originalPins.filter((pin) => pin.direction === "input");
    const outputPins = originalPins.filter((pin) => pin.direction === "output");
    const circuitId = createId(`expanded_${originalKind.toLowerCase()}`);
    const nested = { id: circuitId, name: component.label || originalKind, components: [], wires: [] };
    const portsIn = inputPins.map((pin, index) => {
        const port = createComponent("PORT_IN", 60, 90 + index * 90);
        port.label = pin.label;
        port.props.portIndex = index;
        nested.components.push(port);
        return port;
    });
    const portsOut = outputPins.map((pin, index) => {
        const port = createComponent("PORT_OUT", 880, 120 + index * 100);
        port.label = pin.label;
        port.props.portIndex = index;
        nested.components.push(port);
        return port;
    });
    const connect = (from, fromPin, to, toPin) => {
        nested.wires.push({ id: createId("wire"), from: { componentId: from.id, pinId: fromPin }, to: { componentId: to.id, pinId: toPin } });
    };
    const gate = (kind, x, y, label) => {
        const item = createComponent(kind, x, y);
        if (label)
            item.label = label;
        nested.components.push(item);
        return item;
    };
    if (originalKind === "FULL_ADDER") {
        const xor1 = gate("XOR", 300, 100, "A⊕B");
        const xor2 = gate("XOR", 560, 100, "SUM");
        const and1 = gate("AND", 300, 260, "A·B");
        const and2 = gate("AND", 560, 260, "Cin·(A⊕B)");
        const or1 = gate("OR", 740, 260, "COUT");
        connect(portsIn[0], "out", xor1, "in0");
        connect(portsIn[1], "out", xor1, "in1");
        connect(xor1, "out", xor2, "in0");
        connect(portsIn[2], "out", xor2, "in1");
        connect(xor2, "out", portsOut[0], "in");
        connect(portsIn[0], "out", and1, "in0");
        connect(portsIn[1], "out", and1, "in1");
        connect(xor1, "out", and2, "in0");
        connect(portsIn[2], "out", and2, "in1");
        connect(and1, "out", or1, "in0");
        connect(and2, "out", or1, "in1");
        connect(or1, "out", portsOut[1], "in");
    }
    else if (originalKind === "DECODER2TO4") {
        const notA0 = gate("NOT", 260, 100, "¬A0");
        const notA1 = gate("NOT", 260, 240, "¬A1");
        connect(portsIn[0], "out", notA0, "in");
        connect(portsIn[1], "out", notA1, "in");
        const combinations = [
            [notA0, notA1], [portsIn[0], notA1], [notA0, portsIn[1]], [portsIn[0], portsIn[1]],
        ];
        combinations.forEach(([a, b], index) => {
            const and = gate("AND", 560, 80 + index * 120, `Y${index}`);
            connect(a, "out", and, "in0");
            connect(b, "out", and, "in1");
            connect(and, "out", portsOut[index], "in");
        });
    }
    else if (originalKind === "MUX4") {
        const notS0 = gate("NOT", 240, 430, "¬S0");
        const notS1 = gate("NOT", 240, 540, "¬S1");
        connect(portsIn[4], "out", notS0, "in");
        connect(portsIn[5], "out", notS1, "in");
        const selectPairs = [
            [notS0, notS1], [portsIn[4], notS1], [notS0, portsIn[5]], [portsIn[4], portsIn[5]],
        ];
        const terms = selectPairs.map(([s0, s1], index) => {
            const and = gate("AND", 500, 80 + index * 135, `D${index}`);
            and.props.inputCount = 3;
            connect(portsIn[index], "out", and, "in0");
            connect(s0, "out", and, "in1");
            connect(s1, "out", and, "in2");
            return and;
        });
        const or = gate("OR", 730, 270, "Y");
        or.props.inputCount = 4;
        terms.forEach((term, index) => connect(term, "out", or, `in${index}`));
        connect(or, "out", portsOut[0], "in");
    }
    project.circuits[circuitId] = nested;
    const inputMap = new Map(inputPins.map((pin, index) => [pin.id, `in${index}`]));
    const outputMap = new Map(outputPins.map((pin, index) => [pin.id, `out${index}`]));
    for (const wire of parent.wires) {
        if (wire.to.componentId === component.id)
            wire.to.pinId = inputMap.get(wire.to.pinId) ?? wire.to.pinId;
        if (wire.from.componentId === component.id)
            wire.from.pinId = outputMap.get(wire.from.pinId) ?? wire.from.pinId;
    }
    component.kind = "CUSTOM";
    component.subcircuitId = circuitId;
    component.props = { expandedFrom: originalKind };
    component.state = {};
    return circuitId;
}
export function createBoardLogicAdapter(board) {
    const driven = new Set();
    return {
        readPin(pin) {
            const parsed = parsePortPin(pin);
            if (!parsed)
                return "Z";
            return board.readBit(parsed.port, parsed.bit);
        },
        drivePin(pin, value) {
            const parsed = parsePortPin(pin);
            if (!parsed)
                return;
            if (value === 0 || value === 1) {
                board.setExternalDigitalDrive(parsed.port, parsed.bit, value);
                driven.add(pin.toUpperCase());
            }
            else {
                board.setExternalDigitalDrive(parsed.port, parsed.bit, null);
                driven.delete(pin.toUpperCase());
            }
        },
        releaseAll() {
            for (const pin of driven) {
                const parsed = parsePortPin(pin);
                if (parsed)
                    board.setExternalDigitalDrive(parsed.port, parsed.bit, null);
            }
            driven.clear();
        },
    };
}
export function validateProject(project) {
    const errors = [];
    if (project.version !== 1)
        errors.push("Непідтримувана версія проєкту логічної схеми");
    if (!project.circuits[project.rootCircuitId])
        errors.push("Головну схему не знайдено");
    for (const circuit of Object.values(project.circuits)) {
        const components = new Map(circuit.components.map((component) => [component.id, component]));
        if (components.size !== circuit.components.length)
            errors.push(`${circuit.name}: знайдено дублікати ідентифікаторів елементів`);
        for (const component of circuit.components) {
            if (component.kind === "CUSTOM" && (!component.subcircuitId || !project.circuits[component.subcircuitId])) {
                errors.push(`${circuit.name}: мікросхема ${component.label} посилається на відсутню внутрішню схему`);
            }
        }
        for (const wire of circuit.wires) {
            const source = components.get(wire.from.componentId);
            const destination = components.get(wire.to.componentId);
            if (!source || !destination) {
                errors.push(`${circuit.name}: провід ${wire.id} посилається на відсутній елемент`);
                continue;
            }
            const sourcePin = getComponentPins(source, project).find((pin) => pin.id === wire.from.pinId);
            const destinationPin = getComponentPins(destination, project).find((pin) => pin.id === wire.to.pinId);
            if (!sourcePin)
                errors.push(`${circuit.name}: провід ${wire.id} має невідомий вихід ${wire.from.pinId}`);
            else if (sourcePin.direction !== "output")
                errors.push(`${circuit.name}: провід ${wire.id} починається не з виходу`);
            if (!destinationPin)
                errors.push(`${circuit.name}: провід ${wire.id} має невідомий вхід ${wire.to.pinId}`);
            else if (destinationPin.direction !== "input")
                errors.push(`${circuit.name}: провід ${wire.id} закінчується не на вході`);
            if (wire.bendPoints !== undefined) {
                if (!Array.isArray(wire.bendPoints)) {
                    errors.push(`${circuit.name}: провід ${wire.id} має некоректні точки маршруту`);
                }
                else if (wire.bendPoints.some((point) => !point || typeof point.x !== "number" || !Number.isFinite(point.x) ||
                    typeof point.y !== "number" || !Number.isFinite(point.y))) {
                    errors.push(`${circuit.name}: провід ${wire.id} має некоректні координати маршруту`);
                }
            }
        }
    }
    return errors;
}
export function cloneProject(project) {
    return JSON.parse(JSON.stringify(project));
}
export function logicValueLabel(value) {
    return String(value);
}
function defaultComponentData(kind) {
    switch (kind) {
        case "SWITCH": return { label: "SW", props: {}, state: { value: 0 } };
        case "BUTTON": return { label: "BTN", props: {}, state: { value: 0 } };
        case "CLOCK": return { label: "CLK", props: { frequencyHz: 1 }, state: { value: 0, lastToggleMs: 0 } };
        case "CONST0": return { label: "0", props: {}, state: {} };
        case "CONST1": return { label: "1", props: {}, state: {} };
        case "DIP4": return { label: "DIP4", props: {}, state: { value: 0 } };
        case "PORT_IN": return { label: "A", props: { portIndex: 0 }, state: {} };
        case "PORT_OUT": return { label: "Y", props: { portIndex: 0 }, state: {} };
        case "LED": return { label: "LED", props: { color: "green" }, state: {} };
        case "PROBE": return { label: "OUT", props: {}, state: {} };
        case "SEVEN_SEG": return { label: "7-SEG", props: {}, state: {} };
        case "HEX_DISPLAY": return { label: "HEX", props: {}, state: {} };
        case "ADUC_OUT": return { label: "ADuC OUT", props: { pin: "P1.0" }, state: {} };
        case "ADUC_IN": return { label: "ADuC IN", props: { pin: "P3.2" }, state: {} };
        case "AND": return { label: "AND", props: { inputCount: 2 }, state: {} };
        case "OR": return { label: "OR", props: { inputCount: 2 }, state: {} };
        case "NAND": return { label: "NAND", props: { inputCount: 2 }, state: {} };
        case "NOR": return { label: "NOR", props: { inputCount: 2 }, state: {} };
        case "XOR": return { label: "XOR", props: { inputCount: 2 }, state: {} };
        case "XNOR": return { label: "XNOR", props: { inputCount: 2 }, state: {} };
        case "NOT": return { label: "NOT", props: {}, state: {} };
        case "BUFFER": return { label: "BUF", props: {}, state: {} };
        case "TRISTATE": return { label: "3-STATE", props: {}, state: {} };
        case "MUX4": return { label: "MUX 4:1", props: {}, state: {} };
        case "DECODER2TO4": return { label: "DEC 2→4", props: {}, state: {} };
        case "FULL_ADDER": return { label: "FULL ADDER", props: {}, state: {} };
        case "DFF": return { label: "D FF", props: {}, state: { q: 0, prevClock: 0 } };
        case "COUNTER4": return { label: "COUNTER 4", props: {}, state: { count: 0, prevClock: 0 } };
        case "CUSTOM": return { label: "CHIP", props: {}, state: {} };
    }
}
function evaluateGate(kind, values) {
    const unknown = values.some((value) => value === "X" || value === "Z");
    const binary = values.filter(isBinary);
    switch (kind) {
        case "AND":
            if (binary.includes(0))
                return 0;
            return unknown ? "X" : 1;
        case "NAND": {
            const result = evaluateGate("AND", values);
            return result === 0 ? 1 : result === 1 ? 0 : "X";
        }
        case "OR":
            if (binary.includes(1))
                return 1;
            return unknown ? "X" : 0;
        case "NOR": {
            const result = evaluateGate("OR", values);
            return result === 0 ? 1 : result === 1 ? 0 : "X";
        }
        case "XOR":
            if (unknown)
                return "X";
            return (binary.reduce((sum, value) => sum + value, 0) & 1);
        case "XNOR":
            if (unknown)
                return "X";
            return (binary.reduce((sum, value) => sum + value, 0) & 1) ? 0 : 1;
        default:
            return "X";
    }
}
function normalizeUnary(value) {
    return value === 0 || value === 1 ? value : "X";
}
function invert(value) {
    if (value === 0)
        return 1;
    if (value === 1)
        return 0;
    return "X";
}
function isBinary(value) {
    return value === 0 || value === 1;
}
function readNestedInput(circuit, pinValues, componentId, pinId) {
    const wire = circuit.wires.find((item) => item.to.componentId === componentId && item.to.pinId === pinId);
    if (!wire)
        return "Z";
    return pinValues.get(`${wire.from.componentId}:${wire.from.pinId}`) ?? "Z";
}
function hasCombinationalCycle(circuit) {
    const sequential = new Set(circuit.components.filter((item) => item.kind === "DFF" || item.kind === "COUNTER4").map((item) => item.id));
    const adjacency = new Map();
    for (const component of circuit.components)
        adjacency.set(component.id, []);
    for (const wire of circuit.wires) {
        if (sequential.has(wire.to.componentId))
            continue;
        adjacency.get(wire.from.componentId)?.push(wire.to.componentId);
    }
    const visiting = new Set();
    const visited = new Set();
    const visit = (id) => {
        if (visiting.has(id))
            return true;
        if (visited.has(id))
            return false;
        visiting.add(id);
        for (const next of adjacency.get(id) ?? [])
            if (visit(next))
                return true;
        visiting.delete(id);
        visited.add(id);
        return false;
    };
    return [...adjacency.keys()].some(visit);
}
function comparePortIndex(a, b) {
    return Number(a.props.portIndex ?? 0) - Number(b.props.portIndex ?? 0);
}
function parsePortPin(value) {
    const match = /^P([0-3])\.([0-7])$/i.exec(value.trim());
    if (!match)
        return null;
    return { port: `P${match[1]}`, bit: Number(match[2]) };
}
function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}
function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
