import { type AbsXY, type Vec2 } from "../math/vec";
import {
  type Animation,
  type AnimationSpec,
  type Easing,
  type FillRevealSpec,
  type PropertyPath,
  type StrokeRevealSpec,
  toAnimation,
  type TweenOptions,
} from "../animation";
import {
  createInitialState2D,
  type RuntimeState2D,
  type RuntimeState2DPatch,
} from "../runtime/state";
import { hasTrait } from "../object/traits";
import { type IMObject2D } from "../object/types";
import { type AxesHandle } from "../layout/axes";
import { type UpdaterFn } from "../reactive/engine";

/** Minimal reactive host for per-object updaters. */
export interface UpdaterHost {
  addUpdater(targetId: string, fn: UpdaterFn): () => void;
}
import { type Transform2D } from "./transform";

const DEFAULT_DURATION = 1;

/** Options for the `Create` animation (design.md §11). */
export interface CreateOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly stroke?: StrokeRevealSpec;
  readonly fill?: FillRevealSpec;
}

/**
 * A 2D object registered into a Scene (design.md §9.2). It is the main target of
 * animation: its factory methods return Animation handles (data) without
 * executing. M1 implements tween-based motion (move/rotate/scale + generic
 * tween); Create/Fade reveal semantics and updaters/interaction arrive in later
 * milestones (M4/M6/M11).
 */
export class RegisteredObject2D {
  /** Current immutable object definition (design.md §9.2). */
  object: IMObject2D;

  constructor(
    readonly id: string,
    object: IMObject2D,
    private transform: Transform2D,
    /** Scene-provided setter to mutate this object's baseline runtime state. */
    readonly applyInitial?: (patch: RuntimeState2DPatch) => void,
    private readonly reactive?: UpdaterHost | null,
  ) {
    this.object = object;
  }

  /** Replace the definition (reactive rebuild or post-morph swap). */
  replaceObject(next: IMObject2D): void {
    this.object = next;
  }

  /** Per-frame updater (design.md §8.2); returns an unsubscribe function. */
  addUpdater(fn: UpdaterFn): () => void {
    if (!this.reactive) {
      throw new Error("Reactive engine is not bound to this scene; cannot addUpdater.");
    }
    return this.reactive.addUpdater(this.id, fn);
  }

  /** Current authoring (local) transform. */
  getTransform(): Transform2D {
    return this.transform;
  }

  /** Merge a partial transform into the local transform. */
  setTransform(transform: Partial<Transform2D>): void {
    this.transform = { ...this.transform, ...transform };
  }

  /** Baseline runtime state derived from the authoring transform. */
  initialState(): RuntimeState2D {
    return createInitialState2D(this.transform);
  }

  /** Tween an addressable runtime property to a target value. */
  tween(property: PropertyPath, to: unknown, options?: TweenOptions): Animation {
    const duration = options?.duration ?? DEFAULT_DURATION;
    const tweenSpec: AnimationSpec = {
      kind: "tween",
      targetId: this.id,
      property,
      to,
      duration,
      ...(options?.easing !== undefined ? { easing: options.easing } : {}),
    };
    if (options?.delay && options.delay > 0) {
      return toAnimation({
        kind: "sequence",
        children: [{ kind: "wait", duration: options.delay }, tweenSpec],
      });
    }
    return toAnimation(tweenSpec);
  }

  /** Tween world position. */
  moveTo(position: AbsXY, options?: TweenOptions): Animation {
    return this.tween({ type: "transform", key: "position" }, position, options);
  }

  /** Tween rotation (radians). */
  rotateTo(rotation: number, options?: TweenOptions): Animation {
    return this.tween({ type: "transform", key: "rotation" }, rotation, options);
  }

  /** Tween scale (scalar or per-axis). */
  scaleTo(scale: Vec2 | number, options?: TweenOptions): Animation {
    return this.tween({ type: "transform", key: "scale" }, scale, options);
  }

  /** Tween opacity to a target value. */
  fadeTo(opacity: number, options?: TweenOptions): Animation {
    return this.tween({ type: "opacity" }, opacity, options);
  }

  /** Fade in from invisible: sets baseline opacity 0, then tweens to 1. */
  fadeIn(options?: TweenOptions): Animation {
    this.applyInitial?.({ opacity: 0 });
    return this.tween({ type: "opacity" }, 1, options);
  }

  /** Fade out to invisible. */
  fadeOut(options?: TweenOptions): Animation {
    return this.tween({ type: "opacity" }, 0, options);
  }

  /**
   * `Create`: draw the object on (stroke trim, then fill reveal). Sets the
   * baseline state hidden so the object is not shown before this plays (§11).
   */
  create(options?: CreateOptions): Animation {
    const hasFill = Boolean(this.object.style?.fill) && hasTrait(this.object.traits, "fill");
    this.applyInitial?.({ revealStart: 0, revealEnd: 0, fillProgress: hasFill ? 0 : 1 });
    const spec: AnimationSpec = {
      kind: "create",
      targetId: this.id,
      duration: options?.duration ?? DEFAULT_DURATION,
      stroke: options?.stroke ?? {},
      ...(hasFill ? { fill: options?.fill ?? { mode: "after-stroke-fade", overlap: 0.2 } } : {}),
      ...(options?.easing !== undefined ? { easing: options.easing } : {}),
    };
    return toAnimation(spec);
  }
}

/** Registered axes with a coordinate mapping handle (design.md §7.4). */
export interface RegisteredAxes2D extends RegisteredObject2D {
  readonly handle: AxesHandle;
}
