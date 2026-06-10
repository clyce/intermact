/**
 * Field-derived visualization objects (design.md §6.2): iso-lines (marching
 * squares), heatmaps (color-mapped cells), vector-field arrow grids, and
 * streamlines (numerical integration). All produce immutable {@link IMObject2D}.
 */
import { type AbsXY, xy } from "../math/vec";
import { createGeometryProvider2D, fillTraitFrom } from "../geometry/provider";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { group2D } from "../geometry/group";
import { arrow } from "../geometry/primitives";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { strokeObject } from "../constructs/shared";
import { sampleColorRamp, type RgbStop } from "./color-ramp";
import { type ScalarField2D, type VectorField2D } from "./field";
import { marchingSquares, type MarchingSquaresOptions, stitchSegments } from "./marching-squares";

/** Options for {@link isoline}. */
export interface IsolineOptions extends MarchingSquaresOptions {
  readonly style?: ObjectStyle;
}

/**
 * Iso-lines of a scalar field at one or more `levels` (marching squares). Each
 * level's loose segments are stitched into polylines; all polylines render as a
 * single stroke object.
 */
export function isoline(
  field: ScalarField2D,
  levels: readonly number[],
  options: IsolineOptions = {},
): IMObject2D {
  const contours: RawContour[] = [];
  for (const level of levels) {
    const segments = marchingSquares(field, level, options);
    for (const line of stitchSegments(segments)) {
      if (line.length >= 2) contours.push(rawContourFromPoints(line, false));
    }
  }
  if (contours.length === 0) {
    // Keep a valid (empty) object so callers can still register/animate it.
    contours.push(rawContourFromPoints([xy(0, 0), xy(0, 0)], false));
  }
  return strokeObject("isoline", contours, {
    stroke: "#38bdf8",
    lineWidth: 0.02,
    ...options.style,
  });
}

/** Options for {@link heatmap}. */
export interface HeatmapOptions {
  /** Grid cells along x (default 32). */
  readonly nx?: number;
  /** Grid cells along y (default 32). */
  readonly ny?: number;
  /** Value range mapped to the ramp ends; defaults to the sampled min/max. */
  readonly range?: readonly [number, number];
  /** Custom color ramp stops (default turbo-like). */
  readonly ramp?: readonly RgbStop[];
  readonly style?: ObjectStyle;
}

/**
 * Color-mapped heatmap of a scalar field. Each grid cell becomes an independent
 * fill group with its own color (rendered via the per-group color channel,
 * design.md §6.2). A texture-backed variant is a later optimization (M16).
 */
export function heatmap(field: ScalarField2D, options: HeatmapOptions = {}): IMObject2D {
  const nx = Math.max(1, options.nx ?? 32);
  const ny = Math.max(1, options.ny ?? 32);
  const { min, max } = field.domain;
  const dx = (max[0] - min[0]) / nx;
  const dy = (max[1] - min[1]) / ny;

  const centers: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const v = field.sample(xy(min[0] + (ix + 0.5) * dx, min[1] + (iy + 0.5) * dy));
      centers.push(v);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const [r0, r1] = options.range ?? [lo, hi];
  const span = r1 - r0 || 1;

  const rawContours: RawContour[] = [];
  const fillGroups: RawContour[][] = [];
  const contourGlyphIndex: number[] = [];
  const fillGroupColors: string[] = [];
  let g = 0;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x0 = min[0] + ix * dx;
      const y0 = min[1] + iy * dy;
      const cell = rawContourFromPoints(
        [xy(x0, y0), xy(x0 + dx, y0), xy(x0 + dx, y0 + dy), xy(x0, y0 + dy)],
        true,
      );
      rawContours.push(cell);
      fillGroups.push([cell]);
      contourGlyphIndex.push(g);
      fillGroupColors.push(sampleColorRamp((centers[g]! - r0) / span, options.ramp));
      g++;
    }
  }

  const provider = createGeometryProvider2D({
    rawContours,
    fillable: true,
    fillRule: "nonzero",
    fillGroups,
    contourGlyphIndex,
    fillGroupColors,
  });
  return {
    type: "heatmap",
    dimension: "2d",
    traits: [fillTraitFrom(provider, "nonzero")],
    geometry: provider,
    style: { fill: fillGroupColors[0] ?? "#000000", ...options.style },
  };
}

/** Options for {@link vectorFieldObject}. */
export interface VectorFieldOptions {
  /** Grid samples along x (default 16). */
  readonly nx?: number;
  /** Grid samples along y (default 16). */
  readonly ny?: number;
  /** World length multiplier applied to each sampled vector (default 0.4). */
  readonly scale?: number;
  /** Draw all arrows the same length regardless of magnitude (default false). */
  readonly normalize?: boolean;
  readonly style?: ObjectStyle;
}

/** A grid of arrows sampling a vector field (design.md §6.2). */
export function vectorFieldObject(
  field: VectorField2D,
  options: VectorFieldOptions = {},
): IMObject2D {
  const nx = Math.max(1, options.nx ?? 16);
  const ny = Math.max(1, options.ny ?? 16);
  const scale = options.scale ?? 0.4;
  const { min, max } = field.domain;
  const dx = (max[0] - min[0]) / nx;
  const dy = (max[1] - min[1]) / ny;
  const style: ObjectStyle = {
    stroke: "#38bdf8",
    fill: "#38bdf8",
    lineWidth: 0.012,
    ...options.style,
  };

  const arrows: IMObject2D[] = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const px = min[0] + (ix + 0.5) * dx;
      const py = min[1] + (iy + 0.5) * dy;
      const v = field.sample(xy(px, py));
      const mag = Math.hypot(v[0], v[1]);
      if (mag === 0) continue;
      const len = (options.normalize ? 1 : mag) * scale;
      const ux = (v[0] / mag) * len;
      const uy = (v[1] / mag) * len;
      arrows.push(
        arrow({
          from: xy(px, py),
          to: xy(px + ux, py + uy),
          headLength: Math.min(0.12, len * 0.4),
          style,
        }),
      );
    }
  }
  if (arrows.length === 0) {
    return strokeObject("vector-field", [rawContourFromPoints([xy(0, 0), xy(0, 0)], false)], style);
  }
  return { ...group2D(arrows, { style }), type: "vector-field" };
}

/** Options for {@link streamlines}. */
export interface StreamlineOptions {
  /** Integration steps per seed (default 200). */
  readonly steps?: number;
  /** Integration step size in world units (default 0.05). */
  readonly stepSize?: number;
  /** Stop when a streamline leaves the field domain (default true). */
  readonly clipToDomain?: boolean;
  readonly style?: ObjectStyle;
}

/** Integrate streamlines of a vector field from seed points using RK4 (§6.2). */
export function streamlines(
  field: VectorField2D,
  seeds: readonly AbsXY[],
  options: StreamlineOptions = {},
): IMObject2D {
  const steps = Math.max(1, options.steps ?? 200);
  const h = options.stepSize ?? 0.05;
  const clip = options.clipToDomain ?? true;
  const { min, max } = field.domain;
  const inside = (p: AbsXY): boolean =>
    !clip || (p[0] >= min[0] && p[0] <= max[0] && p[1] >= min[1] && p[1] <= max[1]);
  // Keep RK4 sub-step probes inside the domain so out-of-range samples (which
  // can be undefined/extrapolated) don't corrupt the integrated trajectory.
  const clampToDomain = (x: number, y: number): AbsXY =>
    clip
      ? xy(Math.max(min[0], Math.min(max[0], x)), Math.max(min[1], Math.min(max[1], y)))
      : xy(x, y);

  const contours: RawContour[] = [];
  for (const seed of seeds) {
    const line: AbsXY[] = [seed];
    let p = seed;
    for (let i = 0; i < steps; i++) {
      const k1 = field.sample(p);
      const k2 = field.sample(clampToDomain(p[0] + (h / 2) * k1[0], p[1] + (h / 2) * k1[1]));
      const k3 = field.sample(clampToDomain(p[0] + (h / 2) * k2[0], p[1] + (h / 2) * k2[1]));
      const k4 = field.sample(clampToDomain(p[0] + h * k3[0], p[1] + h * k3[1]));
      const nx = p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      const ny = p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      const next = xy(nx, ny);
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !inside(next)) break;
      line.push(next);
      p = next;
    }
    if (line.length >= 2) contours.push(rawContourFromPoints(line, false));
  }
  if (contours.length === 0) {
    contours.push(rawContourFromPoints([xy(0, 0), xy(0, 0)], false));
  }
  return strokeObject("streamlines", contours, {
    stroke: "#a78bfa",
    lineWidth: 0.014,
    ...options.style,
  });
}
