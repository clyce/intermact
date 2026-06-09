import { BufferAttribute, BufferGeometry } from "three";
import {
  cumulativeLengths,
  glyphLocalReveal,
  pointAtDistance,
  type GlyphRevealSpan,
  type SampledContour2D,
  type SampledPath2D,
} from "@intermact/core";

/** Per-glyph sequential stroke reveal (text `write()`). */
export interface StrokeRevealOptions {
  readonly contourGlyphIndex?: readonly number[];
  readonly glyphWriteSpans?: readonly GlyphRevealSpan[];
}

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
  revealOpts?: StrokeRevealOptions,
): BufferGeometry {
  const positions: number[] = [];
  const halfWidth = Math.max(width, 1e-5) / 2;

  path.contours.forEach((contour, ci) => {
    let localStart = revealStart;
    let localEnd = revealEnd;
    if (revealOpts?.glyphWriteSpans && revealOpts.contourGlyphIndex) {
      const gi = revealOpts.contourGlyphIndex[ci] ?? 0;
      const span = revealOpts.glyphWriteSpans[gi];
      if (span) {
        localStart = glyphLocalReveal(revealStart, span);
        localEnd = glyphLocalReveal(revealEnd, span);
      } else {
        localStart = 0;
        localEnd = 0;
      }
    }
    const pts = trimContour(contour, localStart, localEnd);
    const fullReveal = localStart <= 0 && localEnd >= 1;
    appendRibbon(positions, pts, contour.closed && fullReveal, halfWidth);
  });

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

type Vec2 = [number, number];

const MITER_LIMIT = 1.25;
const BEVEL_COS_THRESHOLD = 0.45;
const CAP_SEGMENTS = 8;

function unit(dx: number, dy: number): Vec2 {
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

/**
 * Offset point at `cur` toward `side` (+1 left, −1 right) by `half`, using a
 * miter join of the adjacent segment normals. Unlike a plain averaged-normal
 * offset, the miter length keeps the ribbon at full width through corners
 * instead of pinching. `prev`/`next` may be null at the ends of an open path.
 */
function offsetVertex(
  prev: Vec2 | null,
  cur: Vec2,
  next: Vec2 | null,
  side: number,
  half: number,
): Vec2 {
  const dIn = prev ? unit(cur[0] - prev[0], cur[1] - prev[1]) : null;
  const dOut = next ? unit(next[0] - cur[0], next[1] - cur[1]) : null;
  const nIn: Vec2 | null = dIn ? [-dIn[1], dIn[0]] : null;
  const nOut: Vec2 | null = dOut ? [-dOut[1], dOut[0]] : null;
  if (nIn && nOut) {
    let mx = nIn[0] + nOut[0];
    let my = nIn[1] + nOut[1];
    const mlen = Math.hypot(mx, my);
    if (mlen < 1e-9) return [cur[0] + side * nIn[0] * half, cur[1] + side * nIn[1] * half];
    mx /= mlen;
    my /= mlen;
    const cosHalf = mx * nIn[0] + my * nIn[1];
    const dist =
      cosHalf < BEVEL_COS_THRESHOLD
        ? half
        : Math.min(half / Math.max(cosHalf, 1e-6), half * MITER_LIMIT);
    return [cur[0] + side * mx * dist, cur[1] + side * my * dist];
  }
  const n = nIn ?? nOut!;
  return [cur[0] + side * n[0] * half, cur[1] + side * n[1] * half];
}

/** Triangle-fan a round cap (semicircle) from `center`, starting at `from`, toward `outward`. */
function appendCap(out: number[], center: Vec2, from: Vec2, half: number, outward: Vec2): void {
  const aStart = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const probe: Vec2 = [Math.cos(aStart + Math.PI / 2), Math.sin(aStart + Math.PI / 2)];
  const sign = probe[0] * outward[0] + probe[1] * outward[1] >= 0 ? 1 : -1;
  let prevX = from[0];
  let prevY = from[1];
  for (let s = 1; s <= CAP_SEGMENTS; s++) {
    const a = aStart + sign * Math.PI * (s / CAP_SEGMENTS);
    const x = center[0] + Math.cos(a) * half;
    const y = center[1] + Math.sin(a) * half;
    out.push(center[0], center[1], 0, prevX, prevY, 0, x, y, 0);
    prevX = x;
    prevY = y;
  }
}

/**
 * Expand a polyline (flat xy) into a ribbon of triangles (z=0) with miter joins
 * and round end caps, so the stroke keeps a constant width along its whole
 * length — including at sharp corners and at the start/end of open paths.
 */
function appendRibbon(out: number[], flat: number[], closed: boolean, halfWidth: number): void {
  const n = flat.length >> 1;
  if (n < 2) return;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) pts.push([flat[i * 2]!, flat[i * 2 + 1]!]);

  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n]! : i > 0 ? pts[i - 1]! : null;
    const next = closed ? pts[(i + 1) % n]! : i < n - 1 ? pts[i + 1]! : null;
    left.push(offsetVertex(prev, pts[i]!, next, +1, halfWidth));
    right.push(offsetVertex(prev, pts[i]!, next, -1, halfWidth));
  }

  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const b = (i + 1) % n;
    const la = left[i]!;
    const ra = right[i]!;
    const lb = left[b]!;
    const rb = right[b]!;
    out.push(la[0], la[1], 0, ra[0], ra[1], 0, rb[0], rb[1], 0);
    out.push(la[0], la[1], 0, rb[0], rb[1], 0, lb[0], lb[1], 0);
  }

  if (!closed) {
    const endDir = unit(pts[n - 1]![0] - pts[n - 2]![0], pts[n - 1]![1] - pts[n - 2]![1]);
    const startDir = unit(pts[0]![0] - pts[1]![0], pts[0]![1] - pts[1]![1]);
    appendCap(out, pts[n - 1]!, left[n - 1]!, halfWidth, endDir);
    appendCap(out, pts[0]!, right[0]!, halfWidth, startDir);
  }
}
