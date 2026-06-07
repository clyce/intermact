import { type AbsXY } from "../math/vec";
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
 */
export function functionGraph(
  handle: AxesHandle,
  fn: (x: number) => number,
  opts: FunctionGraphOptions = {},
): IMObject2D {
  const domain = opts.domain ?? handle.props.x;
  const samples = opts.samples ?? 128;
  const points: AbsXY[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = domain[0] + t * (domain[1] - domain[0]);
    const y = fn(x);
    points.push(handle.c2p([x, y]));
  }
  return polyline({ points, style: opts.style ?? { stroke: "#22c55e", lineWidth: 0.03 } });
}
