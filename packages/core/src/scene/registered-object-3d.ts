import {
  type Animation,
  type AnimationSpec,
  buildFadeSpec,
  buildTweenSpec,
  type Easing,
  type StrokeRevealSpec,
  toAnimation,
  type TweenOptions,
} from "../animation";
import { type AxesCreateOptions } from "./registered-object";
import { quatFromEuler } from "../math/quaternion";
import { type AbsXYZ, type Quaternion, type Vec3 } from "../math/vec";
import { createInitialState3D, type RuntimeState } from "../runtime/state";
import { type Axes3DHandle } from "../layout/axes3d";
import { type IMObject3D } from "../object/types";
import { type EulerRotation, type Transform3D } from "./transform";

const DEFAULT_DURATION = 1;

/** Options for the 3D `Create` (build-on) animation. */
export interface Create3DOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly stroke?: StrokeRevealSpec;
}

/**
 * A 3D object registered into a {@link Scene3D} (design.md §9.2, §10). Mirrors
 * {@link RegisteredObject2D}: its methods return seekable {@link Animation}
 * handles (data) that tween the object's {@link RuntimeState3D}. 3D transform
 * tweens carry `space: "3d"` so rotation interpolates via quaternion slerp.
 */
export class RegisteredObject3D {
  object: IMObject3D;
  parentId?: string;

  constructor(
    readonly id: string,
    object: IMObject3D,
    private transform: Transform3D,
  ) {
    this.object = object;
  }

  /** Replace the definition (post-build swap). */
  replaceObject(next: IMObject3D): void {
    this.object = next;
  }

  /** Current authoring (local) transform. */
  getTransform(): Transform3D {
    return this.transform;
  }

  /** Merge a partial transform into the local transform. */
  setTransform(transform: Partial<Transform3D>): void {
    this.transform = { ...this.transform, ...transform };
  }

  /** Baseline runtime state from the authoring transform. */
  initialState(): RuntimeState {
    return createInitialState3D(this.transform);
  }

  private tween(
    key: "position" | "rotation" | "scale",
    to: unknown,
    options?: TweenOptions,
  ): Animation {
    return buildTweenSpec(this.id, { type: "transform", key, space: "3d" }, to, options);
  }

  /** Tween world position. */
  moveTo(position: AbsXYZ, options?: TweenOptions): Animation {
    return this.tween("position", position, options);
  }

  /** Tween orientation (quaternion slerp). */
  rotateTo(rotation: Quaternion, options?: TweenOptions): Animation {
    return this.tween("rotation", rotation, options);
  }

  /** Tween orientation from intrinsic XYZ Euler angles (radians). */
  orientTo(euler: EulerRotation, options?: TweenOptions): Animation {
    return this.rotateTo(quatFromEuler(euler.x, euler.y, euler.z), options);
  }

  /** Tween scale (scalar or per-axis). */
  scaleTo(scale: Vec3 | number, options?: TweenOptions): Animation {
    return this.tween("scale", scale, options);
  }

  /** Tween opacity to a target value. */
  fadeTo(opacity: number, options?: TweenOptions): Animation {
    return buildTweenSpec(this.id, { type: "opacity" }, opacity, options);
  }

  /** Fade in from invisible. */
  fadeIn(options?: TweenOptions): Animation {
    return buildFadeSpec(this.id, 0, 1, options);
  }

  /** Fade out to invisible. */
  fadeOut(options?: TweenOptions): Animation {
    return this.fadeTo(0, options);
  }

  /**
   * `Create`: progressively reveal the object (revealEnd 0→1). The renderer
   * trims lines by arc length and reveals mesh/point geometry by build order
   * (design.md §11). Baseline hidden state is applied when played into the
   * Storyboard.
   */
  create(options?: Create3DOptions): Animation {
    const spec: AnimationSpec = {
      kind: "create",
      targetId: this.id,
      duration: options?.duration ?? DEFAULT_DURATION,
      stroke: options?.stroke ?? {},
      ...(options?.easing !== undefined ? { easing: options.easing } : {}),
    };
    return toAnimation(spec);
  }
}

/** Registered 3D axes with a coordinate mapping handle (design.md §7.4, §9.1). */
export interface RegisteredAxes3D extends RegisteredObject3D {
  readonly handle: Axes3DHandle;
  /** Same semantics as {@link RegisteredAxes2D.create}. */
  create(options?: AxesCreateOptions): Animation;
}
