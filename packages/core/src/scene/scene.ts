import { type Animation } from "../animation/spec";
import { StoryboardBuilder, type Storyboard } from "../animation/storyboard";
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
import { IntermactError } from "../errors";
import { type RuntimeState2D } from "../runtime/state";
import { emptyObject2D } from "./empty";
import { createLayoutHandle, type LayoutHost } from "./layout";
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
export class Scene2D implements LayoutHost {
  readonly kind = "scene-2d" as const;
  readonly coordinate: CoordinateTransform2D;
  private readonly objects = new Map<string, IMObject>();
  private readonly initialStates = new Map<string, RuntimeState2D>();
  private readonly registered = new Map<string, RegisteredObject2D>();
  private readonly parents = new Map<string, string>();
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
    const ro = new RegisteredObject2D(id, object, transform, this.reactive, this);
    ro.layout = createLayoutHandle(ro, this);
    this.objects.set(id, object);
    this.initialStates.set(id, ro.initialState());
    this.registered.set(id, ro);
    return ro;
  }

  /**
   * Parent `child` under `parent` in the transform hierarchy (design.md §9.3).
   * The Player composes world transforms at snapshot time; layout/bounds reflect
   * the parent chain.
   */
  setParent(child: RegisteredObject2D, parent: RegisteredObject2D | null): void {
    if (parent === child) {
      throw new IntermactError("invalid-argument", `Cannot parent object "${child.id}" to itself.`);
    }
    if (parent && !this.registered.has(parent.id)) {
      throw new IntermactError(
        "invalid-argument",
        `Parent "${parent.id}" is not registered in scene "${this.id}".`,
      );
    }
    if (parent) {
      let cursor: string | undefined = parent.id;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === child.id) {
          throw new IntermactError(
            "invalid-argument",
            `Parenting "${child.id}" under "${parent.id}" would create a cycle.`,
          );
        }
        if (seen.has(cursor)) break;
        seen.add(cursor);
        cursor = this.parents.get(cursor);
      }
      this.parents.set(child.id, parent.id);
      child.parentId = parent.id;
    } else {
      this.parents.delete(child.id);
      child.parentId = undefined;
    }
  }

  /** Parent links keyed by child id (for snapshot world-transform composition). */
  getParents(): ReadonlyMap<string, string> {
    return this.parents;
  }

  /** {@link LayoutHost}: normalized domain UV → absolute world point. */
  relToAbs(p: RelUV): AbsXY {
    return this.coordinate.relToAbs(p);
  }

  /** {@link LayoutHost}: composed world transform of an object's parent chain. */
  parentWorldTransform(id: string): ResolvedTransform2D {
    const parentId = this.parents.get(id);
    if (!parentId) return IDENTITY_TRANSFORM_2D;
    const parent = this.registered.get(parentId);
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

  /** Authoring transform for reactive updater sync ({@link ReactiveEngine.flush}). */
  getAuthoringTransform(id: string): ResolvedTransform2D | undefined {
    const ro = this.registered.get(id);
    if (!ro) return undefined;
    return resolveTransform2D(ro.getTransform());
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
    this.reactive?.unregisterObject(target.id);
    this.objects.delete(target.id);
    this.initialStates.delete(target.id);
    this.registered.delete(target.id);
    this.parents.delete(target.id);
    for (const [child, parent] of [...this.parents]) {
      if (parent === target.id) this.parents.delete(child);
    }
  }

  /** Remove all objects. */
  clear(): void {
    for (const id of [...this.registered.keys()]) {
      this.reactive?.unregisterObject(id);
    }
    this.objects.clear();
    this.initialStates.clear();
    this.registered.clear();
    this.parents.clear();
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
