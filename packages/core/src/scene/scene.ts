import { type Animation } from "../animation/spec";
import { StoryboardBuilder, type Storyboard } from "../animation/storyboard";
import { axesObject, createAxesHandle, type AxesProps } from "../layout/axes";
import { CoordinateTransform2D } from "../layout/coordinate-transform";
import { type ReactiveObjectSource } from "../reactive/derived";
import { type ReactiveEngine } from "../reactive/engine";
import { type IMObject, type IMObject2D } from "../object/types";
import { applyPatch2D, type RuntimeState2D, type RuntimeState2DPatch } from "../runtime/state";
import { emptyObject2D } from "./empty";
import { RegisteredObject2D, type RegisteredAxes2D } from "./registered-object";
import { type Transform2D } from "./transform";
import { type Scene2DProps } from "./types";

/** Result of a build-time `play` call (resolves immediately). */
export interface PlaybackResult {
  readonly duration: number;
}

/**
 * Minimal 2D Scene (design.md §9.1): registration + build-pass orchestration.
 * Owns a {@link StoryboardBuilder} that accumulates the timeline as the program
 * runs, plus coordinate transforms (M5).
 */
export class Scene2D {
  readonly kind = "scene-2d" as const;
  readonly coordinate: CoordinateTransform2D;
  private readonly objects = new Map<string, IMObject>();
  private readonly initialStates = new Map<string, RuntimeState2D>();
  private readonly registered = new Map<string, RegisteredObject2D>();
  private counter = 0;
  private readonly builder: StoryboardBuilder;
  private reactive: ReactiveEngine | null = null;

  constructor(
    readonly id: string,
    readonly props: Scene2DProps,
  ) {
    this.coordinate = new CoordinateTransform2D(props);
    this.builder = new StoryboardBuilder(this.initialStates, this.objects);
  }

  /** Attach the reactive engine used by registerReactive / addUpdater (M6). */
  bindReactive(engine: ReactiveEngine): void {
    this.reactive = engine;
  }

  private nextId(prefix: string): string {
    return `${this.id}:${prefix}-${this.counter++}`;
  }

  /** Register an object definition with an optional initial transform. */
  register(object: IMObject2D, transform: Transform2D = {}): RegisteredObject2D {
    const id = this.nextId(object.type);
    const applyInitial = (patch: RuntimeState2DPatch): void => {
      const current = this.initialStates.get(id);
      if (current) this.initialStates.set(id, applyPatch2D(current, patch));
    };
    const ro = new RegisteredObject2D(id, object, transform, applyInitial, this.reactive);
    this.objects.set(id, object);
    this.initialStates.set(id, ro.initialState());
    this.registered.set(id, ro);
    return ro;
  }

  /**
   * Create and register coordinate axes (design.md §9.1). Returns a
   * {@link RegisteredAxes2D} so visibility and motion use the standard object
   * animation API (`fadeIn`, `create`, `moveTo`, …) instead of Scene-level helpers.
   */
  getAxes(props: AxesProps, transform: Transform2D = {}): RegisteredAxes2D {
    const object = axesObject(props, this.props.domain);
    const ro = this.register(object, transform) as RegisteredAxes2D;
    const handle = createAxesHandle(props, this.props.domain);
    Object.assign(ro, { handle });
    return ro;
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
    this.objects.set(id, object);
    const ro = this.registered.get(id);
    if (ro) ro.replaceObject(object);
  }

  /** Register a transform-only empty node for hierarchies. */
  registerEmpty(transform: Transform2D = {}): RegisteredObject2D {
    return this.register(emptyObject2D(), transform);
  }

  /** Build-pass: append animations in parallel and advance the cursor (§3.2). */
  play(...animations: Animation[]): Promise<PlaybackResult> {
    const duration = this.builder.play(animations);
    return Promise.resolve({ duration });
  }

  /** Apply immediate (duration-0) changes without a visible transition. */
  commit(...animations: Animation[]): void {
    this.builder.commit(animations);
  }

  /** Hold for `duration` seconds on the timeline. */
  wait(duration: number): Promise<void> {
    this.builder.wait(duration);
    return Promise.resolve();
  }

  /** Place a named marker at the current cursor. */
  marker(name: string): void {
    this.builder.marker(name);
  }

  /** Remove an object from the scene. */
  free(target: RegisteredObject2D): void {
    this.objects.delete(target.id);
    this.initialStates.delete(target.id);
    this.registered.delete(target.id);
  }

  /** Remove all objects. */
  clear(): void {
    this.objects.clear();
    this.initialStates.clear();
    this.registered.clear();
  }

  /** Finalize the accumulated timeline. */
  buildStoryboard(): Storyboard {
    return this.builder.build();
  }

  /** Object definitions keyed by id (for snapshot building). */
  getObjects(): ReadonlyMap<string, IMObject> {
    return this.objects;
  }

  /** Baseline runtime states keyed by id. */
  getInitialStates(): ReadonlyMap<string, RuntimeState2D> {
    return this.initialStates;
  }
}
