import { type AbsXY, xy } from "../math/vec";
import { type SampledContour2D } from "../object/geometry-provider";

export type { SampledContour2D };

/**
 * Arc-length sampling utilities (design.md §5.2). Uniform arc-length resampling
 * keeps `Create` stroke speed constant and morph correspondence stable.
 */

/** A raw (pre-resample) contour: flat interleaved coords + closed flag. */
export interface RawContour {
  readonly points: Float32Array;
  readonly closed: boolean;
}

/** Build a RawContour from an array of points. */
export function rawContourFromPoints(points: readonly AbsXY[], closed: boolean): RawContour {
  const flat = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    flat[i * 2] = p[0];
    flat[i * 2 + 1] = p[1];
  });
  return { points: flat, closed };
}

/** Number of points in a flat interleaved buffer. */
export function pointCount(points: Float32Array): number {
  return points.length >> 1;
}

/** Prefix-sum arc lengths and the total length of a polyline. */
export function cumulativeLengths(
  points: Float32Array,
  closed: boolean,
): { cumulative: Float32Array; total: number } {
  const n = pointCount(points);
  const cumulative = new Float32Array(n);
  if (n === 0) return { cumulative, total: 0 };
  for (let i = 1; i < n; i++) {
    const dx = points[i * 2]! - points[(i - 1) * 2]!;
    const dy = points[i * 2 + 1]! - points[(i - 1) * 2 + 1]!;
    cumulative[i] = cumulative[i - 1]! + Math.hypot(dx, dy);
  }
  let total = cumulative[n - 1]!;
  if (closed && n > 1) {
    const dx = points[0]! - points[(n - 1) * 2]!;
    const dy = points[1]! - points[(n - 1) * 2 + 1]!;
    total += Math.hypot(dx, dy);
  }
  return { cumulative, total };
}

/** Total arc length of a sampled contour, including the closing segment when applicable. */
export function contourTotalLength(contour: SampledContour2D): number {
  return cumulativeLengths(contour.points, contour.closed).total;
}

/** Linear point at a given arc-length distance along a polyline (includes closing segment when `closed`). */
export function pointAtDistance(
  points: Float32Array,
  cumulative: Float32Array,
  total: number,
  closed: boolean,
  s: number,
): [number, number] {
  const n = pointCount(points);
  if (n === 0) return [0, 0];
  if (n === 1) return [points[0]!, points[1]!];
  const dist = Math.max(0, Math.min(s, total));

  // Closing segment for closed contours.
  if (closed && dist >= cumulative[n - 1]!) {
    const segLen = total - cumulative[n - 1]!;
    const t = segLen > 0 ? (dist - cumulative[n - 1]!) / segLen : 0;
    const ax = points[(n - 1) * 2]!;
    const ay = points[(n - 1) * 2 + 1]!;
    return [ax + (points[0]! - ax) * t, ay + (points[1]! - ay) * t];
  }

  // Binary search for the segment containing `dist`.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid]! < dist) lo = mid + 1;
    else hi = mid;
  }
  const j = Math.max(1, lo);
  const segLen = cumulative[j]! - cumulative[j - 1]!;
  const t = segLen > 0 ? (dist - cumulative[j - 1]!) / segLen : 0;
  const ax = points[(j - 1) * 2]!;
  const ay = points[(j - 1) * 2 + 1]!;
  const bx = points[j * 2]!;
  const by = points[j * 2 + 1]!;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** Resample a polyline to `count` points uniformly spaced by arc length. */
export function resampleByArcLength(
  points: Float32Array,
  closed: boolean,
  count: number,
): Float32Array {
  const n = pointCount(points);
  const out = new Float32Array(Math.max(0, count) * 2);
  if (count <= 0) return out;
  if (n === 0) return out;
  const { cumulative, total } = cumulativeLengths(points, closed);

  for (let i = 0; i < count; i++) {
    const frac = closed ? i / count : count > 1 ? i / (count - 1) : 0;
    const [px, py] = pointAtDistance(points, cumulative, total, closed, frac * total);
    out[i * 2] = px;
    out[i * 2 + 1] = py;
  }
  return out;
}

/** Build a SampledContour2D (with cumulative lengths) from a points buffer. */
export function toSampledContour(points: Float32Array, closed: boolean): SampledContour2D {
  const { cumulative } = cumulativeLengths(points, closed);
  return { points, closed, cumulativeLength: cumulative };
}

/** Convert an interleaved buffer to readable AbsXY tuples (authoring channel). */
export function pointsToTuples(points: Float32Array): AbsXY[] {
  const out: AbsXY[] = [];
  for (let i = 0; i < points.length; i += 2) out.push(xy(points[i]!, points[i + 1]!));
  return out;
}
