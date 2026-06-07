import { type Easing } from "./easing";
import { type IMObject2D } from "../object/types";

/**
 * Animation as data + interpreter (design.md §11.1). Animations are pure
 * descriptions (specs), not objects with side-effectful `tick`. This yields
 * composability, serializability, seekability, and testability. The Player
 * compiles specs into pure `Track`s.
 */

/** Common options for tween-based animations (design.md §11.4). */
export interface TweenOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  /** Delay before the tween starts (seconds). */
  readonly delay?: number;
  /** Clamp progress to [0,1] (default true; reserved for M4 extrapolation). */
  readonly clamp?: boolean;
}

/** Addressable runtime-state property targeted by a tween. */
export type PropertyPath =
  | { readonly type: "transform"; readonly key: "position" | "rotation" | "scale" }
  | { readonly type: "opacity" }
  | { readonly type: "style"; readonly key: string }
  | { readonly type: "reveal" }
  | { readonly type: "fill" };

/** Stroke reveal description for `Create` (detailed in M4). */
export interface StrokeRevealSpec {
  readonly mode?: "path-order" | "contour-parallel";
}

/** Fill reveal description for `Create` (detailed in M4). */
export interface FillRevealSpec {
  readonly mode?: "after-stroke-fade" | "during-stroke" | "scanline";
  readonly overlap?: number;
}

/** Morph strategy (design.md §11.4). */
export type MorphStrategy = "arc-length" | "anchor" | "matching" | "cross-fade";

/** Options for {@link morph}. */
export interface MorphOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly sampleCount?: number;
  readonly strategy?: MorphStrategy;
  readonly preserveStyle?: boolean;
}

/** Serializable reference to a target object definition (for morph). */
export interface SerializableObjectRef {
  readonly type: string;
  readonly payload?: unknown;
}

/** The discriminated union of all animation specs. */
export type AnimationSpec =
  | {
      readonly kind: "tween";
      readonly targetId: string;
      readonly property: PropertyPath;
      readonly from?: unknown;
      readonly to: unknown;
      readonly duration: number;
      readonly easing?: Easing;
    }
  | {
      readonly kind: "create";
      readonly targetId: string;
      readonly duration: number;
      readonly stroke?: StrokeRevealSpec;
      readonly fill?: FillRevealSpec;
      readonly easing?: Easing;
    }
  | {
      readonly kind: "morph";
      readonly targetId: string;
      /** Target object definition (v0.1 embeds the full object; serialization in M15). */
      readonly toObject: IMObject2D;
      readonly strategy: MorphStrategy;
      readonly duration: number;
      readonly easing?: Easing;
      readonly sampleCount?: number;
      readonly preserveStyle?: boolean;
    }
  | {
      readonly kind: "tween-signal";
      /** Internal id assigned by {@link signal} at creation time. */
      readonly signalId: number;
      readonly from: number;
      readonly to: number;
      readonly duration: number;
      readonly easing?: Easing;
    }
  | {
      readonly kind: "fade";
      readonly targetId: string;
      readonly to: number;
      readonly duration: number;
      readonly easing?: Easing;
    }
  | { readonly kind: "sequence"; readonly children: readonly AnimationSpec[] }
  | { readonly kind: "parallel"; readonly children: readonly AnimationSpec[] }
  | { readonly kind: "stagger"; readonly children: readonly AnimationSpec[]; readonly lag: number }
  | { readonly kind: "repeat"; readonly child: AnimationSpec; readonly times: number | "infinite" }
  | { readonly kind: "wait"; readonly duration: number }
  | { readonly kind: "call"; readonly effect: () => void | Promise<void> };

/**
 * Public animation handle: carries a spec, its total duration, and the set of
 * target ids it touches. Returned by factories/animation methods; not executed
 * directly. Compiled into Tracks when added to a Storyboard.
 */
export interface Animation {
  readonly spec: AnimationSpec;
  readonly duration: number;
  readonly targets: readonly string[];
}

/** Compute the total duration of a spec tree. */
export function specDuration(spec: AnimationSpec): number {
  switch (spec.kind) {
    case "tween":
    case "create":
    case "morph":
    case "fade":
    case "tween-signal":
    case "wait":
      return spec.duration;
    case "call":
      return 0;
    case "sequence":
      return spec.children.reduce((sum, child) => sum + specDuration(child), 0);
    case "parallel":
      return spec.children.reduce((max, child) => Math.max(max, specDuration(child)), 0);
    case "stagger": {
      let max = 0;
      spec.children.forEach((child, i) => {
        max = Math.max(max, i * spec.lag + specDuration(child));
      });
      return max;
    }
    case "repeat": {
      const inner = specDuration(spec.child);
      return spec.times === "infinite" ? Infinity : inner * spec.times;
    }
  }
}

/** Collect all target ids referenced by a spec tree. */
export function specTargets(spec: AnimationSpec): string[] {
  const out = new Set<string>();
  const visit = (s: AnimationSpec): void => {
    switch (s.kind) {
      case "tween":
      case "create":
      case "morph":
      case "fade":
        out.add(s.targetId);
        break;
      case "tween-signal":
        break;
      case "sequence":
      case "parallel":
      case "stagger":
        s.children.forEach(visit);
        break;
      case "repeat":
        visit(s.child);
        break;
      case "wait":
      case "call":
        break;
    }
  };
  visit(spec);
  return [...out];
}

/** Wrap a spec into an Animation handle. */
export function toAnimation(spec: AnimationSpec): Animation {
  return { spec, duration: specDuration(spec), targets: specTargets(spec) };
}
