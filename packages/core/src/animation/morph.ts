import { findTrait, type NormalizedContour } from "../object/traits";
import { type IMObject2D, type ObjectPart2D } from "../object/types";
import { cumulativeLengths, resampleByArcLength } from "../geometry/sampling";
import { IntermactError } from "../errors";
import { type Animation, type MatchByFn, type MorphOptions, toAnimation } from "./spec";

const DEFAULT_MORPH_SAMPLES = 64;

/** Minimal morph source: a registered object's id. */
export interface MorphSource {
  readonly id: string;
}

/**
 * Morph a registered object toward a target definition (design.md §11.4).
 * Strategies: `arc-length` (point-aligned), `anchor` (best cyclic rotation),
 * `matching` (per-part transformer/remover/introducer), `cross-fade` (dissolve).
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
    ...(options?.matchBy !== undefined ? { matchBy: options.matchBy } : {}),
    preserveStyle: options?.preserveStyle ?? false,
  };
  return toAnimation(spec);
}

/**
 * Part-aware morph between composite objects (design.md §11.4). Sugar for
 * `morph(source, target, { strategy: "matching", ... })`; matched part keys are
 * transformed, source-only keys collapse (remover), target-only keys grow
 * (introducer). For LaTeX (M10) keys default to token/sub-expression ids.
 */
export function transformMatching(
  source: MorphSource,
  target: IMObject2D,
  options?: MorphOptions,
): Animation {
  return morph(source, target, { ...options, strategy: "matching" });
}

/** A set of point-aligned contour pairs ready for per-frame `lerp`. */
export interface AlignedMorph {
  readonly from: Float32Array[];
  readonly to: Float32Array[];
  readonly closed: boolean[];
}

/** A degenerate contour: `count` points all at `center` (for grow/collapse). */
function collapsedContour(center: readonly [number, number], count: number): Float32Array {
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    out[i * 2] = center[0];
    out[i * 2 + 1] = center[1];
  }
  return out;
}

/** Overall centroid across a list of contours. */
function contoursCentroid(contours: readonly NormalizedContour[]): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const c of contours) {
    const m = c.points.length >> 1;
    for (let i = 0; i < m; i++) {
      sx += c.points[i * 2]!;
      sy += c.points[i * 2 + 1]!;
      n++;
    }
  }
  return n === 0 ? [0, 0] : [sx / n, sy / n];
}

/** Read normalized contours from an object's morphable trait. */
export function normalizedContoursOf(object: IMObject2D): readonly NormalizedContour[] {
  const trait = findTrait(object.traits, "morphable");
  if (!trait) {
    throw new IntermactError(
      "unsupported-animation",
      `Morph requires the morphable trait; object "${object.type}" does not expose it.`,
    );
  }
  return trait.normalizedContours();
}

/** Total arc length of a normalized contour (closing segment included). */
function lengthOf(c: NormalizedContour): number {
  return cumulativeLengths(c.points, c.closed).total;
}

/**
 * Pair two contour sets by descending length (`design.md §11.4`: match by
 * area/length). Each pair is arc-length resampled to `count`; the shorter set is
 * padded with collapsed contours so unmatched contours grow/shrink in place.
 */
export function pairContours(
  from: readonly NormalizedContour[],
  to: readonly NormalizedContour[],
  count: number,
): AlignedMorph {
  const fromSorted = [...from].sort((a, b) => lengthOf(b) - lengthOf(a));
  const toSorted = [...to].sort((a, b) => lengthOf(b) - lengthOf(a));
  const fromCenter = contoursCentroid(from);
  const toCenter = contoursCentroid(to);
  const n = Math.max(fromSorted.length, toSorted.length, 1);

  const outFrom: Float32Array[] = [];
  const outTo: Float32Array[] = [];
  const outClosed: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const fc = fromSorted[i];
    const tc = toSorted[i];
    const closed = (fc?.closed ?? false) || (tc?.closed ?? false);
    const fromPts = fc
      ? resampleByArcLength(fc.points, fc.closed, count)
      : collapsedContour(toCenter, count);
    const toPts = tc
      ? resampleByArcLength(tc.points, tc.closed, count)
      : collapsedContour(fromCenter, count);
    outFrom.push(fromPts);
    outTo.push(toPts);
    outClosed.push(closed);
  }
  return { from: outFrom, to: outTo, closed: outClosed };
}

/** Best cyclic rotation of a closed contour to minimize MSE against a target. */
function rotateAlignClosed(from: Float32Array, to: Float32Array, count: number): Float32Array {
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let k = 0; k < count; k++) {
    let cost = 0;
    for (let i = 0; i < count; i++) {
      const fi = ((i + k) % count) * 2;
      const ti = i * 2;
      const dx = from[fi]! - to[ti]!;
      const dy = from[fi + 1]! - to[ti + 1]!;
      cost += dx * dx + dy * dy;
      if (cost >= bestCost) break;
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = k;
    }
  }
  if (bestOffset === 0) return from;
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const fi = ((i + bestOffset) % count) * 2;
    out[i * 2] = from[fi]!;
    out[i * 2 + 1] = from[fi + 1]!;
  }
  return out;
}

/** Reverse an open contour's point order (for direction alignment). */
function reverseContour(points: Float32Array, count: number): Float32Array {
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const j = count - 1 - i;
    out[i * 2] = points[j * 2]!;
    out[i * 2 + 1] = points[j * 2 + 1]!;
  }
  return out;
}

function mse(a: Float32Array, b: Float32Array): number {
  let cost = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    cost += d * d;
  }
  return cost;
}

/** Apply anchor alignment (best rotation for closed, best direction for open). */
function anchorAlign(aligned: AlignedMorph, count: number): AlignedMorph {
  const from = aligned.from.map((f, i) => {
    const t = aligned.to[i]!;
    if (aligned.closed[i]) return rotateAlignClosed(f, t, count);
    const reversed = reverseContour(f, count);
    return mse(reversed, t) < mse(f, t) ? reversed : f;
  });
  return { from, to: aligned.to, closed: aligned.closed };
}

/** Build aligned contour frames for `arc-length` / `anchor` strategies. */
export function buildMorphFrames(
  source: IMObject2D,
  target: IMObject2D,
  strategy: "arc-length" | "anchor",
  count: number,
): AlignedMorph {
  const aligned = pairContours(normalizedContoursOf(source), normalizedContoursOf(target), count);
  return strategy === "anchor" ? anchorAlign(aligned, count) : aligned;
}

/** Resolve an object's parts (fallback: the whole object as one unkeyed part). */
function partsOf(object: IMObject2D): readonly ObjectPart2D[] {
  return object.parts && object.parts.length > 0 ? object.parts : [{ key: "", object }];
}

/** Merge each part's contours into a key → contours map (matching strategy). */
function contoursByKey(
  parts: readonly ObjectPart2D[],
  keyFn: MatchByFn,
): Map<string, NormalizedContour[]> {
  const map = new Map<string, NormalizedContour[]>();
  for (const part of parts) {
    const key = keyFn(part);
    const list = map.get(key) ?? [];
    list.push(...normalizedContoursOf(part.object));
    map.set(key, list);
  }
  return map;
}

/**
 * Build aligned frames for the `matching` strategy (design.md §11.4). Matched
 * keys transform; source-only keys collapse to their centroid (remover);
 * target-only keys grow from their centroid (introducer). The result is one flat
 * aligned set so the morph track stays a single seekable geometry override.
 */
export function buildMatchingFrames(
  source: IMObject2D,
  target: IMObject2D,
  matchBy: MatchByFn | undefined,
  count: number,
): AlignedMorph {
  const keyFn: MatchByFn = matchBy ?? ((p) => p.key);
  const srcMap = contoursByKey(partsOf(source), keyFn);
  const tgtMap = contoursByKey(partsOf(target), keyFn);

  const keys: string[] = [...srcMap.keys()];
  for (const k of tgtMap.keys()) if (!srcMap.has(k)) keys.push(k);

  const from: Float32Array[] = [];
  const to: Float32Array[] = [];
  const closed: boolean[] = [];
  const push = (a: AlignedMorph): void => {
    from.push(...a.from);
    to.push(...a.to);
    closed.push(...a.closed);
  };

  for (const key of keys) {
    const sC = srcMap.get(key);
    const tC = tgtMap.get(key);
    if (sC && tC) {
      push(pairContours(sC, tC, count)); // transformer
    } else if (sC) {
      const center = contoursCentroid(sC); // remover: collapse in place
      for (const c of sC) {
        from.push(resampleByArcLength(c.points, c.closed, count));
        to.push(collapsedContour(center, count));
        closed.push(c.closed);
      }
    } else if (tC) {
      const center = contoursCentroid(tC); // introducer: grow in place
      for (const c of tC) {
        from.push(collapsedContour(center, count));
        to.push(resampleByArcLength(c.points, c.closed, count));
        closed.push(c.closed);
      }
    }
  }
  return { from, to, closed };
}

/**
 * Back-compat helper (pre-M9): arc-length aligned contours.
 * @deprecated Use {@link buildMorphFrames}.
 */
export function alignMorphContours(
  source: IMObject2D,
  target: IMObject2D,
  sampleCount: number,
): AlignedMorph {
  return buildMorphFrames(source, target, "arc-length", sampleCount);
}
