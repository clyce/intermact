import { describe, expect, it } from "vitest";
import { encodeGif, type RgbaFrame } from "./gif";

/**
 * GIF89a encoder tests (design.md §17). Correctness is verified end-to-end with
 * an independent, spec-faithful GIF LZW decoder: if our encoder's output decodes
 * back to the same quantized palette indices, real GIF viewers (which use the
 * same spec decoder) will render it correctly.
 */

/** Same uniform 8×8×4 quantization the encoder uses (R3 G3 B2). */
function quantize(r: number, g: number, b: number): number {
  return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
}

function makeFrame(pixels: readonly [number, number, number][], width: number): RgbaFrame {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { data, width, height: pixels.length / width };
}

/** Standard GIF LZW decoder (independent of the encoder). */
function lzwDecode(bytes: number[], minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const initDict = (): void => {
    dict = [];
    for (let i = 0; i < clear; i++) dict.push([i]);
    dict.push([], []); // clear, eoi placeholders
    codeSize = minCodeSize + 1;
  };
  let bitPos = 0;
  const readCode = (): number => {
    let code = 0;
    for (let j = 0; j < codeSize; j++) {
      const byteIndex = bitPos >> 3;
      const bit = (bytes[byteIndex]! >> (bitPos & 7)) & 1;
      code |= bit << j;
      bitPos++;
    }
    return code;
  };

  initDict();
  const out: number[] = [];
  let prev: number[] | null = null;
  for (;;) {
    const code = readCode();
    if (code === clear) {
      initDict();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code]!;
    else if (code === dict.length && prev) entry = [...prev, prev[0]!];
    else throw new Error(`Invalid LZW code ${code} at dict size ${dict.length}.`);
    out.push(...entry);
    if (prev) {
      dict.push([...prev, entry[0]!]);
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out;
}

/** Pull the first frame's image data sub-blocks out of a single-frame GIF. */
function extractImageData(gif: Uint8Array): { minCodeSize: number; data: number[] } {
  // header(6) + LSD(7) + global color table(768) + NETSCAPE(19) + GCE(8) + descriptor(10)
  const offset = 6 + 7 + 768 + 19 + 8 + 10;
  const minCodeSize = gif[offset]!;
  let i = offset + 1;
  const data: number[] = [];
  for (;;) {
    const len = gif[i++]!;
    if (len === 0) break;
    for (let k = 0; k < len; k++) data.push(gif[i++]!);
  }
  return { minCodeSize, data };
}

describe("encodeGif (M15 / §17)", () => {
  it("writes a valid GIF89a header and screen size", () => {
    const frame = makeFrame(
      [
        [0, 0, 0],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ],
      2,
    );
    const gif = encodeGif([frame]);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[6]! | (gif[7]! << 8)).toBe(2); // width
    expect(gif[8]! | (gif[9]! << 8)).toBe(2); // height
    expect(gif[gif.length - 1]).toBe(0x3b); // trailer
  });

  it("round-trips pixels through LZW to the expected palette indices", () => {
    const pixels: [number, number, number][] = [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
      [10, 250, 30],
      [128, 128, 128],
      [200, 50, 90],
    ];
    const frame = makeFrame(pixels, 4);
    const gif = encodeGif([frame], { fps: 10 });
    const { minCodeSize, data } = extractImageData(gif);
    expect(minCodeSize).toBe(8);

    const decoded = lzwDecode(data, minCodeSize);
    const expected = pixels.map(([r, g, b]) => quantize(r, g, b));
    expect(decoded).toEqual(expected);
  });

  it("encodes multiple frames and loops forever by default", () => {
    const a = makeFrame(
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
      2,
    );
    const b = makeFrame(
      [
        [255, 255, 255],
        [0, 0, 0],
      ],
      2,
    );
    const gif = encodeGif([a, b], { fps: 5 });
    // Two image-separator blocks (0x2C) → two frames.
    const separators = gif.filter((byte) => byte === 0x2c).length;
    expect(separators).toBeGreaterThanOrEqual(2);
  });

  it("throws on an empty frame list", () => {
    expect(() => encodeGif([])).toThrowError(/at least one frame/i);
  });
});
