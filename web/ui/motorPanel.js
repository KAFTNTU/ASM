import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/controls/OrbitControls.js";
import { cloneScopeSignal, drawRecordedScope, emptyScopeSignal, hasTriggerEdge, updateRecordedScopeReadout, } from "./realScope.js";
const FIXED_SHAFT_OFFSET = new THREE.Vector3(-0.082, -0.048, 0.032);
const FIXED_SHAFT_ROTATION = new THREE.Euler(3.316126, -4.712389, -0.174533, "XYZ");
export function createMotorPanel(params) {
    const { motor, audio } = params;
    const modal = el("div", { class: "motorModal hidden" });
    const shell = el("div", { class: "motorShell" });
    const cardResizeHandle = el("div", { class: "panelResizeHandle panelResizeHandle-card", title: "Resize motor panel" });
    const card = el("div", { class: "motorCard" });
    const scopeDrawer = el("aside", { class: "scopeDrawer multisimScopeDrawer" });
    cardResizeHandle.appendChild(el("span", { class: "panelResizeGrip" }));
    const head = el("div", { class: "motorHead" });
    const title = el("div", { class: "motorTitle" });
    title.textContent = "\u0414\u0432\u0438\u0433\u0443\u043d 28BYJ-48 - \u043a\u0440\u043e\u043a\u043e\u0432\u0438\u0439";
    const actions = el("div", { class: "motorHeadActions" });
    const scopeBtn = button("\u041e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444");
    const closeBtn = button("\u0417\u0430\u043a\u0440\u0438\u0442\u0438");
    scopeBtn.classList.add("motorAction");
    closeBtn.classList.add("motorAction");
    actions.append(scopeBtn, closeBtn);
    head.append(title, actions);
    card.appendChild(head);
    const body = el("div", { class: "motorBody" });
    const viewportCard = el("section", { class: "motorViewportCard" });
    const viewportTop = el("div", { class: "motorViewportTop" });
    viewportTop.textContent = "";
    const viewportHint = el("div", { class: "motorViewportHint" });
    viewportHint.textContent = "Live model";
    const viewButtons = el("div", { class: "motorViewButtons" });
    const frontViewBtn = createScopePushButton("\u0421\u043f\u0435\u0440\u0435\u0434\u0443");
    const backViewBtn = createScopePushButton("\u0417\u0437\u0430\u0434\u0443");
    const upViewBtn = createScopePushButton("\u0417\u0432\u0435\u0440\u0445\u0443");
    const downViewBtn = createScopePushButton("\u0417\u043d\u0438\u0437\u0443");
    frontViewBtn.classList.add("motorViewBtn");
    backViewBtn.classList.add("motorViewBtn");
    upViewBtn.classList.add("motorViewBtn");
    downViewBtn.classList.add("motorViewBtn");
    viewButtons.append(frontViewBtn, backViewBtn, upViewBtn, downViewBtn);
    viewportCard.append(viewportTop, viewportHint, viewButtons);
    const viewport = el("div", { class: "motorViewport" });
    const viewerCanvas = el("canvas", { class: "motorCanvas" });
    viewport.appendChild(viewerCanvas);
    viewportCard.appendChild(viewport);
    const audioViewportCard = el("section", { class: "audioViewportCard" });
    const audioTop = el("div", { class: "audioViewportTop" });
    audioTop.textContent = "Audio subsystem";
    const audioSub = el("div", { class: "audioViewportHint" });
    audioSub.textContent = "TLV320AIC1109 / DAC0 / DAC1 / mic / phones";
    const audioMeters = el("div", { class: "audioMeters" });
    const micMeter = createAudioMeter("Microphone");
    const speakerMeter = createAudioMeter("Speaker");
    const phonesMeter = createAudioMeter("Headphones");
    audioMeters.append(micMeter.root, speakerMeter.root, phonesMeter.root);
    const micControl = el("label", { class: "audioMicControl" });
    const micLabel = el("span", { class: "audioMicLabel" });
    micLabel.textContent = "Microphone level";
    const micSlider = el("input", { class: "audioMicSlider", type: "range", min: "0", max: "100", value: "35" });
    micControl.append(micLabel, micSlider);
    const audioRoute = el("div", { class: "audioRoute mono" });
    audioRoute.textContent = "Route: DAC0 / DAC1 direct";
    audioViewportCard.append(audioTop, audioSub, audioMeters, micControl, audioRoute);
    const side = el("div", { class: "motorSide" });
    const stats = el("section", { class: "motorInfoCard" });
    const statsTitle = el("h3");
    statsTitle.textContent = "Parameters";
    const statsGrid = el("div", { class: "motorStats" });
    stats.append(statsTitle, statsGrid);
    body.append(viewportCard, audioViewportCard, side);
    card.appendChild(body);
    const scopeTitleBar = el("div", { class: "scopeWindowCaption" });
    const scopeCaptionLeft = el("div", { class: "scopeCaptionLeft" });
    const scopeTitle = el("span", { class: "scopeWindowTitle" });
    scopeTitle.textContent = "Осцилограф";
    const scopeSourcePicker = el("select", { class: "scopeSourcePicker", title: "Джерело сигналу" });
    const primaryPinGroup = document.createElement("optgroup");
    primaryPinGroup.label = "Основні піни стенда (P0/P1/P2/P3.0/P3.1/P3.6)";
    const otherPinGroup = document.createElement("optgroup");
    otherPinGroup.label = "Інші піни ADuC841";
    const primaryPins = new Set([
        ...Array.from({ length: 8 }, (_, bit) => `P0.${bit}`),
        ...Array.from({ length: 8 }, (_, bit) => `P1.${bit}`),
        ...Array.from({ length: 8 }, (_, bit) => `P2.${bit}`),
        "P3.0",
        "P3.1",
        "P3.6",
    ]);
    const auxiliaryOptions = [];
    for (const source of scopeSourceOptions()) {
        const item = document.createElement("option");
        item.value = source;
        item.textContent = scopeSourceLabel(source);
        if (/^P[0-3]\.[0-7]$/.test(source)) {
            (primaryPins.has(source) ? primaryPinGroup : otherPinGroup).appendChild(item);
        }
        else {
            auxiliaryOptions.push(item);
        }
    }
    // Keep the original order: virtual signals first, then the pin groups.
    scopeSourcePicker.append(...auxiliaryOptions, primaryPinGroup, otherPinGroup);
    scopeCaptionLeft.append(scopeTitle, scopeSourcePicker);
    const scopeCaptionActions = el("div", { class: "scopeCaptionActions" });
    const scopeRunBtn = createScopePushButton("Стоп");
    scopeRunBtn.classList.add("scopeRunBtn", "active");
    const scopeCloseBtn = el("button", { class: "scopeCaptionClose", type: "button", title: "Закрити" });
    scopeCloseBtn.textContent = "\u00d7";
    scopeCaptionActions.append(scopeRunBtn, scopeCloseBtn);
    scopeTitleBar.append(scopeCaptionLeft, scopeCaptionActions);
    const scopeCanvas = el("canvas", { class: "motorScope multisimScopeScreen" });
    scopeCanvas.width = 520;
    scopeCanvas.height = 245;
    const scopeInfoRow = el("div", { class: "scopeInfoRowMain" });
    const cursorPad = el("div", { class: "scopeCursorPad" });
    const cursorT1Label = el("span");
    cursorT1Label.textContent = "T1";
    const cursorT2Label = el("span");
    cursorT2Label.textContent = "T2";
    const cursorDeltaLabel = el("span");
    cursorDeltaLabel.textContent = "T2-T1";
    const t1LeftBtn = createScopePushButton("\u25C0");
    const t1RightBtn = createScopePushButton("\u25B6");
    const t2LeftBtn = createScopePushButton("\u25C0");
    const t2RightBtn = createScopePushButton("\u25B6");
    cursorPad.append(createCursorRow(cursorT1Label, t1LeftBtn, t1RightBtn), createCursorRow(cursorT2Label, t2LeftBtn, t2RightBtn), createCursorRow(cursorDeltaLabel));
    const scopeReadout = el("div", { class: "scopeReadoutPanel mono" });
    const scopeReadoutTable = el("table", { class: "scopeReadoutTable multisimReadoutTable" });
    scopeReadoutTable.innerHTML = `
    <thead>
      <tr><th></th><th>Час</th><th>Канал A</th></tr>
    </thead>
    <tbody>
      <tr><td>T1</td><td>0.000 s</td><td>0.000 V</td></tr>
      <tr><td>T2</td><td>0.000 s</td><td>0.000 V</td></tr>
      <tr><td>T2-T1</td><td>0.000 s</td><td>0.000 V</td></tr>
    </tbody>
  `;
    scopeReadout.appendChild(scopeReadoutTable);
    const scopeUtility = el("div", { class: "scopeUtilityPanel" });
    const reverseBtn = createScopeActionButton("Реверс");
    const saveBtn = createScopeActionButton("Зберегти");
    const extTriggerRow = el("label", { class: "scopeExtTriggerRow" });
    const extTriggerText = el("span");
    extTriggerText.textContent = "Зовнішній тригер";
    const extTriggerDot = el("span", { class: "scopeRadioDot" });
    extTriggerRow.append(extTriggerText, extTriggerDot);
    scopeUtility.append(reverseBtn, saveBtn, extTriggerRow);
    scopeInfoRow.append(cursorPad, scopeReadout, scopeUtility);
    const scopeControlStrip = el("div", { class: "scopeControlStrip multisimControlStrip" });
    const timeScaleSpinner = createSpinnerControl("10 ms/Div");
    const timePosSpinner = createSpinnerControl("0");
    const voltsSpinner = createSpinnerControl("5 V/Div");
    const yPosSpinner = createSpinnerControl("0");
    const triggerLevelSpinner = createSpinnerControl("2.5", "small");
    const modeButtons = [createScopePushButton("Y/T"), createScopePushButton("Add")];
    const couplingButtons = [createScopePushButton("AC"), createScopePushButton("0"), createScopePushButton("DC")];
    const triggerEdgeButtons = [
        createScopePushButton("\u2197"),
        createScopePushButton("\u2198"),
    ];
    const triggerSourceButtons = [
        createScopePushButton("A"),
        createScopePushButton("Ext"),
    ];
    const triggerButtons = [...triggerEdgeButtons, ...triggerSourceButtons];
    const triggerModeButtons = [
        createScopePushButton("Одноразовий"),
        createScopePushButton("Нормальний"),
        createScopePushButton("Авто"),
        createScopePushButton("Вимкнено"),
    ];
    scopeControlStrip.append(createControlGroup("Розгортка часу", [
        createControlLine("Масштаб:", timeScaleSpinner.root),
        createControlLine("Позиція X (поділ.):", timePosSpinner.root),
        createButtonRow(modeButtons),
    ]), createControlGroup("Канал A", [
        createControlLine("Масштаб:", voltsSpinner.root),
        createControlLine("Позиція Y (поділ.):", yPosSpinner.root),
        createButtonRow(couplingButtons),
    ]), createControlGroup("Тригер", [
        createControlLine("Фронт:", createTinyRow(triggerButtons)),
        createControlLine("Рівень:", createLevelRow(triggerLevelSpinner.root)),
        createButtonRow(triggerModeButtons),
    ]));
    scopeDrawer.append(scopeTitleBar, scopeCanvas, scopeInfoRow, scopeControlStrip, stats);
    shell.append(cardResizeHandle, card, scopeDrawer);
    modal.appendChild(shell);
    const renderer = new THREE.WebGLRenderer({
        canvas: viewerCanvas,
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161616);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.set(0.24, 0.18, 0.34);
    const controls = new OrbitControls(camera, viewerCanvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.16;
    controls.maxDistance = 0.62;
    controls.target.set(0, 0, 0);
    applyView("front");
    const hemi = new THREE.HemisphereLight(0xe8e8e8, 0x232323, 1.2);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight(0xbdbdbd, 0.55);
    rim.position.set(-3, 1.5, -2.5);
    scene.add(hemi, dir, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.26, 48), new THREE.MeshBasicMaterial({ color: 0x202020 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.07;
    scene.add(floor);
    const modelRoot = new THREE.Group();
    const shaftMount = new THREE.Group();
    const shaftSpin = new THREE.Group();
    shaftMount.add(shaftSpin);
    scene.add(modelRoot, shaftMount);
    const shaftVisual = new THREE.Mesh(new THREE.CylinderGeometry(0.00935, 0.00935, 0.055, 20), new THREE.MeshStandardMaterial({
        color: 0xc59b47,
        emissive: 0x2a1804,
        metalness: 0.72,
        roughness: 0.28,
    }));
    shaftVisual.rotation.z = Math.PI / 2;
    shaftSpin.add(shaftVisual);
    const shaftMarker = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0055, 0.01925), new THREE.MeshStandardMaterial({
        color: 0xd5ae63,
        emissive: 0x211303,
        metalness: 0.38,
        roughness: 0.34,
    }));
    shaftMarker.position.x = 0.0305;
    shaftSpin.add(shaftMarker);
    const timebaseOptions = [
        { label: "1 ns/Div", value: 1e-9 },
        { label: "10 ns/Div", value: 1e-8 },
        { label: "100 ns/Div", value: 1e-7 },
        { label: "1 us/Div", value: 1e-6 },
        { label: "10 us/Div", value: 1e-5 },
        { label: "100 us/Div", value: 1e-4 },
        { label: "1 ms/Div", value: 1e-3 },
        { label: "5 ms/Div", value: 5e-3 },
        { label: "10 ms/Div", value: 1e-2 },
        { label: "100 ms/Div", value: 1e-1 },
        { label: "1 s/Div", value: 1 },
        { label: "10 s/Div", value: 10 },
    ];
    const voltsOptions = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    let opened = false;
    let activeScopeSource = "general";
    let scopeOpen = false;
    let loaded = false;
    let resizeObserver = null;
    let timebaseIndex = Math.max(0, timebaseOptions.findIndex((option) => option.value === 1e-2));
    let voltsIndex = Math.max(0, voltsOptions.findIndex((value) => value === 5));
    let scopePanDivs = 0;
    let scopeYOffsetDivs = 0;
    let cursorT1Div = 1;
    let cursorT2Div = 3;
    let reverseWave = false;
    let triggerLevelVolts = 2.5;
    let scopeRunning = true;
    let frozenScopeSignal = null;
    let singleArmTimeSeconds = 0;
    let showAverage = false;
    let couplingMode = "DC";
    let triggerEdge = "rising";
    let triggerSource = "A";
    let triggerMode = "None";
    let singleArmed = false;
    let motorPanelWidthPx = 610;
    let activeResize = null;
    const shaftBasePosition = new THREE.Vector3(0.068, 0, 0);
    micSlider.addEventListener("input", () => {
        audio?.setMicLevel?.((Number(micSlider.value) || 0) / 100);
    });
    setActiveButton(modeButtons, modeButtons[0]);
    setActiveButton(couplingButtons, couplingButtons[2]);
    setActiveButton(triggerEdgeButtons, triggerEdgeButtons[0]);
    setActiveButton(triggerSourceButtons, triggerSourceButtons[0]);
    setActiveButton(triggerModeButtons, triggerModeButtons[3]);
    bindSpinner(timeScaleSpinner, () => {
        timebaseIndex = clamp(timebaseIndex + 1, 0, timebaseOptions.length - 1);
    }, () => {
        timebaseIndex = clamp(timebaseIndex - 1, 0, timebaseOptions.length - 1);
    });
    bindSpinner(timePosSpinner, () => {
        scopePanDivs = clamp(scopePanDivs + 1, -40, 40);
    }, () => {
        scopePanDivs = clamp(scopePanDivs - 1, -40, 40);
    });
    bindSpinner(voltsSpinner, () => {
        voltsIndex = clamp(voltsIndex + 1, 0, voltsOptions.length - 1);
    }, () => {
        voltsIndex = clamp(voltsIndex - 1, 0, voltsOptions.length - 1);
    });
    bindSpinner(yPosSpinner, () => {
        scopeYOffsetDivs = clamp(scopeYOffsetDivs + 1, -40, 40);
    }, () => {
        scopeYOffsetDivs = clamp(scopeYOffsetDivs - 1, -40, 40);
    });
    bindSpinner(triggerLevelSpinner, () => {
        triggerLevelVolts = clamp(triggerLevelVolts + 0.5, -50, 50);
    }, () => {
        triggerLevelVolts = clamp(triggerLevelVolts - 0.5, -50, 50);
    });
    t1LeftBtn.addEventListener("click", () => {
        cursorT1Div = clamp(cursorT1Div - 0.25, 0, 10);
    });
    t1RightBtn.addEventListener("click", () => {
        cursorT1Div = clamp(cursorT1Div + 0.25, 0, 10);
    });
    t2LeftBtn.addEventListener("click", () => {
        cursorT2Div = clamp(cursorT2Div - 0.25, 0, 10);
    });
    t2RightBtn.addEventListener("click", () => {
        cursorT2Div = clamp(cursorT2Div + 0.25, 0, 10);
    });
    reverseBtn.addEventListener("click", () => {
        reverseWave = !reverseWave;
        reverseBtn.classList.toggle("active", reverseWave);
    });
    saveBtn.addEventListener("click", () => {
        const link = document.createElement("a");
        link.href = scopeCanvas.toDataURL("image/png");
        link.download = "motor-oscilloscope.png";
        link.click();
    });
    frontViewBtn.addEventListener("click", () => applyView("front"));
    backViewBtn.addEventListener("click", () => applyView("back"));
    upViewBtn.addEventListener("click", () => applyView("up"));
    downViewBtn.addEventListener("click", () => applyView("down"));
    scopeCloseBtn.addEventListener("click", () => {
        if (activeScopeSource !== "motor") {
            close();
            return;
        }
        scopeOpen = false;
        syncScopeState();
        resize();
    });
    scopeRunBtn.addEventListener("click", () => {
        scopeRunning = !scopeRunning;
        singleArmed = scopeRunning && triggerMode === "Single";
        if (singleArmed) {
            singleArmTimeSeconds = params.getScopeSignal?.(activeScopeSource)?.nowSeconds ?? 0;
        }
        syncScopeRunButton();
    });
    modeButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            showAverage = index === 1;
            setActiveButton(modeButtons, btn);
        });
    });
    couplingButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            couplingMode = ["AC", "GND", "DC"][index];
            setActiveButton(couplingButtons, btn);
        });
    });
    triggerEdgeButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            triggerEdge = index === 0 ? "rising" : "falling";
            setActiveButton(triggerEdgeButtons, btn);
        });
    });
    triggerSourceButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            triggerSource = index === 0 ? "A" : "Ext";
            setActiveButton(triggerSourceButtons, btn);
            extTriggerDot.classList.toggle("active", triggerSource === "Ext");
        });
    });
    triggerModeButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            triggerMode = ["Single", "Normal", "Auto", "None"][index];
            setActiveButton(triggerModeButtons, btn);
            if (triggerMode === "Single") {
                scopeRunning = true;
                singleArmed = true;
                singleArmTimeSeconds = params.getScopeSignal?.(activeScopeSource)?.nowSeconds ?? 0;
                syncScopeRunButton();
            }
            else {
                singleArmed = false;
            }
        });
    });
    extTriggerRow.addEventListener("click", () => triggerSourceButtons[1].click());
    scopeSourcePicker.addEventListener("change", () => {
        openScope(scopeSourcePicker.value);
    });
    scopeCanvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (event.shiftKey) {
            scopeYOffsetDivs = clamp(scopeYOffsetDivs + (event.deltaY > 0 ? -1 : 1), -40, 40);
            return;
        }
        scopePanDivs = clamp(scopePanDivs + (event.deltaY > 0 ? 1 : -1), -40, 40);
    }, { passive: false });
    closeBtn.addEventListener("click", close);
    scopeBtn.addEventListener("click", () => {
        scopeOpen = !scopeOpen;
        syncScopeState();
        resize();
    });
    cardResizeHandle.addEventListener("pointerdown", beginResize);
    modal.addEventListener("click", (event) => {
        if (event.target === modal)
            close();
    });
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
    const loader = new GLTFLoader();
    loader.load("models/28byj48.glb", (gltf) => {
        const root = gltf.scene;
        root.traverse((child) => {
            if (!(child instanceof THREE.Mesh))
                return;
            child.castShadow = false;
            child.receiveShadow = false;
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxSize = Math.max(size.x, size.y, size.z) || 1;
        const scale = 0.14 / maxSize;
        root.scale.setScalar(scale);
        root.position.sub(center.multiplyScalar(scale));
        const scaledBox = new THREE.Box3().setFromObject(root);
        const scaledCenter = new THREE.Vector3();
        const scaledSize = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        scaledBox.getSize(scaledSize);
        root.position.sub(scaledCenter);
        root.position.y -= scaledSize.y * 0.16;
        root.traverse((child) => {
            if (!(child instanceof THREE.Mesh))
                return;
            // The SolidWorks export contains one mesh and no materials. Split its
            // indexed geometry so each face can still receive a distinct color.
            const geometry = child.geometry.index
                ? child.geometry.toNonIndexed()
                : child.geometry.clone();
            geometry.computeBoundingBox();
            const geometryBox = geometry.boundingBox;
            const positions = geometry.getAttribute("position");
            if (!geometryBox || !positions)
                return;
            const geometrySize = new THREE.Vector3();
            geometryBox.getSize(geometrySize);
            const colors = new Float32Array(positions.count * 3);
            const faceColor = new THREE.Color();
            const normalize = (value, min, length) => length > 0 ? (value - min) / length : 0.5;
            for (let vertex = 0; vertex < positions.count; vertex += 3) {
                const xs = [0, 1, 2].map((corner) => normalize(positions.getX(vertex + corner), geometryBox.min.x, geometrySize.x));
                const ys = [0, 1, 2].map((corner) => normalize(positions.getY(vertex + corner), geometryBox.min.y, geometrySize.y));
                const zs = [0, 1, 2].map((corner) => normalize(positions.getZ(vertex + corner), geometryBox.min.z, geometrySize.z));
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const minZ = Math.min(...zs);
                const maxZ = Math.max(...zs);
                let color = 0x9da8b4;
                if (minY > 0.7 && minX > 0.18 && maxX < 0.82) {
                    color = 0x3279b7;
                }
                else if (minX > 0.68) {
                    color = 0xd8dde2;
                }
                else if (maxX < 0.18) {
                    color = 0x737e8a;
                }
                else if (maxY < 0.22 || maxZ < 0.12 || minZ > 0.88) {
                    color = 0xc3cbd3;
                }
                faceColor.setHex(color);
                for (let corner = 0; corner < 3; corner += 1) {
                    const offset = (vertex + corner) * 3;
                    colors[offset] = faceColor.r;
                    colors[offset + 1] = faceColor.g;
                    colors[offset + 2] = faceColor.b;
                }
            }
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            child.geometry = geometry;
            child.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x080a0d,
                metalness: 0.32,
                roughness: 0.44,
                vertexColors: true,
            });
        });
        modelRoot.add(root);
        const shaftX = scaledBox.max.x + 0.012;
        shaftBasePosition.set(shaftX, 0, 0);
        shaftMount.position.copy(shaftBasePosition);
        loaded = true;
    }, undefined, () => {
        const fallback = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.11, 32), new THREE.MeshStandardMaterial({
            color: 0xb8c2cf,
            metalness: 0.2,
            roughness: 0.55,
        }));
        fallback.rotation.z = Math.PI / 2;
        modelRoot.add(fallback);
        shaftBasePosition.set(0.068, 0, 0);
        shaftMount.position.copy(shaftBasePosition);
        loaded = true;
    });
    function open(source = "motor") {
        openPanel(source, source !== "motor");
    }
    function openScope(source = "general") {
        openPanel(source, true);
    }
    function openPanel(source, scopeOnly) {
        activeScopeSource = source;
        params.setScopeCaptureSource?.(source);
        shell.classList.toggle("scope-only", scopeOnly);
        modal.classList.toggle("scope-only-mode", scopeOnly);
        scopeOpen = scopeOnly || scopeOpen;
        scopeSourcePicker.value = source;
        triggerMode = "None";
        singleArmed = false;
        setActiveButton(triggerModeButtons, triggerModeButtons[3]);
        frozenScopeSignal = null;
        singleArmTimeSeconds = params.getScopeSignal?.(source)?.nowSeconds ?? 0;
        scopeRunning = true;
        opened = true;
        syncScopeRunButton();
        syncScopeState();
        modal.classList.remove("hidden");
        ensureResizeObserver();
        resize();
    }
    function close() {
        opened = false;
        params.setScopeCaptureSource?.(null);
        activeResize = null;
        document.body.classList.remove("panel-resizing");
        modal.classList.add("hidden");
    }
    function isOpen() {
        return opened;
    }
    function renderFrame(dtSeconds) {
        void dtSeconds;
        if (!opened)
            return;
        const liveTelemetry = motor.getTelemetry();
        const audioTelemetry = audio?.getTelemetry?.() ?? null;
        const liveScopeSignal = params.getScopeSignal?.(activeScopeSource) ?? emptyScopeSignal(activeScopeSource);
        shaftSpin.rotation.set(liveTelemetry.angleRad, 0, 0);
        shaftMount.rotation.copy(FIXED_SHAFT_ROTATION);
        shaftMount.position.set(shaftBasePosition.x + FIXED_SHAFT_OFFSET.x, shaftBasePosition.y + FIXED_SHAFT_OFFSET.y, shaftBasePosition.z + FIXED_SHAFT_OFFSET.z);
        if (scopeRunning) {
            frozenScopeSignal = cloneScopeSignal(liveScopeSignal);
        }
        const singleTriggered = triggerSource === "Ext" ||
            hasTriggerEdge(liveScopeSignal, triggerEdge, triggerLevelVolts, singleArmTimeSeconds);
        if (scopeRunning && singleArmed && singleTriggered) {
            frozenScopeSignal = cloneScopeSignal(liveScopeSignal);
            scopeRunning = false;
            singleArmed = false;
            syncScopeRunButton();
        }
        const scopeSignal = scopeRunning ? liveScopeSignal : (frozenScopeSignal ?? liveScopeSignal);
        if (activeScopeSource === "audio" && audioTelemetry) {
            drawAudioStats(statsGrid, audioTelemetry);
            statsTitle.textContent = "Audio parameters";
            title.textContent = "\u041e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444 - \u0437\u0432\u0443\u043a\u043e\u0432\u0430 \u043f\u0456\u0434\u0441\u0438\u0441\u0442\u0435\u043c\u0430";
            viewportHint.textContent = `DAC0 ${audioTelemetry.leftVolts.toFixed(2)} V | DAC1 ${audioTelemetry.rightVolts.toFixed(2)} V`;
            micSlider.value = `${Math.round(audioTelemetry.micLevel * 100)}`;
            setAudioMeterLevel(micMeter.fill, audioTelemetry.micLevel);
            setAudioMeterLevel(speakerMeter.fill, audioTelemetry.speakerLevel);
            setAudioMeterLevel(phonesMeter.fill, audioTelemetry.phonesLevel);
            audioRoute.textContent = `Route: ${audioTelemetry.routeLabel}`;
        }
        else if (activeScopeSource === "motor") {
            drawStats(statsGrid, liveTelemetry);
            statsTitle.textContent = "Motor parameters";
            title.textContent = "\u0414\u0432\u0438\u0433\u0443\u043d 28BYJ-48 - \u043a\u0440\u043e\u043a\u043e\u0432\u0438\u0439";
            setAudioMeterLevel(micMeter.fill, 0);
            setAudioMeterLevel(speakerMeter.fill, 0);
            setAudioMeterLevel(phonesMeter.fill, 0);
            audioRoute.textContent = "Route: DAC0 / DAC1 direct";
        }
        else {
            drawScopeSignalStats(statsGrid, liveScopeSignal);
            statsTitle.textContent = "Signal parameters";
            title.textContent = `Осцилограф — ${scopeSourceLabel(activeScopeSource)}`;
            setAudioMeterLevel(micMeter.fill, 0);
            setAudioMeterLevel(speakerMeter.fill, 0);
            setAudioMeterLevel(phonesMeter.fill, 0);
            audioRoute.textContent = `Джерело: ${scopeSourceLabel(activeScopeSource)}`;
        }
        const timebaseDivSeconds = timebaseOptions[timebaseIndex]?.value ?? 1e-2;
        const voltsDiv = voltsOptions[voltsIndex] ?? 5;
        const scopePanSeconds = scopePanDivs * timebaseDivSeconds;
        timeScaleSpinner.valueNode.textContent = timebaseOptions[timebaseIndex].label;
        timePosSpinner.valueNode.textContent = formatPlainDiv(scopePanDivs);
        voltsSpinner.valueNode.textContent = `${voltsDiv} V/Div`;
        yPosSpinner.valueNode.textContent = formatPlainDiv(scopeYOffsetDivs);
        triggerLevelSpinner.valueNode.textContent = `${triggerLevelVolts.toFixed(1)}`;
        drawRecordedScope(scopeCanvas, scopeSignal, {
            signalColor: "#ff3b12",
            timebaseDivSeconds,
            voltsDiv,
            scopePanSeconds,
            scopeYOffsetDivs,
            reverseWave,
            cursorT1Div,
            cursorT2Div,
            couplingMode,
            showAverage,
            triggerEdge,
            triggerSource,
            triggerMode,
            triggerLevelVolts,
        });
        updateRecordedScopeReadout(scopeReadoutTable, scopeSignal, {
            timebaseDivSeconds,
            scopePanSeconds,
            reverseWave,
            cursorT1Div,
            cursorT2Div,
            couplingMode,
            triggerEdge,
            triggerSource,
            triggerMode,
            triggerLevelVolts,
        });
        controls.autoRotate = false;
        controls.update();
        if (activeScopeSource === "audio") {
            viewportHint.textContent = audioTelemetry
                ? `Frequency ${audioTelemetry.frequencyHz.toFixed(0)} Hz | Peak ${Math.round(audioTelemetry.peak * 100)}%`
                : "Audio subsystem";
        }
        else if (activeScopeSource === "motor") {
            viewportHint.textContent = loaded
                ? `Speed ${Math.round(liveTelemetry.currentRpm)} rpm | PWM ${Math.round(liveTelemetry.duty * 100)}%`
                : "Loading model...";
            renderer.render(scene, camera);
        }
        else {
            viewportHint.textContent = `${scopeSourceLabel(activeScopeSource)} | ${liveScopeSignal.currentVoltage.toFixed(3)} V`;
        }
    }
    function syncScopeState() {
        shell.classList.toggle("scope-open", scopeOpen);
        shell.classList.toggle("scope-only", opened && activeScopeSource !== "motor");
        shell.classList.toggle("audio-mode", false);
        scopeBtn.classList.toggle("scope-active", scopeOpen);
        scopeBtn.textContent = scopeOpen ? "\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u043e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444" : "\u041e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444";
        cardResizeHandle.classList.toggle("visible", opened && activeScopeSource === "motor");
        applyPanelWidths();
    }
    function syncScopeRunButton() {
        scopeRunBtn.textContent = scopeRunning ? "Стоп" : "Старт";
        scopeRunBtn.classList.toggle("active", scopeRunning);
    }
    function ensureResizeObserver() {
        if (resizeObserver)
            return;
        resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(viewport);
        resizeObserver.observe(scopeDrawer);
    }
    function resize() {
        const rect = viewport.getBoundingClientRect();
        const width = Math.max(240, Math.floor(rect.width));
        const height = Math.max(220, Math.floor(rect.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        resizeScopeCanvas();
    }
    function resizeScopeCanvas() {
        const rect = scopeCanvas.getBoundingClientRect();
        const width = Math.max(320, Math.floor(rect.width));
        const height = Math.max(150, Math.floor(rect.height));
        if (scopeCanvas.width !== width || scopeCanvas.height !== height) {
            scopeCanvas.width = width;
            scopeCanvas.height = height;
        }
    }
    function beginResize(event) {
        event.preventDefault();
        activeResize = { pointerId: event.pointerId };
        document.body.classList.add("panel-resizing");
    }
    function onResizeMove(event) {
        if (!activeResize || activeResize.pointerId !== event.pointerId)
            return;
        const viewportWidth = window.innerWidth;
        const draggedWidth = viewportWidth - event.clientX;
        motorPanelWidthPx = clamp(Math.round(draggedWidth), 460, Math.max(460, viewportWidth - 120));
        applyPanelWidths();
        resize();
    }
    function endResize(event) {
        if (!activeResize || activeResize.pointerId !== event.pointerId)
            return;
        activeResize = null;
        document.body.classList.remove("panel-resizing");
    }
    function applyPanelWidths() {
        shell.style.setProperty("--motor-card-width", `${motorPanelWidthPx}px`);
    }
    function applyView(view) {
        if (view === "front") {
            camera.position.set(0, 0.04, 0.35);
        }
        else if (view === "back") {
            camera.position.set(0, 0.04, -0.35);
        }
        else if (view === "up") {
            camera.position.set(0, 0.33, 0.05);
        }
        else {
            camera.position.set(0, -0.18, 0.16);
        }
        controls.target.set(0, 0, 0);
        controls.update();
    }
    syncScopeState();
    return {
        element: modal,
        open,
        openScope,
        close,
        isOpen,
        renderFrame,
    };
}
function createAudioMeter(label) {
    const root = el("div", { class: "audioMeter" });
    const title = el("div", { class: "audioMeterTitle" });
    title.textContent = label;
    const track = el("div", { class: "audioMeterTrack" });
    const fill = el("div", { class: "audioMeterFill" });
    track.appendChild(fill);
    root.append(title, track);
    return { root, fill };
}
function setAudioMeterLevel(fill, value) {
    fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
}
function drawStats(target, telemetry) {
    target.innerHTML = `
    <div class="motorStatTiles">
      ${statTile("State", telemetry.active ? "running" : "idle")}
      ${statTile("PWM", `${Math.round(telemetry.duty * 100)}%`)}
      ${statTile("Frequency", `${telemetry.frequencyHz.toFixed(1)} Hz`)}
      ${statTile("Speed", `${telemetry.currentRpm.toFixed(1)} rpm`)}
      ${statTile("Target", `${telemetry.targetRpm.toFixed(1)} rpm`)}
      ${statTile("Period", telemetry.periodCounts ? `${telemetry.periodCounts} ticks` : "-")}
    </div>
  `;
}
function drawAudioStats(target, telemetry) {
    target.innerHTML = `
    <div class="motorStatTiles">
      ${statTile("State", telemetry.active ? "playing" : "idle")}
      ${statTile("DAC", telemetry.dacEnabled ? "enabled" : "disabled")}
      ${statTile("Frequency", `${telemetry.frequencyHz.toFixed(1)} Hz`)}
      ${statTile("Peak", `${Math.round(telemetry.peak * 100)}%`)}
      ${statTile("DAC0", `${telemetry.leftVolts.toFixed(2)} V`)}
      ${statTile("DAC1", `${telemetry.rightVolts.toFixed(2)} V`)}
    </div>
  `;
}
function drawScopeSignalStats(target, signal) {
    const state = signal.currentVoltage >= 2.5 ? "HIGH" : signal.currentVoltage <= 0.05 ? "LOW" : "analog";
    target.innerHTML = `
    <div class="motorStatTiles">
      ${statTile("State", state)}
      ${statTile("Voltage", `${signal.currentVoltage.toFixed(3)} V`)}
      ${statTile("Frequency", signal.frequencyHz > 0 ? `${signal.frequencyHz.toFixed(1)} Hz` : "-")}
      ${statTile("High time", `${Math.round(signal.duty * 100)}%`)}
      ${statTile("Events", `${signal.samples.length}`)}
      ${statTile("Simulation", formatScopeTime(signal.nowSeconds))}
    </div>
  `;
}
function formatScopeTime(seconds) {
    if (Math.abs(seconds) < 1e-3)
        return `${(seconds * 1e6).toFixed(1)} us`;
    if (Math.abs(seconds) < 1)
        return `${(seconds * 1e3).toFixed(3)} ms`;
    return `${seconds.toFixed(3)} s`;
}
function formatPlainDiv(value) {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
function scopeSourceOptions() {
    const sources = [
        "general",
        "motor",
        "audio",
        "sevenSeg",
        "ledBar",
        "matrix",
        "joystick",
        "keypad",
        "lcd",
    ];
    for (const port of [0, 1, 2, 3]) {
        for (const bit of [0, 1, 2, 3, 4, 5, 6, 7]) {
            sources.push(`P${port}.${bit}`);
        }
    }
    return sources;
}
function scopeSourceLabel(source) {
    if (/^P[0-3]\.[0-7]$/.test(source))
        return `${source} — пін`;
    switch (source) {
        case "general":
            return "General";
        case "motor":
            return "Motor PWM";
        case "audio":
            return "Audio PCM";
        case "sevenSeg":
            return "7-segment display";
        case "ledBar":
            return "LED bar";
        case "matrix":
            return "LED matrix 5x7";
        case "joystick":
            return "Joystick X";
        case "keypad":
            return "Keypad";
        case "lcd":
            return "LCD";
    }
    return source;
}
function createScopeActionButton(label) {
    const btn = el("button", { class: "scopeActionBtn", type: "button" });
    btn.textContent = label;
    return btn;
}
function createScopePushButton(label) {
    const btn = el("button", { class: "scopePushBtn", type: "button" });
    btn.textContent = label;
    return btn;
}
function createCursorRow(labelNode, leftBtn, rightBtn) {
    const row = el("div", { class: "scopeCursorRow" });
    row.appendChild(labelNode);
    if (leftBtn && rightBtn) {
        row.append(leftBtn, rightBtn);
    }
    else {
        row.append(el("span"), el("span"));
    }
    return row;
}
function createControlGroup(title, children) {
    const group = el("div", { class: "scopeControlGroup multisimControlGroup" });
    const titleNode = el("div", { class: "scopeControlGroupTitle" });
    titleNode.textContent = title;
    group.appendChild(titleNode);
    children.forEach((child) => group.appendChild(child));
    return group;
}
function createControlLine(label, content) {
    const row = el("div", { class: "scopeControlLine" });
    const labelNode = el("span", { class: "scopeControlLabel" });
    labelNode.textContent = label;
    row.append(labelNode, content);
    return row;
}
function createButtonRow(buttons) {
    const row = el("div", { class: "scopeButtonRow" });
    buttons.forEach((btn) => row.appendChild(btn));
    return row;
}
function createTinyRow(buttons) {
    const row = el("div", { class: "scopeTinyRow" });
    buttons.forEach((btn) => row.appendChild(btn));
    return row;
}
function createLevelRow(spinnerRoot) {
    const row = el("div", { class: "scopeLevelRow" });
    const unit = el("span", { class: "scopeLevelUnit" });
    unit.textContent = "V";
    row.append(spinnerRoot, unit);
    return row;
}
function createSpinnerControl(initialValue, extraClass = "") {
    const root = el("div", { class: `scopeSpinner ${extraClass}`.trim() });
    const valueNode = el("div", { class: "scopeSpinnerValue" });
    valueNode.textContent = initialValue;
    const buttons = el("div", { class: "scopeSpinnerButtons" });
    const upBtn = createScopePushButton("\u25b2");
    const downBtn = createScopePushButton("\u25bc");
    upBtn.classList.add("scopeSpinnerBtn");
    downBtn.classList.add("scopeSpinnerBtn");
    buttons.append(upBtn, downBtn);
    root.append(valueNode, buttons);
    return { root, valueNode, upBtn, downBtn };
}
function bindSpinner(control, onUp, onDown) {
    control.upBtn.addEventListener("click", onUp);
    control.downBtn.addEventListener("click", onDown);
}
function setActiveButton(group, active) {
    group.forEach((button) => button.classList.toggle("active", button === active));
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function statTile(label, value) {
    return `<div class="motorStatTile"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function button(text) {
    const node = document.createElement("button");
    node.className = "topBtn";
    node.textContent = text;
    return node;
}
function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, value);
    }
    return node;
}
