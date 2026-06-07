import { MeshBasicMaterial } from "three";
import { parseColor } from "./color";

/**
 * Create a 2D-friendly basic material (design.md §15): unlit, transparent, with
 * `depthWrite` disabled so 2D objects compose via the painter's algorithm
 * (`renderOrder` from zIndex) rather than the depth buffer.
 */
export function makeBasicMaterial(css: string | undefined, opacity: number): MeshBasicMaterial {
  const { color, alpha } = parseColor(css);
  const material = new MeshBasicMaterial({ color });
  material.transparent = true;
  material.depthWrite = false;
  material.opacity = alpha * opacity;
  return material;
}
