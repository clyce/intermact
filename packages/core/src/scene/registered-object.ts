import { type AbsXY, type Vec2 } from "../math/vec";
import {
  type Animation,
  type AnimationSpec,
  buildFadeSpec,
  buildTweenSpec,
  type Easing,
  type FillRevealSpec,
  morph,
  type MorphOptions,
  type PropertyPath,
  type StrokeRevealMode,
  type StrokeRevealSpec,
  toAnimation,
  transformMatching,
  type TweenOptions,
} from "../animation";
import { createInitialState2D, type RuntimeState2D } from "../runtime/state";
import { findTrait, hasTrait, type InteractiveTrait } from "../object/traits";
import { type IMObject2D } from "../object/types";
import { pickRectFromObject } from "../interaction/hit-test";
import { type PickProxy, type PointerEventBinding } from "../interaction/types";
import { type AxesHandle } from "../layout/axes";
import { type LayoutHandle } from "./layout";
import { type UpdaterFn } from "../reactive/engine";

/** Minimal reactive host for per-object updaters. */
export interface UpdaterHost {
  addUpdater(targetId: string, fn: UpdaterFn): () => void;
}

/** Host able to swap an object's definition (so `.on()` reaches snapshots). */
export interface DefinitionHost {
  replaceObject(id: string, object: IMObject2D): void;
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
 * Options for axes `create()` — `parallel` draws every axis/tick at once;
 * `sequential` reveals each axis then its tick+label clusters in order.
 */
export interface AxesCreateOptions extends Omit<CreateOptions, "stroke"> {
  readonly mode?: Extract<StrokeRevealMode, "sequential" | "contour-parallel">;
  /** Overlap between sequential groups (0 = strict order). */
  readonly overlap?: number;
  readonly stroke?: StrokeRevealSpec;
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

  /** RectTransform-/Manim-style layout (design.md §9.4); set by the Scene. */
  layout!: LayoutHandle;

  /** Parent in the transform hierarchy (design.md §9.3), if any. */
  parentId?: string;

  constructor(
    readonly id: string,
    object: IMObject2D,
    private transform: Transform2D,
    private readonly reactive?: UpdaterHost | null,
    private readonly defHost?: DefinitionHost | null,
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
    return buildTweenSpec(this.id, property, to, options);
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

  /** Fade in from invisible: baseline opacity 0 is applied when this is played (§11). */
  fadeIn(options?: TweenOptions): Animation {
    return buildFadeSpec(this.id, 0, 1, options);
  }

  /** Fade out to invisible. */
  fadeOut(options?: TweenOptions): Animation {
    return this.tween({ type: "opacity" }, 0, options);
  }

  /**
   * `Create`: draw the object on (stroke trim, then fill reveal). Baseline
   * hidden state is applied when this animation is played into the Storyboard (§11).
   */
  create(options?: CreateOptions): Animation {
    const hasFill = Boolean(this.object.style?.fill) && hasTrait(this.object.traits, "fill");
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

  /**
   * `Write`: sequential left-to-right glyph stroke reveal for text/LaTeX
   * (design.md §13). Sugar over {@link create} with `stroke.direction: "ltr"`
   * and optional `stroke.glyphOverlap` (negative padding between glyphs).
   */
  write(options?: CreateOptions): Animation {
    return this.create({
      ...options,
      stroke: { mode: "path-order", direction: "ltr", glyphOverlap: 0, ...options?.stroke },
    });
  }

  /**
   * `Morph`: transform this object's geometry toward `target` (design.md §11.4).
   * Strategy defaults to `arc-length`; pass `strategy: "matching"` (or use
   * {@link transformMatchingTo}) for part-keyed composite morphs.
   */
  morphTo(target: IMObject2D, options?: MorphOptions): Animation {
    return morph(this, target, options);
  }

  /** Part-aware morph (transformer/remover/introducer) toward a composite target. */
  transformMatchingTo(target: IMObject2D, options?: MorphOptions): Animation {
    return transformMatching(this, target, options);
  }

  /**
   * Attach pointer/drag handlers (design.md §12.2). Adds (or replaces) an
   * {@link InteractiveTrait} carrying the binding and a pick proxy (defaults to
   * the object's bounds rect), propagating the new definition so the renderer
   * sees it. Returns `this` for chaining.
   */
  on(binding: PointerEventBinding, pick?: PickProxy): this {
    const existing = findTrait(this.object.traits, "interactive");
    const proxy = pick ?? existing?.pick ?? pickRectFromObject(this.object);
    const trait: InteractiveTrait = {
      kind: "interactive",
      pick: proxy,
      binding,
      ...(existing?.drag ? { drag: existing.drag } : {}),
      ...(existing?.cursor ? { cursor: existing.cursor } : {}),
    };
    const traits = [...this.object.traits.filter((t) => t.kind !== "interactive"), trait];
    const next: IMObject2D = { ...this.object, traits };
    this.object = next;
    this.defHost?.replaceObject(this.id, next);
    return this;
  }
}

/** Registered axes with a coordinate mapping handle (design.md §7.4). */
export interface RegisteredAxes2D extends RegisteredObject2D {
  readonly handle: AxesHandle;
  /**
   * Draw axes on: `sequential` (default) reveals each axis and its tick+label
   * clusters in order; `contour-parallel` (`mode: "contour-parallel"`) draws all
   * at once.
   */
  create(options?: AxesCreateOptions): Animation;
}
