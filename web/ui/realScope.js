export function cloneScopeSignal(signal) {
    return {
        ...signal,
        samples: signal.samples.map((sample) => ({ ...sample })),
    };
}
export function emptyScopeSignal(source) {
    return {
        source,
        samples: [],
        nowSeconds: 0,
        currentVoltage: 0,
        active: false,
        duty: 0,
        frequencyHz: 0,
    };
}
export function hasTriggerEdge(signal, edge, levelVolts, afterSeconds = Number.NEGATIVE_INFINITY) {
    return findLatestTriggerTime(signal.samples, edge, levelVolts, afterSeconds) != null;
}
export function drawRecordedScope(canvas, signal, view) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    const width = canvas.width;
    const height = canvas.height;
    const palette = resolveScopePalette(canvas, view.signalColor);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height, palette);
    const totalTime = Math.max(1e-12, view.timebaseDivSeconds * 10);
    const triggerTime = view.triggerSource === "Ext"
        ? signal.nowSeconds
        : findSweepTriggerTime(signal, view.triggerEdge, view.triggerLevelVolts, totalTime);
    const triggerRequired = view.triggerMode === "Normal" || view.triggerMode === "Single";
    const triggerReady = triggerTime != null;
    let windowStart = signal.nowSeconds - totalTime + view.scopePanSeconds;
    if (view.triggerMode !== "None" && triggerReady && triggerTime != null) {
        windowStart = triggerTime - totalTime * 0.2 + view.scopePanSeconds;
    }
    const windowEnd = windowStart + totalTime;
    const zeroY = height * 0.5 - view.scopeYOffsetDivs * (height / 8);
    ctx.strokeStyle = palette.zeroLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    if (triggerRequired && !triggerReady) {
        ctx.fillStyle = palette.waitingText;
        ctx.font = "11px monospace";
        ctx.fillText("WAITING FOR TRIGGER", 10, 18);
        drawCursorLine(ctx, width, height, view.cursorT1Div, palette.cursorPrimary);
        drawCursorLine(ctx, width, height, view.cursorT2Div, palette.cursorSecondary);
        return;
    }
    const average = averageVoltage(signal.samples, windowStart, windowEnd);
    if (view.showAverage) {
        const transformedAverage = transformVoltage(average, average, view.reverseWave, view.couplingMode);
        const averageY = voltageToY(transformedAverage, zeroY, height, view.voltsDiv);
        ctx.strokeStyle = palette.averageLine;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(0, averageY);
        ctx.lineTo(width, averageY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.shadowColor = palette.signal;
    ctx.shadowBlur = 3;
    ctx.strokeStyle = palette.signal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Only draw from the moment the recorder actually has data. Before the
    // first sample nothing was measured, and painting the trace at 0 V there
    // would claim a reading that was never taken.
    const firstSampleTime = signal.samples.length ? signal.samples[0].timeSeconds : windowStart;
    const traceStart = Math.max(windowStart, firstSampleTime);
    const startX = totalTime > 0 ? ((traceStart - windowStart) / totalTime) * width : 0;
    let previousVoltage = transformVoltage(sampleVoltageAt(signal.samples, traceStart), average, view.reverseWave, view.couplingMode);
    let previousY = voltageToY(previousVoltage, zeroY, height, view.voltsDiv);
    ctx.moveTo(startX, previousY);
    for (const sample of signal.samples) {
        if (sample.timeSeconds <= windowStart)
            continue;
        if (sample.timeSeconds > windowEnd)
            break;
        const x = ((sample.timeSeconds - windowStart) / totalTime) * width;
        ctx.lineTo(x, previousY);
        const nextVoltage = transformVoltage(sample.voltage, average, view.reverseWave, view.couplingMode);
        const nextY = voltageToY(nextVoltage, zeroY, height, view.voltsDiv);
        ctx.lineTo(x, nextY);
        previousY = nextY;
    }
    ctx.lineTo(width, previousY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawCursorLine(ctx, width, height, view.cursorT1Div, palette.cursorPrimary);
    drawCursorLine(ctx, width, height, view.cursorT2Div, palette.cursorSecondary);
}
export function updateRecordedScopeReadout(table, signal, view) {
    const body = table.tBodies[0];
    if (!body)
        return;
    const totalTime = Math.max(1e-12, view.timebaseDivSeconds * 10);
    const triggerTime = view.triggerSource === "Ext"
        ? signal.nowSeconds
        : findSweepTriggerTime(signal, view.triggerEdge, view.triggerLevelVolts, totalTime);
    let windowStart = signal.nowSeconds - totalTime + view.scopePanSeconds;
    if (view.triggerMode !== "None" && triggerTime != null) {
        windowStart = triggerTime - totalTime * 0.2 + view.scopePanSeconds;
    }
    const windowEnd = windowStart + totalTime;
    const average = averageVoltage(signal.samples, windowStart, windowEnd);
    const t1Time = windowStart + view.cursorT1Div * view.timebaseDivSeconds;
    const t2Time = windowStart + view.cursorT2Div * view.timebaseDivSeconds;
    const t1Voltage = transformVoltage(sampleVoltageAt(signal.samples, t1Time), average, view.reverseWave, view.couplingMode);
    const t2Voltage = transformVoltage(sampleVoltageAt(signal.samples, t2Time), average, view.reverseWave, view.couplingMode);
    const rows = [
        ["T1", formatTime(t1Time), `${t1Voltage.toFixed(3)} V`],
        ["T2", formatTime(t2Time), `${t2Voltage.toFixed(3)} V`],
        ["T2-T1", formatTime(t2Time - t1Time), `${(t2Voltage - t1Voltage).toFixed(3)} V`],
    ];
    Array.from(body.rows).forEach((row, rowIndex) => {
        const values = rows[rowIndex];
        if (!values)
            return;
        Array.from(row.cells).forEach((cell, cellIndex) => {
            cell.textContent = values[cellIndex] ?? "";
        });
    });
}
/** Classic red trace, with a white-paper variant when the application uses its light theme. */
function resolveScopePalette(canvas, signalColor) {
    const isLight = canvas.closest?.(".minimalShell")?.getAttribute("data-theme") === "light";
    if (isLight) {
        return {
            background: "#FBFCFD",
            majorGrid: "rgba(65,83,98,0.14)",
            centreGrid: "rgba(65,83,98,0.40)",
            zeroLine: "rgba(65,83,98,0.22)",
            waitingText: "#5A6B78",
            averageLine: "rgba(166,109,21,0.9)",
            signal: signalColor,
            cursorPrimary: "#41535F",
            cursorSecondary: "#587090",
        };
    }
    return {
        background: "#000000",
        majorGrid: "rgba(255,255,255,0.12)",
        centreGrid: "rgba(255,255,255,0.42)",
        zeroLine: "rgba(255,255,255,0.24)",
        waitingText: "rgba(255,255,255,0.72)",
        averageLine: "rgba(236,213,110,0.85)",
        signal: signalColor,
        cursorPrimary: "#ffffff",
        cursorSecondary: "#b4c8ff",
    };
}
function drawGrid(ctx, width, height, palette) {
    ctx.strokeStyle = palette.majorGrid;
    ctx.lineWidth = 1;
    for (let index = 0; index <= 10; index += 1) {
        const x = (index / 10) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let index = 0; index <= 8; index += 1) {
        const y = (index / 8) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.strokeStyle = palette.centreGrid;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();
}
function drawCursorLine(ctx, width, height, divPosition, color) {
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
function voltageToY(voltage, zeroY, height, voltsDiv) {
    return zeroY - (voltage / Math.max(0.01, voltsDiv)) * (height / 8);
}
function transformVoltage(voltage, average, reverseWave, couplingMode) {
    if (couplingMode === "GND")
        return 0;
    const coupled = couplingMode === "AC" ? voltage - average : voltage;
    return reverseWave ? -coupled : coupled;
}
function sampleVoltageAt(samples, timeSeconds) {
    if (!samples.length || timeSeconds < samples[0].timeSeconds)
        return 0;
    let low = 0;
    let high = samples.length - 1;
    let result = 0;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const sample = samples[middle];
        if (sample.timeSeconds <= timeSeconds) {
            result = sample.voltage;
            low = middle + 1;
        }
        else {
            high = middle - 1;
        }
    }
    return result;
}
function averageVoltage(samples, start, end) {
    if (end <= start)
        return sampleVoltageAt(samples, start);
    let value = sampleVoltageAt(samples, start);
    let cursor = start;
    let integral = 0;
    for (const sample of samples) {
        if (sample.timeSeconds <= start)
            continue;
        if (sample.timeSeconds > end)
            break;
        integral += value * (sample.timeSeconds - cursor);
        cursor = sample.timeSeconds;
        value = sample.voltage;
    }
    integral += value * (end - cursor);
    return integral / (end - start);
}
function findLatestTriggerTime(samples, edge, levelVolts, afterSeconds = Number.NEGATIVE_INFINITY, notLaterThanSeconds = Number.POSITIVE_INFINITY) {
    let latest = null;
    for (let index = 1; index < samples.length; index += 1) {
        const previous = samples[index - 1];
        const current = samples[index];
        if (current.timeSeconds <= afterSeconds)
            continue;
        if (current.timeSeconds > notLaterThanSeconds)
            break;
        const crossed = edge === "rising"
            ? previous.voltage < levelVolts && current.voltage >= levelVolts
            : previous.voltage > levelVolts && current.voltage <= levelVolts;
        if (crossed)
            latest = current.timeSeconds;
    }
    return latest;
}
/**
 * Time base for a triggered sweep.
 *
 * A real scope only draws a sweep once it has captured the whole span that
 * follows the trigger. Picking the newest edge would pin it at the 20 % mark
 * and leave the remaining 80 % of the screen blank, because that time has not
 * elapsed yet. So we look for the newest edge that still has a full
 * post-trigger window behind it, and fall back to the newest edge of all when
 * the record is too short for even one sweep.
 */
function findSweepTriggerTime(signal, edge, levelVolts, totalTime) {
    const postTrigger = totalTime * 0.8;
    const newestUsable = signal.nowSeconds - postTrigger;
    return (findLatestTriggerTime(signal.samples, edge, levelVolts, Number.NEGATIVE_INFINITY, newestUsable)
        ?? findLatestTriggerTime(signal.samples, edge, levelVolts));
}
function formatTime(seconds) {
    const absolute = Math.abs(seconds);
    if (absolute < 1e-6)
        return `${(seconds * 1e9).toFixed(1)} ns`;
    if (absolute < 1e-3)
        return `${(seconds * 1e6).toFixed(3)} us`;
    if (absolute < 1)
        return `${(seconds * 1e3).toFixed(3)} ms`;
    return `${seconds.toFixed(6)} s`;
}
