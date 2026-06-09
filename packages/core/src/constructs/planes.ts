/**
 * Plane constructs (design.md §7.4): NumberPlane (cartesian grid), PolarPlane
 * (concentric circles + radial spokes), and ComplexPlane (a NumberPlane whose
 * axes are Re/Im). All draw in world coordinates equal to their data domain and
 * render as a single (faint) stroke object.
 */
import { type AbsXY, xy } from "../math/vec";
import { linearScale } from "../math/scale";
import { sampleArc } from "../geometry/curves";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval } from "../scene/types";
import { strokeObject } from "./shared";

/** Authoring spec for {@link numberPlane} / {@link complexPlane}. */
export interface NumberPlaneSpec {
  readonly x: Interval;
  readonly y: Interval;
  /** Approximate number of grid lines per axis (default 8). */
  readonly tickCount?: number;
  /** Grid line style. */
  readonly style?: ObjectStyle;
}

/** Cartesian grid plane: faint vertical + horizontal lines at nice tick steps. */
export function numberPlane(spec: NumberPlaneSpec): IMObject2D {
  const tickCount = spec.tickCount ?? 8;
  const xScale = linearScale(spec.x, spec.x);
  const yScale = linearScale(spec.y, spec.y);
  const contours: RawContour[] = [];
  for (const tx of xScale.ticks(tickCount)) {
    contours.push(rawContourFromPoints([xy(tx, spec.y[0]), xy(tx, spec.y[1])], false));
  }
  for (const ty of yScale.ticks(tickCount)) {
    contours.push(rawContourFromPoints([xy(spec.x[0], ty), xy(spec.x[1], ty)], false));
  }
  return strokeObject("number-plane", contours, {
    stroke: "#334155",
    lineWidth: 0.012,
    ...spec.style,
  });
}

/**
 * Complex plane: a NumberPlane over the complex domain. `Re`/`Im` axis labels
 * are added once the M10 text pipeline lands; the geometry matches a plane.
 */
export function complexPlane(spec: NumberPlaneSpec): IMObject2D {
  return { ...numberPlane(spec), type: "complex-plane" };
}

/** Authoring spec for {@link polarPlane}. */
export interface PolarPlaneSpec {
  /** Largest radius drawn (default 4). */
  readonly maxRadius?: number;
  /** Radial ring step (default 1). */
  readonly radiusStep?: number;
  /** Number of angular spokes (default 12). */
  readonly spokes?: number;
  /** Center in world space (default `[0,0]`). */
  readonly center?: AbsXY;
  readonly style?: ObjectStyle;
}

/** Polar grid: concentric rings + evenly spaced radial spokes. */
export function polarPlane(spec: PolarPlaneSpec = {}): IMObject2D {
  const maxRadius = spec.maxRadius ?? 4;
  const radiusStep = spec.radiusStep ?? 1;
  const spokes = spec.spokes ?? 12;
  const [cx, cy] = spec.center ?? xy(0, 0);
  const contours: RawContour[] = [];
  for (let r = radiusStep; r <= maxRadius + 1e-9; r += radiusStep) {
    const ring = sampleArc(cx, cy, r, 0, Math.PI * 2, Math.max(32, Math.round(r * 24)));
    contours.push(rawContourFromPoints(ring, true));
  }
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    contours.push(
      rawContourFromPoints(
        [xy(cx, cy), xy(cx + maxRadius * Math.cos(a), cy + maxRadius * Math.sin(a))],
        false,
      ),
    );
  }
  return strokeObject("polar-plane", contours, {
    stroke: "#334155",
    lineWidth: 0.012,
    ...spec.style,
  });
}
