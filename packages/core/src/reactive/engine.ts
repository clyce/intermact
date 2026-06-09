import { type IMObject2D } from "../object/types";
import { type RuntimeStateStore } from "../runtime/store";
import { type ReactiveObjectSource } from "./derived";
import { getSignalId, type ReadonlySignal, type Signal, type SignalId } from "./signal";

/** Minimal scene surface required by the reactive flush pass. */
export interface ReactiveSceneHost {
  replaceObject(id: string, object: IMObject2D): void;
}

/** Context passed to object updaters (design.md §8.2). */
export interface UpdaterContext {
  readonly time: number;
}

export type UpdaterFn = (ctx: UpdaterContext) => void;

interface DerivedEntry {
  readonly deps: readonly ReadonlySignal<unknown>[];
  readonly build: () => IMObject2D;
  lastVersions: number[];
  lastObject: IMObject2D | null;
}

interface UpdaterEntry {
  readonly fn: UpdaterFn;
}

/**
 * Reactive runtime: tracks signals, derived object sources, and per-object
 * updaters. Flushed each frame after the Player advances (design.md §8.4).
 */
export class ReactiveEngine {
  private readonly signals = new Map<SignalId, Signal<unknown>>();
  private readonly derived = new Map<string, DerivedEntry>();
  private readonly updaters = new Map<string, UpdaterEntry[]>();
  private readonly depVersions = new Map<SignalId, number>();

  /** Register a signal for tweenSignal timeline tracks. */
  registerSignal<T>(sig: Signal<T>): void {
    this.signals.set(getSignalId(sig), sig as Signal<unknown>);
    if (!this.depVersions.has(getSignalId(sig))) this.depVersions.set(getSignalId(sig), 0);
  }

  /** Apply a numeric value from a compiled signal track (seek-safe). */
  applySignalValue(signalId: SignalId, value: number): void {
    const sig = this.signals.get(signalId);
    if (sig && typeof sig.get() === "number") sig.set(value);
  }

  /** Register a derived object source bound to a scene object id. */
  registerDerived(id: string, source: ReactiveObjectSource): void {
    for (const dep of source.deps) {
      this.registerSignal(dep as Signal<unknown>);
      dep.subscribe(() => this.notifySignal(dep));
    }
    this.derived.set(id, {
      deps: source.deps,
      build: source.build,
      lastVersions: source.deps.map(() => -1),
      lastObject: null,
    });
  }

  /** Remove derived/updater state for a freed scene object. */
  unregisterObject(targetId: string): void {
    this.derived.delete(targetId);
    this.updaters.delete(targetId);
  }

  /** Release all tracked signals, derived sources, and updaters. */
  dispose(): void {
    this.signals.clear();
    this.derived.clear();
    this.updaters.clear();
    this.depVersions.clear();
  }

  /** Attach a per-frame updater to a registered object; returns an unsubscribe. */
  addUpdater(targetId: string, fn: UpdaterFn): () => void {
    const list = this.updaters.get(targetId) ?? [];
    const entry: UpdaterEntry = { fn };
    list.push(entry);
    this.updaters.set(targetId, list);
    return () => {
      const current = this.updaters.get(targetId);
      if (!current) return;
      const idx = current.indexOf(entry);
      if (idx >= 0) current.splice(idx, 1);
    };
  }

  /**
   * Run updaters and rebuild changed derived objects. Mutates the scene object
   * map and bumps `geometryVersion` on affected runtime states.
   */
  flush(scene: ReactiveSceneHost, store: RuntimeStateStore, time: number): void {
    const ctx: UpdaterContext = { time };
    for (const [, list] of this.updaters) {
      for (const entry of list) entry.fn(ctx);
    }

    for (const [id, entry] of this.derived) {
      const versions = entry.deps.map((dep) => this.depVersions.get(getSignalId(dep)) ?? 0);
      const changed = versions.some((v, i) => v !== entry.lastVersions[i]);
      if (!changed && entry.lastObject) continue;

      const next = entry.build();
      scene.replaceObject(id, next);
      entry.lastObject = next;
      entry.lastVersions = versions;
      const state = store.get(id);
      if (state) {
        store.applyPatch({
          targetId: id,
          changes: { geometryVersion: state.geometryVersion + 1 },
        });
      }
    }
  }

  /** Bump dependency versions when a signal changes (called from bindSignal). */
  notifySignal(sig: ReadonlySignal<unknown>): void {
    const id = getSignalId(sig);
    this.depVersions.set(id, (this.depVersions.get(id) ?? 0) + 1);
  }

  /**
   * Read-only snapshot of the reactive graph for the Inspector (design.md §16):
   * tracked signals, derived object sources (with their signal deps), and the
   * per-object updater counts.
   */
  inspect(): ReactiveInspection {
    return {
      signals: [...this.signals.keys()],
      derived: [...this.derived.entries()].map(([id, entry]) => ({
        id,
        deps: entry.deps.map((d) => getSignalId(d)),
      })),
      updaters: [...this.updaters.entries()].map(([id, list]) => ({ id, count: list.length })),
    };
  }
}

/** Read-only view of the reactive dependency graph (design.md §16). */
export interface ReactiveInspection {
  readonly signals: readonly SignalId[];
  readonly derived: readonly { readonly id: string; readonly deps: readonly SignalId[] }[];
  readonly updaters: readonly { readonly id: string; readonly count: number }[];
}
