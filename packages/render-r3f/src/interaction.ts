/**
 * Pointer interaction for the R3F view (design.md §12). The pointer is
 * un-projected to scene space and hit-tested analytically against each object's
 * pick proxy (core `hitTest`); dragging an interactive handle writes its bound
 * signal, which the reactive engine turns into recomputed geometry on the next
 * frame.
 */
import {
  type HitEntry,
  type InteractiveTrait,
  type RenderSnapshot,
  findTrait,
} from "@intermact/core";

/** An orthographic frustum in world units. */
export interface OrthoFrustum {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Un-project a pixel coordinate to world space under an ortho frustum. */
export function unprojectOrtho(
  frustum: OrthoFrustum,
  width: number,
  height: number,
  px: number,
  py: number,
): [number, number] {
  const x = frustum.left + (px / width) * (frustum.right - frustum.left);
  const y = frustum.top - (py / height) * (frustum.top - frustum.bottom);
  return [x, y];
}

/** Project a world coordinate to pixel space under an ortho frustum. */
export function projectOrtho(
  frustum: OrthoFrustum,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number] {
  const px = ((x - frustum.left) / (frustum.right - frustum.left)) * width;
  const py = ((frustum.top - y) / (frustum.top - frustum.bottom)) * height;
  return [px, py];
}

/** Collect hit-test candidates (interactive objects) from a snapshot. */
export function collectHitEntries(snapshot: RenderSnapshot): HitEntry[] {
  const entries: HitEntry[] = [];
  for (const [id, render] of snapshot.objects) {
    const state = render.state;
    if (state.dimension !== "2d") continue;
    if (!state.visible) continue;
    const trait = findTrait(render.object.traits, "interactive") as InteractiveTrait | undefined;
    if (!trait) continue;
    entries.push({
      id,
      proxy: trait.pick,
      transform: state.transform,
      zIndex: state.transform.zIndex,
    });
  }
  return entries;
}

/** Look up the interactive trait of an object id in a snapshot. */
export function interactiveTraitOf(
  snapshot: RenderSnapshot,
  id: string,
): InteractiveTrait | undefined {
  const render = snapshot.objects.get(id);
  if (!render) return undefined;
  return findTrait(render.object.traits, "interactive") as InteractiveTrait | undefined;
}
