import { type AbsXY, type RelUV, uv, xy } from "../math/vec";
import { type Scene2DProps } from "../scene/types";

/**
 * Scene coordinate transforms (design.md §7.2). Maps between absolute world
 * coordinates, normalized domain UV, and polar coordinates for a 2D scene.
 */
export class CoordinateTransform2D {
  constructor(private readonly props: Scene2DProps) {}

  /** Map absolute world coordinates to normalized domain UV in [0,1]². */
  absToRel(value: AbsXY): RelUV {
    const { x: dx, y: dy } = this.props.domain;
    const u = (value[0] - dx[0]) / (dx[1] - dx[0]);
    const v = (value[1] - dy[0]) / (dy[1] - dy[0]);
    return uv(u, v);
  }

  /** Map normalized domain UV back to absolute world coordinates. */
  relToAbs(value: RelUV): AbsXY {
    const { x: dx, y: dy } = this.props.domain;
    return xy(dx[0] + value[0] * (dx[1] - dx[0]), dy[0] + value[1] * (dy[1] - dy[0]));
  }

  /** Polar radius and angle (radians) of an absolute point. */
  toPolar(value: AbsXY): { readonly r: number; readonly theta: number } {
    return { r: Math.hypot(value[0], value[1]), theta: Math.atan2(value[1], value[0]) };
  }

  /** Absolute point from polar coordinates. */
  fromPolar(r: number, theta: number): AbsXY {
    return xy(r * Math.cos(theta), r * Math.sin(theta));
  }
}
