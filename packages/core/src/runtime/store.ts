import { applyPatch2D, type RuntimeState2D, type StatePatch } from "./state";

/**
 * Immutable runtime-state store keyed by object id. Each `applyPatch` produces
 * a new state value for the target while leaving others referentially stable,
 * so renderers can diff cheaply by identity (design.md §4.3, §15.2).
 */
export class RuntimeStateStore {
  private states = new Map<string, RuntimeState2D>();

  /** Seed an object's baseline state. */
  set(id: string, state: RuntimeState2D): void {
    this.states.set(id, state);
  }

  /** Read current state for an object, if registered. */
  get(id: string): RuntimeState2D | undefined {
    return this.states.get(id);
  }

  /** Merge a patch into the target's state (no-op for unknown targets). */
  applyPatch(patch: StatePatch): void {
    const current = this.states.get(patch.targetId);
    if (!current) return;
    this.states.set(patch.targetId, applyPatch2D(current, patch.changes));
  }

  /** Snapshot of all states as a readonly map. */
  entries(): ReadonlyMap<string, RuntimeState2D> {
    return this.states;
  }

  /** Deep-ish clone for deterministic per-seek evaluation from a baseline. */
  clone(): RuntimeStateStore {
    const next = new RuntimeStateStore();
    for (const [id, state] of this.states) next.states.set(id, state);
    return next;
  }

  /** Reset to a baseline set of states (replaces all entries). */
  resetTo(baseline: ReadonlyMap<string, RuntimeState2D>): void {
    this.states = new Map(baseline);
  }
}
