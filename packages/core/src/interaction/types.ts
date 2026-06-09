/**
 * Interaction event & pick types (design.md §12.1–§12.3). These are pure data
 * types (only depend on math) so {@link InteractiveTrait} can reference them
 * without creating an `object → interaction` import cycle. The heavier factories
 * (`draggable.ts`) and hit-testing live alongside but pull in geometry/reactive.
 */
import { type AbsXY, type RelUV, type Vec2 } from "../math/vec";

/** A pointer event enriched with three coordinate spaces (design.md §12.2). */
export interface IntermactPointerEvent {
  /** Pixel coordinates within the canvas. */
  readonly screen: Vec2;
  /** Scene world coordinates (already un-projected). */
  readonly sceneAbs: AbsXY;
  /** Normalized [0,1] coordinates within the viewport. */
  readonly sceneRel: RelUV;
  readonly targetId?: string;
  readonly originalEvent?: unknown;
}

/** A drag event: pointer event + accumulated/initial deltas. */
export interface IntermactDragEvent extends IntermactPointerEvent {
  readonly deltaAbs: AbsXY;
  readonly startAbs: AbsXY;
}

/** Pointer/drag callback bundle attached to an interactive object (design.md §12.2). */
export interface PointerEventBinding {
  readonly onPointerEnter?: (e: IntermactPointerEvent) => void;
  readonly onPointerLeave?: (e: IntermactPointerEvent) => void;
  readonly onPointerDown?: (e: IntermactPointerEvent) => void;
  readonly onDrag?: (e: IntermactDragEvent) => void;
  readonly onClick?: (e: IntermactPointerEvent) => void;
}

/**
 * Invisible pick-proxy geometry for hit-testing (design.md §12.1). Thin strokes
 * become a band, points a disc, regions a rect — all expressed in the object's
 * local space (the host adds the runtime transform).
 */
export type PickProxy =
  | { readonly kind: "disc"; readonly center: AbsXY; readonly radius: number }
  | { readonly kind: "rect"; readonly min: AbsXY; readonly max: AbsXY }
  | { readonly kind: "band"; readonly polylines: readonly Float32Array[]; readonly width: number };

/**
 * Signal-backed drag behavior the host wires up (design.md §12.3). `read` gives
 * the handle's current world position (so it follows the signal); `write` commits
 * a dragged world position back to the signal, triggering reactive recompute.
 */
export interface DragBinding {
  readonly kind: "point" | "value";
  read(): AbsXY;
  write(world: AbsXY): void;
}
