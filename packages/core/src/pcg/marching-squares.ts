/**
 * Marching squares (design.md §5.2, §6.2): extract iso-line segments of a scalar
 * field at a given level, then stitch them into polylines for clean stroking.
 * Deterministic: same field + level + resolution => identical output.
 */
import { type AbsXY, xy } from "../math/vec";
import { type ScalarField2D } from "./field";

/** A single iso-line segment as a pair of endpoints. */
export type IsoSegment = readonly [AbsXY, AbsXY];

/** Options controlling marching-squares resolution. */
export interface MarchingSquaresOptions {
  /** Grid cells along x (default 48). */
  readonly nx?: number;
  /** Grid cells along y (default 48). */
  readonly ny?: number;
}

function lerpCrossing(
  ax: number,
  ay: number,
  av: number,
  bx: number,
  by: number,
  bv: number,
  level: number,
): AbsXY {
  const denom = bv - av;
  const t = denom === 0 ? 0.5 : (level - av) / denom;
  return xy(ax + (bx - ax) * t, ay + (by - ay) * t);
}

/**
 * Extract iso-line segments of `field` at `level` over the field domain. Uses
 * standard marching-squares case handling with linear edge interpolation; the
 * ambiguous saddle cases (5/10) are resolved by the cell-center average.
 */
export function marchingSquares(
  field: ScalarField2D,
  level: number,
  options: MarchingSquaresOptions = {},
): IsoSegment[] {
  const nx = Math.max(1, options.nx ?? 48);
  const ny = Math.max(1, options.ny ?? 48);
  const { min, max } = field.domain;
  const dx = (max[0] - min[0]) / nx;
  const dy = (max[1] - min[1]) / ny;

  // Sample the scalar grid once at all corner nodes.
  const values = new Float64Array((nx + 1) * (ny + 1));
  const at = (ix: number, iy: number): number => values[iy * (nx + 1) + ix]!;
  for (let iy = 0; iy <= ny; iy++) {
    for (let ix = 0; ix <= nx; ix++) {
      values[iy * (nx + 1) + ix] = field.sample(xy(min[0] + ix * dx, min[1] + iy * dy));
    }
  }

  const segments: IsoSegment[] = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x0 = min[0] + ix * dx;
      const y0 = min[1] + iy * dy;
      const x1 = x0 + dx;
      const y1 = y0 + dy;
      const tl = at(ix, iy + 1);
      const tr = at(ix + 1, iy + 1);
      const br = at(ix + 1, iy);
      const bl = at(ix, iy);

      let caseIndex = 0;
      if (bl >= level) caseIndex |= 1;
      if (br >= level) caseIndex |= 2;
      if (tr >= level) caseIndex |= 4;
      if (tl >= level) caseIndex |= 8;
      if (caseIndex === 0 || caseIndex === 15) continue;

      // Edge crossing points (bottom, right, top, left).
      const bottom = (): AbsXY => lerpCrossing(x0, y0, bl, x1, y0, br, level);
      const right = (): AbsXY => lerpCrossing(x1, y0, br, x1, y1, tr, level);
      const top = (): AbsXY => lerpCrossing(x0, y1, tl, x1, y1, tr, level);
      const left = (): AbsXY => lerpCrossing(x0, y0, bl, x0, y1, tl, level);

      switch (caseIndex) {
        case 1:
        case 14:
          segments.push([left(), bottom()]);
          break;
        case 2:
        case 13:
          segments.push([bottom(), right()]);
          break;
        case 3:
        case 12:
          segments.push([left(), right()]);
          break;
        case 4:
        case 11:
          segments.push([top(), right()]);
          break;
        case 6:
        case 9:
          segments.push([bottom(), top()]);
          break;
        case 7:
        case 8:
          segments.push([left(), top()]);
          break;
        case 5:
        case 10: {
          const center = (bl + br + tr + tl) / 4;
          const aboveCenter = center >= level;
          if ((caseIndex === 5) === aboveCenter) {
            segments.push([left(), top()]);
            segments.push([bottom(), right()]);
          } else {
            segments.push([left(), bottom()]);
            segments.push([top(), right()]);
          }
          break;
        }
        default:
          break;
      }
    }
  }
  return segments;
}

function key(p: AbsXY, eps: number): string {
  return `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)}`;
}

/**
 * Stitch loose iso-segments into connected polylines by endpoint matching.
 * Greedy and deterministic; nearly-coincident endpoints are merged within `eps`.
 *
 * Each seed segment is grown in **both** directions (appending at the tail and
 * prepending at the head), so a polyline whose seed sits in the middle of a long
 * iso-curve is recovered as a single line instead of being split. When the two
 * ends meet within `eps` the loop is detected as closed and the duplicate
 * endpoint is retained so callers can stroke it as a closed ring. Every input
 * segment is consumed by exactly one output polyline.
 */
export function stitchSegments(segments: readonly IsoSegment[], eps = 1e-4): AbsXY[][] {
  const remaining = segments.map((s) => [s[0], s[1]] as [AbsXY, AbsXY]);
  const used = new Array<boolean>(remaining.length).fill(false);
  const byKey = new Map<string, number[]>();
  remaining.forEach((seg, i) => {
    for (const end of seg) {
      const k = key(end, eps);
      const list = byKey.get(k);
      if (list) list.push(i);
      else byKey.set(k, [i]);
    }
  });

  /** Find an unused segment touching `endpoint`; return its far endpoint. */
  const findNext = (endpoint: AbsXY): { ci: number; far: AbsXY } | null => {
    const ek = key(endpoint, eps);
    for (const ci of byKey.get(ek) ?? []) {
      if (used[ci]) continue;
      const cand = remaining[ci]!;
      if (key(cand[0], eps) === ek) return { ci, far: cand[1] };
      if (key(cand[1], eps) === ek) return { ci, far: cand[0] };
    }
    return null;
  };

  const polylines: AbsXY[][] = [];
  let consumed = 0;
  for (let start = 0; start < remaining.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    consumed++;
    const seg = remaining[start]!;
    const line: AbsXY[] = [seg[0], seg[1]];

    // Extend forward from the tail, stopping if the loop closes onto the head.
    for (;;) {
      const next = findNext(line[line.length - 1]!);
      if (!next) break;
      used[next.ci] = true;
      consumed++;
      line.push(next.far);
      if (key(next.far, eps) === key(line[0]!, eps)) break;
    }
    // Extend backward from the head unless the polyline is already a closed loop.
    if (key(line[0]!, eps) !== key(line[line.length - 1]!, eps)) {
      for (;;) {
        const prev = findNext(line[0]!);
        if (!prev) break;
        used[prev.ci] = true;
        consumed++;
        line.unshift(prev.far);
        if (key(prev.far, eps) === key(line[line.length - 1]!, eps)) break;
      }
    }
    polylines.push(line);
  }
  // Invariant: stitching partitions the segments — every one is used exactly once.
  if (consumed !== remaining.length) {
    throw new Error(
      `stitchSegments: consumed ${consumed} of ${remaining.length} segments (internal invariant violated).`,
    );
  }
  return polylines;
}
