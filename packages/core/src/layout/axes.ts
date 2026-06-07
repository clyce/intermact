import { type AbsXY, type Vec2, xy } from "../math/vec";
import { createGeometryProvider2D, strokeTraitFrom } from "../geometry/provider";
import { rawContourFromPoints } from "../geometry/sampling";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval, type Scene2DProps } from "../scene/types";

/**
 * Axes authoring props (design.md §7.4, §9.1). Describes the axes object itself
 * (data domain, style, ticks/labels). Visibility is controlled via the returned
 * {@link RegisteredAxes2D} animation methods (`fadeIn`/`create`/…), not Scene.
 */
export interface AxesProps {
  readonly x: Interval;
  readonly y: Interval;
  readonly style?: ObjectStyle;
  /** Axis label text (rendering lands in M10; reserved here for API stability). */
  readonly xLabel?: string;
  readonly yLabel?: string;
  /** Whether to draw tick marks along each axis (M7). */
  readonly showTicks?: boolean;
  /** Whether to draw numeric tick labels (M7). */
  readonly showTickLabels?: boolean;
}

/** @deprecated Use {@link AxesProps}. */
export type AxesSpec = AxesProps;

/**
 * Handle for mapping data coordinates to scene world coordinates (design.md §7.4).
 * Attached to registered axes objects returned by {@link Scene2D.getAxes}.
 */
export interface AxesHandle {
  /** Data coordinate `[x, y]` → absolute world point. */
  c2p(coord: Vec2): AbsXY;
  /** Absolute world point → data coordinate `[x, y]`. */
  p2c(point: AbsXY): Vec2;
  readonly props: AxesProps;
}

/** Build an {@link AxesHandle} that linearly maps data ranges onto a scene domain. */
export function createAxesHandle(
  props: AxesProps,
  sceneDomain: Scene2DProps["domain"],
): AxesHandle {
  const mapX = (cx: number): number => {
    const t = (cx - props.x[0]) / (props.x[1] - props.x[0]);
    return sceneDomain.x[0] + t * (sceneDomain.x[1] - sceneDomain.x[0]);
  };
  const mapY = (cy: number): number => {
    const t = (cy - props.y[0]) / (props.y[1] - props.y[0]);
    return sceneDomain.y[0] + t * (sceneDomain.y[1] - sceneDomain.y[0]);
  };
  const invX = (wx: number): number => {
    const t = (wx - sceneDomain.x[0]) / (sceneDomain.x[1] - sceneDomain.x[0]);
    return props.x[0] + t * (props.x[1] - props.x[0]);
  };
  const invY = (wy: number): number => {
    const t = (wy - sceneDomain.y[0]) / (sceneDomain.y[1] - sceneDomain.y[0]);
    return props.y[0] + t * (props.y[1] - props.y[0]);
  };
  return {
    props,
    c2p: ([cx, cy]) => xy(mapX(cx), mapY(cy)),
    p2c: (point) => [invX(point[0]), invY(point[1])],
  };
}

/** Symbol key used to retrieve {@link AxesProps} from an axes object definition. */
export const AXES_SPEC_KEY = Symbol.for("intermact.axesSpec");

/** Build axis lines as an {@link IMObject2D} (x-axis at y=0, y-axis at x=0 in data space). */
export function axesObject(props: AxesProps, sceneDomain: Scene2DProps["domain"]): IMObject2D {
  const handle = createAxesHandle(props, sceneDomain);
  const x0 = handle.c2p([props.x[0], 0]);
  const x1 = handle.c2p([props.x[1], 0]);
  const y0 = handle.c2p([0, props.y[0]]);
  const y1 = handle.c2p([0, props.y[1]]);
  const style: ObjectStyle = {
    stroke: "#94a3b8",
    lineWidth: 0.025,
    ...props.style,
  };
  const provider = createGeometryProvider2D({
    rawContours: [rawContourFromPoints([x0, x1], false), rawContourFromPoints([y0, y1], false)],
    fillable: false,
  });
  const object: IMObject2D = {
    type: "axes",
    dimension: "2d",
    traits: [strokeTraitFrom(provider)],
    geometry: provider,
    style,
  };
  Object.defineProperty(object, AXES_SPEC_KEY, { value: props, enumerable: false });
  return object;
}

/** @deprecated Use {@link axesObject}. */
export const axes = axesObject;

/** Read {@link AxesProps} from an axes object, if present. */
export function readAxesProps(object: IMObject2D): AxesProps | undefined {
  return (object as IMObject2D & { [AXES_SPEC_KEY]?: AxesProps })[AXES_SPEC_KEY];
}

/** @deprecated Use {@link readAxesProps}. */
export const readAxesSpec = readAxesProps;
