import { findTrait } from "../object/traits";
import { type IMObject2D } from "../object/types";
import { resampleByArcLength } from "../geometry/sampling";
import { type Animation, type MorphOptions, toAnimation } from "./spec";

const DEFAULT_MORPH_SAMPLES = 64;

/** Minimal morph source: a registered object's id. */
export interface MorphSource {
  readonly id: string;
}

/**
 * Morph a registered object toward a target definition (design.md §11.4).
 * v0.1 implements `arc-length` and `cross-fade` strategies; matching lands in M9.
 */
export function morph(source: MorphSource, target: IMObject2D, options?: MorphOptions): Animation {
  const spec = {
    kind: "morph" as const,
    targetId: source.id,
    toObject: target,
    strategy: options?.strategy ?? "arc-length",
    duration: options?.duration ?? 1,
    ...(options?.easing !== undefined ? { easing: options.easing } : {}),
    sampleCount: options?.sampleCount ?? DEFAULT_MORPH_SAMPLES,
    preserveStyle: options?.preserveStyle ?? false,
  };
  return toAnimation(spec);
}

/** Sample and align morphable contours from source/target for arc-length morph. */
export function alignMorphContours(
  source: IMObject2D,
  target: IMObject2D,
  sampleCount: number,
): { readonly from: Float32Array[]; readonly to: Float32Array[]; readonly closed: boolean[] } {
  const srcTrait = findTrait(source.traits, "morphable");
  const tgtTrait = findTrait(target.traits, "morphable");
  if (!srcTrait || !tgtTrait) {
    throw new Error("Both morph source and target must expose the morphable trait.");
  }
  const fromContours = srcTrait.normalizedContours();
  const toContours = tgtTrait.normalizedContours();
  const count = Math.max(fromContours.length, toContours.length, 1);
  const from: Float32Array[] = [];
  const to: Float32Array[] = [];
  const closed: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const fc = fromContours[i] ?? fromContours[0]!;
    const tc = toContours[i] ?? toContours[0]!;
    from.push(resampleByArcLength(fc.points, fc.closed, sampleCount));
    to.push(resampleByArcLength(tc.points, tc.closed, sampleCount));
    closed.push(fc.closed || tc.closed);
  }
  return { from, to, closed };
}
