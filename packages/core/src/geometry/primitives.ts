import { type AbsXY, V2, xy } from "../math/vec";
import { type ObjectMetadata, type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type ObjectTrait } from "../object/traits";
import { sampleArc, sampleBezier } from "./curves";
import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "./provider";
import { type RawContour, rawContourFromPoints } from "./sampling";

const DEFAULT_SAMPLES = 64;

interface BuildConfig {
  readonly type: string;
  readonly rawContours: readonly RawContour[];
  readonly fillable: boolean;
  readonly morphable: boolean;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

function buildObject2D(config: BuildConfig): IMObject2D {
  const fillRule = config.style?.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({
    rawContours: config.rawContours,
    fillable: config.fillable,
    fillRule,
  });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (config.fillable) traits.push(fillTraitFrom(provider, fillRule));
  if (config.morphable) traits.push(morphableTraitFrom(provider, DEFAULT_SAMPLES));

  const object: IMObject2D = {
    type: config.type,
    dimension: "2d",
    traits,
    geometry: provider,
    ...(config.style ? { style: config.style } : {}),
    ...(config.metadata ? { metadata: config.metadata } : {}),
  };
  return object;
}

function sampleClosedEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  samples: number,
): AbsXY[] {
  const out: AbsXY[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    out.push(xy(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return out;
}

/** A circle. */
export interface CircleProps {
  readonly radius: number;
  readonly center?: AbsXY;
  readonly samples?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build a filled, morphable circle approximated by `samples` evenly-spaced
 * points (default 64) around `center` (design.md §5.1). Higher `samples` give
 * smoother strokes and finer morph correspondence at the cost of vertices.
 */
export function circle(props: CircleProps): IMObject2D {
  const c = props.center ?? xy(0, 0);
  const pts = sampleClosedEllipse(
    c[0],
    c[1],
    props.radius,
    props.radius,
    props.samples ?? DEFAULT_SAMPLES,
  );
  return buildObject2D({
    type: "circle",
    rawContours: [rawContourFromPoints(pts, true)],
    fillable: true,
    morphable: true,
    ...pickStyleMeta(props),
  });
}

/** An axis-aligned ellipse. */
export interface EllipseProps {
  readonly rx: number;
  readonly ry: number;
  readonly center?: AbsXY;
  readonly samples?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build a filled, morphable axis-aligned ellipse with semi-axes `rx`/`ry`,
 * approximated by `samples` points (default 64) around `center` (design.md §5.1).
 */
export function ellipse(props: EllipseProps): IMObject2D {
  const c = props.center ?? xy(0, 0);
  const pts = sampleClosedEllipse(c[0], c[1], props.rx, props.ry, props.samples ?? DEFAULT_SAMPLES);
  return buildObject2D({
    type: "ellipse",
    rawContours: [rawContourFromPoints(pts, true)],
    fillable: true,
    morphable: true,
    ...pickStyleMeta(props),
  });
}

/** A rectangle, optionally with rounded corners. */
export interface RectangleProps {
  readonly width: number;
  readonly height: number;
  readonly cornerRadius?: number;
  readonly center?: AbsXY;
  readonly samples?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build a filled, morphable rectangle of `width`×`height` centered at `center`
 * (design.md §5.1). A positive `cornerRadius` rounds the corners with arc
 * segments (clamped to half the shorter side); `samples` controls corner
 * smoothness.
 */
export function rectangle(props: RectangleProps): IMObject2D {
  const c = props.center ?? xy(0, 0);
  const hw = props.width / 2;
  const hh = props.height / 2;
  const r = Math.min(props.cornerRadius ?? 0, hw, hh);
  let pts: AbsXY[];
  if (r <= 0) {
    pts = [
      xy(c[0] - hw, c[1] - hh),
      xy(c[0] + hw, c[1] - hh),
      xy(c[0] + hw, c[1] + hh),
      xy(c[0] - hw, c[1] + hh),
    ];
  } else {
    const steps = Math.max(2, Math.floor((props.samples ?? DEFAULT_SAMPLES) / 4));
    pts = [
      ...sampleArc(c[0] + hw - r, c[1] - hh + r, r, -Math.PI / 2, 0, steps),
      ...sampleArc(c[0] + hw - r, c[1] + hh - r, r, 0, Math.PI / 2, steps),
      ...sampleArc(c[0] - hw + r, c[1] + hh - r, r, Math.PI / 2, Math.PI, steps),
      ...sampleArc(c[0] - hw + r, c[1] - hh + r, r, Math.PI, (3 * Math.PI) / 2, steps),
    ];
  }
  return buildObject2D({
    type: "rectangle",
    rawContours: [rawContourFromPoints(pts, true)],
    fillable: true,
    morphable: true,
    ...pickStyleMeta(props),
  });
}

/** A circular arc; `closed` chords it into a fillable shape. */
export interface ArcProps {
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly center?: AbsXY;
  readonly closed?: boolean;
  readonly samples?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build a circular arc of `radius` from `startAngle` to `endAngle` (radians,
 * CCW) around `center` (design.md §5.1). When `closed` is true the endpoints are
 * chorded into a fillable, morphable wedge; otherwise it is an open stroke.
 */
export function arc(props: ArcProps): IMObject2D {
  const c = props.center ?? xy(0, 0);
  const pts = sampleArc(
    c[0],
    c[1],
    props.radius,
    props.startAngle,
    props.endAngle,
    props.samples ?? DEFAULT_SAMPLES,
  );
  const closed = props.closed ?? false;
  return buildObject2D({
    type: "arc",
    rawContours: [rawContourFromPoints(pts, closed)],
    fillable: closed,
    morphable: closed,
    ...pickStyleMeta(props),
  });
}

/** A polygon from explicit points, optionally with holes. */
export interface PolygonProps {
  readonly points: readonly AbsXY[];
  readonly holes?: readonly (readonly AbsXY[])[];
  readonly closed?: boolean;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build a polygon from an explicit ordered point list (design.md §5.1). Each
 * entry in `holes` becomes an inner contour subtracted via the even-odd/nonzero
 * fill rule. A `closed` polygon (default) is fillable and morphable; an open one
 * is a stroke-only path.
 */
export function polygon(props: PolygonProps): IMObject2D {
  const closed = props.closed ?? true;
  const contours: RawContour[] = [rawContourFromPoints(props.points, closed)];
  for (const hole of props.holes ?? []) contours.push(rawContourFromPoints(hole, true));
  return buildObject2D({
    type: "polygon",
    rawContours: contours,
    fillable: closed,
    morphable: closed,
    ...pickStyleMeta(props),
  });
}

/** A Bézier curve from control points (quadratic, cubic, or cubic chain). */
export interface BezierCurveProps {
  readonly points: readonly AbsXY[];
  readonly stepsPerSegment?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build an open Bézier path from control points (design.md §5.1): 3 points form
 * a quadratic, 4 a cubic, and additional points chain further cubic segments.
 * `stepsPerSegment` (default 32) sets the flattening resolution.
 */
export function bezierCurve(props: BezierCurveProps): IMObject2D {
  const pts = sampleBezier(props.points, props.stepsPerSegment ?? 32);
  return buildObject2D({
    type: "bezier-curve",
    rawContours: [rawContourFromPoints(pts, false)],
    fillable: false,
    morphable: false,
    ...pickStyleMeta(props),
  });
}

/** A straight line segment. */
export interface LineProps {
  readonly from: AbsXY;
  readonly to: AbsXY;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a straight stroke-only segment from `from` to `to` (design.md §5.1). */
export function line(props: LineProps): IMObject2D {
  return buildObject2D({
    type: "line",
    rawContours: [rawContourFromPoints([props.from, props.to], false)],
    fillable: false,
    morphable: false,
    ...pickStyleMeta(props),
  });
}

/** An open polyline through an ordered list of points. */
export interface PolylineProps {
  readonly points: readonly AbsXY[];
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build an open stroke-only polyline through an ordered point list (design.md §5.1). */
export function polyline(props: PolylineProps): IMObject2D {
  return buildObject2D({
    type: "polyline",
    rawContours: [rawContourFromPoints(props.points, false)],
    fillable: false,
    morphable: false,
    ...pickStyleMeta(props),
  });
}

/**
 * An arrow: an open shaft ending at the head base, plus a filled isosceles
 * triangular head. The head base is perpendicular to the shaft and bisected by it.
 */
export interface ArrowProps {
  readonly from: AbsXY;
  readonly to: AbsXY;
  readonly headLength?: number;
  readonly headWidth?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/**
 * Build an arrow from `from` to `to` (design.md §5.1): an open stroked shaft
 * plus a filled isosceles triangular head whose base is perpendicular to and
 * bisected by the shaft. `headLength` is clamped to 45% of the length;
 * `headWidth` defaults to 90% of the head length.
 */
export function arrow(props: ArrowProps): IMObject2D {
  const dir = V2.normalize(V2.sub(props.to, props.from));
  const len = V2.distance(props.from, props.to);
  const headLength = Math.min(props.headLength ?? 0.25, len * 0.45);
  const headWidth = props.headWidth ?? headLength * 0.9;
  /** Head base center: where the shaft stops and the isosceles base sits. */
  const base = V2.sub(props.to, V2.scale(dir, headLength));
  const perp = xy(-dir[1], dir[0]);
  const wingA = V2.add(base, V2.scale(perp, headWidth / 2));
  const wingB = V2.sub(base, V2.scale(perp, headWidth / 2));

  const shaft = rawContourFromPoints([props.from, base], false);
  const head = rawContourFromPoints([props.to, wingA, wingB], true);
  const style: ObjectStyle = {
    stroke: "#38bdf8",
    fill: "#38bdf8",
    lineWidth: 0.03,
    ...props.style,
  };
  return buildObject2D({
    type: "arrow",
    rawContours: [shaft, head],
    fillable: true,
    morphable: false,
    style,
    ...pickStyleMeta({ metadata: props.metadata }),
  });
}

function pickStyleMeta(props: { style?: ObjectStyle; metadata?: ObjectMetadata }): {
  style?: ObjectStyle;
  metadata?: ObjectMetadata;
} {
  return {
    ...(props.style ? { style: props.style } : {}),
    ...(props.metadata ? { metadata: props.metadata } : {}),
  };
}
