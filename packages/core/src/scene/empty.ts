import { xy } from "../math/vec";
import {
  type Bounds2D,
  type GeometryProvider2D,
  type SampledPath2D,
} from "../object/geometry-provider";
import { type IMObject2D } from "../object/types";

const EMPTY_PATH: SampledPath2D = { contours: [], totalLength: 0 };

const ZERO_BOUNDS: Bounds2D = {
  min: xy(0, 0),
  max: xy(0, 0),
  size: [0, 0],
  center: xy(0, 0),
};

const emptyGeometry: GeometryProvider2D = {
  capabilities: [],
  samplePath: () => EMPTY_PATH,
  getBounds: () => ZERO_BOUNDS,
};

/**
 * A transform-only object with no geometry, used by `scene.registerEmpty` to
 * build Unity-style transform hierarchies (design.md §9.3).
 */
export function emptyObject2D(): IMObject2D {
  return { type: "empty", dimension: "2d", traits: [], geometry: emptyGeometry };
}
