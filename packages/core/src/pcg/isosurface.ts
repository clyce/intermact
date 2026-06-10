import { marchingCubes } from "../geometry/marching-cubes";
import { createMeshProvider3D } from "../geometry/provider3d";
import { xyz } from "../math/vec";
import { type ObjectStyle } from "../object/style";
import { type IMObject3D } from "../object/types";
import { type ScalarField3D } from "./field";

/**
 * Isosurface generator (design.md §6). Polygonises the `level` set of a 3D
 * scalar field into a mesh {@link IMObject3D} via marching cubes (tetrahedral
 * variant, see {@link marchingCubes}). Deterministic for a given field + options.
 */
export interface IsosurfaceOptions {
  /** Iso level to extract (default 0). */
  readonly level?: number;
  /** Cells per axis (vertices = res+1); default 24. */
  readonly resolution?: number | readonly [number, number, number];
  readonly style?: ObjectStyle;
}

/** Extract a mesh object for the iso-`level` surface of `field`. */
export function isosurface(field: ScalarField3D, options: IsosurfaceOptions = {}): IMObject3D {
  const { min, max } = field.domain;
  const mesh = marchingCubes((x, y, z) => field.sample(xyz(x, y, z)), {
    min,
    max,
    resolution: options.resolution ?? 24,
    level: options.level ?? 0,
  });
  return {
    type: "isosurface-3d",
    dimension: "3d",
    traits: [],
    geometry: createMeshProvider3D(mesh),
    style: { doubleSided: true, ...options.style },
  };
}
