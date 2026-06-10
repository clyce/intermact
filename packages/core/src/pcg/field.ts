/**
 * Fields and samplers (design.md §6.2). A field maps a space point to a value
 * (scalar / vector / color) and is the common abstraction for scientific
 * visualization. Fields are pure functions of position, so the objects derived
 * from them (isolines, heatmaps, vector fields, streamlines) are deterministic
 * and replayable.
 */
import { type AbsXY, type AbsXYZ, type Vec2, xy } from "../math/vec";
import { type Bounds2D, type Bounds3D } from "../object/geometry-provider";

/** A 2D numeric interval `[min, max]` (kept local so pcg stays scene-free). */
export type FieldInterval = readonly [number, number];

/** A rectangular 2D field domain expressed as x/y intervals. */
export interface FieldDomain2D {
  readonly x: FieldInterval;
  readonly y: FieldInterval;
}

/** A box-shaped 3D field domain. */
export interface FieldDomain3D {
  readonly x: FieldInterval;
  readonly y: FieldInterval;
  readonly z: FieldInterval;
}

/** Scalar field over a 2D domain (design.md §6.2). */
export interface ScalarField2D {
  readonly domain: Bounds2D;
  sample(p: AbsXY): number;
}

/** Vector field over a 2D domain (design.md §6.2). */
export interface VectorField2D {
  readonly domain: Bounds2D;
  sample(p: AbsXY): Vec2;
}

/** Scalar field over a 3D domain (design.md §6.2; consumed by M14 isosurface). */
export interface ScalarField3D {
  readonly domain: Bounds3D;
  sample(p: AbsXYZ): number;
}

/** Build a {@link Bounds2D} from x/y intervals. */
export function bounds2DFromDomain(domain: FieldDomain2D): Bounds2D {
  const [minX, maxX] = domain.x;
  const [minY, maxY] = domain.y;
  return {
    min: xy(minX, minY),
    max: xy(maxX, maxY),
    size: [maxX - minX, maxY - minY],
    center: xy((minX + maxX) / 2, (minY + maxY) / 2),
  };
}

/** Build a {@link Bounds3D} from x/y/z intervals. */
export function bounds3DFromDomain(domain: FieldDomain3D): Bounds3D {
  const [minX, maxX] = domain.x;
  const [minY, maxY] = domain.y;
  const [minZ, maxZ] = domain.z;
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
  };
}

/** Create a {@link ScalarField2D} from a `(x, y) -> number` function. */
export function scalarField2D(
  domain: FieldDomain2D,
  fn: (x: number, y: number) => number,
): ScalarField2D {
  const bounds = bounds2DFromDomain(domain);
  return { domain: bounds, sample: (p) => fn(p[0], p[1]) };
}

/** Create a {@link VectorField2D} from a `(x, y) -> [vx, vy]` function. */
export function vectorField2D(
  domain: FieldDomain2D,
  fn: (x: number, y: number) => Vec2,
): VectorField2D {
  const bounds = bounds2DFromDomain(domain);
  return { domain: bounds, sample: (p) => fn(p[0], p[1]) };
}

/** Create a {@link ScalarField3D} from a `(x, y, z) -> number` function. */
export function scalarField3D(
  domain: FieldDomain3D,
  fn: (x: number, y: number, z: number) => number,
): ScalarField3D {
  const bounds = bounds3DFromDomain(domain);
  return { domain: bounds, sample: (p) => fn(p[0], p[1], p[2]) };
}

/**
 * Derive a scalar field from the magnitude of a vector field. Handy for coloring
 * a vector field by speed (heatmap under streamlines, etc.).
 */
export function vectorMagnitudeField(field: VectorField2D): ScalarField2D {
  return {
    domain: field.domain,
    sample: (p) => {
      const v = field.sample(p);
      return Math.hypot(v[0], v[1]);
    },
  };
}
