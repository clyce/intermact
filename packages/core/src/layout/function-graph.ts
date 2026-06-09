import { type AbsXY, xy } from "../math/vec";
import { createGeometryProvider2D, strokeTraitFrom } from "../geometry/provider";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { polyline } from "../geometry/primitives";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval } from "../scene/types";
import { type AxesHandle } from "./axes";

/** Options for {@link functionGraph}. */
export interface FunctionGraphOptions {
  readonly domain?: Interval;
  readonly samples?: number;
  readonly style?: ObjectStyle;
}

/**
 * Sample a function `y = fn(x)` over a domain and return a polyline object
 * positioned in scene world space via an {@link AxesHandle} (design.md §7.4).
 * Non-finite samples (`NaN` / `Infinity`) split the curve into separate segments.
 */
export function functionGraph(
  handle: AxesHandle,
  fn: (x: number) => number,
  opts: FunctionGraphOptions = {},
): IMObject2D {
  const domain = opts.domain ?? handle.props.x;
  const samples = opts.samples ?? 128;
  const style = opts.style ?? { stroke: "#22c55e", lineWidth: 0.03 };
  const contours: RawContour[] = [];
  let segment: AbsXY[] = [];

  const flushSegment = (): void => {
    if (segment.length >= 2) {
      contours.push(rawContourFromPoints(segment, false));
    }
    segment = [];
  };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = domain[0] + t * (domain[1] - domain[0]);
    const y = fn(x);
    if (!Number.isFinite(y)) {
      flushSegment();
      continue;
    }
    segment.push(handle.c2p([x, y]));
  }
  flushSegment();

  if (contours.length === 0) {
    return polyline({ points: [], style });
  }
  if (contours.length === 1) {
    const points: AbsXY[] = [];
    const pts = contours[0]!.points;
    for (let i = 0; i < pts.length; i += 2) {
      points.push(xy(pts[i]!, pts[i + 1]!));
    }
    return polyline({ points, style });
  }

  const provider = createGeometryProvider2D({
    rawContours: contours,
    fillable: false,
  });
  return {
    type: "function-graph",
    dimension: "2d",
    traits: [strokeTraitFrom(provider)],
    geometry: provider,
    style,
  };
}
