import { type AbsXY, xy } from "../math/vec";
import { type Bounds2D } from "../object/geometry-provider";
import { type RawContour } from "./sampling";

/** Compute the axis-aligned bounding box of one or more contours. */
export function computeBounds(contours: readonly RawContour[]): Bounds2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const contour of contours) {
    const { points } = contour;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!;
      const y = points[i + 1]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { min: xy(0, 0), max: xy(0, 0), size: [0, 0], center: xy(0, 0) };
  }

  const min: AbsXY = xy(minX, minY);
  const max: AbsXY = xy(maxX, maxY);
  return {
    min,
    max,
    size: [maxX - minX, maxY - minY],
    center: xy((minX + maxX) / 2, (minY + maxY) / 2),
  };
}
