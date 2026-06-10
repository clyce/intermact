import { frameTimes, type Player } from "@intermact/core";

/**
 * Dependency-free animated-GIF export (design.md §17). A compact, correct GIF89a
 * encoder (uniform 256-color quantization + standard LZW) so the deterministic
 * PNG-sequence path can also produce a single shareable animation without
 * pulling in a heavy encoder. Frame quality is intentionally simple (8×8×4 RGB
 * palette); for high-fidelity output use {@link recordCanvasVideo} (WebM) or the
 * PNG sequence.
 */

/** A raw RGBA frame (e.g. from `CanvasRenderingContext2D.getImageData().data`). */
export interface RgbaFrame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Options for {@link encodeGif}. */
export interface EncodeGifOptions {
  /** Playback frame rate → per-frame delay (default 30). */
  readonly fps?: number;
  /** Loop count: 0 = forever (default), N = N times. */
  readonly loop?: number;
}

const PALETTE_SIZE = 256;
const MIN_CODE_SIZE = 8;

/** Build the fixed 8×8×4 (R3 G3 B2) palette as a flat `[r,g,b,...]` table. */
function buildPalette(): Uint8Array {
  const pal = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const r = (i >> 5) & 7;
    const g = (i >> 2) & 7;
    const b = i & 3;
    pal[i * 3] = Math.round((r * 255) / 7);
    pal[i * 3 + 1] = Math.round((g * 255) / 7);
    pal[i * 3 + 2] = Math.round((b * 255) / 3);
  }
  return pal;
}

/** Map an RGBA frame to palette indices via uniform quantization. */
function quantize(frame: RgbaFrame): Uint8Array {
  const n = frame.width * frame.height;
  const indices = new Uint8Array(n);
  const d = frame.data;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4]!;
    const g = d[i * 4 + 1]!;
    const b = d[i * 4 + 2]!;
    indices[i] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
  }
  return indices;
}

/** LSB-first variable-width bit packer producing a flat byte array. */
class BitWriter {
  readonly bytes: number[] = [];
  private cur = 0;
  private bits = 0;

  write(code: number, size: number): void {
    this.cur |= code << this.bits;
    this.bits += size;
    while (this.bits >= 8) {
      this.bytes.push(this.cur & 0xff);
      this.cur >>= 8;
      this.bits -= 8;
    }
  }

  flush(): void {
    if (this.bits > 0) {
      this.bytes.push(this.cur & 0xff);
      this.cur = 0;
      this.bits = 0;
    }
  }
}

/** Standard GIF LZW compression of palette indices (minCodeSize = 8). */
function lzwEncode(indices: Uint8Array): number[] {
  const clearCode = 1 << MIN_CODE_SIZE; // 256
  const eoiCode = clearCode + 1; // 257
  const writer = new BitWriter();

  let codeSize = MIN_CODE_SIZE + 1; // 9
  let dict = new Map<string, number>();
  let next = eoiCode + 1; // 258
  const reset = (): void => {
    dict = new Map();
    next = eoiCode + 1;
    codeSize = MIN_CODE_SIZE + 1;
  };
  // Root codes (0..255) are implicit; multi-char strings live in `dict`.
  const codeOf = (s: string): number => (s.length === 1 ? s.charCodeAt(0) : dict.get(s)!);

  writer.write(clearCode, codeSize);
  reset();

  let w = "";
  for (let i = 0; i < indices.length; i++) {
    const c = String.fromCharCode(indices[i]!);
    if (w === "") {
      w = c;
      continue;
    }
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      writer.write(codeOf(w), codeSize);
      dict.set(wc, next);
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
      if (next > 4095) {
        writer.write(clearCode, codeSize);
        reset();
      }
      w = c;
    }
  }
  if (w !== "") writer.write(codeOf(w), codeSize);
  writer.write(eoiCode, codeSize);
  writer.flush();
  return writer.bytes;
}

/** Split a byte stream into ≤255-byte GIF sub-blocks, terminated by 0x00. */
function toSubBlocks(bytes: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return out;
}

function writeU16(out: number[], value: number): void {
  out.push(value & 0xff, (value >> 8) & 0xff);
}

/**
 * Encode RGBA frames into an animated GIF89a byte stream. All frames must share
 * the first frame's dimensions.
 */
export function encodeGif(
  frames: readonly RgbaFrame[],
  options: EncodeGifOptions = {},
): Uint8Array {
  if (frames.length === 0) throw new Error("encodeGif requires at least one frame.");
  const { width, height } = frames[0]!;
  const fps = options.fps ?? 30;
  const delay = Math.max(1, Math.round(100 / fps)); // centiseconds
  const loop = options.loop ?? 0;
  const palette = buildPalette();

  const out: number[] = [];
  // Header + logical screen descriptor (global 256-color table, 8-bit).
  out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // "GIF89a"
  writeU16(out, width);
  writeU16(out, height);
  out.push(0xf7, 0x00, 0x00); // packed: global table, 256 colors / bg / aspect
  for (let i = 0; i < palette.length; i++) out.push(palette[i]!);

  // NETSCAPE2.0 application extension for looping.
  out.push(0x21, 0xff, 0x0b);
  for (const ch of "NETSCAPE2.0") out.push(ch.charCodeAt(0));
  out.push(0x03, 0x01);
  writeU16(out, loop);
  out.push(0x00);

  for (const frame of frames) {
    // Graphic control extension (per-frame delay).
    out.push(0x21, 0xf9, 0x04, 0x00);
    writeU16(out, delay);
    out.push(0x00, 0x00);

    // Image descriptor (no local color table).
    out.push(0x2c);
    writeU16(out, 0);
    writeU16(out, 0);
    writeU16(out, frame.width);
    writeU16(out, frame.height);
    out.push(0x00);

    // LZW image data.
    out.push(MIN_CODE_SIZE);
    const lzw = lzwEncode(quantize(frame));
    out.push(...toSubBlocks(lzw));
  }

  out.push(0x3b); // trailer
  return Uint8Array.from(out);
}

/** Options for {@link exportCanvasGif}. */
export interface ExportGifOptions {
  /** Frames per second (default 15 for GIF). */
  readonly fps?: number;
  /** Seconds to export (default: the player's duration). */
  readonly duration?: number;
  /** Loop count: 0 = forever (default). */
  readonly loop?: number;
  /** Force a synchronous redraw after each seek (wire to your `gl.render`). */
  readonly renderFrame?: (time: number) => void;
}

/**
 * Deterministically export an animated GIF by seeking the player frame by frame,
 * reading back the canvas pixels, and encoding (design.md §17). The canvas must
 * be created with `preserveDrawingBuffer: true` for WebGL readback to work.
 */
export async function exportCanvasGif(
  canvas: HTMLCanvasElement,
  player: Player,
  options: ExportGifOptions = {},
): Promise<Blob> {
  const fps = options.fps ?? 15;
  const times = frameTimes(player, {
    fps,
    ...(options.duration !== undefined ? { duration: options.duration } : {}),
  });
  const w = canvas.width;
  const h = canvas.height;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d");
  if (!ctx) throw new Error("Could not acquire a 2D context for GIF readback.");

  const frames: RgbaFrame[] = [];
  for (const t of times) {
    player.seek(t);
    options.renderFrame?.(t);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    frames.push({ data: img.data, width: w, height: h });
  }
  player.seek(0);
  const bytes = encodeGif(frames, { fps, loop: options.loop ?? 0 });
  return new Blob([bytes as BlobPart], { type: "image/gif" });
}
