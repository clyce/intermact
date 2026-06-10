import { type Bounds3D, type GeometryProvider3D } from "../object/geometry-provider";
import { type IMObject3D } from "../object/types";

const ZERO_BOUNDS_3D: Bounds3D = {
  min: [0, 0, 0],
  max: [0, 0, 0],
  size: [0, 0, 0],
  center: [0, 0, 0],
};

const emptyGeometry3D: GeometryProvider3D = {
  capabilities: [],
  kind: "line",
  getBounds: () => ZERO_BOUNDS_3D,
  sampleLines: () => [],
  totalLength: () => 0,
};

/**
 * A transform-only 3D object with no geometry (design.md §9.3). Used for
 * `group3D` parents and as the backing object for a registered 3D camera so it
 * participates in the seekable timeline like any other object.
 */
export function emptyObject3D(type = "empty-3d"): IMObject3D {
  return { type, dimension: "3d", traits: [], geometry: emptyGeometry3D };
}
