import { type Animation } from "../animation/spec";
import { type Storyboard, type TimelineOp } from "../animation/storyboard";
import { globalRegistries } from "../extend/registries";
import { type Registries } from "../extend/types";
import { axesObject, createAxesHandle, type AxesProps } from "../layout/axes";
import { CoordinateTransform2D } from "../layout/coordinate-transform";
import { type ReactiveObjectSource } from "../reactive/derived";
import { type ReactiveEngine } from "../reactive/engine";
import { type AbsXY, type RelUV } from "../math/vec";
import { type IMObject, type IMObject2D } from "../object/types";
import { type ResolvedTransform2D } from "../runtime/state";
import {
  composeTransform2D,
  IDENTITY_TRANSFORM_2D,
  resolveTransform2D,
} from "../runtime/world-transform";
import { type RuntimeState } from "../runtime/state";
import { emptyObject2D } from "./empty";
import { createLayoutHandle, type LayoutHost } from "./layout";
import {
  RegisteredObject2D,
  type AxesCreateOptions,
  type RegisteredAxes2D,
} from "./registered-object";
import { SceneHost, type PlaybackResult } from "./scene-host";
import { type Transform2D } from "./transform";
import { type Scene2DProps } from "./types";

/**
 * Minimal 2D Scene (design.md §9.1): registration + build-pass orchestration.
 * Composes a {@link SceneHost} for the shared registry/timeline bookkeeping and
 * adds the 2D-specific coordinate transforms, layout, and reactive wiring (M5).
 */
export class Scene2D implements LayoutHost {
  readonly kind = "scene-2d" as const;
  readonly coordinate: CoordinateTransform2D;
  private readonly host: SceneHost<RegisteredObject2D>;
  private reactive: ReactiveEngine | null = null;

  constructor(
    readonly id: string,
    readonly props: Scene2DProps,
    /** Registry bundle for custom-animation resolution (default: global, §18). */
    registries: Registries = globalRegistries,
  ) {
    this.coordinate = new CoordinateTransform2D(props);
    this.host = new SceneHost(id, registries);
  }

  /** Attach the reactive engine used by registerReactive / addUpdater (M6). */
  bindReactive(engine: ReactiveEngine): void {
    this.reactive = engine;
  }

  /** Register an object definition with an optional initial transform. */
  register(object: IMObject2D, transform: Transform2D = {}): RegisteredObject2D {
    const id = this.host.nextId(object.type);
    const ro = new RegisteredObject2D(id, object, transform, this.reactive, this);
    ro.layout = createLayoutHandle(ro, this);
    this.host.track(ro, object, ro.initialState());
    return ro;
  }

  /**
   * Parent `child` under `parent` in the transform hierarchy (design.md §9.3).
   * The Player composes world transforms at snapshot time; layout/bounds reflect
   * the parent chain.
   */
  setParent(child: RegisteredObject2D, parent: RegisteredObject2D | null): void {
    this.host.validateAndSetParent(child, parent);
  }

  /** Parent links keyed by child id (for snapshot world-transform composition). */
  getParents(): ReadonlyMap<string, string> {
    return this.host.parents;
  }

  /** {@link LayoutHost}: normalized domain UV → absolute world point. */
  relToAbs(p: RelUV): AbsXY {
    return this.coordinate.relToAbs(p);
  }

  /** {@link LayoutHost}: composed world transform of an object's parent chain. */
  parentWorldTransform(id: string): ResolvedTransform2D {
    const parentId = this.host.parents.get(id);
    if (!parentId) return IDENTITY_TRANSFORM_2D;
    const parent = this.host.registered.get(parentId);
    return composeTransform2D(
      this.parentWorldTransform(parentId),
      resolveTransform2D(parent?.getTransform()),
    );
  }

  /**
   * Create and register coordinate axes (design.md §9.1). Returns a
   * {@link RegisteredAxes2D} so visibility and motion use the standard object
   * animation API (`fadeIn`, `create`, `moveTo`, …) instead of Scene-level helpers.
   */
  getAxes(props: AxesProps, transform: Transform2D = {}): RegisteredAxes2D {
    const object = axesObject(props, this.props.domain);
    const ro = this.register(object, transform);
    const handle = createAxesHandle(props, this.props.domain);
    const baseCreate = ro.create.bind(ro);
    const axes = Object.assign(ro, {
      handle,
      create(options?: AxesCreateOptions): Animation {
        const mode = options?.mode ?? "sequential";
        return baseCreate({
          duration: options?.duration ?? 2,
          ...(options?.easing !== undefined ? { easing: options.easing } : {}),
          ...(options?.fill !== undefined ? { fill: options.fill } : {}),
          stroke: {
            mode,
            glyphOverlap: options?.overlap ?? 0,
            ...options?.stroke,
          },
        });
      },
    }) as RegisteredAxes2D;
    return axes;
  }

  /** Register a reactive derived object (design.md §8.2). */
  registerReactive(source: ReactiveObjectSource, transform: Transform2D = {}): RegisteredObject2D {
    const initial = source.build();
    const ro = this.register(initial, transform);
    this.reactive?.registerDerived(ro.id, source);
    return ro;
  }

  /** Replace an object's definition in-place (used by the reactive engine). */
  replaceObject(id: string, object: IMObject2D): void {
    this.host.objects.set(id, object);
    const ro = this.host.registered.get(id);
    if (ro) ro.replaceObject(object);
  }

  /** Authoring transform for reactive updater sync ({@link ReactiveEngine.flush}). */
  getAuthoringTransform(id: string): ResolvedTransform2D | undefined {
    const ro = this.host.registered.get(id);
    if (!ro) return undefined;
    return resolveTransform2D(ro.getTransform());
  }

  /** Register a transform-only empty node for hierarchies. */
  registerEmpty(transform: Transform2D = {}): RegisteredObject2D {
    return this.register(emptyObject2D(), transform);
  }

  /** Build-pass: append animations in parallel and advance the cursor (§3.2). */
  play(...animations: Animation[]): Promise<PlaybackResult> {
    return this.host.play(animations);
  }

  /** Apply immediate (duration-0) changes without a visible transition. */
  commit(...animations: Animation[]): void {
    this.host.commit(animations);
  }

  /** Hold for `duration` seconds on the timeline. */
  wait(duration: number): Promise<void> {
    return this.host.wait(duration);
  }

  /** Place a named marker at the current cursor. */
  marker(name: string): void {
    this.host.marker(name);
  }

  /** Remove an object from the scene. */
  free(target: RegisteredObject2D): void {
    this.reactive?.unregisterObject(target.id);
    this.host.untrack(target.id);
  }

  /** Remove all objects. */
  clear(): void {
    for (const id of [...this.host.registered.keys()]) {
      this.reactive?.unregisterObject(id);
    }
    this.host.clearAll();
  }

  /** Finalize the accumulated timeline. */
  buildStoryboard(): Storyboard {
    return this.host.buildStoryboard();
  }

  /** Ordered build-pass op-log for serialization (design.md §17). */
  getTimelineOps(): readonly TimelineOp[] {
    return this.host.getTimelineOps();
  }

  /** Object definitions keyed by id (for snapshot building). */
  getObjects(): ReadonlyMap<string, IMObject> {
    return this.host.objects;
  }

  /** Baseline runtime states keyed by id. */
  getInitialStates(): ReadonlyMap<string, RuntimeState> {
    return this.host.initialStates;
  }

  /**
   * Pristine baseline states captured at registration, before compile-time
   * baseline patches (design.md §17 serialization). Replaying the op-log on
   * these reproduces the post-build initial states exactly.
   */
  getInitialStatesPristine(): ReadonlyMap<string, RuntimeState> {
    return this.host.pristineStates;
  }
}
