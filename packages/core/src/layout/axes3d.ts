import { createLineProvider3D, packVec3, toSampledPolyline3D } from "../geometry/provider3d";
import { linearScale } from "../math/scale";
import { type AbsXYZ, type Vec3, xy, xyz } from "../math/vec";
import { type SampledPolyline3D } from "../object/geometry-provider";
import { type ObjectStyle } from "../object/style";
import { type AxesLayoutTrait, type Geometry3DTrait } from "../object/traits";
import { type IMObject3D } from "../object/types";
import { type Interval } from "../scene/types";
import { labelContours } from "../text/text-layout";
import { resolveMathTickFontId } from "../text/font-registry";

/**
 * 3D axes authoring props (design.md §7.4, §9.1, §10). Describes the axes object
 * itself (per-axis data ranges, style, labels). Distinct from the `axes3D()`
 * geometry factory's `Axes3DProps` (size/origin): this range-based shape is the
 * one consumed by {@link Scene3D.getAxes}, returning a coordinate
 * {@link Axes3DHandle}. Visibility/motion use the returned object's standard
 * animation methods (`fadeIn`/`create`/…), not Scene-level helpers.
 */
export interface Axes3DLayoutProps {
  readonly x: Interval;
  readonly y: Interval;
  readonly z: Interval;
  readonly style?: ObjectStyle;
  /** Axis labels (reserved for the 3D text pipeline). */
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly zLabel?: string;
  /** Whether to draw tick marks along each axis (default true). */
  readonly showTicks?: boolean;
  /** Whether to draw numeric tick labels (default true). */
  readonly showTickLabels?: boolean;
  /** Approximate number of ticks per axis (default 6). */
  readonly tickCount?: number;
  /** Registered font id for numeric tick labels (default math-serif). */
  readonly tickFont?: string;
}

/**
 * Handle for mapping 3D data coordinates to world coordinates (design.md §7.4).
 * In 3D the math space *is* the world space, so the mapping is the identity; the
 * handle still carries `props` so axis-bound constructs can read the ranges.
 */
export interface Axes3DHandle {
  /** Data coordinate `[x, y, z]` → absolute world point. */
  c2p(coord: Vec3): AbsXYZ;
  /** Absolute world point → data coordinate `[x, y, z]`. */
  p2c(point: AbsXYZ): Vec3;
  readonly props: Axes3DLayoutProps;
}

/** Build an {@link Axes3DHandle} (identity mapping for the world==data 3D model). */
export function createAxes3DHandle(props: Axes3DLayoutProps): Axes3DHandle {
  return {
    props,
    c2p: (coord) => xyz(coord[0], coord[1], coord[2]),
    p2c: (point) => [point[0], point[1], point[2]],
  };
}

const GEOMETRY_LINE: Geometry3DTrait = { kind: "geometry-3d", geometryKind: "line" };
const DEFAULT_TICK_COUNT = 6;
const TICK_LENGTH = 0.12;
const TICK_LABEL_SIZE = 0.18;

function clampOrigin(range: Interval): number {
  return Math.min(Math.max(0, Math.min(...range)), Math.max(...range));
}

function labelPolylines3D(
  text: string,
  origin: Vec3,
  font: string,
  align: "left" | "center" | "right",
  baseline: "bottom" | "middle" | "top",
): SampledPolyline3D[] {
  const { contours } = labelContours(text, {
    size: TICK_LABEL_SIZE,
    origin: xy(origin[0], origin[1]),
    align,
    baseline,
    font,
  });
  const z = origin[2];
  return contours.map((c) => {
    const pts = new Float32Array((c.points.length / 2) * 3);
    for (let i = 0; i < c.points.length; i += 2) {
      pts[(i / 2) * 3] = c.points[i]!;
      pts[(i / 2) * 3 + 1] = c.points[i + 1]!;
      pts[(i / 2) * 3 + 2] = z;
    }
    return toSampledPolyline3D(pts, c.closed);
  });
}

function axesLayoutTrait3D(groupIndex: readonly number[]): AxesLayoutTrait {
  const maxGroup = groupIndex.length > 0 ? Math.max(...groupIndex) : 0;
  return {
    kind: "axes-layout",
    contourGroupIndex: () => groupIndex,
    groupCount: () => maxGroup + 1,
  };
}

/**
 * Build 3D coordinate axes as an {@link IMObject3D}: three axis segments plus
 * optional ticks and numeric labels (math-serif outlines in the axis planes).
 */
export function axes3DLayoutObject(props: Axes3DLayoutProps): IMObject3D {
  const o: Vec3 = [clampOrigin(props.x), clampOrigin(props.y), clampOrigin(props.z)];
  const showTicks = props.showTicks ?? true;
  const showTickLabels = props.showTickLabels ?? true;
  const tickCount = props.tickCount ?? DEFAULT_TICK_COUNT;
  const tickFont = showTickLabels ? (props.tickFont ?? resolveMathTickFontId()) : undefined;

  const lines: SampledPolyline3D[] = [];
  const groupIndex: number[] = [];
  let group = 0;

  const pushLine = (poly: SampledPolyline3D, g: number): void => {
    lines.push(poly);
    groupIndex.push(g);
  };

  pushLine(
    toSampledPolyline3D(
      packVec3([
        [props.x[0], o[1], o[2]],
        [props.x[1], o[1], o[2]],
      ]),
      false,
    ),
    group++,
  );
  pushLine(
    toSampledPolyline3D(
      packVec3([
        [o[0], props.y[0], o[2]],
        [o[0], props.y[1], o[2]],
      ]),
      false,
    ),
    group++,
  );
  pushLine(
    toSampledPolyline3D(
      packVec3([
        [o[0], o[1], props.z[0]],
        [o[0], o[1], props.z[1]],
      ]),
      false,
    ),
    group++,
  );

  if (showTicks) {
    const xScale = linearScale(props.x, props.x);
    const yScale = linearScale(props.y, props.y);
    const zScale = linearScale(props.z, props.z);
    const xFmt = xScale.tickFormat(tickCount);
    const yFmt = yScale.tickFormat(tickCount);
    const zFmt = zScale.tickFormat(tickCount);

    for (const tx of xScale.ticks(tickCount)) {
      if (Math.abs(tx - o[0]) < 1e-9) continue;
      const tickGroup = group++;
      pushLine(
        toSampledPolyline3D(
          packVec3([
            [tx, o[1] - TICK_LENGTH, o[2]],
            [tx, o[1] + TICK_LENGTH, o[2]],
          ]),
          false,
        ),
        tickGroup,
      );
      if (showTickLabels && tickFont) {
        for (const lp of labelPolylines3D(
          xFmt(tx),
          [tx, o[1] - TICK_LENGTH - 0.08, o[2]],
          tickFont,
          "center",
          "top",
        )) {
          pushLine(lp, tickGroup);
        }
      }
    }
    for (const ty of yScale.ticks(tickCount)) {
      if (Math.abs(ty - o[1]) < 1e-9) continue;
      const tickGroup = group++;
      pushLine(
        toSampledPolyline3D(
          packVec3([
            [o[0] - TICK_LENGTH, ty, o[2]],
            [o[0] + TICK_LENGTH, ty, o[2]],
          ]),
          false,
        ),
        tickGroup,
      );
      if (showTickLabels && tickFont) {
        for (const lp of labelPolylines3D(
          yFmt(ty),
          [o[0] - TICK_LENGTH - 0.1, ty, o[2]],
          tickFont,
          "right",
          "middle",
        )) {
          pushLine(lp, tickGroup);
        }
      }
    }
    for (const tz of zScale.ticks(tickCount)) {
      if (Math.abs(tz - o[2]) < 1e-9) continue;
      const tickGroup = group++;
      pushLine(
        toSampledPolyline3D(
          packVec3([
            [o[0], o[1] - TICK_LENGTH, tz],
            [o[0], o[1] + TICK_LENGTH, tz],
          ]),
          false,
        ),
        tickGroup,
      );
      if (showTickLabels && tickFont) {
        for (const lp of labelPolylines3D(
          zFmt(tz),
          [o[0] - TICK_LENGTH - 0.1, o[1], tz],
          tickFont,
          "right",
          "middle",
        )) {
          pushLine(lp, tickGroup);
        }
      }
    }
  }

  const style: ObjectStyle = { stroke: "#94a3b8", ...props.style };
  const layoutTrait = axesLayoutTrait3D(groupIndex);
  return {
    type: "axes-3d",
    dimension: "3d",
    traits: [GEOMETRY_LINE, layoutTrait],
    geometry: createLineProvider3D(lines),
    style,
  };
}
