import earcut from "earcut";
import { type SampledContour2D } from "../object/geometry-provider";

/**
 * Polygon triangulation (design.md §5.2). Uses earcut for concave / holed
 * shapes. Convention: the first contour is the outer ring, the remaining
 * contours are holes (the common ring-with-holes model). `fillRule` is carried
 * through for the renderer; earcut itself assumes the outer+holes layout.
 */
export interface Triangulation {
  /** Interleaved vertex coordinates `[x0,y0,...]`. */
  readonly vertices: Float32Array;
  /** Triangle vertex indices into `vertices` (groups of 3). */
  readonly indices: Uint32Array;
}

/** Triangulate one or more contours (first = outer ring, rest = holes). */
export function triangulate(contours: readonly SampledContour2D[]): Triangulation {
  const verts: number[] = [];
  const holeIndices: number[] = [];

  contours.forEach((contour, ci) => {
    if (ci > 0) holeIndices.push(verts.length / 2);
    const { points } = contour;
    for (let i = 0; i < points.length; i++) verts.push(points[i]!);
  });

  const indices = earcut(verts, holeIndices.length ? holeIndices : undefined, 2);
  return { vertices: Float32Array.from(verts), indices: Uint32Array.from(indices) };
}

/** Sum of triangle areas in a triangulation (handy for tests/diagnostics). */
export function triangulationArea(tri: Triangulation): number {
  const { vertices, indices } = tri;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 2;
    const b = indices[i + 1]! * 2;
    const c = indices[i + 2]! * 2;
    const ax = vertices[a]!;
    const ay = vertices[a + 1]!;
    const bx = vertices[b]!;
    const by = vertices[b + 1]!;
    const cx = vertices[c]!;
    const cy = vertices[c + 1]!;
    area += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return area;
}
