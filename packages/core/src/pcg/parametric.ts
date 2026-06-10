/**
 * Parametric and lattice generators (design.md §6.3). All are pure
 * `(spec) => IMObject2D` functions producing immutable definitions.
 */
import { type AbsXY, type Vec2, xy } from "../math/vec";
import { type RawContour, approxCircle, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { shapeObject, strokeObject } from "../constructs/shared";

/** Spec for {@link parametricCurve2D}. */
export interface ParametricCurve2DSpec {
  /** Parameter interval `[t0, t1]`. */
  readonly domain: readonly [number, number];
  /** Curve function mapping a parameter to a world point. */
  readonly fn: (t: number) => Vec2;
  /** Sample count along the curve (default 200). */
  readonly samples?: number;
  /** Treat the curve as closed (default false). */
  readonly closed?: boolean;
  readonly style?: ObjectStyle;
}

/** A parametric 2D curve sampled into a polyline (design.md §6.3). */
export function parametricCurve2D(spec: ParametricCurve2DSpec): IMObject2D {
  const samples = Math.max(2, spec.samples ?? 200);
  const [t0, t1] = spec.domain;
  const closed = spec.closed ?? false;
  const points: AbsXY[] = [];
  const count = closed ? samples : samples;
  for (let i = 0; i < count; i++) {
    const t = closed ? t0 + ((t1 - t0) * i) / count : t0 + ((t1 - t0) * i) / (count - 1);
    const [x, y] = spec.fn(t);
    points.push(xy(x, y));
  }
  if (closed) {
    return shapeObject("parametric-curve", [rawContourFromPoints(points, true)], {
      stroke: "#22c55e",
      lineWidth: 0.02,
      ...spec.style,
    });
  }
  return strokeObject("parametric-curve", [rawContourFromPoints(points, false)], {
    stroke: "#22c55e",
    lineWidth: 0.02,
    ...spec.style,
  });
}

function normalizeSpacing(spacing: number | Vec2 | undefined): Vec2 {
  if (spacing === undefined) return [1, 1];
  return typeof spacing === "number" ? [spacing, spacing] : spacing;
}

/** Spec for {@link lattice}. */
export interface LatticeSpec {
  readonly rows: number;
  readonly cols: number;
  /** Cell spacing in world units (default 1). */
  readonly spacing?: number | Vec2;
  /** Bottom-left origin (default `[0,0]`). */
  readonly origin?: AbsXY;
  /** Also place a small dot at each lattice node (default false). */
  readonly dots?: boolean;
  /** Dot radius when `dots` is set (default 0.04). */
  readonly dotRadius?: number;
  readonly style?: ObjectStyle;
}

/** A regular rectangular lattice of grid lines (and optional node dots). */
export function lattice(spec: LatticeSpec): IMObject2D {
  const [sx, sy] = normalizeSpacing(spec.spacing);
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const w = spec.cols * sx;
  const h = spec.rows * sy;
  const contours: RawContour[] = [];
  for (let r = 0; r <= spec.rows; r++) {
    const y = oy + r * sy;
    contours.push(rawContourFromPoints([xy(ox, y), xy(ox + w, y)], false));
  }
  for (let c = 0; c <= spec.cols; c++) {
    const x = ox + c * sx;
    contours.push(rawContourFromPoints([xy(x, oy), xy(x, oy + h)], false));
  }
  if (spec.dots) {
    const radius = spec.dotRadius ?? 0.04;
    for (let r = 0; r <= spec.rows; r++) {
      for (let c = 0; c <= spec.cols; c++) {
        const cx = ox + c * sx;
        const cy = oy + r * sy;
        contours.push(rawContourFromPoints(approxCircle(xy(cx, cy), radius, 12), true));
      }
    }
  }
  return strokeObject("lattice", contours, {
    stroke: "#334155",
    lineWidth: 0.01,
    ...spec.style,
  });
}

/** Spec for {@link tiling}. */
export interface TilingSpec {
  /** Tile pattern (default "square"). */
  readonly pattern?: "square" | "hex" | "triangle";
  readonly rows: number;
  readonly cols: number;
  /** Tile size in world units (default 0.5). */
  readonly size?: number;
  /** Bottom-left origin (default `[0,0]`). */
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

function hexCell(cx: number, cy: number, size: number): RawContour {
  const pts: AbsXY[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(xy(cx + size * Math.cos(a), cy + size * Math.sin(a)));
  }
  return rawContourFromPoints(pts, true);
}

/** A periodic tiling outline (square / hex / triangle) (design.md §6.3). */
export function tiling(spec: TilingSpec): IMObject2D {
  const pattern = spec.pattern ?? "square";
  const size = spec.size ?? 0.5;
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const contours: RawContour[] = [];

  if (pattern === "square") {
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        const x = ox + c * size;
        const y = oy + r * size;
        contours.push(
          rawContourFromPoints(
            [xy(x, y), xy(x + size, y), xy(x + size, y + size), xy(x, y + size)],
            true,
          ),
        );
      }
    }
  } else if (pattern === "hex") {
    const w = Math.sqrt(3) * size;
    const vstep = 1.5 * size;
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        const cx = ox + c * w + (r % 2 === 1 ? w / 2 : 0) + w / 2;
        const cy = oy + r * vstep + size;
        contours.push(hexCell(cx, cy, size));
      }
    }
  } else {
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        const x = ox + (c * size) / 2;
        const y = oy + r * size;
        const up = (r + c) % 2 === 0;
        const tri = up
          ? [xy(x, y), xy(x + size, y), xy(x + size / 2, y + size)]
          : [xy(x + size / 2, y), xy(x + size, y + size), xy(x, y + size)];
        contours.push(rawContourFromPoints(tri, true));
      }
    }
  }
  return shapeObject("tiling", contours, {
    stroke: "#475569",
    fill: "rgba(71,85,105,0.15)",
    lineWidth: 0.01,
    ...spec.style,
  });
}
