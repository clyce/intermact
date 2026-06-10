/**
 * Fractal and recursive-tree generators (design.md §6.4). `fractal` covers a
 * few classic constructions (Koch curve, Sierpinski triangle, and a generic
 * iterated function system); `recursiveTree` builds a branching tree.
 */
import { type AbsXY, V2, xy } from "../math/vec";
import { type RawContour, approxCircle, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { shapeObject, strokeObject } from "../constructs/shared";
import { IntermactError } from "../errors";

/** A 2D affine map `p -> A·p + t` for iterated function systems. */
export interface AffineMap2D {
  /** Row-major 2x2 linear part `[a, b, c, d]`. */
  readonly matrix: readonly [number, number, number, number];
  /** Translation `[tx, ty]`. */
  readonly translate: readonly [number, number];
}

/** Spec for {@link fractal}. */
export type FractalSpec =
  | {
      readonly kind: "koch";
      readonly iterations: number;
      readonly size?: number;
      readonly start?: AbsXY;
      readonly style?: ObjectStyle;
    }
  | {
      readonly kind: "sierpinski";
      readonly iterations: number;
      readonly size?: number;
      readonly start?: AbsXY;
      readonly style?: ObjectStyle;
    }
  | {
      readonly kind: "ifs";
      readonly maps: readonly AffineMap2D[];
      readonly points: number;
      readonly rng: Rng;
      readonly dotRadius?: number;
      readonly style?: ObjectStyle;
    };

function kochSegment(a: AbsXY, b: AbsXY, depth: number, out: AbsXY[]): void {
  if (depth === 0) {
    out.push(a);
    return;
  }
  const d = V2.sub(b, a);
  const p1 = V2.add(a, V2.scale(d, 1 / 3));
  const p2 = V2.add(a, V2.scale(d, 2 / 3));
  // Apex of the bump: rotate (p2 - p1) by -60 degrees around p1.
  const seg = V2.sub(p2, p1);
  const ang = -Math.PI / 3;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const apex = xy(p1[0] + cos * seg[0] - sin * seg[1], p1[1] + sin * seg[0] + cos * seg[1]);
  kochSegment(a, p1, depth - 1, out);
  kochSegment(p1, apex, depth - 1, out);
  kochSegment(apex, p2, depth - 1, out);
  kochSegment(p2, b, depth - 1, out);
}

function sierpinski(a: AbsXY, b: AbsXY, c: AbsXY, depth: number, out: RawContour[]): void {
  if (depth === 0) {
    out.push(rawContourFromPoints([a, b, c], true));
    return;
  }
  const ab = V2.lerp(a, b, 0.5);
  const bc = V2.lerp(b, c, 0.5);
  const ca = V2.lerp(c, a, 0.5);
  sierpinski(a, ab, ca, depth - 1, out);
  sierpinski(ab, b, bc, depth - 1, out);
  sierpinski(ca, bc, c, depth - 1, out);
}

/** Generate a fractal object (Koch / Sierpinski / IFS) (design.md §6.4). */
export function fractal(spec: FractalSpec): IMObject2D {
  if (spec.kind === "koch") {
    const size = spec.size ?? 4;
    const s = spec.start ?? xy(-size / 2, 0);
    const e = xy(s[0] + size, s[1]);
    const pts: AbsXY[] = [];
    kochSegment(s, e, spec.iterations, pts);
    pts.push(e);
    return strokeObject("fractal-koch", [rawContourFromPoints(pts, false)], {
      stroke: "#38bdf8",
      lineWidth: 0.02,
      ...spec.style,
    });
  }
  if (spec.kind === "sierpinski") {
    const size = spec.size ?? 4;
    const h = (Math.sqrt(3) / 2) * size;
    const a = xy(-size / 2, -h / 3);
    const b = xy(size / 2, -h / 3);
    const c = xy(0, (2 * h) / 3);
    const tris: RawContour[] = [];
    sierpinski(a, b, c, spec.iterations, tris);
    return shapeObject("fractal-sierpinski", tris, {
      stroke: "#a78bfa",
      fill: "rgba(167,139,250,0.4)",
      lineWidth: 0.008,
      ...spec.style,
    });
  }
  // Chaos-game IFS: pick maps at random and plot the orbit as small dots.
  if (spec.maps.length === 0) {
    throw new IntermactError(
      "invalid-argument",
      "fractal: IFS requires at least one affine map in `maps`.",
    );
  }
  const radius = spec.dotRadius ?? 0.02;
  const contours: RawContour[] = [];
  let p: AbsXY = xy(0, 0);
  const warmup = 20;
  for (let i = 0; i < spec.points + warmup; i++) {
    const m = spec.maps[spec.rng.int(0, spec.maps.length - 1)]!;
    const [a, b, c, d] = m.matrix;
    p = xy(a * p[0] + b * p[1] + m.translate[0], c * p[0] + d * p[1] + m.translate[1]);
    if (i < warmup) continue;
    contours.push(rawContourFromPoints(approxCircle(p, radius, 6), true));
  }
  return shapeObject("fractal-ifs", contours, {
    fill: "#22c55e",
    stroke: "#22c55e",
    lineWidth: 0.004,
    ...spec.style,
  });
}

/** Spec for {@link recursiveTree}. */
export interface RecursiveTreeSpec {
  readonly depth: number;
  /** Trunk length (default 2). */
  readonly length?: number;
  /** Child/parent length ratio (default 0.7). */
  readonly lengthRatio?: number;
  /** Branch angle in degrees (default 28). */
  readonly branchAngle?: number;
  /** Number of children per node (default 2). */
  readonly branches?: number;
  readonly start?: AbsXY;
  /** Initial heading in degrees (default 90 = up). */
  readonly startAngle?: number;
  readonly style?: ObjectStyle;
}

/** A self-similar branching tree (design.md §6.4). */
export function recursiveTree(spec: RecursiveTreeSpec): IMObject2D {
  const lengthRatio = spec.lengthRatio ?? 0.7;
  const branchAngle = ((spec.branchAngle ?? 28) * Math.PI) / 180;
  const branches = Math.max(1, spec.branches ?? 2);
  const start = spec.start ?? xy(0, -2);
  const contours: RawContour[] = [];

  const grow = (x: number, y: number, heading: number, length: number, depth: number): void => {
    const nx = x + length * Math.cos(heading);
    const ny = y + length * Math.sin(heading);
    contours.push(rawContourFromPoints([xy(x, y), xy(nx, ny)], false));
    if (depth <= 0) return;
    for (let i = 0; i < branches; i++) {
      const spread = branches === 1 ? 0 : (i / (branches - 1) - 0.5) * 2;
      grow(nx, ny, heading + spread * branchAngle, length * lengthRatio, depth - 1);
    }
  };
  grow(start[0], start[1], ((spec.startAngle ?? 90) * Math.PI) / 180, spec.length ?? 2, spec.depth);
  return strokeObject("recursive-tree", contours, {
    stroke: "#a3e635",
    lineWidth: 0.02,
    ...spec.style,
  });
}
