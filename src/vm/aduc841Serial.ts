import { parseIntelHex, type IntelHexByte } from "./emu8051Wasm";

/** Options for the ADuC841 factory serial downloader. */
export type Aduc841FlashOptions = {
  baudRate?: number;
  runAfter?: boolean;
  onProgress?: (written: number, total: number) => void;
  /** Low-level UART events for the on-screen flashing diagnostic log. */
  onTrace?: (event: Aduc841FlashTraceEvent) => void;
};

export type Aduc841FlashTraceEvent = {
  /** Elapsed milliseconds since the flash session started. */
  atMs: number;
  kind: "state" | "tx" | "rx" | "error";
  label: string;
  bytes?: readonly number[];
  detail?: string;
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
const SERIAL_BUFFER_BYTES = 4096;

type TraceWriter = {
  state: (label: string, detail?: string) => void;
  tx: (label: string, bytes: ArrayLike<number>) => void;
  rx: (label: string, bytes: ArrayLike<number>) => void;
  error: (label: string, detail?: string) => void;
};

type PendingRead = {
  resolve: (value: Uint8Array | null) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

type LoaderIdPacket = {
  bytes: number[];
  text: string;
};

/**
 * Web Serial only permits one outstanding reader.read() call.  A small pump
 * keeps that invariant while allowing callers to wait with a timeout.  The
 * previous Promise.race approach could leave a read pending after a timeout,
 * which made subsequent diagnostics unreliable on some USB-to-UART bridges.
 */
class SerialReadPump {
  private readonly queued: Uint8Array[] = [];
  private readonly pending: PendingRead[] = [];
  private ended = false;
  private failure: unknown = null;
  private readonly pumping: Promise<void>;

  constructor(
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly onChunk: (bytes: Uint8Array) => void,
    private readonly onFailure?: (error: unknown) => void,
  ) {
    this.pumping = this.pump();
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    if (this.queued.length) return this.queued.shift() ?? null;
    if (this.failure) throw this.failure;
    if (this.ended) return null;
    return new Promise<Uint8Array | null>((resolve, reject) => {
      const pending: PendingRead = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.pending.indexOf(pending);
          if (index >= 0) this.pending.splice(index, 1);
          reject(new Error("serial timeout"));
        }, Math.max(1, timeoutMs)),
      };
      this.pending.push(pending);
    });
  }

  async stop(): Promise<void> {
    await this.reader.cancel().catch(() => undefined);
    await this.pumping.catch(() => undefined);
  }

  private async pump(): Promise<void> {
    try {
      while (true) {
        const result = await this.reader.read();
        if (result.done) break;
        const bytes = result.value;
        if (!bytes?.length) continue;
        this.onChunk(bytes);
        const next = this.pending.shift();
        if (next) {
          clearTimeout(next.timer);
          next.resolve(bytes);
        }
        else {
          this.queued.push(bytes);
        }
      }
    }
    catch (error) {
      this.failure = error;
      this.onFailure?.(error);
    }
    finally {
      this.ended = true;
      while (this.pending.length) {
        const next = this.pending.shift();
        if (!next) continue;
        clearTimeout(next.timer);
        if (this.failure) next.reject(this.failure);
        else next.resolve(null);
      }
    }
  }
}

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

  const trace = createTraceWriter(options.onTrace);
  const port = await serial.requestPort();
  const baudRate = options.baudRate ?? 9600;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let serialReader: SerialReadPump | null = null;
  try {
    trace.state("Opening serial port", `${baudRate} baud, 8N1, RTS/DTR inactive, RX buffer ${SERIAL_BUFFER_BYTES} bytes`);
    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
      bufferSize: SERIAL_BUFFER_BYTES,
    });
    // The manual specifies inactive RTS/DTR. Some CP2102 boards use these for
    // auto-reset, so explicitly keep them inactive when the browser allows it.
    await port.setSignals?.({ requestToSend: false, dataTerminalReady: false });
    if (!port.readable || !port.writable) throw new Error("The selected USB port has no readable/writable stream.");
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    serialReader = new SerialReadPump(
      reader,
      (received) => {
        // Rendering a line per received byte must never delay the next UART
        // read.  CP210x bridges may split the 25-byte loader ID into many tiny
        // chunks, so defer the UI-only trace after the read loop is armed.
        const copy = Uint8Array.from(received);
        setTimeout(() => trace.rx("UART received", copy), 0);
      },
      (error) => trace.error("UART receive stream failed", error instanceof Error ? error.message : String(error)),
    );

    // The Version 2 loader emits its ID packet by itself immediately after a
    // reset. Listen first, without sending anything, so this is also a clean
    // receive-path test for the CP210x/board connection.
    trace.state("Waiting for board RESET", "Press RESET now; listening 5 seconds for the automatic loader ID packet.");
    const resetIdReceived = await waitForLoaderId(serialReader, trace, 5000, "automatic reset ID");
    if (!resetIdReceived) {
      trace.state("No automatic ID received", "Trying the documented Version 2 interrogation packet next.");
      await identifyLoader(serialReader, writer, trace);
    }
    await sendAndExpectAck(writer, serialReader, makePacket([0x43]), "Erase CODE Flash", trace, 10000);

    let written = 0;
    options.onProgress?.(0, bytes.length);
    const chunks = contiguousChunks(bytes, MAX_PROGRAM_BYTES);
    trace.state("Programming image", `${bytes.length} bytes in ${chunks.length} packet(s).`);
    for (const [index, chunk] of chunks.entries()) {
      const address = chunk[0].addr & 0xffff;
      const payload = [0x57, 0x00, (address >> 8) & 0xff, address & 0xff,
        ...chunk.map((item) => item.value & 0xff)]; // W + 24-bit address + data
      await sendAndExpectAck(
        writer,
        serialReader,
        makePacket(payload),
        `Write ${index + 1}/${chunks.length} at 0x${address.toString(16).padStart(4, "0").toUpperCase()}`,
        trace,
      );
      written += chunk.length;
      options.onProgress?.(written, bytes.length);
    }

    if (options.runAfter !== false) {
      await sendAndExpectAck(
        writer,
        serialReader,
        makePacket([0x55, 0x00, 0x00, 0x00]),
        "Run user code at 0x0000",
        trace,
      );
    }
    trace.state("Flash session completed", `${bytes.length} bytes written and acknowledged.`);
  }
  catch (error) {
    trace.error("Flash session failed", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    // Cancel first so an outstanding read cannot keep the port locked.
    await serialReader?.stop();
    reader?.releaseLock();
    writer?.releaseLock();
    await port.close().catch(() => undefined);
    trace.state("Serial port closed");
  }
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
  reader: SerialReadPump,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  trace: TraceWriter,
): Promise<void> {
  // Interrogation is accepted by the Version 2 loader even if its reset ID
  // packet was sent before the browser opened the port.
  const interrogation = Uint8Array.from([0x21, 0x5a, 0x00, 0xa6]);
  trace.tx("Interrogate Version 2 loader", interrogation);
  await writer.write(interrogation);
  if (await waitForLoaderId(reader, trace, 1800, "interrogation response")) return;
  throw new Error("ADuC841 loader ID was not received. Set JP6=Programming, SW8=USB, then press RESET.");
}

async function waitForLoaderId(
  reader: SerialReadPump,
  trace: TraceWriter,
  timeoutMs: number,
  source: string,
): Promise<boolean> {
  const received: number[] = [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && received.length < 256) {
    const remaining = Math.max(1, deadline - Date.now());
    let chunk: Uint8Array | null;
    try {
      chunk = await reader.read(remaining);
    }
    catch (error) {
      if (isSerialTimeout(error)) break;
      throw error;
    }
    if (!chunk) break;
    for (const value of chunk) received.push(value);
    const packet = findLoaderIdPacket(received);
    if (packet) {
      trace.state(
        "Loader ID accepted",
        `${source}: ${packet.text} (25 bytes, checksum OK)`,
      );
      return true;
    }
  }
  return false;
}

/**
 * The V2 loader ID is exactly 25 bytes long and ends with a two's-complement
 * checksum.  Do not treat a short ASCII prefix (for example "ADI 84") as the
 * whole response: the remaining bytes can contain 0x07, which is otherwise
 * indistinguishable from a later NAK response.
 */
function findLoaderIdPacket(received: readonly number[]): LoaderIdPacket | null {
  for (let start = 0; start + 25 <= received.length; start += 1) {
    const bytes = received.slice(start, start + 25).map((value) => value & 0xff);
    const text = new TextDecoder().decode(Uint8Array.from(bytes.slice(0, 24)));
    if (!/ADI.{0,8}(841|842|843)/i.test(text)) continue;
    const checksum = bytes.reduce((sum, value) => (sum + value) & 0xff, 0);
    if (checksum !== 0) continue;
    return {
      bytes,
      text: text.replace(/[\x00-\x1F\x7F-\xFF]/g, " ").replace(/\s+/g, " ").trim(),
    };
  }
  return null;
}

async function sendAndExpectAck(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: SerialReadPump,
  packet: Uint8Array,
  label: string,
  trace: TraceWriter,
  timeoutMs = 2500,
): Promise<void> {
  trace.tx(label, packet);
  await writer.write(packet);
  trace.state(`Waiting for ACK: ${label}`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let chunk: Uint8Array | null;
    try {
      chunk = await reader.read(Math.max(1, deadline - Date.now()));
    }
    catch (error) {
      if (isSerialTimeout(error)) break;
      throw error;
    }
    if (!chunk) break;
    for (const byte of chunk) {
      if (byte === ACK) {
        trace.state(`ACK received: ${label}`, "0x06");
        return;
      }
      if (byte === NAK) {
        trace.error(`NAK received: ${label}`, "0x07");
        throw new Error(`ADuC841 loader returned NAK (0x07) after: ${label}.`);
      }
    }
  }
  throw new Error(`Timed out waiting for ADuC841 loader response after: ${label}.`);
}

function createTraceWriter(listener?: (event: Aduc841FlashTraceEvent) => void): TraceWriter {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
  const emit = (
    kind: Aduc841FlashTraceEvent["kind"],
    label: string,
    bytes?: ArrayLike<number>,
    detail?: string,
  ) => listener?.({
    atMs: now(),
    kind,
    label,
    bytes: bytes ? Array.from(bytes, (value) => value & 0xff) : undefined,
    detail,
  });
  return {
    state: (label, detail) => emit("state", label, undefined, detail),
    tx: (label, bytes) => emit("tx", label, bytes),
    rx: (label, bytes) => emit("rx", label, bytes),
    error: (label, detail) => emit("error", label, undefined, detail),
  };
}

function isSerialTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === "serial timeout";
}
