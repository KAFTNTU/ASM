import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "st841-scope-test-"));

try {
  for (const relative of [
    "src/mcu/aduc841.ts",
    "src/vm/peripheralBus.ts",
    "src/vm/st841Map.ts",
    "src/vm/scopeRecorder.ts",
    "src/vm/board.ts",
    "src/vm/devices/lcd16x2.ts",
  ]) {
    const sourcePath = path.join(projectRoot, relative);
    const source = fs.readFileSync(sourcePath, "utf8");
    let output = ts.transpileModule(source, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    output = output.replace(/from "\.\.?\/(?:[^"/]+\/)*([^"/.]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(tempDir, `${path.basename(relative, ".ts")}.mjs`), output);
  }

  const boardModule = await import(pathToFileURL(path.join(tempDir, "board.mjs")).href);
  const recorderModule = await import(pathToFileURL(path.join(tempDir, "scopeRecorder.mjs")).href);
  const mapModule = await import(pathToFileURL(path.join(tempDir, "st841Map.mjs")).href);
  const lcdModule = await import(pathToFileURL(path.join(tempDir, "lcd16x2.mjs")).href);
  const { Board } = boardModule;
  const { ScopeRecorder, ADUC841_MACHINE_CYCLE_HZ } = recorderModule;
  const { SFR } = mapModule;
  const { Lcd16x2 } = lcdModule;

  assert.equal(SFR.pwmcon, 0xae, "PWMCON must use the ADuC841 address");
  assert.equal(SFR.pwm0l, 0xb1, "PWM0L must not overlap DAC0L/H");
  assert.equal(SFR.pwm1h, 0xb4, "PWM1H must not overlap DACCON");
  assert.equal(SFR.dac0l, 0xf9);
  assert.equal(SFR.daccon, 0xfd);

  const lcd = new Lcd16x2();
  lcd.writeCommandByte(0x80);
  lcd.write(0xb1);
  lcd.write(0xf1);
  const lcdDebug = lcd.getDebugRows();
  assert.match(lcdDebug[0], /т/, "legacy LCD byte 0xBF must render lowercase Cyrillic т");
  assert.match(lcdDebug[1], /0xBF/, "B1h + F1h must assemble into LCD byte 0xBF");

  const board = new Board();
  board.reset();

  let p00 = board.scope.getSignal("P0.0");
  assert.equal(p00.samples.length, 1, "P0.0 must have a reset sample");
  assert.equal(p00.samples[0].voltage, 5, "P0.0 reset level must be high");

  board.setSimulationCycle(10);
  board.writePort("P0", 0xfe);
  p00 = board.scope.getSignal("P0.0");
  assert.deepEqual(p00.samples.map((sample) => sample.voltage), [5, 0]);
  assert.equal(p00.samples[1].timeSeconds, 10 / ADUC841_MACHINE_CYCLE_HZ);

  board.setSimulationCycle(20);
  board.writePort("P2", 0x02);
  board.setSimulationCycle(30);
  board.writePort("P2", 0x00);
  const sevenSegmentSelect = board.scope.getSignal("sevenSeg");
  assert.deepEqual(
    sevenSegmentSelect.samples.map((sample) => sample.voltage),
    [0, 5, 0],
    "Address 0x02 must produce a real seven-segment select pulse",
  );
  assert.equal(sevenSegmentSelect.samples[1].timeSeconds, 20 / ADUC841_MACHINE_CYCLE_HZ);
  assert.equal(sevenSegmentSelect.samples[2].timeSeconds, 30 / ADUC841_MACHINE_CYCLE_HZ);
  assert.deepEqual(
    board.scope.getSignal("ledBar").samples.map((sample) => sample.voltage),
    [0],
    "A seven-segment transaction must not activate the LED-bar channel",
  );

  board.setSimulationCycle(40);
  board.setJoystick(4095, 2048);
  const joystick = board.scope.getSignal("joystick");
  assert.equal(joystick.currentVoltage, 5);
  assert.equal(joystick.samples.at(-1).timeSeconds, 40 / ADUC841_MACHINE_CYCLE_HZ);

  const recorder = new ScopeRecorder();
  recorder.captureDigital("square", 0, 0);
  recorder.captureDigital("square", 1, 100);
  recorder.captureDigital("square", 0, 150);
  recorder.captureDigital("square", 1, 200);
  recorder.captureDigital("square", 0, 250);
  recorder.setCycle(300);
  const square = recorder.getSignal("square");
  assert.ok(Math.abs(square.frequencyHz - ADUC841_MACHINE_CYCLE_HZ / 100) < 1e-6);
  assert.ok(Math.abs(square.duty - 1 / 3) < 1e-9);

  const focusedRecorder = new ScopeRecorder();
  focusedRecorder.setCaptureSources([]);
  focusedRecorder.captureDigital("P0.0", 1, 0);
  focusedRecorder.captureDigital("P0.1", 1, 0);
  assert.equal(focusedRecorder.getSignal("P0.0").samples.length, 0, "closed scope must not record pins");
  focusedRecorder.setCaptureSources(["P0.1"]);
  focusedRecorder.captureDigital("P0.0", 0, 10);
  focusedRecorder.captureDigital("P0.1", 0, 10);
  assert.equal(focusedRecorder.getSignal("P0.0").samples.length, 0, "unselected pin must stay idle");
  assert.deepEqual(
    focusedRecorder.getSignal("P0.1").samples.map((sample) => sample.voltage),
    [0],
    "only the selected pin must be recorded",
  );

  const focusedBoard = new Board();
  focusedBoard.setScopeCaptureSource(null);
  focusedBoard.reset();
  assert.equal(focusedBoard.scope.getSignal("P0.0").samples.length, 0);
  focusedBoard.setScopeCaptureSource("P0.7");
  assert.deepEqual(focusedBoard.scope.getSignal("P0.7").samples.map((sample) => sample.voltage), [5]);
  focusedBoard.writePort("P0", 0x7f);
  assert.deepEqual(focusedBoard.scope.getSignal("P0.7").samples.map((sample) => sample.voltage), [5, 0]);
  assert.equal(focusedBoard.scope.getSignal("P0.0").samples.length, 0);

  const standView = fs.readFileSync(path.join(projectRoot, "src/ui/standView.ts"), "utf8");
  for (const syntheticFrequency of [120, 250, 700, 800, 1000]) {
    assert.ok(
      !standView.includes(`frequencyHz: ${syntheticFrequency}`),
      `Synthetic ${syntheticFrequency} Hz oscilloscope template must be removed`,
    );
  }

  console.log("Real oscilloscope signal tests passed");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
