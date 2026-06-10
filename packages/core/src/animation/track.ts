import { IntermactError } from "../errors";
import {
  type AbsXY,
  type AbsXYZ,
  clamp,
  lerp,
  type Quaternion,
  type Vec2,
  type Vec3,
} from "../math/vec";
import { quatSlerp } from "../math/quaternion";
import { findTrait, hasTrait } from "../object/traits";
import { type IMObject, type IMObject2D } from "../object/types";
import {
  type GeometryOverride,
  normalizeScale,
  normalizeScale3,
  type GlyphRevealSpan,
  type RuntimeState2DPatch,
  type RuntimeState3DPatch,
  type StatePatch,
} from "../runtime/state";
import { type StrokeRevealMode } from "./spec";
import { computeGlyphRevealSpans } from "../text/write-spans";
import { type SignalId } from "../reactive/signal";
import { buildMatchingFrames, buildMorphFrames, normalizedContoursOf } from "./morph";
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

/**
 * Geometry-version values emitted by morph tracks. A morph rewrites an object's
 * contours every frame; the renderer rebuilds its meshes whenever
 * `geometryVersion` changes (the same signal updaters use). The base offset keeps
 * morph versions well clear of the small increments reactive updaters produce, so
 * the two never collide on the same object.
 */
const MORPH_GEOMETRY_VERSION_BASE = 1_000_000;
const MORPH_GEOMETRY_VERSION_SPAN = 1_000_000;

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
  readonly getObject: (id: string) => IMObject | undefined;
  /** Merge a patch into the object's baseline runtime state at compile time. */
  readonly applyBaselinePatch?: (
    targetId: string,
    patch: RuntimeState2DPatch | RuntimeState3DPatch,
  ) => void;
  /**
   * Resolve a plugin {@link AnimationCompiler} for a `custom` spec's `type`
   * (design.md §18). Supplied by the `StoryboardBuilder`, which defaults to the
   * global animations registry. When absent, `custom` specs throw
   * `unsupported-animation`.
   */
  readonly resolveAnimation?: (type: string) => AnimationCompiler | undefined;
}

/**
 * Compile-time context handed to a plugin {@link AnimationCompiler} (design.md
 * §18). Exposes the same machinery the built-in compiler uses so custom kinds
 * can read object definitions, resolve tween `from` values from the projection,
 * patch the compile-time baseline, and mint stable ids.
 */
export interface CustomAnimationContext {
  /** Absolute scene-time start (seconds) at which the animation is placed. */
  readonly startTime: number;
  readonly ids: IdGen;
  readonly projection: Projection;
  readonly getObject: (id: string) => IMObject | undefined;
  readonly applyBaselinePatch?: (
    targetId: string,
    patch: RuntimeState2DPatch | RuntimeState3DPatch,
  ) => void;
}

/**
 * A plugin-registered compiler turning a `custom` {@link AnimationSpec} into
 * seekable tracks (design.md §18). Registered under a `type` key in the
 * animations registry; invoked by {@link compileSpec} when it meets a matching
 * `custom` spec. The result must be pure/seekable like every built-in track.
 */
export interface AnimationCompiler {
  /** Optional human-readable summary for tooling. */
  readonly describe?: string;
  /** Compile `spec` at `ctx.startTime` into tracks/signal-tracks/effects. */
  compile(
    spec: Extract<AnimationSpec, { kind: "custom" }>,
    ctx: CustomAnimationContext,
  ): CompileResult;
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

function propertyChange(
  property: PropertyPath,
  value: unknown,
): RuntimeState2DPatch | RuntimeState3DPatch {
  switch (property.type) {
    case "transform":
      if (property.space === "3d") {
        if (property.key === "position") return { transform: { position: value as AbsXYZ } };
        if (property.key === "rotation") return { transform: { rotation: value as Quaternion } };
        return { transform: { scale: normalizeScale3(value as Vec3 | number) } };
      }
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
      if (property.space === "3d") {
        if (property.key === "rotation") {
          return quatSlerp(from as Quaternion, to as Quaternion, t);
        }
        if (property.key === "position") {
          const a = from as Vec3;
          const b = to as Vec3;
          return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as Vec3;
        }
        {
          const a = normalizeScale3(from as Vec3 | number);
          const b = normalizeScale3(to as Vec3 | number);
          return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as Vec3;
        }
      }
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
      // Only seed global baseline opacity when the fade starts at t=0. A later
      // fadeIn (e.g. after create → fadeOut) must not hide the object for the
      // whole timeline — its `from` value applies when that track starts.
      if (spec.from !== undefined && startTime <= 0) {
        context?.applyBaselinePatch?.(spec.targetId, { opacity: spec.from });
      }
      const from = spec.from ?? projection.read(spec.targetId, property);
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
    case "custom": {
      const compiler = context?.resolveAnimation?.(spec.type);
      if (!compiler) {
        throw new IntermactError(
          "unsupported-animation",
          `No animation compiler registered for custom type "${spec.type}". Install a plugin that registers it (design.md §18).`,
          spec,
        );
      }
      const result = compiler.compile(spec, {
        startTime,
        ids,
        projection,
        getObject: (id) => context?.getObject(id),
        ...(context?.applyBaselinePatch ? { applyBaselinePatch: context.applyBaselinePatch } : {}),
      });
      return {
        tracks: result.tracks,
        signalTracks: result.signalTracks,
        effects: result.effects,
        duration: result.duration ?? spec.duration,
      };
    }
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
      // (fillProgress 0->1). Baseline hidden state is applied at compile time
      // when this animation is played into the Storyboard (§11).
      const obj = context?.getObject(spec.targetId);
      const hasFill = Boolean(obj?.style?.fill) && obj && hasTrait(obj.traits, "fill");
      const layout = obj ? findTrait(obj.traits, "text-layout") : undefined;
      const axesLayout = obj ? findTrait(obj.traits, "axes-layout") : undefined;
      let glyphWriteSpans: GlyphRevealSpan[] | undefined;
      const strokeMode: StrokeRevealMode =
        spec.stroke?.mode ??
        (layout
          ? spec.stroke?.direction === "simultaneous"
            ? "contour-parallel"
            : "path-order"
          : axesLayout
            ? "sequential"
            : "path-order");

      if (layout && strokeMode !== "contour-parallel") {
        const direction = spec.stroke?.direction ?? "ltr";
        const order = layout.glyphOrder();
        const temporal = computeGlyphRevealSpans(
          order.length,
          spec.stroke?.glyphOverlap ?? 0,
          direction,
        );
        glyphWriteSpans = [];
        order.forEach((gi, i) => {
          glyphWriteSpans![gi] = temporal[i]!;
        });
      } else if (axesLayout && strokeMode === "sequential") {
        glyphWriteSpans = [
          ...computeGlyphRevealSpans(
            axesLayout.groupCount(),
            spec.stroke?.glyphOverlap ?? 0,
            "ltr",
          ),
        ];
      }

      context?.applyBaselinePatch?.(spec.targetId, {
        revealStart: 0,
        revealEnd: 0,
        fillProgress: hasFill ? 0 : 1,
        strokeRevealMode: strokeMode,
        ...(glyphWriteSpans ? { glyphWriteSpans } : {}),
      });
      const tracks: Track[] = [];
      const revealProp: PropertyPath = { type: "reveal" };
      const fillProp: PropertyPath = { type: "fill" };
      projection.write(spec.targetId, revealProp, 0);
      if (hasFill) projection.write(spec.targetId, fillProp, 0);
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
      const sourceObj = context?.getObject(spec.targetId);
      if (!sourceObj) {
        throw new IntermactError(
          "unsupported-animation",
          `Morph source object "${spec.targetId}" was not found at compile time.`,
          spec,
        );
      }
      if (sourceObj.dimension !== "2d") {
        throw new IntermactError(
          "unsupported-animation",
          `Morph is only supported for 2D objects (target "${spec.targetId}").`,
          spec,
        );
      }
      const source: IMObject2D = sourceObj;
      const easeFn = resolveEasing(spec.easing ?? "linear");
      const sampleCount = spec.sampleCount ?? 64;

      if (spec.strategy === "cross-fade") {
        // Single-object cross-fade = dissolve: fade source out, swap geometry,
        // fade target in. (True overlap needs two objects; see docs/morph.)
        const fromGeo = normalizedContoursOf(source).map((c) => ({
          points: c.points,
          closed: c.closed,
        }));
        const toGeo = normalizedContoursOf(spec.toObject).map((c) => ({
          points: c.points,
          closed: c.closed,
        }));
        const fromOpacity =
          (projection.read(spec.targetId, { type: "opacity" }) as number | undefined) ?? 1;
        const toOpacity = 1;
        const track: Track = {
          id: ids.next("track"),
          targetId: spec.targetId,
          start: startTime,
          duration: spec.duration,
          easing: spec.easing ?? "linear",
          evaluate(localProgress: number): StatePatch {
            const eased = easeFn(clamp(localProgress, 0, 1));
            const firstHalf = eased < 0.5;
            const halfT = firstHalf ? eased * 2 : (eased - 0.5) * 2;
            const opacity = firstHalf ? fromOpacity * (1 - halfT) : toOpacity * halfT;
            const changes: RuntimeState2DPatch = {
              opacity,
              geometryOverride: { contours: firstHalf ? fromGeo : toGeo },
              // Signal the renderer to rebuild meshes when the geometry swaps.
              geometryVersion: firstHalf
                ? MORPH_GEOMETRY_VERSION_BASE
                : MORPH_GEOMETRY_VERSION_BASE + 1,
            };
            if (!spec.preserveStyle) {
              changes.styleOverrides = firstHalf ? source.style : spec.toObject.style;
            }
            return { targetId: spec.targetId, changes };
          },
        };
        return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
      }

      const aligned =
        spec.strategy === "matching"
          ? buildMatchingFrames(source, spec.toObject, spec.matchBy, sampleCount)
          : buildMorphFrames(source, spec.toObject, spec.strategy, sampleCount);
      const track: Track = {
        id: ids.next("track"),
        targetId: spec.targetId,
        start: startTime,
        duration: spec.duration,
        easing: spec.easing ?? "linear",
        evaluate(localProgress: number): StatePatch {
          const eased = easeFn(clamp(localProgress, 0, 1));
          const geometryOverride = lerpContours(aligned.from, aligned.to, aligned.closed, eased);
          // The interpolated contours change every frame, but `geometryVersion`
          // (not the override identity) is what tells the renderer to rebuild its
          // meshes. Derive a version from progress so it varies while morphing and
          // settles to a stable value at the endpoints (avoids per-frame rebuilds
          // once the morph has finished).
          const changes: RuntimeState2DPatch = {
            geometryOverride,
            geometryVersion:
              MORPH_GEOMETRY_VERSION_BASE + Math.round(eased * MORPH_GEOMETRY_VERSION_SPAN),
          };
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
