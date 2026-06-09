import {
  type PathSampleOptions,
  type SampledContour2D,
  type SampledPath2D,
} from "./geometry-provider";
import { type AbsXY } from "../math/vec";
import { type DragBinding, type PickProxy, type PointerEventBinding } from "../interaction/types";

/**
 * Trait / capability composition (design.md §4.2). To favor "atomic composition
 * over inheritance" (user rule), object behavior is a set of traits and the
 * animation/render layers query capabilities rather than testing concrete types.
 * A new object type = a new combination of existing traits.
 */

/** Object can be stroked: provides an ordered sampled path. */
export interface StrokeTrait {
  readonly kind: "stroke";
  samplePath(opts?: PathSampleOptions): SampledPath2D;
}

/** Object can be filled: provides closed contours + a fill rule. */
export interface FillTrait {
  readonly kind: "fill";
  readonly fillRule: "nonzero" | "evenodd";
  contours(opts?: PathSampleOptions): readonly SampledContour2D[];
  /** Per-glyph groups when present (preferred for text fill). */
  fillGroups?(opts?: PathSampleOptions): readonly (readonly SampledContour2D[])[] | undefined;
  contourGlyphIndex?(): readonly number[] | undefined;
}

/** A normalized contour used for morph point alignment. */
export interface NormalizedContour {
  readonly points: Float32Array;
  readonly closed: boolean;
}

/** Anchor used to force-align corresponding features during morph. */
export interface MorphAnchor {
  readonly source: AbsXY;
  readonly target: AbsXY;
}

/** Object can act as a morph source/target. */
export interface MorphableTrait {
  readonly kind: "morphable";
  normalizedContours(): readonly NormalizedContour[];
  morphAnchors?(): readonly MorphAnchor[];
}

/** Object is defined by parameter functions; geometry recomputes on change. */
export interface ParametricTrait {
  readonly kind: "parametric";
}

/** A laid-out text/LaTeX token mapped to a part key (design.md §13). */
export interface TextToken {
  /** Matching key (token/sub-expression id) used by `transformMatchingTex`. */
  readonly key: string;
  /** Source text/atom this token renders. */
  readonly text: string;
}

/** Object carries text/LaTeX glyph layout with token → part keys (design.md §13). */
export interface TextLayoutTrait {
  readonly kind: "text-layout";
  tokens(): readonly TextToken[];
  /** Flat contour index → glyph (token) index. */
  contourGlyphIndex(): readonly number[];
  /** Glyph indices in left-to-right writing order. */
  glyphOrder(): readonly number[];
}

/** Object exposes pick-proxy geometry and pointer/drag bindings (M11, §12). */
export interface InteractiveTrait {
  readonly kind: "interactive";
  /** Invisible hit-test geometry in local space. */
  readonly pick: PickProxy;
  /** Pointer/drag callbacks. */
  readonly binding?: PointerEventBinding;
  /** Signal-backed drag behavior the host wires (draggablePoint/Value). */
  readonly drag?: DragBinding;
  /** Optional CSS cursor hint for the renderer. */
  readonly cursor?: string;
}

/** Single geometry instanced across many transforms (M16). */
export interface InstancedTrait {
  readonly kind: "instanced";
}

/** Discriminated union of all object traits. */
export type ObjectTrait =
  | StrokeTrait
  | FillTrait
  | MorphableTrait
  | ParametricTrait
  | TextLayoutTrait
  | InteractiveTrait
  | InstancedTrait;

/** Map a trait's `kind` to its concrete interface, for `findTrait` typing. */
export interface TraitByKind {
  stroke: StrokeTrait;
  fill: FillTrait;
  morphable: MorphableTrait;
  parametric: ParametricTrait;
  "text-layout": TextLayoutTrait;
  interactive: InteractiveTrait;
  instanced: InstancedTrait;
}

/**
 * Capability query: find a trait by kind, typed to its concrete interface.
 * Returns `undefined` when the object lacks the capability.
 */
export function findTrait<K extends ObjectTrait["kind"]>(
  traits: readonly ObjectTrait[],
  kind: K,
): TraitByKind[K] | undefined {
  return traits.find((t): t is Extract<ObjectTrait, { kind: K }> => t.kind === kind) as
    | TraitByKind[K]
    | undefined;
}

/** Whether an object advertises a given trait. */
export function hasTrait(traits: readonly ObjectTrait[], kind: ObjectTrait["kind"]): boolean {
  return traits.some((t) => t.kind === kind);
}
