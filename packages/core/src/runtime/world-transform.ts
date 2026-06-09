import { type AbsXY, type Vec2, xy } from "../math/vec";
import { type Bounds2D } from "../object/geometry-provider";
import { type Transform2D } from "../scene/transform";
import { normalizeScale, type ResolvedTransform2D } from "./state";

/**
 * World-transform algebra for the 2D transform hierarchy (design.md §9.3).
 * Pure functions over {@link ResolvedTransform2D} — no scene/animation deps — so
 * both the Player (snapshot composition) and the layout handles can share them.
 */

/** Identity transform (root parent). */
export const IDENTITY_TRANSFORM_2D: ResolvedTransform2D = {
  position: xy(0, 0),
  rotation: 0,
  scale: [1, 1],
  zIndex: 0,
};

/** Normalize an authoring {@link Transform2D} into a fully resolved transform. */
export function resolveTransform2D(t: Transform2D | undefined): ResolvedTransform2D {
  return {
    position: t?.position ?? xy(0, 0),
    rotation: t?.rotation ?? 0,
    scale: normalizeScale(t?.scale),
    zIndex: t?.zIndex ?? 0,
  };
}

/**
 * Compose a child's local transform under its parent's world transform:
 * `world(p) = parent(child(p))` (TRS, no shear). zIndex is taken from the child.
 */
export function composeTransform2D(
  parent: ResolvedTransform2D,
  child: ResolvedTransform2D,
): ResolvedTransform2D {
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);
  const sx = parent.scale[0] * child.position[0];
  const sy = parent.scale[1] * child.position[1];
  return {
    position: xy(
      parent.position[0] + cos * sx - sin * sy,
      parent.position[1] + sin * sx + cos * sy,
    ),
    rotation: parent.rotation + child.rotation,
    scale: [parent.scale[0] * child.scale[0], parent.scale[1] * child.scale[1]],
    zIndex: child.zIndex,
  };
}

/** Map a world point into a transform's local space (inverse TRS). */
export function worldPointToLocal(t: ResolvedTransform2D, world: AbsXY): AbsXY {
  const dx = world[0] - t.position[0];
  const dy = world[1] - t.position[1];
  const cos = Math.cos(-t.rotation);
  const sin = Math.sin(-t.rotation);
  const rx = cos * dx - sin * dy;
  const ry = sin * dx + cos * dy;
  const sx = t.scale[0] || 1;
  const sy = t.scale[1] || 1;
  return xy(rx / sx, ry / sy);
}

/** Rotate/scale a world delta vector into a transform's local space (no translation). */
export function worldDeltaToLocal(t: ResolvedTransform2D, delta: AbsXY): AbsXY {
  const cos = Math.cos(-t.rotation);
  const sin = Math.sin(-t.rotation);
  const rx = cos * delta[0] - sin * delta[1];
  const ry = sin * delta[0] + cos * delta[1];
  return xy(rx / (t.scale[0] || 1), ry / (t.scale[1] || 1));
}

/** Map a world AABB of `local` bounds through a transform, returning a new world AABB. */
export function transformBounds(local: Bounds2D, t: ResolvedTransform2D): Bounds2D {
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  const corners: readonly Vec2[] = [
    [local.min[0], local.min[1]],
    [local.max[0], local.min[1]],
    [local.max[0], local.max[1]],
    [local.min[0], local.max[1]],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of corners) {
    const sx = t.scale[0] * lx;
    const sy = t.scale[1] * ly;
    const wx = t.position[0] + cos * sx - sin * sy;
    const wy = t.position[1] + sin * sx + cos * sy;
    if (wx < minX) minX = wx;
    if (wy < minY) minY = wy;
    if (wx > maxX) maxX = wx;
    if (wy > maxY) maxY = wy;
  }
  return {
    min: xy(minX, minY),
    max: xy(maxX, maxY),
    size: [maxX - minX, maxY - minY],
    center: xy((minX + maxX) / 2, (minY + maxY) / 2),
  };
}
