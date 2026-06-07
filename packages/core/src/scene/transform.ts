import {
  type AbsXY,
  type AbsXYZ,
  type Quaternion,
  type RelUV,
  type Vec2,
  type Vec3,
} from "../math/vec";

/**
 * Authoring-time transforms (design.md §9.3). Animations write local transform;
 * the runtime resolves world transform into RuntimeState (§4.3).
 */

/** Euler rotation in radians (3D). */
export interface EulerRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 2D local transform. All fields optional; defaults applied at registration. */
export interface Transform2D {
  position?: AbsXY;
  /** Rotation in radians. */
  rotation?: number;
  scale?: Vec2 | number;
  /** Self anchor as a normalized point of the object's own bounds. */
  anchor?: RelUV;
  opacity?: number;
  zIndex?: number;
}

/** 3D local transform. */
export interface Transform3D {
  position?: AbsXYZ;
  rotation?: EulerRotation | Quaternion;
  scale?: Vec3 | number;
  opacity?: number;
  renderOrder?: number;
}
