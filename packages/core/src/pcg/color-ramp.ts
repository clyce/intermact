/**
 * Deterministic color ramps for field visualization (design.md §6.2 heatmap).
 * A ramp maps a normalized value `t ∈ [0,1]` to a CSS `rgb(...)` string by
 * piecewise-linear interpolation between stops.
 */
import { clamp } from "../math/vec";

/** A color stop as an RGB triple in [0,255]. */
export type RgbStop = readonly [number, number, number];

/** Blue → cyan → green → yellow → red ("turbo"-like) default ramp. */
export const DEFAULT_RAMP: readonly RgbStop[] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

/** Sample a color ramp at `t ∈ [0,1]`, returning a CSS `rgb(r,g,b)` string. */
export function sampleColorRamp(t: number, stops: readonly RgbStop[] = DEFAULT_RAMP): string {
  if (stops.length === 0) return "rgb(0,0,0)";
  if (stops.length === 1) {
    const [r, g, b] = stops[0]!;
    return `rgb(${r},${g},${b})`;
  }
  const x = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}
