import { type IMObject } from "../object/types";
import { type RuntimeState } from "../runtime/state";

/**
 * Per-frame render snapshot (design.md §15.1). The renderer adapter consumes
 * only this; it is unaware of animation/timeline, which keeps backends
 * swappable. M3/M5 enrich `ViewportSnapshot` with camera/domain/rect.
 */

/** Resolved render state for a single object (definition + runtime state). */
export interface ObjectRenderState {
  readonly id: string;
  readonly object: IMObject;
  readonly state: RuntimeState;
}

/** A viewport region's render context (expanded in M3/M5). */
export interface ViewportSnapshot {
  readonly id: string;
}

/** Immutable snapshot of the whole scene at a given time. */
export interface RenderSnapshot {
  readonly time: number;
  readonly objects: ReadonlyMap<string, ObjectRenderState>;
  readonly viewports: readonly ViewportSnapshot[];
}
