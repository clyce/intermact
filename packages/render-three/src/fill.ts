import { BufferAttribute, BufferGeometry } from "three";
import { type SampledContour2D, triangulate } from "@intermact/core";

/**
 * Fill geometry via earcut triangulation (design.md §15). The first contour is
 * the outer ring and the rest are holes; `fillProgress` (Create fill reveal) is
 * applied by the caller via material opacity for the simple after-stroke-fade
 * strategy.
 */
export function buildFillGeometry(contours: readonly SampledContour2D[]): BufferGeometry {
  const tri = triangulate(contours);
  const positions = new Float32Array((tri.vertices.length / 2) * 3);
  for (let i = 0; i < tri.vertices.length / 2; i++) {
    positions[i * 3] = tri.vertices[i * 2]!;
    positions[i * 3 + 1] = tri.vertices[i * 2 + 1]!;
    positions[i * 3 + 2] = 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(tri.indices, 1));
  return geometry;
}
