import { type IMObject } from "../object/types";
import { applyPatch2D, type RuntimeState2D } from "../runtime/state";
import { type Animation } from "./spec";
import {
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

/** A named bookmark on the timeline for slide-style navigation (design.md §11.3). */
export interface TimelineMarker {
  readonly name: string;
  readonly time: number;
}

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

function readInitial(state: RuntimeState2D | undefined, property: PropertyPath): unknown {
  if (!state) return undefined;
  switch (property.type) {
    case "transform":
      return state.transform[property.key];
    case "opacity":
      return state.opacity;
    case "reveal":
      return state.revealEnd;
    case "fill":
      return state.fillProgress;
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
  private cursor = 0;
  private readonly ids: IdGen = createIdGen();
  private readonly projected = new Map<string, unknown>();
  private readonly projection: Projection;
  private readonly compileContext: CompileContext;

  constructor(
    private readonly initialStates: Map<string, RuntimeState2D>,
    objects: ReadonlyMap<string, IMObject> = new Map(),
  ) {
    this.compileContext = {
      getObject: (id) => {
        const obj = objects.get(id);
        return obj && obj.dimension === "2d" ? obj : undefined;
      },
      applyBaselinePatch: (targetId, patch) => {
        const current = this.initialStates.get(targetId);
        if (current) this.initialStates.set(targetId, applyPatch2D(current, patch));
      },
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
    this.cursor += duration;
  }

  /** Record a named marker at the current cursor. */
  marker(name: string): void {
    this.markers.push({ name, time: this.cursor });
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
