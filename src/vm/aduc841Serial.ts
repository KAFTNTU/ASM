import { parseIntelHex, type IntelHexByte } from "./emu8051Wasm";

/** Options for the ADuC841 factory serial downloader. */
export type Aduc841FlashOptions = {
  baudRate?: number;
  runAfter?: boolean;
  onProgress?: (written: number, total: number) => void;
};

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: Record<string, boolean>): Promise<void>;
};

type SerialApi = {
  requestPort(): Promise<SerialPortLike>;
};

const ACK = 0x06;
const NAK = 0x07;
const PACKET_START = [0x07, 0x0e];
const MAX_PACKET_DATA = 25;
const MAX_PROGRAM_BYTES = MAX_PACKET_DATA - 1 - 3;

/** Whether this browser exposes Web Serial (Chrome/Edge on localhost or HTTPS). */
export function isAduc841SerialSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" &&
    Boolean((navigator as Navigator & { serial?: SerialApi }).serial);
}

/**
 * Flash an Intel HEX image through the ADuC841 Version 2 UART loader.
 * The user must put the board in programming mode (JP6 and SW8) and reset it
 * after the USB port is opened. The loader uses 8 data bits, no parity, 1 stop.
 */
export async function flashAduc841(hexText: string, options: Aduc841FlashOptions = {}): Promise<void> {
  const serial = (navigator as Navigator & { serial?: SerialApi }).serial;
  if (!serial) throw new Error("Web Serial is not supported. Use Chrome or Edge on localhost/HTTPS.");

  const bytes = normalizeImage(parseIntelHex(hexText));
  if (!bytes.length) throw new Error("HEX image is empty.");

  const port = await serial.requestPort();
  const baudRate = options.baudRate ?? 9600;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  try {
    await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
    // The manual specifies inactive RTS/DTR. Some CP2102 boards use these for
    // auto-reset, so explicitly keep them inactive when the browser allows it.
    await port.setSignals?.({ requestToSend: false, dataTerminalReady: false });
    if (!port.readable || !port.writable) throw new Error("The selected USB port has no readable/writable stream.");
    reader = port.readable.getReader();
    writer = port.writable.getWriter();

    // Give the user time to press the board RESET after the browser opens the
    // port. Interrogation also works when the reset happened just before this.
    await delay(1000);
    await identifyLoader(reader, writer);
    await sendAndExpectAck(writer, reader, makePacket([0x43]), 10000); // erase program Flash

    let written = 0;
    options.onProgress?.(0, bytes.length);
    for (const chunk of contiguousChunks(bytes, MAX_PROGRAM_BYTES)) {
      const address = chunk[0].addr & 0xffff;
      const payload = [0x57, 0x00, (address >> 8) & 0xff, address & 0xff,
        ...chunk.map((item) => item.value & 0xff)]; // W + 24-bit address + data
      await sendAndExpectAck(writer, reader, makePacket(payload));
      written += chunk.length;
      options.onProgress?.(written, bytes.length);
    }

    if (options.runAfter !== false) {
      await sendAndExpectAck(writer, reader, makePacket([0x55, 0x00, 0x00, 0x00])); // U, run at 0x0000
    }
  } finally {
    // Cancel first so an outstanding read cannot keep the port locked.
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
    writer?.releaseLock();
    await port.close().catch(() => undefined);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build one Version 2 packet; exported for deterministic protocol tests. */
export function makePacket(data: number[]): Uint8Array {
  if (!data.length || data.length > MAX_PACKET_DATA) throw new Error("Invalid ADuC841 packet length.");
  const sum = data.reduce((total, value) => total + (value & 0xff), data.length);
  const checksum = (0x100 - sum) & 0xff;
  return Uint8Array.from([...PACKET_START, data.length, ...data.map((value) => value & 0xff), checksum]);
}

function normalizeImage(input: IntelHexByte[]): IntelHexByte[] {
  const seen = new Map<number, number>();
  for (const byte of input) {
    const address = byte.addr & 0xffff;
    if (address >= 0x10000) throw new Error("HEX address is outside ADuC841 program memory.");
    seen.set(address, byte.value & 0xff);
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([addr, value]) => ({ addr, value }));
}

function contiguousChunks(bytes: IntelHexByte[], maxLength: number): IntelHexByte[][] {
  const chunks: IntelHexByte[][] = [];
  let current: IntelHexByte[] = [];
  for (const byte of bytes) {
    const previous = current[current.length - 1];
    if (current.length && (byte.addr !== previous.addr + 1 || current.length >= maxLength)) {
      chunks.push(current);
      current = [];
    }
    current.push(byte);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function identifyLoader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
): Promise<void> {
  // Interrogation is accepted by the Version 2 loader even if its reset ID
  // packet was sent before the browser opened the port.
  await writer.write(Uint8Array.from([0x21, 0x5a, 0x00, 0xa6]));
  const received: number[] = [];
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline && received.length < 80) {
    const remaining = Math.max(1, deadline - Date.now());
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await readWithTimeout(reader, remaining);
    }
    catch {
      break;
    }
    if (result.done) break;
    for (const value of result.value ?? []) received.push(value);
    const text = new TextDecoder().decode(Uint8Array.from(received));
    if (/ADI.{0,8}8[0-9]{2}/i.test(text) || received.length >= 25) return;
  }
  throw new Error("ADuC841 loader not detected. Set JP6=Programming, close SW8, then press RESET.");
}

async function sendAndExpectAck(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  packet: Uint8Array,
  timeoutMs = 2500,
): Promise<void> {
  await writer.write(packet);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await readWithTimeout(reader, Math.max(1, deadline - Date.now()));
    if (result.done) break;
    for (const byte of result.value ?? []) {
      if (byte === ACK) return;
      if (byte === NAK) throw new Error("ADuC841 loader returned NAK; erase/memory/checksum failed.");
    }
  }
  throw new Error("Timed out waiting for ADuC841 loader response.");
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("serial timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
