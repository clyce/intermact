import {
  type AbsXY,
  type AbsXYZ,
  type Quaternion,
  type Vec2,
  type Vec3,
  xy,
  xyz,
} from "../math/vec";
import { QUAT_IDENTITY, quatFromEuler } from "../math/quaternion";
import { type StrokeRevealMode } from "../animation/spec";
import { IntermactError } from "../errors";
import { type ObjectStyle } from "../object/style";
import { type Transform2D, type Transform3D } from "../scene/transform";

/**
 * Runtime state and immutable patches (design.md §4.3). Definitions are
 * immutable, but each RegisteredObject has a per-frame runtime state. The Player
 * merges active tracks' StatePatch into the state store each frame; the renderer
 * diffs consecutive frames.
 */

/** Fully resolved 2D world transform (parents already applied). */
export interface ResolvedTransform2D {
  readonly position: AbsXY;
  /** Rotation in radians. */
  readonly rotation: number;
  readonly scale: Vec2;
  readonly zIndex: number;
}

/** A single contour override used during morph or reactive rebuild preview. */
export interface GeometryOverrideContour {
  readonly points: Float32Array;
  readonly closed: boolean;
}

/** Runtime geometry override (e.g. arc-length morph in flight). */
export interface GeometryOverride {
  readonly contours: readonly GeometryOverrideContour[];
  readonly fillRule?: "nonzero" | "evenodd";
}

/** Per-glyph stroke window on the global reveal timeline (sequential write). */
export interface GlyphRevealSpan {
  readonly start: number;
  readonly end: number;
}

/** Per-frame runtime state for a 2D registered object. */
export interface RuntimeState2D {
  /** Discriminator for the {@link RuntimeState} union. */
  readonly dimension: "2d";
  readonly visible: boolean;
  readonly opacity: number;
  readonly transform: ResolvedTransform2D;
  /** Stroke reveal interval [start,end] in [0,1] for Create/trim. */
  readonly revealStart: number;
  readonly revealEnd: number;
  /** Fill reveal progress in [0,1]. */
  readonly fillProgress: number;
  readonly styleOverrides?: Partial<ObjectStyle>;
  /** When set, renderer samples these contours instead of the object traits. */
  readonly geometryOverride?: GeometryOverride | null;
  /** Bumped when geometry is recomputed (by updaters), triggering resampling. */
  readonly geometryVersion: number;
  /** Per-glyph stroke windows for sequential `write()` (set at compile time). */
  readonly glyphWriteSpans?: readonly GlyphRevealSpan[];
  /** Stroke reveal mode chosen by the active `create` animation (compile time). */
  readonly strokeRevealMode?: StrokeRevealMode;
}

/** A deep-partial update to a 2D runtime state. */
export interface RuntimeState2DPatch {
  visible?: boolean;
  opacity?: number;
  transform?: Partial<ResolvedTransform2D>;
  revealStart?: number;
  revealEnd?: number;
  fillProgress?: number;
  styleOverrides?: Partial<ObjectStyle>;
  geometryOverride?: GeometryOverride | null;
  geometryVersion?: number;
  glyphWriteSpans?: readonly GlyphRevealSpan[];
  strokeRevealMode?: StrokeRevealMode;
}

/** An immutable incremental update targeting one object's runtime state. */
export interface StatePatch {
  readonly targetId: string;
  readonly changes: RuntimeState2DPatch | RuntimeState3DPatch;
}

const DEFAULT_SCALE: Vec2 = [1, 1];
const DEFAULT_SCALE_3D: Vec3 = [1, 1, 1];

/** Build the initial runtime state from an object's authoring transform. */
export function createInitialState2D(transform?: Transform2D): RuntimeState2D {
  const scale = normalizeScale(transform?.scale);
  return {
    dimension: "2d",
    visible: true,
    opacity: transform?.opacity ?? 1,
    transform: {
      position: transform?.position ?? xy(0, 0),
      rotation: transform?.rotation ?? 0,
      scale,
      zIndex: transform?.zIndex ?? 0,
    },
    revealStart: 0,
    revealEnd: 1,
    fillProgress: 1,
    geometryOverride: null,
    geometryVersion: 0,
  };
}

/** Normalize a scalar-or-tuple scale into a Vec2. */
export function normalizeScale(scale: Vec2 | number | undefined): Vec2 {
  if (scale === undefined) return DEFAULT_SCALE;
  return typeof scale === "number" ? [scale, scale] : scale;
}

/**
 * Apply an immutable patch, returning a new RuntimeState2D (structural sharing
 * for unchanged branches). Order-independent merge of known fields.
 */
export function applyPatch2D(state: RuntimeState2D, changes: RuntimeState2DPatch): RuntimeState2D {
  const transform = changes.transform
    ? {
        position: changes.transform.position ?? state.transform.position,
        rotation: changes.transform.rotation ?? state.transform.rotation,
        scale: changes.transform.scale ?? state.transform.scale,
        zIndex: changes.transform.zIndex ?? state.transform.zIndex,
      }
    : state.transform;

  return {
    dimension: "2d",
    visible: changes.visible ?? state.visible,
    opacity: changes.opacity ?? state.opacity,
    transform,
    revealStart: changes.revealStart ?? state.revealStart,
    revealEnd: changes.revealEnd ?? state.revealEnd,
    fillProgress: changes.fillProgress ?? state.fillProgress,
    styleOverrides: changes.styleOverrides
      ? { ...state.styleOverrides, ...changes.styleOverrides }
      : state.styleOverrides,
    geometryOverride:
      changes.geometryOverride !== undefined ? changes.geometryOverride : state.geometryOverride,
    geometryVersion: changes.geometryVersion ?? state.geometryVersion,
    glyphWriteSpans: changes.glyphWriteSpans ?? state.glyphWriteSpans,
    strokeRevealMode: changes.strokeRevealMode ?? state.strokeRevealMode,
  };
}

/** Fully resolved 3D world transform (parents already applied). */
export interface ResolvedTransform3D {
  readonly position: AbsXYZ;
  /** Orientation as a unit quaternion `[x,y,z,w]` (design.md §10.1). */
  readonly rotation: Quaternion;
  readonly scale: Vec3;
  /** Explicit draw order (mirrors 2D zIndex). */
  readonly renderOrder: number;
}

/** Per-frame runtime state for a 3D registered object. */
export interface RuntimeState3D {
  /** Discriminator for the {@link RuntimeState} union. */
  readonly dimension: "3d";
  readonly visible: boolean;
  readonly opacity: number;
  readonly transform: ResolvedTransform3D;
  /** Reveal interval [start,end] in [0,1] for 3D Create (line trim / draw range). */
  readonly revealStart: number;
  readonly revealEnd: number;
  readonly styleOverrides?: Partial<ObjectStyle>;
  /** Bumped when geometry is recomputed, triggering renderer resampling. */
  readonly geometryVersion: number;
  /** Per-group stroke windows for sequential axes `create()` (compile time). */
  readonly glyphWriteSpans?: readonly GlyphRevealSpan[];
  /** Stroke reveal mode chosen by the active `create` animation (compile time). */
  readonly strokeRevealMode?: StrokeRevealMode;
}

/** A deep-partial update to a 3D runtime state. */
export interface RuntimeState3DPatch {
  visible?: boolean;
  opacity?: number;
  transform?: Partial<ResolvedTransform3D>;
  revealStart?: number;
  revealEnd?: number;
  styleOverrides?: Partial<ObjectStyle>;
  geometryVersion?: number;
  glyphWriteSpans?: readonly GlyphRevealSpan[];
  strokeRevealMode?: StrokeRevealMode;
}

/** Discriminated union of 2D and 3D runtime states (design.md §4.3, §5.3). */
export type RuntimeState = RuntimeState2D | RuntimeState3D;

/** Normalize a scalar-or-tuple 3D scale into a Vec3. */
export function normalizeScale3(scale: Vec3 | number | undefined): Vec3 {
  if (scale === undefined) return DEFAULT_SCALE_3D;
  return typeof scale === "number" ? [scale, scale, scale] : scale;
}

/** Convert a {@link Transform3D} rotation (Euler or quaternion) to a quaternion. */
export function resolveRotation3D(rotation: Transform3D["rotation"]): Quaternion {
  if (!rotation) return QUAT_IDENTITY;
  if (Array.isArray(rotation)) {
    if (rotation.length !== 4) {
      throw new IntermactError(
        "invalid-argument",
        `Quaternion rotation must have 4 components, got ${rotation.length} ` +
          `(did you pass a Vec3? Use an {x,y,z} Euler object for Euler angles).`,
      );
    }
    return rotation as Quaternion;
  }
  const euler = rotation as { x: number; y: number; z: number };
  return quatFromEuler(euler.x, euler.y, euler.z);
}

/** Build the initial 3D runtime state from an authoring transform. */
export function createInitialState3D(transform?: Transform3D): RuntimeState3D {
  return {
    dimension: "3d",
    visible: true,
    opacity: transform?.opacity ?? 1,
    transform: {
      position: transform?.position ?? xyz(0, 0, 0),
      rotation: resolveRotation3D(transform?.rotation),
      scale: normalizeScale3(transform?.scale),
      renderOrder: transform?.renderOrder ?? 0,
    },
    revealStart: 0,
    revealEnd: 1,
    geometryVersion: 0,
  };
}

/** Apply an immutable patch to a 3D runtime state (structural sharing). */
export function applyPatch3D(state: RuntimeState3D, changes: RuntimeState3DPatch): RuntimeState3D {
  const transform = changes.transform
    ? {
        position: changes.transform.position ?? state.transform.position,
        rotation: changes.transform.rotation ?? state.transform.rotation,
        scale: changes.transform.scale ?? state.transform.scale,
        renderOrder: changes.transform.renderOrder ?? state.transform.renderOrder,
      }
    : state.transform;
  return {
    dimension: "3d",
    visible: changes.visible ?? state.visible,
    opacity: changes.opacity ?? state.opacity,
    transform,
    revealStart: changes.revealStart ?? state.revealStart,
    revealEnd: changes.revealEnd ?? state.revealEnd,
    styleOverrides: changes.styleOverrides
      ? { ...state.styleOverrides, ...changes.styleOverrides }
      : state.styleOverrides,
    geometryVersion: changes.geometryVersion ?? state.geometryVersion,
    glyphWriteSpans: changes.glyphWriteSpans ?? state.glyphWriteSpans,
    strokeRevealMode: changes.strokeRevealMode ?? state.strokeRevealMode,
  };
}
