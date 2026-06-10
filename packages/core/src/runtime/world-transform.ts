import { type AbsXY, type Vec2, type Vec3, xy, xyz } from "../math/vec";
import { QUAT_IDENTITY, quatMultiply, quatRotateVec3 } from "../math/quaternion";
import { type Bounds2D } from "../object/geometry-provider";
import { type Transform2D, type Transform3D } from "../scene/transform";
import {
  normalizeScale,
  normalizeScale3,
  resolveRotation3D,
  type ResolvedTransform2D,
  type ResolvedTransform3D,
} from "./state";

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

/** Identity 3D transform (root parent). */
export const IDENTITY_TRANSFORM_3D: ResolvedTransform3D = {
  position: xyz(0, 0, 0),
  rotation: QUAT_IDENTITY,
  scale: [1, 1, 1],
  renderOrder: 0,
};

/** Normalize an authoring {@link Transform3D} into a fully resolved transform. */
export function resolveTransform3D(t: Transform3D | undefined): ResolvedTransform3D {
  return {
    position: t?.position ?? xyz(0, 0, 0),
    rotation: resolveRotation3D(t?.rotation),
    scale: normalizeScale3(t?.scale),
    renderOrder: t?.renderOrder ?? 0,
  };
}

/**
 * Compose a child's local 3D transform under its parent's world transform
 * (TRS, no shear): `world(p) = parent.pos + parent.rot · (parent.scale * child)`.
 */
export function composeTransform3D(
  parent: ResolvedTransform3D,
  child: ResolvedTransform3D,
): ResolvedTransform3D {
  const scaled: Vec3 = [
    parent.scale[0] * child.position[0],
    parent.scale[1] * child.position[1],
    parent.scale[2] * child.position[2],
  ];
  const rotated = quatRotateVec3(parent.rotation, scaled);
  return {
    position: xyz(
      parent.position[0] + rotated[0],
      parent.position[1] + rotated[1],
      parent.position[2] + rotated[2],
    ),
    rotation: quatMultiply(parent.rotation, child.rotation),
    scale: [
      parent.scale[0] * child.scale[0],
      parent.scale[1] * child.scale[1],
      parent.scale[2] * child.scale[2],
    ],
    renderOrder: child.renderOrder,
  };
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
