import {
  type PathSampleOptions,
  type SampledContour2D,
  type SampledPath2D,
} from "./geometry-provider";
import { type AbsXY } from "../math/vec";

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

/** Object exposes pick proxy geometry and is draggable (M11). */
export interface InteractiveTrait {
  readonly kind: "interactive";
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
  | InteractiveTrait
  | InstancedTrait;

/** Map a trait's `kind` to its concrete interface, for `findTrait` typing. */
export interface TraitByKind {
  stroke: StrokeTrait;
  fill: FillTrait;
  morphable: MorphableTrait;
  parametric: ParametricTrait;
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
