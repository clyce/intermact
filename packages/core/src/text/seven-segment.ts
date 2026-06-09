/**
 * Seven-segment numeric glyphs (stopgap text renderer).
 *
 * Until the full font/LaTeX pipeline lands (M10, design.md §13), numeric labels
 * for axis ticks, matrix entries, and {@link decimalNumber} are drawn as simple
 * 7-segment strokes. This keeps the math toolbox (M8) framework-free and
 * dependency-light; M10 upgrades these to MSDF/LaTeX glyph paths.
 */

import { createGeometryProvider2D, strokeTraitFrom } from "../geometry/provider";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { type AbsXY, xy } from "../math/vec";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";

/** Base glyph metrics (a "size 1" digit), in world units. */
const BASE_WIDTH = 0.22;
const BASE_HEIGHT = 0.36;
const BASE_GAP = 0.06;

/** Options for {@link sevenSegmentText} / {@link glyphObject}. */
export interface SevenSegmentOptions {
  /** Glyph height in world units (default 0.36). Width/gap scale with it. */
  readonly size?: number;
  /** Bottom-left origin of the first glyph (default `[0,0]`). */
  readonly origin?: AbsXY;
  /** Horizontal alignment of the whole string around the origin x. */
  readonly align?: "left" | "center" | "right";
  /** Vertical alignment of the whole string around the origin y. */
  readonly baseline?: "bottom" | "middle" | "top";
}

/** Result of laying out a seven-segment string. */
export interface SevenSegmentText {
  /** One open 2-point contour per drawn segment, in world coordinates. */
  readonly contours: RawContour[];
  /** Total advance width of the laid-out string. */
  readonly width: number;
  /** Glyph height. */
  readonly height: number;
}

/** Segment masks for each supported character (7-segment + punctuation). */
const SEGMENTS: Record<string, readonly [AbsXY, AbsXY][]> = {
  "0": segmentPairs("0111110"),
  "1": segmentPairs("0011000"),
  "2": segmentPairs("1101101"),
  "3": segmentPairs("1111001"),
  "4": segmentPairs("0110011"),
  "5": segmentPairs("1011011"),
  "6": segmentPairs("1011111"),
  "7": segmentPairs("1110000"),
  "8": segmentPairs("1111111"),
  "9": segmentPairs("1111011"),
  ".": [[xy(0.05, 0), xy(0.05, 0.05)]],
  "-": [[xy(0.04, BASE_HEIGHT * 0.5), xy(BASE_WIDTH - 0.04, BASE_HEIGHT * 0.5)]],
  "+": [
    [xy(0.04, BASE_HEIGHT * 0.5), xy(BASE_WIDTH - 0.04, BASE_HEIGHT * 0.5)],
    [xy(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.3), xy(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.7)],
  ],
  i: [
    [xy(BASE_WIDTH * 0.5, 0), xy(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.6)],
    [xy(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.75), xy(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.8)],
  ],
  " ": [],
};

/** Build segment endpoint pairs from a 7-bit on/off mask (top→bottom order). */
function segmentPairs(mask: string): [AbsXY, AbsXY][] {
  const segs: [number, number, number, number][] = [
    [0, 0, BASE_WIDTH, 0],
    [BASE_WIDTH, 0, BASE_WIDTH, BASE_HEIGHT * 0.5],
    [BASE_WIDTH, BASE_HEIGHT * 0.5, BASE_WIDTH, BASE_HEIGHT],
    [0, BASE_HEIGHT, BASE_WIDTH, BASE_HEIGHT],
    [0, BASE_HEIGHT * 0.5, 0, BASE_HEIGHT],
    [0, BASE_HEIGHT * 0.5, 0, 0],
    [0, BASE_HEIGHT * 0.5, BASE_WIDTH, BASE_HEIGHT * 0.5],
  ];
  const out: [AbsXY, AbsXY][] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === "1") {
      const s = segs[i]!;
      out.push([xy(s[0], s[1]), xy(s[2], s[3])]);
    }
  }
  return out;
}

/** Lay out a string of seven-segment glyphs into world-space stroke contours. */
export function sevenSegmentText(text: string, opts: SevenSegmentOptions = {}): SevenSegmentText {
  const size = opts.size ?? BASE_HEIGHT;
  const scale = size / BASE_HEIGHT;
  const glyphW = BASE_WIDTH * scale;
  const gap = BASE_GAP * scale;
  const advance = glyphW + gap;
  const totalWidth = text.length > 0 ? text.length * advance - gap : 0;

  const [ox, oy] = opts.origin ?? xy(0, 0);
  const alignOffset =
    opts.align === "center" ? -totalWidth / 2 : opts.align === "right" ? -totalWidth : 0;
  const baselineOffset =
    opts.baseline === "middle" ? -size / 2 : opts.baseline === "top" ? -size : 0;
  const baseX = ox + alignOffset;
  const baseY = oy + baselineOffset;

  const contours: RawContour[] = [];
  let cursor = 0;
  for (const ch of text) {
    const segs = SEGMENTS[ch] ?? SEGMENTS[" "]!;
    for (const [a, b] of segs) {
      contours.push(
        rawContourFromPoints(
          [
            xy(baseX + cursor + a[0] * scale, baseY + a[1] * scale),
            xy(baseX + cursor + b[0] * scale, baseY + b[1] * scale),
          ],
          false,
        ),
      );
    }
    cursor += advance;
  }
  return { contours, width: totalWidth, height: size };
}

/** Build a stroke-only {@link IMObject2D} rendering `text` in seven-segment glyphs. */
export function glyphObject(
  text: string,
  style: ObjectStyle = { stroke: "#e2e8f0", lineWidth: 0.03 },
  opts: SevenSegmentOptions = {},
): IMObject2D {
  const { contours } = sevenSegmentText(text, opts);
  const provider = createGeometryProvider2D({ rawContours: contours, fillable: false });
  return {
    type: "glyph-text",
    dimension: "2d",
    traits: [strokeTraitFrom(provider)],
    geometry: provider,
    style,
  };
}
