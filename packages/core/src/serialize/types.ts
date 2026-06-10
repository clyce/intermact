import { type EasingName } from "../animation/easing";
import { type SerializedCameraMeta } from "../animation/player";
import { type FillRevealSpec, type StrokeRevealSpec } from "../animation/spec";
import { type RuntimeState } from "../runtime/state";

export { type SerializedCameraMeta };

/**
 * Serialization data model (design.md §17). A {@link SerializedProject} is a
 * plain-JSON description of a built program — baked object geometry, the timeline
 * op-log (as serializable {@link SerializedSpec}s), baseline signal values, and
 * the seed — sufficient to reconstruct an equivalent {@link Player} **without
 * re-running the user program**. This resolves the Phase-1 serialization debts:
 * easings degrade to names, `morph` embeds a baked target, and non-serializable
 * escape hatches (`call`) are dropped (degrade) or rejected (strict).
 */

/** Format version; bumped on breaking schema changes. */
export const SERIALIZED_VERSION = "1";

/** A baked 2D contour: flat `[x0,y0,x1,y1,...]` + closed flag. */
export interface SerializedContour2D {
  readonly points: readonly number[];
  readonly closed: boolean;
}

/** Baked 2D geometry (contours + optional per-glyph fill groups). */
export interface SerializedGeometry2D {
  readonly kind: "2d";
  readonly contours: readonly SerializedContour2D[];
  readonly fillable: boolean;
  readonly fillRule?: "nonzero" | "evenodd";
  readonly morphable: boolean;
  /** Morph sampling resolution captured from the source (avoids a hardcoded default). */
  readonly morphSamples?: number;
  readonly fillGroups?: readonly (readonly SerializedContour2D[])[];
  readonly contourGlyphIndex?: readonly number[];
  readonly fillGroupColors?: readonly string[];
}

/** Baked 3D geometry (line / mesh / points channel). */
export type SerializedGeometry3D =
  | {
      readonly kind: "3d-line";
      readonly lines: readonly { readonly points: readonly number[]; readonly closed: boolean }[];
    }
  | {
      readonly kind: "3d-mesh";
      readonly positions: readonly number[];
      readonly indices: readonly number[];
      readonly normals?: readonly number[];
    }
  | {
      readonly kind: "3d-points";
      readonly positions: readonly number[];
      readonly scalars?: readonly number[];
    };

/** Baked geometry of either dimension. */
export type SerializedGeometry = SerializedGeometry2D | SerializedGeometry3D;

/** A baked, fully serializable object definition. */
export interface SerializedObject {
  readonly id: string;
  readonly type: string;
  readonly dimension: "2d" | "3d";
  readonly geometry: SerializedGeometry;
  readonly style?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  /** Baseline runtime state (pristine, pre compile-time baseline patches). */
  readonly initialState: RuntimeState;
  /** Parent id in the transform hierarchy (design.md §9.3). */
  readonly parentId?: string;
  /** Keyed sub-parts for composites / morph matching (recursively baked). */
  readonly parts?: readonly { readonly key: string; readonly object: SerializedObject }[];
}

/** A serializable {@link PropertyPath} (identical shape; JSON-safe). */
export type SerializedPropertyPath =
  | {
      readonly type: "transform";
      readonly key: "position" | "rotation" | "scale";
      readonly space?: "2d" | "3d";
    }
  | { readonly type: "opacity" }
  | { readonly type: "style"; readonly key: string }
  | { readonly type: "reveal" }
  | { readonly type: "fill" };

/**
 * A serializable animation spec. Mirrors {@link AnimationSpec} but with all
 * non-serializable members resolved: easings become {@link EasingName}s, `morph`
 * carries a baked {@link SerializedObject}, and `call`/function `matchBy` are
 * dropped. `tween-signal` is preserved for timeline-duration fidelity.
 */
export type SerializedSpec =
  | {
      readonly kind: "tween";
      readonly targetId: string;
      readonly property: SerializedPropertyPath;
      readonly from?: unknown;
      readonly to: unknown;
      readonly duration: number;
      readonly easing?: EasingName;
    }
  | {
      readonly kind: "create";
      readonly targetId: string;
      readonly duration: number;
      readonly stroke?: StrokeRevealSpec;
      readonly fill?: FillRevealSpec;
      readonly easing?: EasingName;
    }
  | {
      readonly kind: "morph";
      readonly targetId: string;
      readonly toObject: SerializedObject;
      readonly strategy: "arc-length" | "anchor" | "matching" | "cross-fade";
      readonly duration: number;
      readonly easing?: EasingName;
      readonly sampleCount?: number;
      readonly preserveStyle?: boolean;
    }
  | {
      readonly kind: "tween-signal";
      readonly signalId: number;
      readonly from: number;
      readonly to: number;
      readonly duration: number;
      readonly easing?: EasingName;
    }
  | {
      readonly kind: "fade";
      readonly targetId: string;
      readonly from?: number;
      readonly to: number;
      readonly duration: number;
      readonly easing?: EasingName;
    }
  | { readonly kind: "sequence"; readonly children: readonly SerializedSpec[] }
  | { readonly kind: "parallel"; readonly children: readonly SerializedSpec[] }
  | { readonly kind: "stagger"; readonly children: readonly SerializedSpec[]; readonly lag: number }
  | { readonly kind: "repeat"; readonly child: SerializedSpec; readonly times: number | "infinite" }
  | { readonly kind: "wait"; readonly duration: number }
  | {
      /**
       * Plugin animation (design.md §18). Re-resolved at deserialize time by the
       * `AnimationCompiler` registered under `type`; `params` must be JSON-safe.
       */
      readonly kind: "custom";
      readonly type: string;
      readonly targetId?: string;
      readonly params?: unknown;
      readonly duration: number;
    };

/** A serializable timeline op (the op-log entry, design.md §17). */
export type SerializedOp =
  | { readonly op: "play"; readonly specs: readonly SerializedSpec[] }
  | { readonly op: "commit"; readonly specs: readonly SerializedSpec[] }
  | { readonly op: "wait"; readonly duration: number }
  | { readonly op: "marker"; readonly name: string };

/** The serialized timeline (op-log + duration for quick inspection). */
export interface SerializedStoryboard {
  readonly ops: readonly SerializedOp[];
  readonly duration: number;
}

/** A complete serialized project (design.md §17). */
export interface SerializedProject {
  readonly version: string;
  readonly seed: number | string;
  readonly scene: { readonly kind: "scene-2d" | "scene-3d"; readonly props: unknown };
  readonly objects: readonly SerializedObject[];
  readonly storyboard: SerializedStoryboard;
  readonly signals: Readonly<Record<string, unknown>>;
  /** Registered 3D cameras (empty for 2D scenes). */
  readonly cameras: readonly SerializedCameraMeta[];
}

/** Options controlling {@link serialize} behavior. */
export interface SerializeOptions {
  /**
   * How to handle non-serializable members (design.md §17). `"degrade"` (default)
   * drops `call` effects and replaces function easings with `"linear"`;
   * `"strict"` throws an {@link IntermactError} (`serialization-error`).
   */
  readonly mode?: "degrade" | "strict";
}
