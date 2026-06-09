/**
 * Pen-stroke → outline conversion (design.md §13). Converts a centerline path
 * (a single-stroke "skeleton", e.g. the built-in font) into closed outline
 * contours of a *constant* pen width. The result is a fillable/strokeable shape:
 *
 * - **Fill** the contours (nonzero rule) → a solid glyph of uniform thickness.
 * - **Stroke** the contours → a hollow/outlined glyph.
 *
 * This removes the variable thickness you get when stroking a skeleton directly
 * (sharp corners and end caps pinch). Open subpaths become "racetrack" loops
 * with round caps; closed subpaths (e.g. `O`) become an outer + inner ring so
 * the counter stays hollow.
 */
import { type RawContour } from "./sampling";

type Pt = [number, number];

/**
 * Miter joins longer than this multiple of the half-width are clamped. Glyphs use
 * sharp skeleton corners (A, N, V…); a low limit avoids the long spikes you get
 * when offsetting single-stroke paths (Manim uses Pango-filled outlines instead).
 */
const MITER_LIMIT = 1.25;
/** Below this cos(half-angle), use a bevel (perpendicular offset) not a miter. */
const BEVEL_COS_THRESHOLD = 0.45;
/** Segments used to approximate each round end cap (per semicircle). */
const CAP_SEGMENTS = 8;
const EPS = 1e-9;

function readPoints(contour: RawContour): Pt[] {
  const pts: Pt[] = [];
  const p = contour.points;
  for (let i = 0; i < p.length; i += 2) pts.push([p[i]!, p[i + 1]!]);
  return pts;
}

/** Drop consecutive duplicate points (zero-length segments break offsetting). */
function dedupe(points: readonly Pt[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > EPS) out.push(p);
  }
  if (closed && out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= EPS) out.pop();
  }
  return out;
}

function unit(dx: number, dy: number): Pt {
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

/** Left-hand unit normal of a direction (rotate +90°). */
function leftNormal(d: Pt): Pt {
  return [-d[1], d[0]];
}

function flatten(points: readonly Pt[], closed: boolean): RawContour {
  const out = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    out[i * 2] = p[0];
    out[i * 2 + 1] = p[1];
  });
  return { points: out, closed };
}

function signedArea(points: readonly Pt[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

/** Ensure a ring winds counter-clockwise (`ccw`) or clockwise when `ccw=false`. */
function orient(points: Pt[], ccw: boolean): Pt[] {
  const area = signedArea(points);
  if ((ccw && area < 0) || (!ccw && area > 0)) points.reverse();
  return points;
}

/**
 * Offset point at vertex `cur` toward `side` (+1 left, −1 right) by `half`,
 * using a miter join of the incoming/outgoing segment normals. `prev`/`next`
 * may be null at the open ends of a path (single-segment normal then).
 */
function offsetVertex(
  prev: Pt | null,
  cur: Pt,
  next: Pt | null,
  side: number,
  half: number,
): Pt {
  const dIn = prev ? unit(cur[0] - prev[0], cur[1] - prev[1]) : null;
  const dOut = next ? unit(next[0] - cur[0], next[1] - cur[1]) : null;
  const nIn = dIn ? leftNormal(dIn) : null;
  const nOut = dOut ? leftNormal(dOut) : null;

  if (nIn && nOut) {
    let mx = nIn[0] + nOut[0];
    let my = nIn[1] + nOut[1];
    const mlen = Math.hypot(mx, my);
    if (mlen < EPS) {
      // 180° reversal: offset perpendicular to the incoming segment.
      return [cur[0] + side * nIn[0] * half, cur[1] + side * nIn[1] * half];
    }
    mx /= mlen;
    my /= mlen;
    const cosHalf = mx * nIn[0] + my * nIn[1];
    const dist =
      cosHalf < BEVEL_COS_THRESHOLD
        ? half
        : Math.min(half / Math.max(cosHalf, EPS), half * MITER_LIMIT);
    return [cur[0] + side * mx * dist, cur[1] + side * my * dist];
  }
  const n = nIn ?? nOut!;
  return [cur[0] + side * n[0] * half, cur[1] + side * n[1] * half];
}

/** Sample a round cap: a semicircle of radius `half` around `center` from `from` to `to`. */
function roundCap(center: Pt, from: Pt, half: number, outward: Pt): Pt[] {
  const aStart = Math.atan2(from[1] - center[1], from[0] - center[0]);
  // The two cap endpoints are diametrically opposite; sweep π toward `outward`.
  const probe: Pt = [Math.cos(aStart + Math.PI / 2), Math.sin(aStart + Math.PI / 2)];
  const sign = probe[0] * outward[0] + probe[1] * outward[1] >= 0 ? 1 : -1;
  const out: Pt[] = [];
  for (let s = 1; s < CAP_SEGMENTS; s++) {
    const a = aStart + sign * Math.PI * (s / CAP_SEGMENTS);
    out.push([center[0] + Math.cos(a) * half, center[1] + Math.sin(a) * half]);
  }
  return out;
}

/** Outline of an open subpath: a closed "racetrack" loop with round end caps. */
function outlineOpen(points: Pt[], half: number): RawContour {
  const n = points.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? points[i - 1]! : null;
    const next = i < n - 1 ? points[i + 1]! : null;
    left.push(offsetVertex(prev, points[i]!, next, +1, half));
    right.push(offsetVertex(prev, points[i]!, next, -1, half));
  }
  const endDir = unit(points[n - 1]![0] - points[n - 2]![0], points[n - 1]![1] - points[n - 2]![1]);
  const startDir = unit(points[0]![0] - points[1]![0], points[0]![1] - points[1]![1]);

  const loop: Pt[] = [];
  loop.push(...left);
  loop.push(...roundCap(points[n - 1]!, left[n - 1]!, half, endDir));
  for (let i = n - 1; i >= 0; i--) loop.push(right[i]!);
  loop.push(...roundCap(points[0]!, right[0]!, half, startDir));
  return flatten(orient(loop, true), true);
}

/**
 * Outline of a closed subpath: an outer ring (solid) + an inner ring (hole).
 * The *outward* offset side depends on the path's winding — for a CCW path the
 * interior is on the left, so the outward normal is on the right (and vice
 * versa). `orient()` then normalizes the final rings (outer CCW, inner CW).
 */
function outlineClosed(points: Pt[], half: number): RawContour[] {
  const n = points.length;
  const outerSide = signedArea(points) > 0 ? -1 : +1;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const next = points[(i + 1) % n]!;
    outer.push(offsetVertex(prev, points[i]!, next, outerSide, half));
    inner.push(offsetVertex(prev, points[i]!, next, -outerSide, half));
  }
  return [flatten(orient(outer, true), true), flatten(orient(inner, false), true)];
}

/**
 * Convert centerline contours into constant-width outline contours.
 * `width` is the full pen width (world units); contours shorter than a single
 * point are skipped, and degenerate single-point contours render as a dot.
 */
export function strokeContoursToOutline(
  contours: readonly RawContour[],
  width: number,
): RawContour[] {
  const half = Math.max(width, EPS) / 2;
  const out: RawContour[] = [];
  for (const contour of contours) {
    const pts = dedupe(readPoints(contour), contour.closed);
    if (pts.length === 0) continue;
    if (pts.length === 1) {
      // A lone point becomes a small filled disc (round dot).
      const c = pts[0]!;
      const disc: Pt[] = [];
      const segs = CAP_SEGMENTS * 2;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        disc.push([c[0] + Math.cos(a) * half, c[1] + Math.sin(a) * half]);
      }
      out.push(flatten(orient(disc, true), true));
      continue;
    }
    if (contour.closed) out.push(...outlineClosed(pts, half));
    else out.push(outlineOpen(pts, half));
  }
  return out;
}
