import { BufferAttribute, BufferGeometry } from "three";
import { cumulativeLengths, type SampledContour2D, type SampledPath2D } from "@intermact/core";

/**
 * Stroke geometry as a world-unit ribbon (design.md §15). A polyline is
 * expanded to a triangle ribbon of the given world-unit width, with vertex
 * offsets along averaged segment normals. Trim (`revealStart`/`revealEnd`,
 * §15) is applied by slicing each contour by arc length before ribboning,
 * which makes `Create` stroke reveal smooth without per-frame shader work.
 *
 * Constant-screen-width ("px") strokes are approximated by passing a width
 * already converted to world units by the viewport; a dedicated screen-space
 * shader path is deferred (noted in the M3 implementation log).
 */
export function buildStrokeGeometry(
  path: SampledPath2D,
  width: number,
  revealStart = 0,
  revealEnd = 1,
): BufferGeometry {
  const positions: number[] = [];
  const halfWidth = Math.max(width, 1e-5) / 2;

  for (const contour of path.contours) {
    const pts = trimContour(contour, revealStart, revealEnd);
    const fullReveal = revealStart <= 0 && revealEnd >= 1;
    appendRibbon(positions, pts, contour.closed && fullReveal, halfWidth);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

/**
 * Slice a contour to the arc-length window [start, end] in [0,1]. Uses the full
 * perimeter for closed contours (including the closing segment), so reveal
 * progress stays proportional to visible arc length.
 */
function trimContour(contour: SampledContour2D, start: number, end: number): number[] {
  const { points, cumulativeLength, closed } = contour;
  const n = points.length >> 1;
  if (n === 0) return [];
  const total = cumulativeLengths(points, closed).total;
  if (total <= 0) return [];
  if (start <= 0 && end >= 1) return Array.from(points);

  const sDist = Math.max(0, start) * total;
  const eDist = Math.min(1, end) * total;
  if (eDist <= sDist) return [];

  const out: number[] = [];
  const [sx, sy] = pointAtDistance(points, cumulativeLength, total, closed, sDist);
  out.push(sx, sy);

  for (let i = 0; i < n; i++) {
    const d = cumulativeLength[i]!;
    if (d > sDist && d < eDist) out.push(points[i * 2]!, points[i * 2 + 1]!);
  }

  const [ex, ey] = pointAtDistance(points, cumulativeLength, total, closed, eDist);
  const lastX = out[out.length - 2];
  const lastY = out[out.length - 1];
  if (lastX !== ex || lastY !== ey) out.push(ex, ey);
  return out;
}

/** Point at arc-length distance `s` along a polyline (includes closing segment when `closed`). */
function pointAtDistance(
  points: Float32Array,
  cumulative: Float32Array,
  total: number,
  closed: boolean,
  s: number,
): [number, number] {
  const n = points.length >> 1;
  if (n === 0) return [0, 0];
  if (n === 1) return [points[0]!, points[1]!];
  const dist = Math.max(0, Math.min(s, total));

  if (closed && dist >= cumulative[n - 1]!) {
    const segLen = total - cumulative[n - 1]!;
    const t = segLen > 0 ? (dist - cumulative[n - 1]!) / segLen : 0;
    const ax = points[(n - 1) * 2]!;
    const ay = points[(n - 1) * 2 + 1]!;
    return [ax + (points[0]! - ax) * t, ay + (points[1]! - ay) * t];
  }

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

/** Expand a polyline (flat xy) into a ribbon of triangles (z=0). */
function appendRibbon(out: number[], flat: number[], closed: boolean, halfWidth: number): void {
  const n = flat.length >> 1;
  if (n < 2) return;
  const idx = (i: number) => (closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i)));

  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const px = flat[idx(i - 1) * 2]!;
    const py = flat[idx(i - 1) * 2 + 1]!;
    const cx = flat[i * 2]!;
    const cy = flat[i * 2 + 1]!;
    const nx = flat[idx(i + 1) * 2]!;
    const ny = flat[idx(i + 1) * 2 + 1]!;
    let dx = nx - px;
    let dy = ny - py;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const ox = -dy * halfWidth;
    const oy = dx * halfWidth;
    left.push([cx + ox, cy + oy]);
    right.push([cx - ox, cy - oy]);
  }

  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = i;
    const b = (i + 1) % n;
    const la = left[a]!;
    const ra = right[a]!;
    const lb = left[b]!;
    const rb = right[b]!;
    out.push(la[0], la[1], 0, ra[0], ra[1], 0, rb[0], rb[1], 0);
    out.push(la[0], la[1], 0, rb[0], rb[1], 0, lb[0], lb[1], 0);
  }
}
