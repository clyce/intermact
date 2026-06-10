import { globalRegistries } from "../extend/registries";
import { type IMObject } from "../object/types";
import {
  applyPatch2D,
  applyPatch3D,
  type RuntimeState,
  type RuntimeState2DPatch,
  type RuntimeState3DPatch,
} from "../runtime/state";
import { type Animation, type AnimationSpec } from "./spec";
import {
  type AnimationCompiler,
  compileSpec,
  createIdGen,
  type CompileContext,
  type IdGen,
  type Projection,
  type SignalTrack,
  type TimelineEffect,
  type Track,
} from "./track";
import { type PropertyPath } from "./spec";

/**
 * Resolve a plugin {@link AnimationCompiler} for a `custom` spec type. Defaults
 * to the ambient {@link globalRegistries} so plugins installed before the build
 * pass are visible without threading a registries object through scene/program
 * call sites (design.md §18).
 */
export type AnimationResolver = (type: string) => AnimationCompiler | undefined;

/** A named bookmark on the timeline for slide-style navigation (design.md §11.3). */
export interface TimelineMarker {
  readonly name: string;
  readonly time: number;
}

/**
 * A recorded build-pass timeline operation (design.md §17 serialization). The
 * {@link StoryboardBuilder} keeps an ordered op-log of every `play`/`commit`/
 * `wait`/`marker`; replaying it on a fresh builder reproduces an identical
 * {@link Storyboard}. This is what lets `serialize`/`deserialize` round-trip the
 * timeline without re-running the user program (the op-log carries the original
 * {@link AnimationSpec} data, which is the serializable form — not the compiled
 * closures).
 */
export type TimelineOp =
  | { readonly op: "play"; readonly specs: readonly AnimationSpec[] }
  | { readonly op: "commit"; readonly specs: readonly AnimationSpec[] }
  | { readonly op: "wait"; readonly duration: number }
  | { readonly op: "marker"; readonly name: string };

/** Retained-mode, fully seekable timeline data (design.md §3.2). */
export interface Storyboard {
  readonly tracks: readonly Track[];
  readonly signalTracks: readonly SignalTrack[];
  readonly effects: readonly TimelineEffect[];
  readonly duration: number;
  readonly markers: readonly TimelineMarker[];
}

function propertyToKey(property: PropertyPath): string {
  switch (property.type) {
    case "transform":
      return `transform.${property.key}`;
    case "opacity":
      return "opacity";
    case "style":
      return `style.${property.key}`;
    case "reveal":
      return "reveal";
    case "fill":
      return "fill";
  }
}

function readInitial(state: RuntimeState | undefined, property: PropertyPath): unknown {
  if (!state) return undefined;
  switch (property.type) {
    case "transform":
      return state.transform[property.key];
    case "opacity":
      return state.opacity;
    case "reveal":
      return state.revealEnd;
    case "fill":
      return state.dimension === "2d" ? state.fillProgress : undefined;
    case "style":
      return (state.styleOverrides as Record<string, unknown> | undefined)?.[property.key];
  }
}

/**
 * Accumulates the timeline during the build pass (design.md §3.2). `play`
 * appends animations at the current cursor and advances it; the builder also
 * resolves tween `from` values via a per-property projection seeded from each
 * object's initial runtime state.
 */
export class StoryboardBuilder {
  private tracks: Track[] = [];
  private signalTracks: SignalTrack[] = [];
  private effects: TimelineEffect[] = [];
  private markers: TimelineMarker[] = [];
  private ops: TimelineOp[] = [];
  private cursor = 0;
  private readonly ids: IdGen = createIdGen();
  private readonly projected = new Map<string, unknown>();
  private readonly projection: Projection;
  private readonly compileContext: CompileContext;

  constructor(
    private readonly initialStates: Map<string, RuntimeState>,
    objects: ReadonlyMap<string, IMObject> = new Map(),
    resolveAnimation: AnimationResolver = (type) => globalRegistries.animations.get(type),
  ) {
    this.compileContext = {
      getObject: (id) => objects.get(id),
      applyBaselinePatch: (targetId, patch) => {
        const current = this.initialStates.get(targetId);
        if (!current) return;
        if (current.dimension === "3d") {
          this.initialStates.set(targetId, applyPatch3D(current, patch as RuntimeState3DPatch));
        } else {
          this.initialStates.set(targetId, applyPatch2D(current, patch as RuntimeState2DPatch));
        }
      },
      resolveAnimation,
    };
    this.projection = {
      read: (targetId, property) => {
        const key = `${targetId}::${propertyToKey(property)}`;
        if (this.projected.has(key)) return this.projected.get(key);
        const value = readInitial(this.initialStates.get(targetId), property);
        this.projected.set(key, value);
        return value;
      },
      write: (targetId, property, value) => {
        this.projected.set(`${targetId}::${propertyToKey(property)}`, value);
      },
    };
  }

  /** Current scene-time cursor (seconds). */
  get time(): number {
    return this.cursor;
  }

  /** Append animations in parallel at the cursor; advance cursor by the longest. */
  play(animations: readonly Animation[]): number {
    this.ops.push({ op: "play", specs: animations.map((a) => a.spec) });
    let max = 0;
    for (const animation of animations) {
      const result = compileSpec(
        animation.spec,
        this.cursor,
        this.projection,
        this.ids,
        this.compileContext,
      );
      this.tracks.push(...result.tracks);
      this.signalTracks.push(...result.signalTracks);
      this.effects.push(...result.effects);
      max = Math.max(max, result.duration);
    }
    this.cursor += max;
    return max;
  }

  /** Apply immediate (duration-0) changes without advancing the cursor. */
  commit(animations: readonly Animation[]): void {
    this.ops.push({ op: "commit", specs: animations.map((a) => a.spec) });
    for (const animation of animations) {
      const result = compileSpec(
        animation.spec,
        this.cursor,
        this.projection,
        this.ids,
        this.compileContext,
      );
      this.tracks.push(...result.tracks);
      this.signalTracks.push(...result.signalTracks);
      this.effects.push(...result.effects);
    }
  }

  /** Advance the cursor by `duration` seconds. */
  wait(duration: number): void {
    this.ops.push({ op: "wait", duration });
    this.cursor += duration;
  }

  /** Record a named marker at the current cursor. */
  marker(name: string): void {
    this.ops.push({ op: "marker", name });
    this.markers.push({ name, time: this.cursor });
  }

  /** Ordered op-log of build-pass operations (design.md §17 serialization). */
  getOps(): readonly TimelineOp[] {
    return this.ops;
  }

  /** Finalize into an immutable, sorted Storyboard. */
  build(): Storyboard {
    const tracks = [...this.tracks].sort((a, b) => a.start - b.start);
    const signalTracks = [...this.signalTracks].sort((a, b) => a.start - b.start);
    const effects = [...this.effects].sort((a, b) => a.time - b.time);
    const trackEnd = tracks.reduce((max, t) => Math.max(max, t.start + t.duration), 0);
    const signalEnd = signalTracks.reduce((max, t) => Math.max(max, t.start + t.duration), 0);
    const duration = Math.max(this.cursor, trackEnd, signalEnd);
    return { tracks, signalTracks, effects, duration, markers: [...this.markers] };
  }
}
