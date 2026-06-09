import { BufferAttribute, BufferGeometry } from "three";
import { type SampledContour2D, triangulate, triangulateGroups } from "@intermact/core";

/**
 * Fill geometry via earcut triangulation (design.md §15). When `groups` is
 * provided each group (glyph) is triangulated independently so nested holes
 * stay with their outer ring.
 */
export function buildFillGeometry(
  contours: readonly SampledContour2D[],
  groups?: readonly (readonly SampledContour2D[])[],
): BufferGeometry {
  const tri = groups?.length ? triangulateGroups(groups) : triangulate(contours);
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
