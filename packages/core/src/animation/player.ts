import { clamp, xy } from "../math/vec";
import { type IMObject } from "../object/types";
import { type ReactiveEngine } from "../reactive/engine";
import { type ResolvedTransform2D, type RuntimeState2D } from "../runtime/state";
import { RuntimeStateStore } from "../runtime/store";
import { composeTransform2D } from "../runtime/world-transform";
import { type ReactiveSceneHost } from "../reactive/engine";
import { type ObjectRenderState, type RenderSnapshot, type ViewportSnapshot } from "./snapshot";
import { type Storyboard } from "./storyboard";

/** Playback lifecycle states. */
export type PlayerState = "idle" | "playing" | "paused" | "finished";

/** Optional hooks for the framework-free Player. */
export interface PlayerOptions {
  /** Initial baseline runtime states keyed by object id. */
  readonly initialStates: ReadonlyMap<string, RuntimeState2D>;
  /** Object definitions keyed by id, for building snapshots. */
  readonly objects: ReadonlyMap<string, IMObject>;
  /** Viewports to include in every snapshot (M3/M5). */
  readonly viewports?: readonly ViewportSnapshot[];
  /** Called when a scrub crosses a non-seekable `call` boundary (§11.5). */
  readonly onNonSeekable?: (effectId: string, time: number) => void;
  /** Reactive engine for signal tracks and derived/updater flush (§8). */
  readonly reactive?: ReactiveEngine;
  /** Primary scene for reactive geometry rebuilds. */
  readonly scene?: ReactiveSceneHost;
  /** Transform-hierarchy parent links (child id → parent id), design.md §9.3. */
  readonly parents?: ReadonlyMap<string, string>;
}

/**
 * The Player owns a Storyboard and produces per-frame snapshots (design.md
 * §3.2). It is framework-free: continuous playback is driven externally via
 * {@link Player.update} (the R3F layer runs a RAF loop), while `seek` provides
 * deterministic random access. core never touches `requestAnimationFrame`.
 */
export class Player {
  private readonly store: RuntimeStateStore;
  private readonly subscribers = new Set<(snapshot: RenderSnapshot) => void>();
  private _time = 0;
  private _rate = 1;
  private _loop = false;
  private _state: PlayerState = "idle";
  /** Index into the (start-sorted) effects list of the next effect to fire. */
  private effectCursor = 0;
  /** Effect ids already warned about during scrubbing (warn once each). */
  private readonly warnedEffects = new Set<string>();

  constructor(
    readonly storyboard: Storyboard,
    private readonly options: PlayerOptions,
  ) {
    this.store = new RuntimeStateStore();
    this.store.resetTo(options.initialStates);
    this.applyAt(0);
  }

  get time(): number {
    return this._time;
  }
  get duration(): number {
    return this.storyboard.duration;
  }
  get rate(): number {
    return this._rate;
  }
  get loop(): boolean {
    return this._loop;
  }
  get state(): PlayerState {
    return this._state;
  }

  play(): void {
    if (this._state === "finished" && this._rate > 0 && this._time >= this.duration) {
      this.seek(0);
    }
    this._state = "playing";
  }

  pause(): void {
    if (this._state === "playing") this._state = "paused";
  }

  setRate(rate: number): void {
    this._rate = rate;
  }

  setLoop(loop: boolean): void {
    this._loop = loop;
  }

  /** Deterministic random access. Does NOT fire side effects (scrub). */
  seek(time: number): void {
    const clamped = clamp(time, 0, this.duration);
    this.warnSkippedEffects(clamped);
    this._time = clamped;
    this.applyAt(clamped);
    this.effectCursor = this.countEffectsUpTo(clamped);
    this.emit();
  }

  /** Jump to a named marker (slide navigation). */
  jumpToMarker(name: string): void {
    const marker = this.storyboard.markers.find((m) => m.name === name);
    if (marker) this.seek(marker.time);
  }

  /**
   * Advance playback by `deltaSeconds` of wall-clock time. Driven by an external
   * loop. Fires forward `call` effects; handles loop/finish.
   */
  update(deltaSeconds: number): void {
    if (this._state !== "playing") return;
    const prev = this._time;
    let next = prev + deltaSeconds * this._rate;

    if (this._rate >= 0) {
      this.fireForwardEffects(prev, next);
      if (next >= this.duration) {
        if (this._loop && this.duration > 0) {
          next = next % this.duration;
          this.effectCursor = 0;
        } else {
          next = this.duration;
          this._state = "finished";
        }
      }
    } else if (next <= 0) {
      next = 0;
      this._state = "finished";
    }

    this._time = next;
    this.applyAt(next);
    if (this._rate < 0) this.effectCursor = this.countEffectsUpTo(next);
    this.emit();
  }

  /** Release subscribers and pause playback. */
  dispose(): void {
    this.pause();
    this.subscribers.clear();
  }

  /** Subscribe to frame snapshots; returns an unsubscribe function. */
  subscribe(onFrame: (snapshot: RenderSnapshot) => void): () => void {
    this.subscribers.add(onFrame);
    onFrame(this.getSnapshot());
    return () => this.subscribers.delete(onFrame);
  }

  /** Run reactive updaters/derived rebuilds before sampling a frame (§8.4). */
  prepareFrame(): void {
    if (this.options.reactive && this.options.scene) {
      this.options.reactive.flush(this.options.scene, this.store, this._time);
    }
  }

  /** Current frame snapshot. */
  getSnapshot(): RenderSnapshot {
    this.prepareFrame();
    const states = this.store.entries();
    const parents = this.options.parents;
    const hierarchical = parents !== undefined && parents.size > 0;
    const tCache = hierarchical ? new Map<string, ResolvedTransform2D>() : null;
    const oCache = hierarchical ? new Map<string, number>() : null;
    const objects = new Map<string, ObjectRenderState>();
    for (const [id, state] of states) {
      const object = this.options.objects.get(id);
      if (!object) continue;
      let out = state;
      if (hierarchical) {
        const world = this.resolveWorldTransform(id, states, parents, tCache!);
        const opacity = this.resolveWorldOpacity(id, states, parents, oCache!);
        if (world !== state.transform || opacity !== state.opacity) {
          out = { ...state, transform: world, opacity };
        }
      }
      objects.set(id, { id, object, state: out });
    }
    return { time: this._time, objects, viewports: this.options.viewports ?? [] };
  }

  /** Compose a child's world transform from its parent chain (memoized per frame). */
  private resolveWorldTransform(
    id: string,
    states: ReadonlyMap<string, RuntimeState2D>,
    parents: ReadonlyMap<string, string>,
    cache: Map<string, ResolvedTransform2D>,
  ): ResolvedTransform2D {
    const cached = cache.get(id);
    if (cached) return cached;
    const local = states.get(id)?.transform;
    const parentId = parents.get(id);
    let world: ResolvedTransform2D;
    if (!local) {
      world = { position: xy(0, 0), rotation: 0, scale: [1, 1], zIndex: 0 };
    } else if (parentId && states.has(parentId)) {
      world = composeTransform2D(
        this.resolveWorldTransform(parentId, states, parents, cache),
        local,
      );
    } else {
      world = local;
    }
    cache.set(id, world);
    return world;
  }

  /** Multiply opacity down the parent chain (memoized per frame). */
  private resolveWorldOpacity(
    id: string,
    states: ReadonlyMap<string, RuntimeState2D>,
    parents: ReadonlyMap<string, string>,
    cache: Map<string, number>,
  ): number {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const local = states.get(id)?.opacity ?? 1;
    const parentId = parents.get(id);
    const opacity =
      parentId && states.has(parentId)
        ? local * this.resolveWorldOpacity(parentId, states, parents, cache)
        : local;
    cache.set(id, opacity);
    return opacity;
  }

  /** Reset the store to baseline and apply every track active at `time`. */
  private applyAt(time: number): void {
    this.store.resetTo(this.options.initialStates);
    for (const track of this.storyboard.tracks) {
      if (track.start > time) continue;
      const local = track.duration > 0 ? clamp((time - track.start) / track.duration, 0, 1) : 1;
      this.store.applyPatch(track.evaluate(local));
    }
    if (this.options.reactive) {
      for (const track of this.storyboard.signalTracks) {
        if (track.start > time) continue;
        const local = track.duration > 0 ? clamp((time - track.start) / track.duration, 0, 1) : 1;
        this.options.reactive.applySignalValue(track.signalId, track.evaluate(local));
      }
    }
  }

  /**
   * Warn (once per effect) that scrubbing skips a non-seekable `call` boundary
   * (design.md §11.5). Routed through `onNonSeekable` if provided, else a
   * one-time console warning.
   */
  private warnSkippedEffects(time: number): void {
    for (const effect of this.storyboard.effects) {
      if (effect.time > time) break;
      if (this.warnedEffects.has(effect.id)) continue;
      this.warnedEffects.add(effect.id);
      if (this.options.onNonSeekable) this.options.onNonSeekable(effect.id, effect.time);
      else if (typeof console !== "undefined") {
        console.warn(
          `[intermact] non-seekable call effect "${effect.id}" at t=${effect.time}s is skipped during scrub.`,
        );
      }
    }
  }

  private countEffectsUpTo(time: number): number {
    let i = 0;
    while (i < this.storyboard.effects.length && this.storyboard.effects[i]!.time <= time) i++;
    return i;
  }

  private fireForwardEffects(from: number, to: number): void {
    while (this.effectCursor < this.storyboard.effects.length) {
      const effect = this.storyboard.effects[this.effectCursor]!;
      if (effect.time > to) break;
      if (effect.time > from) {
        void effect.run();
        this.options.onNonSeekable?.(effect.id, effect.time);
      }
      this.effectCursor++;
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const subscriber of this.subscribers) subscriber(snapshot);
  }
}
