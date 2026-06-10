import { assertNever } from "../errors";
import {
  applyPatch2D,
  applyPatch3D,
  type RuntimeState,
  type RuntimeState2DPatch,
  type RuntimeState3DPatch,
  type StatePatch,
} from "./state";

/**
 * Immutable runtime-state store keyed by object id. Each `applyPatch` produces
 * a new state value for the target while leaving others referentially stable,
 * so renderers can diff cheaply by identity (design.md §4.3, §15.2).
 *
 * The store holds the {@link RuntimeState} union (2D | 3D) and dispatches the
 * correct patch application by the stored state's `dimension` discriminator.
 */
export class RuntimeStateStore {
  private states = new Map<string, RuntimeState>();

  /** Seed an object's baseline state. */
  set(id: string, state: RuntimeState): void {
    this.states.set(id, state);
  }

  /** Read current state for an object, if registered. */
  get(id: string): RuntimeState | undefined {
    return this.states.get(id);
  }

  /** Merge a patch into the target's state (no-op for unknown targets). */
  applyPatch(patch: StatePatch): void {
    const current = this.states.get(patch.targetId);
    if (!current) return;
    switch (current.dimension) {
      case "2d":
        this.states.set(
          patch.targetId,
          applyPatch2D(current, patch.changes as RuntimeState2DPatch),
        );
        return;
      case "3d":
        this.states.set(
          patch.targetId,
          applyPatch3D(current, patch.changes as RuntimeState3DPatch),
        );
        return;
      default:
        assertNever(current, "Unhandled runtime-state dimension in applyPatch.");
    }
  }

  /** Snapshot of all states as a readonly map. */
  entries(): ReadonlyMap<string, RuntimeState> {
    return this.states;
  }

  /** Deep-ish clone for deterministic per-seek evaluation from a baseline. */
  clone(): RuntimeStateStore {
    const next = new RuntimeStateStore();
    for (const [id, state] of this.states) next.states.set(id, state);
    return next;
  }

  /** Reset to a baseline set of states (replaces all entries). */
  resetTo(baseline: ReadonlyMap<string, RuntimeState>): void {
    this.states = new Map(baseline);
  }
}
