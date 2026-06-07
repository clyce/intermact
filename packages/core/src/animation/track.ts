import { IntermactError } from "../errors";
import { type AbsXY, clamp, lerp, type Vec2 } from "../math/vec";
import { type IMObject2D } from "../object/types";
import {
  type GeometryOverride,
  normalizeScale,
  type RuntimeState2DPatch,
  type StatePatch,
} from "../runtime/state";
import { type SignalId } from "../reactive/signal";
import { alignMorphContours } from "./morph";
import { type Easing, resolveEasing } from "./easing";
import { type AnimationSpec, type PropertyPath } from "./spec";

/**
 * Track compilation (design.md §3.2, §11.1). A spec tree is flattened into a
 * list of `Track`s, each with an absolute `start` and a PURE `evaluate(p)`. This
 * purity is what makes the timeline seekable: any time `t` can be evaluated
 * deterministically by applying every track whose start <= t.
 *
 * Determinism note: tween `from` values are resolved at build time from a
 * "projected" value cursor per (target, property). Each track therefore carries
 * concrete from/to and is self-contained.
 */

/** A compiled, seekable unit of animation. `evaluate` is a pure function. */
export interface Track {
  readonly id: string;
  readonly targetId: string;
  /** Absolute scene-time start (seconds). */
  readonly start: number;
  readonly duration: number;
  readonly easing: Easing;
  /** Pure: normalized progress [0,1] -> state patch. */
  evaluate(localProgress: number): StatePatch;
}

/**
 * A non-seekable side effect placed on the timeline (`call`, design.md §11.5).
 * Fired only during forward real-time playback, skipped during scrub.
 */
export interface TimelineEffect {
  readonly id: string;
  readonly time: number;
  readonly seekable: false;
  run(): void | Promise<void>;
}

/** A compiled, seekable signal tween (design.md §8.4). */
export interface SignalTrack {
  readonly id: string;
  readonly signalId: SignalId;
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly duration: number;
  readonly easing: Easing;
  /** Pure: normalized progress [0,1] -> signal value. */
  evaluate(localProgress: number): number;
}

/** Optional compile-time context for specs that need object definitions. */
export interface CompileContext {
  readonly getObject: (id: string) => IMObject2D | undefined;
}

/** Result of compiling one spec subtree. */
export interface CompileResult {
  readonly tracks: Track[];
  readonly signalTracks: SignalTrack[];
  readonly effects: TimelineEffect[];
  readonly duration: number;
}

/** Build-time projection used to resolve tween `from` values. */
export interface Projection {
  read(targetId: string, property: PropertyPath): unknown;
  write(targetId: string, property: PropertyPath, value: unknown): void;
}

/** Stable id generator passed through compilation. */
export interface IdGen {
  next(prefix: string): string;
}

/** Create a simple monotonic id generator. */
export function createIdGen(): IdGen {
  let n = 0;
  return { next: (prefix) => `${prefix}-${n++}` };
}

function propertyChange(property: PropertyPath, value: unknown): RuntimeState2DPatch {
  switch (property.type) {
    case "transform":
      if (property.key === "position") return { transform: { position: value as AbsXY } };
      if (property.key === "rotation") return { transform: { rotation: value as number } };
      return { transform: { scale: normalizeScale(value as Vec2 | number) } };
    case "opacity":
      return { opacity: value as number };
    case "style":
      return { styleOverrides: { [property.key]: value } };
    case "reveal":
      return { revealEnd: value as number };
    case "fill":
      return { fillProgress: value as number };
  }
}

function interpolateValue(property: PropertyPath, from: unknown, to: unknown, t: number): unknown {
  switch (property.type) {
    case "transform":
      if (property.key === "rotation") return lerp(from as number, to as number, t);
      if (property.key === "position") {
        const a = from as Vec2;
        const b = to as Vec2;
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] as Vec2;
      }
      {
        const a = normalizeScale(from as Vec2 | number);
        const b = normalizeScale(to as Vec2 | number);
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] as Vec2;
      }
    case "opacity":
    case "reveal":
    case "fill":
      return lerp(from as number, to as number, t);
    case "style":
      return lerp(from as number, to as number, t);
  }
}

function makeTweenTrack(args: {
  id: string;
  targetId: string;
  property: PropertyPath;
  from: unknown;
  to: unknown;
  start: number;
  duration: number;
  easing: Easing;
}): Track {
  const { id, targetId, property, from, to, start, duration, easing } = args;
  const easeFn = resolveEasing(easing);
  return {
    id,
    targetId,
    start,
    duration,
    easing,
    evaluate(localProgress: number): StatePatch {
      const eased = easeFn(clamp(localProgress, 0, 1));
      const value = interpolateValue(property, from, to, eased);
      return { targetId, changes: propertyChange(property, value) };
    },
  };
}

/**
 * Compile a spec at an absolute `startTime`. Mutates `projection` to advance the
 * per-property cursor so subsequent (sequential) tweens resolve their `from`.
 */
function lerpContours(
  from: readonly Float32Array[],
  to: readonly Float32Array[],
  closed: readonly boolean[],
  t: number,
): GeometryOverride {
  const contours = from.map((fc, i) => {
    const tc = to[i]!;
    const out = new Float32Array(fc.length);
    for (let j = 0; j < fc.length; j++) out[j] = lerp(fc[j]!, tc[j]!, t);
    return { points: out, closed: closed[i] ?? false };
  });
  return { contours };
}

export function compileSpec(
  spec: AnimationSpec,
  startTime: number,
  projection: Projection,
  ids: IdGen,
  context?: CompileContext,
): CompileResult {
  switch (spec.kind) {
    case "tween": {
      const from = spec.from ?? projection.read(spec.targetId, spec.property);
      const track = makeTweenTrack({
        id: ids.next("track"),
        targetId: spec.targetId,
        property: spec.property,
        from,
        to: spec.to,
        start: startTime,
        duration: spec.duration,
        easing: spec.easing ?? "linear",
      });
      projection.write(spec.targetId, spec.property, spec.to);
      return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
    }
    case "fade": {
      const property: PropertyPath = { type: "opacity" };
      const from = projection.read(spec.targetId, property);
      const track = makeTweenTrack({
        id: ids.next("track"),
        targetId: spec.targetId,
        property,
        from: from ?? 1,
        to: spec.to,
        start: startTime,
        duration: spec.duration,
        easing: spec.easing ?? "linear",
      });
      projection.write(spec.targetId, property, spec.to);
      return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
    }
    case "tween-signal": {
      const easeFn = resolveEasing(spec.easing ?? "linear");
      const track: SignalTrack = {
        id: ids.next("signal"),
        signalId: spec.signalId as SignalId,
        from: spec.from,
        to: spec.to,
        start: startTime,
        duration: spec.duration,
        easing: spec.easing ?? "linear",
        evaluate(localProgress: number): number {
          const eased = easeFn(clamp(localProgress, 0, 1));
          return lerp(spec.from, spec.to, eased);
        },
      };
      return { tracks: [], signalTracks: [track], effects: [], duration: spec.duration };
    }
    case "wait":
      return { tracks: [], signalTracks: [], effects: [], duration: spec.duration };
    case "call":
      return {
        tracks: [],
        signalTracks: [],
        effects: [{ id: ids.next("effect"), time: startTime, seekable: false, run: spec.effect }],
        duration: 0,
      };
    case "sequence": {
      const tracks: Track[] = [];
      const signalTracks: SignalTrack[] = [];
      const effects: TimelineEffect[] = [];
      let cursor = startTime;
      for (const child of spec.children) {
        const r = compileSpec(child, cursor, projection, ids, context);
        tracks.push(...r.tracks);
        signalTracks.push(...r.signalTracks);
        effects.push(...r.effects);
        cursor += r.duration;
      }
      return { tracks, signalTracks, effects, duration: cursor - startTime };
    }
    case "parallel": {
      const tracks: Track[] = [];
      const signalTracks: SignalTrack[] = [];
      const effects: TimelineEffect[] = [];
      let max = 0;
      for (const child of spec.children) {
        const r = compileSpec(child, startTime, projection, ids, context);
        tracks.push(...r.tracks);
        signalTracks.push(...r.signalTracks);
        effects.push(...r.effects);
        max = Math.max(max, r.duration);
      }
      return { tracks, signalTracks, effects, duration: max };
    }
    case "stagger": {
      const tracks: Track[] = [];
      const signalTracks: SignalTrack[] = [];
      const effects: TimelineEffect[] = [];
      let max = 0;
      spec.children.forEach((child, i) => {
        const childStart = startTime + i * spec.lag;
        const r = compileSpec(child, childStart, projection, ids, context);
        tracks.push(...r.tracks);
        signalTracks.push(...r.signalTracks);
        effects.push(...r.effects);
        max = Math.max(max, childStart - startTime + r.duration);
      });
      return { tracks, signalTracks, effects, duration: max };
    }
    case "repeat": {
      if (spec.times === "infinite") {
        throw new IntermactError(
          "unsupported-animation",
          "Infinite repeat is not yet supported in the timeline compiler (use player loop).",
        );
      }
      const tracks: Track[] = [];
      const signalTracks: SignalTrack[] = [];
      const effects: TimelineEffect[] = [];
      let cursor = startTime;
      for (let i = 0; i < spec.times; i++) {
        const r = compileSpec(spec.child, cursor, projection, ids, context);
        tracks.push(...r.tracks);
        signalTracks.push(...r.signalTracks);
        effects.push(...r.effects);
        cursor += r.duration;
      }
      return { tracks, signalTracks, effects, duration: cursor - startTime };
    }
    case "create": {
      // Create draws the stroke on (revealEnd 0->1), then reveals the fill
      // (fillProgress 0->1). The object's initial state is set hidden by the
      // `create()` factory so nothing shows before this track starts (§11).
      const tracks: Track[] = [];
      const revealProp: PropertyPath = { type: "reveal" };
      const strokePortion = spec.fill ? 0.6 : 1;
      const strokeDuration = spec.duration * strokePortion;
      tracks.push(
        makeTweenTrack({
          id: ids.next("track"),
          targetId: spec.targetId,
          property: revealProp,
          from: projection.read(spec.targetId, revealProp) ?? 0,
          to: 1,
          start: startTime,
          duration: strokeDuration,
          easing: spec.easing ?? "linear",
        }),
      );
      projection.write(spec.targetId, revealProp, 1);

      if (spec.fill) {
        const fillProp: PropertyPath = { type: "fill" };
        const overlap = spec.fill.overlap ?? 0.2;
        const fillStart = startTime + strokeDuration * (1 - overlap);
        const fillDuration = startTime + spec.duration - fillStart;
        tracks.push(
          makeTweenTrack({
            id: ids.next("track"),
            targetId: spec.targetId,
            property: fillProp,
            from: projection.read(spec.targetId, fillProp) ?? 0,
            to: 1,
            start: fillStart,
            duration: fillDuration,
            easing: spec.easing ?? "linear",
          }),
        );
        projection.write(spec.targetId, fillProp, 1);
      }
      return { tracks, signalTracks: [], effects: [], duration: spec.duration };
    }
    case "morph": {
      const source = context?.getObject(spec.targetId);
      if (!source) {
        throw new IntermactError(
          "unsupported-animation",
          `Morph source object "${spec.targetId}" was not found at compile time.`,
          spec,
        );
      }
      if (spec.strategy === "cross-fade") {
        const opacityProp: PropertyPath = { type: "opacity" };
        const track = makeTweenTrack({
          id: ids.next("track"),
          targetId: spec.targetId,
          property: opacityProp,
          from: projection.read(spec.targetId, opacityProp) ?? 1,
          to: 0,
          start: startTime,
          duration: spec.duration,
          easing: spec.easing ?? "linear",
        });
        return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
      }
      const sampleCount = spec.sampleCount ?? 64;
      const aligned = alignMorphContours(source, spec.toObject, sampleCount);
      const easeFn = resolveEasing(spec.easing ?? "linear");
      const track: Track = {
        id: ids.next("track"),
        targetId: spec.targetId,
        start: startTime,
        duration: spec.duration,
        easing: spec.easing ?? "linear",
        evaluate(localProgress: number): StatePatch {
          const eased = easeFn(clamp(localProgress, 0, 1));
          const geometryOverride = lerpContours(aligned.from, aligned.to, aligned.closed, eased);
          const changes: RuntimeState2DPatch = { geometryOverride };
          if (!spec.preserveStyle && eased >= 1) {
            changes.styleOverrides = spec.toObject.style;
          }
          return { targetId: spec.targetId, changes };
        },
      };
      return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
    }
  }
}
