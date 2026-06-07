import { type ReadonlySignal } from "../reactive/signal";
import { derived, type ReactiveObjectSource } from "../reactive/derived";
import { createGeometryProvider2D, strokeTraitFrom } from "../geometry/provider";
import { rawContourFromPoints } from "../geometry/sampling";
import { type IMObject2D } from "../object/types";
import { type AbsXY, xy } from "../math/vec";

/** Options for {@link decimalNumber}. */
export interface DecimalOptions {
  readonly prefix?: string;
  readonly digits?: number;
}

const DIGIT_WIDTH = 0.22;
const DIGIT_HEIGHT = 0.36;
const CHAR_GAP = 0.06;

/** Minimal 7-segment style strokes for digits 0–9, period, minus, space. */
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
  "-": [[xy(0.05, DIGIT_HEIGHT * 0.5), xy(0.15, DIGIT_HEIGHT * 0.5)]],
  " ": [],
};

function segmentPairs(mask: string): [AbsXY, AbsXY][] {
  const segs: [number, number, number, number][] = [
    [0, 0, DIGIT_WIDTH, 0],
    [DIGIT_WIDTH, 0, DIGIT_WIDTH, DIGIT_HEIGHT * 0.5],
    [DIGIT_WIDTH, DIGIT_HEIGHT * 0.5, DIGIT_WIDTH, DIGIT_HEIGHT],
    [0, DIGIT_HEIGHT, DIGIT_WIDTH, DIGIT_HEIGHT],
    [0, DIGIT_HEIGHT * 0.5, 0, DIGIT_HEIGHT],
    [0, DIGIT_HEIGHT * 0.5, 0, 0],
    [0, DIGIT_HEIGHT * 0.5, DIGIT_WIDTH, DIGIT_HEIGHT * 0.5],
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

function buildGlyphObject(text: string): IMObject2D {
  const contours = [];
  let cursor = 0;
  for (const ch of text) {
    const segs = SEGMENTS[ch] ?? SEGMENTS[" "]!;
    for (const [a, b] of segs) {
      contours.push(
        rawContourFromPoints([xy(a[0] + cursor, a[1]), xy(b[0] + cursor, b[1])], false),
      );
    }
    cursor += DIGIT_WIDTH + CHAR_GAP;
  }
  const provider = createGeometryProvider2D({ rawContours: contours, fillable: false });
  return {
    type: "decimal-number",
    dimension: "2d",
    traits: [strokeTraitFrom(provider)],
    geometry: provider,
    style: { stroke: "#e2e8f0", lineWidth: 0.04 },
  };
}

/**
 * Reactive decimal readout driven by a numeric signal (design.md §7.4, §8).
 * Returns a {@link ReactiveObjectSource} for `scene.registerReactive`.
 */
export function decimalNumber(
  tracker: ReadonlySignal<number>,
  opts: DecimalOptions = {},
): ReactiveObjectSource {
  const digits = opts.digits ?? 2;
  const prefix = opts.prefix ?? "";
  return derived([tracker], () => {
    const text = `${prefix}${tracker.get().toFixed(digits)}`;
    return buildGlyphObject(text);
  });
}
