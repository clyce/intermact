import { type AbsXY, clamp, type Vec2, xy } from "../math/vec";
import { linearScale, logScale, powScale, type Scale } from "../math/scale";
import { createGeometryProvider2D, strokeTraitFrom } from "../geometry/provider";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { labelContours } from "../text/text-layout";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval, type Scene2DProps } from "../scene/types";

/** Scale family for an axis (design.md §7.3). */
export type AxisScaleType = "linear" | "log" | "pow";

/**
 * Axes authoring props (design.md §7.4, §9.1). Describes the axes object itself
 * (data domain, scales, ticks/labels). Visibility is controlled via the returned
 * {@link RegisteredAxes2D} animation methods (`fadeIn`/`create`/…), not Scene.
 */
export interface AxesProps {
  readonly x: Interval;
  readonly y: Interval;
  readonly style?: ObjectStyle;
  /** Axis label text (rendered via the M10 text pipeline; reserved here). */
  readonly xLabel?: string;
  readonly yLabel?: string;
  /** Whether to draw tick marks along each axis (default true, M7/M8). */
  readonly showTicks?: boolean;
  /** Whether to draw numeric tick labels (default true). */
  readonly showTickLabels?: boolean;
  /** Approximate number of ticks per axis (default 8). */
  readonly tickCount?: number;
  /** x/y scale family (default linear). */
  readonly xScaleType?: AxisScaleType;
  readonly yScaleType?: AxisScaleType;
  /** Exponent for `pow` scales (default 1). */
  readonly exponent?: number;
  /** Base for `log` scales (default 10). */
  readonly logBase?: number;
}

/** @deprecated Use {@link AxesProps}. */
export type AxesSpec = AxesProps;

/**
 * Handle for mapping data coordinates to scene world coordinates (design.md §7.4).
 * Attached to registered axes objects returned by {@link Scene2D.getAxes}. The
 * per-axis {@link Scale}s are reused by axis-bound constructs (M8) for ticks.
 */
export interface AxesHandle {
  /** Data coordinate `[x, y]` → absolute world point. */
  c2p(coord: Vec2): AbsXY;
  /** Absolute world point → data coordinate `[x, y]`. */
  p2c(point: AbsXY): Vec2;
  readonly props: AxesProps;
  /** Data x → world x. */
  readonly xScale: Scale;
  /** Data y → world y. */
  readonly yScale: Scale;
}

function makeAxisScale(
  type: AxisScaleType | undefined,
  domain: Interval,
  range: Interval,
  props: AxesProps,
): Scale {
  switch (type ?? "linear") {
    case "log":
      return logScale(domain, range, props.logBase ?? 10);
    case "pow":
      return powScale(domain, range, props.exponent ?? 1);
    case "linear":
      return linearScale(domain, range);
  }
}

/** Build an {@link AxesHandle} that maps data ranges onto a scene domain. */
export function createAxesHandle(
  props: AxesProps,
  sceneDomain: Scene2DProps["domain"],
): AxesHandle {
  const xScale = makeAxisScale(props.xScaleType, props.x, sceneDomain.x, props);
  const yScale = makeAxisScale(props.yScaleType, props.y, sceneDomain.y, props);
  return {
    props,
    xScale,
    yScale,
    c2p: ([cx, cy]) => xy(xScale(cx), yScale(cy)),
    p2c: (point) => [xScale.invert(point[0]), yScale.invert(point[1])],
  };
}

/** Symbol key used to retrieve {@link AxesProps} from an axes object definition. */
export const AXES_SPEC_KEY = Symbol.for("intermact.axesSpec");

const DEFAULT_TICK_COUNT = 8;
const TICK_LENGTH = 0.08;
const TICK_LABEL_SIZE = 0.2;

/**
 * Build axis lines + ticks + numeric labels as an {@link IMObject2D}. The x-axis
 * sits at data `y=0` (clamped into the y domain) and the y-axis at data `x=0`,
 * mirroring Manim. Tick positions come from each axis {@link Scale}; labels use
 * the built-in stroke-font glyph renderer (M10).
 */
export function axesObject(props: AxesProps, sceneDomain: Scene2DProps["domain"]): IMObject2D {
  const handle = createAxesHandle(props, sceneDomain);
  const showTicks = props.showTicks ?? true;
  const showTickLabels = props.showTickLabels ?? true;
  const tickCount = props.tickCount ?? DEFAULT_TICK_COUNT;

  const axisYData = clamp(0, Math.min(props.y[0], props.y[1]), Math.max(props.y[0], props.y[1]));
  const axisXData = clamp(0, Math.min(props.x[0], props.x[1]), Math.max(props.x[0], props.x[1]));
  const axisYWorld = handle.yScale(axisYData);
  const axisXWorld = handle.xScale(axisXData);

  const contours: RawContour[] = [
    rawContourFromPoints(
      [handle.c2p([props.x[0], axisYData]), handle.c2p([props.x[1], axisYData])],
      false,
    ),
    rawContourFromPoints(
      [handle.c2p([axisXData, props.y[0]]), handle.c2p([axisXData, props.y[1]])],
      false,
    ),
  ];

  if (showTicks) {
    const xFmt = handle.xScale.tickFormat(tickCount);
    for (const tx of handle.xScale.ticks(tickCount)) {
      const wx = handle.xScale(tx);
      contours.push(
        rawContourFromPoints(
          [xy(wx, axisYWorld - TICK_LENGTH), xy(wx, axisYWorld + TICK_LENGTH)],
          false,
        ),
      );
      if (showTickLabels && Math.abs(tx - axisXData) > 1e-9) {
        const text = labelContours(xFmt(tx), {
          size: TICK_LABEL_SIZE,
          origin: xy(wx, axisYWorld - TICK_LENGTH - 0.04),
          align: "center",
          baseline: "top",
        });
        contours.push(...text.contours);
      }
    }
    const yFmt = handle.yScale.tickFormat(tickCount);
    for (const ty of handle.yScale.ticks(tickCount)) {
      const wy = handle.yScale(ty);
      contours.push(
        rawContourFromPoints(
          [xy(axisXWorld - TICK_LENGTH, wy), xy(axisXWorld + TICK_LENGTH, wy)],
          false,
        ),
      );
      if (showTickLabels && Math.abs(ty - axisYData) > 1e-9) {
        const text = labelContours(yFmt(ty), {
          size: TICK_LABEL_SIZE,
          origin: xy(axisXWorld - TICK_LENGTH - 0.06, wy),
          align: "right",
          baseline: "middle",
        });
        contours.push(...text.contours);
      }
    }
  }

  const style: ObjectStyle = {
    stroke: "#94a3b8",
    lineWidth: 0.025,
    ...props.style,
  };
  const provider = createGeometryProvider2D({ rawContours: contours, fillable: false });
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
