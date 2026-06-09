/**
 * Axis-bound graph constructs (design.md §7.4). Each accepts an {@link AxesHandle}
 * (`ax.handle`) and positions geometry in scene world space via `c2p`, so they
 * stay glued to their axes. `functionGraph` lives in `layout/function-graph.ts`;
 * the parametric/area/Riemann/tangent family is here.
 */
import { type AbsXY, type Vec2 } from "../math/vec";
import { rawContourFromPoints } from "../geometry/sampling";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval } from "../scene/types";
import { type AxesHandle } from "../layout/axes";
import { shapeObject, strokeObject } from "./shared";

/** Options for {@link parametricGraph}. */
export interface ParametricOptions {
  readonly domain?: Interval;
  readonly samples?: number;
  readonly style?: ObjectStyle;
}

/** Sample a parametric curve `t -> [x, y]` (data coords) glued to axes. */
export function parametricGraph(
  handle: AxesHandle,
  fn: (t: number) => Vec2,
  opts: ParametricOptions = {},
): IMObject2D {
  const domain = opts.domain ?? [0, 1];
  const samples = opts.samples ?? 128;
  const points: AbsXY[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = domain[0] + (i / samples) * (domain[1] - domain[0]);
    points.push(handle.c2p(fn(t)));
  }
  return strokeObject("parametric-graph", [rawContourFromPoints(points, false)], {
    stroke: "#a78bfa",
    lineWidth: 0.03,
    ...opts.style,
  });
}

/** Options for {@link areaUnderCurve}. */
export interface AreaOptions {
  readonly samples?: number;
  /** Baseline data y the area is measured from (default 0). */
  readonly baseline?: number;
  readonly style?: ObjectStyle;
}

/** Filled region between `fn(x)` and a baseline over a data x range. */
export function areaUnderCurve(
  handle: AxesHandle,
  fn: (x: number) => number,
  range: Interval,
  opts: AreaOptions = {},
): IMObject2D {
  const samples = opts.samples ?? 96;
  const baseline = opts.baseline ?? 0;
  const points: AbsXY[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = range[0] + (i / samples) * (range[1] - range[0]);
    points.push(handle.c2p([x, fn(x)]));
  }
  points.push(handle.c2p([range[1], baseline]));
  points.push(handle.c2p([range[0], baseline]));
  return shapeObject("area-under-curve", [rawContourFromPoints(points, true)], {
    fill: "rgba(56,189,248,0.28)",
    stroke: "#38bdf8",
    lineWidth: 0.02,
    ...opts.style,
  });
}

/** Sampling position within each Riemann subinterval. */
export type RiemannSample = "left" | "right" | "midpoint";

/** Options for {@link riemannRectangles}. */
export interface RiemannOptions {
  readonly domain?: Interval;
  /** Number of rectangles (default 8). */
  readonly n?: number;
  readonly sample?: RiemannSample;
  /** Baseline data y (default 0). */
  readonly baseline?: number;
  readonly style?: ObjectStyle;
}

/** Riemann-sum rectangles approximating the area under `fn(x)` (design.md §7.4). */
export function riemannRectangles(
  handle: AxesHandle,
  fn: (x: number) => number,
  opts: RiemannOptions = {},
): IMObject2D {
  const domain = opts.domain ?? handle.props.x;
  const n = Math.max(1, Math.floor(opts.n ?? 8));
  const sample = opts.sample ?? "midpoint";
  const baseline = opts.baseline ?? 0;
  const dx = (domain[1] - domain[0]) / n;
  const contours = [];
  for (let i = 0; i < n; i++) {
    const x0 = domain[0] + i * dx;
    const x1 = x0 + dx;
    const sx = sample === "left" ? x0 : sample === "right" ? x1 : x0 + dx / 2;
    const h = fn(sx);
    contours.push(
      rawContourFromPoints(
        [
          handle.c2p([x0, baseline]),
          handle.c2p([x1, baseline]),
          handle.c2p([x1, h]),
          handle.c2p([x0, h]),
        ],
        true,
      ),
    );
  }
  return shapeObject("riemann-rectangles", contours, {
    fill: "rgba(34,197,94,0.3)",
    stroke: "#22c55e",
    lineWidth: 0.02,
    ...opts.style,
  });
}

/** The Riemann-sum value for `fn` over `domain` (useful for readouts/tests). */
export function riemannSum(
  fn: (x: number) => number,
  domain: Interval,
  n: number,
  sample: RiemannSample = "midpoint",
): number {
  const dx = (domain[1] - domain[0]) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = domain[0] + i * dx;
    const sx = sample === "left" ? x0 : sample === "right" ? x0 + dx : x0 + dx / 2;
    sum += fn(sx) * dx;
  }
  return sum;
}

/** Options for {@link tangentLine}. */
export interface TangentOptions {
  /** Half-length of the drawn tangent in data x units (default 1). */
  readonly length?: number;
  /** Finite-difference step for the numeric derivative (default 1e-3). */
  readonly dx?: number;
  readonly style?: ObjectStyle;
}

/** Slope of `fn` at `at` via central finite difference. */
export function slopeAt(fn: (x: number) => number, at: number, dx = 1e-3): number {
  return (fn(at + dx) - fn(at - dx)) / (2 * dx);
}

/** Tangent line to `fn` at data x `at`, glued to axes (design.md §7.4). */
export function tangentLine(
  handle: AxesHandle,
  fn: (x: number) => number,
  at: number,
  opts: TangentOptions = {},
): IMObject2D {
  const length = opts.length ?? 1;
  const slope = slopeAt(fn, at, opts.dx ?? 1e-3);
  const y = fn(at);
  const x0 = at - length;
  const x1 = at + length;
  const p0 = handle.c2p([x0, y + slope * (x0 - at)]);
  const p1 = handle.c2p([x1, y + slope * (x1 - at)]);
  return strokeObject("tangent-line", [rawContourFromPoints([p0, p1], false)], {
    stroke: "#f97316",
    lineWidth: 0.03,
    ...opts.style,
  });
}
