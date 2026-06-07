import { type AbsXY, xy } from "../math/vec";

/**
 * Camera as a registered scene object (design.md §10.1). M1 provides only the
 * minimal 2D handle needed to mount a scene; camera animation (move/zoom/orbit)
 * and parent attachment land in later milestones.
 */

/** 2D camera authoring props. */
export interface Camera2DProps {
  readonly projection?: "orthographic";
  readonly zoom?: number;
}

/** Minimal registered 2D camera handle. */
export interface RegisteredCamera2D {
  readonly id: string;
  readonly kind: "camera-2d";
  position: AbsXY;
  zoom: number;
}

/** Construct a minimal 2D camera handle. */
export function createCamera2D(id: string, props?: Camera2DProps): RegisteredCamera2D {
  return { id, kind: "camera-2d", position: xy(0, 0), zoom: props?.zoom ?? 1 };
}
