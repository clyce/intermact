/**
 * Data-driven generators (design.md §6.5): map arrays of data to geometry,
 * bridging "experiment snapshots" and visualization. Charts use the M7
 * {@link linearScale} to map data domains into world coordinates and keep stable
 * keys (via `mapData`/`keyOf`) so Morph/data updates can match objects.
 */
import { type AbsXY, type Vec2, xy } from "../math/vec";
import { linearScale } from "../math/scale";
import { group2D, type GroupChild } from "../geometry/group";
import { approxCircle, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { shapeObject, strokeObject } from "../constructs/shared";

/** Options for {@link mapData}. */
export interface MapDataOptions<T> {
  /** Stable key per datum, used for Morph/data-update matching (default index). */
  readonly key?: (datum: T, index: number) => string;
  readonly style?: ObjectStyle;
}

/**
 * Map data to a composite object: each datum becomes a keyed part (design.md
 * §6.5). The keys flow into `group2D` parts so `transformMatching` can pair
 * elements across data updates.
 */
export function mapData<T>(
  data: readonly T[],
  build: (datum: T, index: number) => IMObject2D,
  options: MapDataOptions<T> = {},
): IMObject2D {
  const children: GroupChild[] = data.map((datum, index) => ({
    key: options.key ? options.key(datum, index) : String(index),
    object: build(datum, index),
  }));
  return group2D(children, options.style ? { style: options.style } : {});
}

/** A bar datum: a value with an optional label/key. */
export interface BarDatum {
  readonly value: number;
  readonly label?: string;
}

/** Spec for {@link barChart}. */
export interface BarChartSpec {
  readonly data: readonly (number | BarDatum)[];
  /** Chart size `[width, height]` in world units (default `[4, 3]`). */
  readonly size?: Vec2;
  /** Value range mapped to `[0, height]`; defaults to `[0, maxValue]`. */
  readonly domain?: readonly [number, number];
  /** Gap fraction between bars in `[0,1)` (default 0.2). */
  readonly gap?: number;
  /** Bottom-left origin in world space (default `[0,0]`). */
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

function barValue(d: number | BarDatum): number {
  return typeof d === "number" ? d : d.value;
}

/** A bar chart of filled rectangles, keyed by label/index (design.md §6.5). */
export function barChart(spec: BarChartSpec): IMObject2D {
  const [w, h] = spec.size ?? [4, 3];
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const gap = Math.min(0.95, Math.max(0, spec.gap ?? 0.2));
  const n = Math.max(1, spec.data.length);
  const maxValue = spec.data.reduce<number>((m, d) => Math.max(m, barValue(d)), 0);
  const yScale = linearScale(spec.domain ?? [0, maxValue || 1], [0, h]);
  const slot = w / n;
  const barWidth = slot * (1 - gap);

  const children: GroupChild[] = spec.data.map((d, i) => {
    const value = barValue(d);
    const bh = yScale(value);
    const x0 = ox + i * slot + (slot - barWidth) / 2;
    const rect = shapeObject(
      "bar",
      [
        rawContourFromPoints(
          [xy(x0, oy), xy(x0 + barWidth, oy), xy(x0 + barWidth, oy + bh), xy(x0, oy + bh)],
          true,
        ),
      ],
      { fill: "#60a5fa", stroke: "#3b82f6", lineWidth: 0.008, ...spec.style },
    );
    const key = typeof d === "number" ? String(i) : (d.label ?? String(i));
    return { key, object: rect };
  });
  return group2D(children, spec.style ? { style: spec.style } : {});
}

/** Spec for {@link scatter}. */
export interface ScatterSpec {
  readonly points: readonly Vec2[];
  /** Chart size `[width, height]` in world units (default `[4, 3]`). */
  readonly size?: Vec2;
  readonly xDomain?: readonly [number, number];
  readonly yDomain?: readonly [number, number];
  /** Marker radius (default 0.05). */
  readonly radius?: number;
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

function extent(values: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) return [0, 1];
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** A scatter plot of marker disks (design.md §6.5). */
export function scatter(spec: ScatterSpec): IMObject2D {
  const [w, h] = spec.size ?? [4, 3];
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const radius = spec.radius ?? 0.05;
  const xs = spec.points.map((p) => p[0]);
  const ys = spec.points.map((p) => p[1]);
  const xScale = linearScale(spec.xDomain ?? extent(xs), [0, w]);
  const yScale = linearScale(spec.yDomain ?? extent(ys), [0, h]);

  const children: GroupChild[] = spec.points.map((p, i) => {
    const cx = ox + xScale(p[0]);
    const cy = oy + yScale(p[1]);
    const disk = approxCircle(xy(cx, cy), radius, 12);
    const dot = shapeObject("scatter-point", [rawContourFromPoints(disk, true)], {
      fill: "#f97316",
      stroke: "#f97316",
      lineWidth: 0.006,
      ...spec.style,
    });
    return { key: String(i), object: dot };
  });
  return group2D(children, spec.style ? { style: spec.style } : {});
}

/** Spec for {@link lineChart}. */
export interface LineChartSpec {
  readonly points: readonly Vec2[];
  readonly size?: Vec2;
  readonly xDomain?: readonly [number, number];
  readonly yDomain?: readonly [number, number];
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

/** A line chart polyline through data points (design.md §6.5). */
export function lineChart(spec: LineChartSpec): IMObject2D {
  const [w, h] = spec.size ?? [4, 3];
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const xs = spec.points.map((p) => p[0]);
  const ys = spec.points.map((p) => p[1]);
  const xScale = linearScale(spec.xDomain ?? extent(xs), [0, w]);
  const yScale = linearScale(spec.yDomain ?? extent(ys), [0, h]);
  const pts = spec.points.map((p) => xy(ox + xScale(p[0]), oy + yScale(p[1])));
  if (pts.length < 2) {
    return strokeObject("line-chart", [rawContourFromPoints([xy(ox, oy), xy(ox, oy)], false)], {
      stroke: "#22c55e",
      lineWidth: 0.02,
      ...spec.style,
    });
  }
  return strokeObject("line-chart", [rawContourFromPoints(pts, false)], {
    stroke: "#22c55e",
    lineWidth: 0.02,
    ...spec.style,
  });
}
