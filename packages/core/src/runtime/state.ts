import { type AbsXY, type Vec2, xy } from "../math/vec";
import { type ObjectStyle } from "../object/style";
import { type Transform2D } from "../scene/transform";

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

/** Per-frame runtime state for a 2D registered object. */
export interface RuntimeState2D {
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
}

/** An immutable incremental update targeting one object's runtime state. */
export interface StatePatch {
  readonly targetId: string;
  readonly changes: RuntimeState2DPatch;
}

const DEFAULT_SCALE: Vec2 = [1, 1];

/** Build the initial runtime state from an object's authoring transform. */
export function createInitialState2D(transform?: Transform2D): RuntimeState2D {
  const scale = normalizeScale(transform?.scale);
  return {
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
  };
}
