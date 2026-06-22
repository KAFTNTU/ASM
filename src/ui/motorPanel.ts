import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PwmMotor } from "../vm/devices/pwmMotor";
import type { AudioCodec } from "../vm/devices/audioCodec";

type Telemetry = ReturnType<PwmMotor["getTelemetry"]>;
type AudioTelemetry = ReturnType<AudioCodec["getTelemetry"]>;

export type ScopeSource = "general" | "motor" | "sevenSeg" | "ledBar" | "matrix" | "joystick" | "keypad" | "lcd" | "audio";
export type ScopeSignal = {
  active: boolean;
  duty: number;
  frequencyHz: number;
  analogVoltage?: number;
};

type MotorPanelController = {
  element: HTMLDivElement;
  open(source?: ScopeSource): void;
  openScope(source?: ScopeSource): void;
  close(): void;
  isOpen(): boolean;
  renderFrame(dtSeconds: number): void;
};

type SpinnerControl = {
  valueNode: HTMLDivElement;
  upBtn: HTMLButtonElement;
  downBtn: HTMLButtonElement;
};

type CouplingMode = "AC" | "GND" | "DC";
type TriggerEdge = "rising" | "falling";
type TriggerSource = "A" | "Ext";
type TriggerMode = "Single" | "Normal" | "Auto" | "None";

const FIXED_SHAFT_OFFSET = new THREE.Vector3(-0.082, -0.048, 0.032);
const FIXED_SHAFT_ROTATION = new THREE.Euler(3.316126, -4.712389, -0.174533, "XYZ");

export { MotorPanelController };

export function createMotorPanel(params: {
  motor: PwmMotor;
  audio?: AudioCodec;
  onLoadDemo(): void;
  onLoadAudioAsm?(): void;
  onLoadAudioC?(): void;
  getScopeSignal?(source: ScopeSource): ScopeSignal;
}): MotorPanelController {
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
  const viewerCanvas = el("canvas", { class: "motorCanvas" }) as HTMLCanvasElement;
  viewport.appendChild(viewerCanvas);
  viewportCard.appendChild(viewport);
  const audioViewportCard = el("section", { class: "audioViewportCard" });
  const audioTop = el("div", { class: "audioViewportTop" });
  audioTop.textContent = "Audio subsystem";
  const audioSub = el("div", { class: "audioViewportHint" });
  audioSub.textContent = "TLV320AIC1109 / DAC0 / DAC1 / mic / phones";
  const audioDemoButtons = el("div", { class: "audioDemoButtons" });
  const audioAsmBtn = createScopePushButton("ASM demo");
  const audioCBtn = createScopePushButton("C demo");
  audioAsmBtn.classList.add("motorViewBtn");
  audioCBtn.classList.add("motorViewBtn");
  audioDemoButtons.append(audioAsmBtn, audioCBtn);
  const audioMeters = el("div", { class: "audioMeters" });
  const micMeter = createAudioMeter("Microphone");
  const speakerMeter = createAudioMeter("Speaker");
  const phonesMeter = createAudioMeter("Headphones");
  audioMeters.append(micMeter.root, speakerMeter.root, phonesMeter.root);
  const micControl = el("label", { class: "audioMicControl" });
  const micLabel = el("span", { class: "audioMicLabel" });
  micLabel.textContent = "Microphone level";
  const micSlider = el("input", { class: "audioMicSlider", type: "range", min: "0", max: "100", value: "35" }) as HTMLInputElement;
  micControl.append(micLabel, micSlider);
  const audioRoute = el("div", { class: "audioRoute mono" });
  audioRoute.textContent = "Route: DAC0 / DAC1 direct";
  audioViewportCard.append(audioTop, audioSub, audioDemoButtons, audioMeters, micControl, audioRoute);

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
  scopeTitle.textContent = "Oscilloscope";
  const scopeSourcePicker = el("select", { class: "scopeSourcePicker", title: "Signal source" }) as HTMLSelectElement;
  for (const source of ["general", "motor", "audio", "sevenSeg", "ledBar", "matrix", "joystick", "keypad", "lcd"] as ScopeSource[]) {
    const item = document.createElement("option");
    item.value = source;
    item.textContent = scopeSourceLabel(source);
    scopeSourcePicker.appendChild(item);
  }
  scopeCaptionLeft.append(scopeTitle, scopeSourcePicker);
  const scopeCaptionActions = el("div", { class: "scopeCaptionActions" });
  const scopeRunBtn = createScopePushButton("Stop");
  scopeRunBtn.classList.add("scopeRunBtn", "active");
  const scopeCloseBtn = el("button", { class: "scopeCaptionClose", type: "button", title: "Close" }) as HTMLButtonElement;
  scopeCloseBtn.textContent = "\u00d7";
  scopeCaptionActions.append(scopeRunBtn, scopeCloseBtn);
  scopeTitleBar.append(scopeCaptionLeft, scopeCaptionActions);

  const scopeCanvas = el("canvas", { class: "motorScope multisimScopeScreen" }) as HTMLCanvasElement;
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
  cursorPad.append(
    createCursorRow(cursorT1Label, t1LeftBtn, t1RightBtn),
    createCursorRow(cursorT2Label, t2LeftBtn, t2RightBtn),
    createCursorRow(cursorDeltaLabel),
  );

  const scopeReadout = el("div", { class: "scopeReadoutPanel mono" });
  const scopeReadoutTable = el("table", { class: "scopeReadoutTable multisimReadoutTable" });
  scopeReadoutTable.innerHTML = `
    <thead>
      <tr><th></th><th>Time</th><th>Channel_A</th></tr>
    </thead>
    <tbody>
      <tr><td>T1</td><td>0.000 s</td><td>0.000 V</td></tr>
      <tr><td>T2</td><td>0.000 s</td><td>0.000 V</td></tr>
      <tr><td>T2-T1</td><td>0.000 s</td><td>0.000 V</td></tr>
    </tbody>
  `;
  scopeReadout.appendChild(scopeReadoutTable);

  const scopeUtility = el("div", { class: "scopeUtilityPanel" });
  const reverseBtn = createScopeActionButton("Reverse");
  const saveBtn = createScopeActionButton("Save");
  const extTriggerRow = el("label", { class: "scopeExtTriggerRow" });
  const extTriggerText = el("span");
  extTriggerText.textContent = "Ext. trigger";
  const extTriggerDot = el("span", { class: "scopeRadioDot" });
  extTriggerRow.append(extTriggerText, extTriggerDot);
  scopeUtility.append(reverseBtn, saveBtn, extTriggerRow);
  scopeInfoRow.append(cursorPad, scopeReadout, scopeUtility);

  const scopeControlStrip = el("div", { class: "scopeControlStrip multisimControlStrip" });
  const timeScaleSpinner = createSpinnerControl("10 ms/Div");
  const timePosSpinner = createSpinnerControl("0");
  const voltsSpinner = createSpinnerControl("5 V/Div");
  const yPosSpinner = createSpinnerControl("0");
  const triggerLevelSpinner = createSpinnerControl("0", "small");

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
    createScopePushButton("Single"),
    createScopePushButton("Normal"),
    createScopePushButton("Auto"),
    createScopePushButton("None"),
  ];

  scopeControlStrip.append(
    createControlGroup("Timebase", [
      createControlLine("Scale:", timeScaleSpinner.root),
      createControlLine("X pos.(Div):", timePosSpinner.root),
      createButtonRow(modeButtons),
    ]),
    createControlGroup("Channel A", [
      createControlLine("Scale:", voltsSpinner.root),
      createControlLine("Y pos.(Div):", yPosSpinner.root),
      createButtonRow(couplingButtons),
    ]),
    createControlGroup("Trigger", [
      createControlLine("Edge:", createTinyRow(triggerButtons)),
      createControlLine("Level:", createLevelRow(triggerLevelSpinner.root)),
      createButtonRow(triggerModeButtons),
    ]),
  );

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

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 48),
    new THREE.MeshBasicMaterial({ color: 0x202020 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.07;
  scene.add(floor);

  const modelRoot = new THREE.Group();
  const shaftMount = new THREE.Group();
  const shaftSpin = new THREE.Group();
  shaftMount.add(shaftSpin);
  scene.add(modelRoot, shaftMount);

  const shaftVisual = new THREE.Mesh(
    new THREE.CylinderGeometry(0.00935, 0.00935, 0.055, 20),
    new THREE.MeshStandardMaterial({
      color: 0xc59b47,
      emissive: 0x2a1804,
      metalness: 0.72,
      roughness: 0.28,
    }),
  );
  shaftVisual.rotation.z = Math.PI / 2;
  shaftSpin.add(shaftVisual);

  const shaftMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.0055, 0.01925),
    new THREE.MeshStandardMaterial({
      color: 0xd5ae63,
      emissive: 0x211303,
      metalness: 0.38,
      roughness: 0.34,
    }),
  );
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
  let activeScopeSource: ScopeSource = "general";
  let scopeOpen = false;
  let loaded = false;
  let resizeObserver: ResizeObserver | null = null;
  let scopePhaseSeconds = 0;
  let timebaseIndex = Math.max(0, timebaseOptions.findIndex((option) => option.value === 1e-2));
  let voltsIndex = Math.max(0, voltsOptions.findIndex((value) => value === 5));
  let scopePanDivs = 0;
  let scopeYOffsetDivs = 0;
  let cursorT1Div = 1;
  let cursorT2Div = 3;
  let reverseWave = false;
  let triggerLevelVolts = 0;
  let scopeRunning = true;
  let frozenTelemetry: Telemetry | null = null;
  let frozenAnalogVoltage: number | null = null;
  let showAverage = false;
  let couplingMode: CouplingMode = "DC";
  let triggerEdge: TriggerEdge = "rising";
  let triggerSource: TriggerSource = "A";
  let triggerMode: TriggerMode = "None";
  let singleArmed = false;
  let motorPanelWidthPx = 610;
  let activeResize: { pointerId: number } | null = null;
  const shaftBasePosition = new THREE.Vector3(0.068, 0, 0);
  micSlider.addEventListener("input", () => {
    audio?.setMicLevel?.((Number(micSlider.value) || 0) / 100);
  });
  audioAsmBtn.addEventListener("click", () => params.onLoadAudioAsm?.());
  audioCBtn.addEventListener("click", () => params.onLoadAudioC?.());

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
      couplingMode = (["AC", "GND", "DC"] as CouplingMode[])[index];
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
      triggerMode = (["Single", "Normal", "Auto", "None"] as TriggerMode[])[index];
      setActiveButton(triggerModeButtons, btn);
      if (triggerMode === "Single") {
        scopeRunning = true;
        singleArmed = true;
        syncScopeRunButton();
      } else {
        singleArmed = false;
      }
    });
  });
  extTriggerRow.addEventListener("click", () => triggerSourceButtons[1].click());
  scopeSourcePicker.addEventListener("change", () => {
    openScope(scopeSourcePicker.value as ScopeSource);
  });

  scopeCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      if (event.shiftKey) {
        scopeYOffsetDivs = clamp(scopeYOffsetDivs + (event.deltaY > 0 ? -1 : 1), -40, 40);
        return;
      }
      scopePanDivs = clamp(scopePanDivs + (event.deltaY > 0 ? 1 : -1), -40, 40);
    },
    { passive: false },
  );

  closeBtn.addEventListener("click", close);
  scopeBtn.addEventListener("click", () => {
    scopeOpen = !scopeOpen;
    syncScopeState();
    resize();
  });
  cardResizeHandle.addEventListener("pointerdown", beginResize);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  window.addEventListener("pointermove", onResizeMove);
  window.addEventListener("pointerup", endResize);
  window.addEventListener("pointercancel", endResize);

  const loader = new GLTFLoader();
  loader.load(
    "/models/28byj48.glb",
    (gltf) => {
      const root = gltf.scene;
      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
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
        if (!(child instanceof THREE.Mesh)) return;

        // The SolidWorks export contains one mesh and no materials. Split its
        // indexed geometry so each face can still receive a distinct color.
        const geometry = child.geometry.index
          ? child.geometry.toNonIndexed()
          : child.geometry.clone();
        geometry.computeBoundingBox();
        const geometryBox = geometry.boundingBox;
        const positions = geometry.getAttribute("position");
        if (!geometryBox || !positions) return;

        const geometrySize = new THREE.Vector3();
        geometryBox.getSize(geometrySize);
        const colors = new Float32Array(positions.count * 3);
        const faceColor = new THREE.Color();
        const normalize = (value: number, min: number, length: number) =>
          length > 0 ? (value - min) / length : 0.5;

        for (let vertex = 0; vertex < positions.count; vertex += 3) {
          const xs = [0, 1, 2].map((corner) =>
            normalize(positions.getX(vertex + corner), geometryBox.min.x, geometrySize.x),
          );
          const ys = [0, 1, 2].map((corner) =>
            normalize(positions.getY(vertex + corner), geometryBox.min.y, geometrySize.y),
          );
          const zs = [0, 1, 2].map((corner) =>
            normalize(positions.getZ(vertex + corner), geometryBox.min.z, geometrySize.z),
          );
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const minZ = Math.min(...zs);
          const maxZ = Math.max(...zs);

          let color = 0x9da8b4;
          if (minY > 0.7 && minX > 0.18 && maxX < 0.82) {
            color = 0x3279b7;
          } else if (minX > 0.68) {
            color = 0xd8dde2;
          } else if (maxX < 0.18) {
            color = 0x737e8a;
          } else if (maxY < 0.22 || maxZ < 0.12 || minZ > 0.88) {
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
    },
    undefined,
    () => {
      const fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.11, 32),
        new THREE.MeshStandardMaterial({
          color: 0xb8c2cf,
          metalness: 0.2,
          roughness: 0.55,
        }),
      );
      fallback.rotation.z = Math.PI / 2;
      modelRoot.add(fallback);
      shaftBasePosition.set(0.068, 0, 0);
      shaftMount.position.copy(shaftBasePosition);
      loaded = true;
    },
  );

  function open(source: ScopeSource = "motor"): void {
    openPanel(source, source !== "motor");
  }

  function openScope(source: ScopeSource = "general"): void {
    openPanel(source, true);
  }

  function openPanel(source: ScopeSource, scopeOnly: boolean): void {
    activeScopeSource = source;
    shell.classList.toggle("scope-only", scopeOnly);
    modal.classList.toggle("scope-only-mode", scopeOnly);
    scopeOpen = scopeOnly || scopeOpen;
    scopeSourcePicker.value = source;
    triggerMode = "None";
    singleArmed = false;
    setActiveButton(triggerModeButtons, triggerModeButtons[3]);
    frozenTelemetry = null;
    scopeRunning = true;
    opened = true;
    syncScopeRunButton();
    syncScopeState();
    modal.classList.remove("hidden");
    ensureResizeObserver();
    resize();
  }

  function close(): void {
    opened = false;
    activeResize = null;
    document.body.classList.remove("panel-resizing");
    modal.classList.add("hidden");
  }

  function isOpen(): boolean {
    return opened;
  }

  function renderFrame(dtSeconds: number): void {
    const liveTelemetry = motor.getTelemetry();
    const audioTelemetry = audio?.getTelemetry?.() ?? null;
    const externalSignal = activeScopeSource === "motor"
      ? null
      : params.getScopeSignal?.(activeScopeSource) ?? null;
    const observedTelemetry: Telemetry = externalSignal
      ? {
          ...liveTelemetry,
          active: externalSignal.active,
          duty: externalSignal.duty,
          frequencyHz: externalSignal.frequencyHz,
          currentRpm: 0,
          targetRpm: 0,
          periodCounts: 0,
          compareCounts: 0,
          modeLabel: scopeSourceLabel(activeScopeSource),
        }
      : liveTelemetry;
    const liveAnalogVoltage = externalSignal?.analogVoltage ?? null;
    shaftSpin.rotation.set(liveTelemetry.angleRad, 0, 0);
    shaftMount.rotation.copy(FIXED_SHAFT_ROTATION);
    shaftMount.position.set(
      shaftBasePosition.x + FIXED_SHAFT_OFFSET.x,
      shaftBasePosition.y + FIXED_SHAFT_OFFSET.y,
      shaftBasePosition.z + FIXED_SHAFT_OFFSET.z,
    );
    if (scopeRunning) {
      scopePhaseSeconds += dtSeconds;
      frozenTelemetry = { ...observedTelemetry };
      frozenAnalogVoltage = liveAnalogVoltage;
    }
    if (
      scopeRunning &&
      singleArmed &&
      isTriggerAvailable(observedTelemetry, reverseWave, couplingMode, triggerLevelVolts, triggerSource, liveAnalogVoltage)
    ) {
      frozenTelemetry = { ...observedTelemetry };
      frozenAnalogVoltage = liveAnalogVoltage;
      scopeRunning = false;
      singleArmed = false;
      syncScopeRunButton();
    }
    const scopeTelemetry = scopeRunning ? observedTelemetry : (frozenTelemetry ?? observedTelemetry);
    const scopeAnalogVoltage = scopeRunning ? liveAnalogVoltage : frozenAnalogVoltage;
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
    } else {
      drawStats(statsGrid, liveTelemetry);
      statsTitle.textContent = "Parameters";
      title.textContent = "\u0414\u0432\u0438\u0433\u0443\u043d 28BYJ-48 - \u043a\u0440\u043e\u043a\u043e\u0432\u0438\u0439";
      setAudioMeterLevel(micMeter.fill, 0);
      setAudioMeterLevel(speakerMeter.fill, 0);
      setAudioMeterLevel(phonesMeter.fill, 0);
      audioRoute.textContent = "Route: DAC0 / DAC1 direct";
    }

    const timebaseDivSeconds = timebaseOptions[timebaseIndex]?.value ?? 1e-2;
    const voltsDiv = voltsOptions[voltsIndex] ?? 5;
    const scopePanSeconds = scopePanDivs * timebaseDivSeconds;

    timeScaleSpinner.valueNode.textContent = timebaseOptions[timebaseIndex].label;
    timePosSpinner.valueNode.textContent = formatPlainDiv(scopePanDivs);
    voltsSpinner.valueNode.textContent = `${voltsDiv} V/Div`;
    yPosSpinner.valueNode.textContent = formatPlainDiv(scopeYOffsetDivs);
    triggerLevelSpinner.valueNode.textContent = `${triggerLevelVolts.toFixed(1)}`;

    drawScope(scopeCanvas, scopeTelemetry, {
      elapsedSeconds: scopePhaseSeconds,
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
      analogVoltage: scopeAnalogVoltage,
    });
    updateScopeReadout(scopeReadoutTable, scopeTelemetry, {
      timebaseDivSeconds,
      scopePanSeconds,
      voltsDiv,
      scopeYOffsetDivs,
      reverseWave,
      cursorT1Div,
      cursorT2Div,
      couplingMode,
      analogVoltage: scopeAnalogVoltage,
    });

    if (!opened) return;
    controls.autoRotate = false;
    controls.update();
    if (activeScopeSource === "audio") {
      viewportHint.textContent = audioTelemetry
        ? `Frequency ${audioTelemetry.frequencyHz.toFixed(0)} Hz | Peak ${Math.round(audioTelemetry.peak * 100)}%`
        : "Audio subsystem";
    } else {
      viewportHint.textContent = loaded
      ? `Speed ${Math.round(liveTelemetry.currentRpm)} rpm | PWM ${Math.round(liveTelemetry.duty * 100)}%`
      : "Loading model...";
      renderer.render(scene, camera);
    }
  }

  function syncScopeState(): void {
    shell.classList.toggle("scope-open", scopeOpen);
    shell.classList.toggle("scope-only", opened && activeScopeSource !== "motor");
    shell.classList.toggle("audio-mode", false);
    scopeBtn.classList.toggle("scope-active", scopeOpen);
    scopeBtn.textContent = scopeOpen ? "\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u043e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444" : "\u041e\u0441\u0446\u0438\u043b\u043e\u0433\u0440\u0430\u0444";
    cardResizeHandle.classList.toggle("visible", opened && activeScopeSource === "motor");
    applyPanelWidths();
  }

  function syncScopeRunButton(): void {
    scopeRunBtn.textContent = scopeRunning ? "Stop" : "Start";
    scopeRunBtn.classList.toggle("active", scopeRunning);
  }

  function ensureResizeObserver(): void {
    if (resizeObserver) return;
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(viewport);
    resizeObserver.observe(scopeDrawer);
  }

  function resize(): void {
    const rect = viewport.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    resizeScopeCanvas();
  }

  function resizeScopeCanvas(): void {
    const rect = scopeCanvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(150, Math.floor(rect.height));
    if (scopeCanvas.width !== width || scopeCanvas.height !== height) {
      scopeCanvas.width = width;
      scopeCanvas.height = height;
    }
  }

  function beginResize(event: PointerEvent): void {
    event.preventDefault();
    activeResize = { pointerId: event.pointerId };
    document.body.classList.add("panel-resizing");
  }

  function onResizeMove(event: PointerEvent): void {
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    const viewportWidth = window.innerWidth;
    const draggedWidth = viewportWidth - event.clientX;
    motorPanelWidthPx = clamp(Math.round(draggedWidth), 460, Math.max(460, viewportWidth - 120));
    applyPanelWidths();
    resize();
  }

  function endResize(event: PointerEvent): void {
    if (!activeResize || activeResize.pointerId !== event.pointerId) return;
    activeResize = null;
    document.body.classList.remove("panel-resizing");
  }

  function applyPanelWidths(): void {
    shell.style.setProperty("--motor-card-width", `${motorPanelWidthPx}px`);
  }

  function applyView(view: "front" | "back" | "up" | "down"): void {
    if (view === "front") {
      camera.position.set(0, 0.04, 0.35);
    } else if (view === "back") {
      camera.position.set(0, 0.04, -0.35);
    } else if (view === "up") {
      camera.position.set(0, 0.33, 0.05);
    } else {
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

function updateScopeReadout(
  table: HTMLTableElement,
  telemetry: Telemetry,
  params: {
    timebaseDivSeconds: number;
    scopePanSeconds: number;
    voltsDiv: number;
    scopeYOffsetDivs: number;
    reverseWave: boolean;
    cursorT1Div: number;
    cursorT2Div: number;
    couplingMode: CouplingMode;
    analogVoltage: number | null;
  },
): void {
  const body = table.tBodies[0];
  if (!body) return;

  const t1Time = params.scopePanSeconds + params.cursorT1Div * params.timebaseDivSeconds;
  const t2Time = params.scopePanSeconds + params.cursorT2Div * params.timebaseDivSeconds;
  const t1Voltage = sampleVoltageAtTime(telemetry, t1Time, params.reverseWave, params.couplingMode, params.analogVoltage);
  const t2Voltage = sampleVoltageAtTime(telemetry, t2Time, params.reverseWave, params.couplingMode, params.analogVoltage);
  const rows = [
    ["T1", `${t1Time.toFixed(3)} s`, `${t1Voltage.toFixed(3)} V`],
    ["T2", `${t2Time.toFixed(3)} s`, `${t2Voltage.toFixed(3)} V`],
    ["T2-T1", `${(t2Time - t1Time).toFixed(3)} s`, `${(t2Voltage - t1Voltage).toFixed(3)} V`],
  ];

  Array.from(body.rows).forEach((row, rowIndex) => {
    const values = rows[rowIndex];
    if (!values) return;
    Array.from(row.cells).forEach((cell, cellIndex) => {
      cell.textContent = values[cellIndex] ?? "";
    });
  });
}

function createAudioMeter(label: string): {
  root: HTMLDivElement;
  fill: HTMLDivElement;
} {
  const root = el("div", { class: "audioMeter" });
  const title = el("div", { class: "audioMeterTitle" });
  title.textContent = label;
  const track = el("div", { class: "audioMeterTrack" });
  const fill = el("div", { class: "audioMeterFill" });
  track.appendChild(fill);
  root.append(title, track);
  return { root, fill };
}

function setAudioMeterLevel(fill: HTMLDivElement, value: number): void {
  fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
}

function drawStats(target: HTMLDivElement, telemetry: Telemetry): void {
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

function drawAudioStats(target: HTMLDivElement, telemetry: AudioTelemetry): void {
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

function drawScope(
  canvas: HTMLCanvasElement,
  telemetry: Telemetry,
  params: {
    elapsedSeconds: number;
    signalColor: string;
    timebaseDivSeconds: number;
    voltsDiv: number;
    scopePanSeconds: number;
    scopeYOffsetDivs: number;
    reverseWave: boolean;
    cursorT1Div: number;
    cursorT2Div: number;
    couplingMode: CouplingMode;
    showAverage: boolean;
    triggerEdge: TriggerEdge;
    triggerSource: TriggerSource;
    triggerMode: TriggerMode;
    triggerLevelVolts: number;
    analogVoltage: number | null;
  },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let i = 0; i <= 8; i++) {
    const y = (i / 8) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const centerY = h * 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(w, centerY);
  ctx.stroke();

  const zeroY = h * 0.5 - params.scopeYOffsetDivs * (h / 8);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(w, zeroY);
  ctx.stroke();

  const triggerReady = isTriggerAvailable(
    telemetry,
    params.reverseWave,
    params.couplingMode,
    params.triggerLevelVolts,
    params.triggerSource,
    params.analogVoltage,
  );
  if ((params.triggerMode === "Normal" || params.triggerMode === "Single") && !triggerReady) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "11px monospace";
    ctx.fillText("WAITING FOR TRIGGER", 10, 18);
    drawCursorLine(ctx, w, h, params.cursorT1Div, "#ffffff");
    drawCursorLine(ctx, w, h, params.cursorT2Div, "#b4c8ff");
    return;
  }

  const avgVoltage = sampleAverageVoltage(telemetry, params.reverseWave, params.couplingMode, params.analogVoltage);
  const avgY = zeroY - ((avgVoltage / Math.max(0.2, params.voltsDiv)) * (h / 8));
  if (params.showAverage) {
    ctx.strokeStyle = "rgba(236, 213, 110, 0.85)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, avgY);
    ctx.lineTo(w, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.shadowColor = params.signalColor;
  ctx.shadowBlur = 7;
  ctx.strokeStyle = params.signalColor;
  ctx.lineWidth = 2;
  const totalTime = params.timebaseDivSeconds * 10;
  let startTime = params.elapsedSeconds + params.scopePanSeconds;
  if (params.triggerMode !== "None" && triggerReady) {
    const edgePhase = params.reverseWave
      ? (params.triggerEdge === "rising" ? telemetry.duty : 0)
      : (params.triggerEdge === "rising" ? 0 : telemetry.duty);
    const edgeTime = params.triggerSource === "A" && telemetry.frequencyHz > 0
      ? edgePhase / telemetry.frequencyHz
      : 0;
    startTime = params.triggerMode === "Single"
      ? edgeTime + params.scopePanSeconds
      : edgeTime + params.scopePanSeconds - totalTime * 0.2;
  }
  const periodPixels = telemetry.frequencyHz > 0
    ? w / Math.max(1, telemetry.frequencyHz * totalTime)
    : Number.POSITIVE_INFINITY;
  if (periodPixels < 1.5 && telemetry.active && params.couplingMode !== "GND") {
    const lowVoltage = sampleVoltageLevel(telemetry, false, params.reverseWave, params.couplingMode);
    const highVoltage = sampleVoltageLevel(telemetry, true, params.reverseWave, params.couplingMode);
    const lowY = zeroY - ((lowVoltage / Math.max(0.2, params.voltsDiv)) * (h / 8));
    const highY = zeroY - ((highVoltage / Math.max(0.2, params.voltsDiv)) * (h / 8));
    ctx.fillStyle = `${params.signalColor}42`;
    ctx.fillRect(1, Math.min(lowY, highY), w - 2, Math.abs(highY - lowY));
    ctx.beginPath();
    ctx.moveTo(1, lowY);
    ctx.lineTo(w - 1, lowY);
    ctx.moveTo(1, highY);
    ctx.lineTo(w - 1, highY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    const sampleCount = clamp(Math.ceil(w * 3), 900, 5000);
    let previousY = 0;
  for (let index = 0; index < sampleCount; index++) {
    const fraction = index / Math.max(1, sampleCount - 1);
    const x = fraction * (w - 2) + 1;
      const timeAtSample = startTime + fraction * totalTime;
      const sampleVoltage = sampleVoltageAtTime(
        telemetry,
        timeAtSample,
        params.reverseWave,
        params.couplingMode,
        params.analogVoltage,
      );
    const y = zeroY - ((sampleVoltage / Math.max(0.2, params.voltsDiv)) * (h / 8));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        if (Math.abs(y - previousY) > 0.01) ctx.lineTo(x, previousY);
        ctx.lineTo(x, y);
      }
      previousY = y;
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  drawCursorLine(ctx, w, h, params.cursorT1Div, "#ffffff");
  drawCursorLine(ctx, w, h, params.cursorT2Div, "#b4c8ff");
}

function drawCursorLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  divPosition: number,
  color: string,
): void {
  const x = (divPosition / 10) * width;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function sampleAverageVoltage(
  telemetry: Telemetry,
  reverseWave: boolean,
  couplingMode: CouplingMode = "DC",
  analogVoltage: number | null = null,
): number {
  if (analogVoltage != null) {
    return couplingMode === "DC" ? (reverseWave ? -analogVoltage : analogVoltage) : 0;
  }
  if (couplingMode !== "DC") return 0;
  const base = telemetry.duty * 5;
  return reverseWave ? -base : base;
}

function sampleVoltageLevel(
  telemetry: Telemetry,
  high: boolean,
  reverseWave: boolean,
  couplingMode: CouplingMode,
): number {
  if (couplingMode === "GND") return 0;
  const signedVoltage = reverseWave ? (high ? -5 : 0) : (high ? 5 : 0);
  if (couplingMode === "AC") {
    const signedAverage = (reverseWave ? -1 : 1) * telemetry.duty * 5;
    return signedVoltage - signedAverage;
  }
  return signedVoltage;
}

function sampleVoltageAtTime(
  telemetry: Telemetry,
  timeSeconds: number,
  reverseWave: boolean,
  couplingMode: CouplingMode = "DC",
  analogVoltage: number | null = null,
): number {
  if (analogVoltage != null) {
    if (couplingMode !== "DC") return 0;
    return reverseWave ? -analogVoltage : analogVoltage;
  }
  if (!telemetry.active || telemetry.duty <= 0 || telemetry.frequencyHz <= 0) {
    return 0;
  }
  const phase = (timeSeconds * telemetry.frequencyHz) % 1;
  return sampleVoltageLevel(telemetry, phase < telemetry.duty, reverseWave, couplingMode);
}

function isTriggerAvailable(
  telemetry: Telemetry,
  reverseWave: boolean,
  couplingMode: CouplingMode,
  triggerLevelVolts: number,
  triggerSource: TriggerSource,
  analogVoltage: number | null = null,
): boolean {
  if (analogVoltage != null) {
    return triggerSource === "Ext";
  }
  if (!telemetry.active || telemetry.frequencyHz <= 0 || telemetry.duty <= 0) return false;
  if (triggerSource === "Ext") return true;
  if (couplingMode === "GND" || telemetry.duty >= 1) return false;
  const low = sampleVoltageLevel(telemetry, false, reverseWave, couplingMode);
  const high = sampleVoltageLevel(telemetry, true, reverseWave, couplingMode);
  return triggerLevelVolts >= Math.min(low, high) && triggerLevelVolts <= Math.max(low, high);
}

function formatPlainDiv(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function scopeSourceLabel(source: ScopeSource): string {
  return {
    general: "General",
    motor: "Motor PWM",
    audio: "Audio PCM",
    sevenSeg: "7-segment display",
    ledBar: "LED bar",
    matrix: "LED matrix 5x7",
    joystick: "Joystick X",
    keypad: "Keypad",
    lcd: "LCD",
  }[source];
}

function createScopeActionButton(label: string): HTMLButtonElement {
  const btn = el("button", { class: "scopeActionBtn", type: "button" }) as HTMLButtonElement;
  btn.textContent = label;
  return btn;
}

function createScopePushButton(label: string): HTMLButtonElement {
  const btn = el("button", { class: "scopePushBtn", type: "button" }) as HTMLButtonElement;
  btn.textContent = label;
  return btn;
}

function createCursorRow(
  labelNode: HTMLElement,
  leftBtn?: HTMLButtonElement,
  rightBtn?: HTMLButtonElement,
): HTMLDivElement {
  const row = el("div", { class: "scopeCursorRow" });
  row.appendChild(labelNode);
  if (leftBtn && rightBtn) {
    row.append(leftBtn, rightBtn);
  } else {
    row.append(el("span"), el("span"));
  }
  return row;
}

function createControlGroup(title: string, children: HTMLElement[]): HTMLDivElement {
  const group = el("div", { class: "scopeControlGroup multisimControlGroup" });
  const titleNode = el("div", { class: "scopeControlGroupTitle" });
  titleNode.textContent = title;
  group.appendChild(titleNode);
  children.forEach((child) => group.appendChild(child));
  return group;
}

function createControlLine(label: string, content: HTMLElement): HTMLDivElement {
  const row = el("div", { class: "scopeControlLine" });
  const labelNode = el("span", { class: "scopeControlLabel" });
  labelNode.textContent = label;
  row.append(labelNode, content);
  return row;
}

function createButtonRow(buttons: HTMLButtonElement[]): HTMLDivElement {
  const row = el("div", { class: "scopeButtonRow" });
  buttons.forEach((btn) => row.appendChild(btn));
  return row;
}

function createTinyRow(buttons: HTMLButtonElement[]): HTMLDivElement {
  const row = el("div", { class: "scopeTinyRow" });
  buttons.forEach((btn) => row.appendChild(btn));
  return row;
}

function createLevelRow(spinnerRoot: HTMLDivElement): HTMLDivElement {
  const row = el("div", { class: "scopeLevelRow" });
  const unit = el("span", { class: "scopeLevelUnit" });
  unit.textContent = "V";
  row.append(spinnerRoot, unit);
  return row;
}

function createSpinnerControl(initialValue: string, extraClass = ""): SpinnerControl & { root: HTMLDivElement } {
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

function bindSpinner(control: SpinnerControl, onUp: () => void, onDown: () => void): void {
  control.upBtn.addEventListener("click", onUp);
  control.downBtn.addEventListener("click", onDown);
}

function setActiveButton(group: HTMLButtonElement[], active: HTMLButtonElement): void {
  group.forEach((button) => button.classList.toggle("active", button === active));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function statTile(label: string, value: string): string {
  return `<div class="motorStatTile"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function button(text: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.className = "topBtn";
  node.textContent = text;
  return node;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}
