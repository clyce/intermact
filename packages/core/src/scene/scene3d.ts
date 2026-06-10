import { type Animation } from "../animation/spec";
import { type Storyboard, type TimelineOp } from "../animation/storyboard";
import { globalRegistries } from "../extend/registries";
import { type Registries } from "../extend/types";
import { type Axes3DLayoutProps, axes3DLayoutObject, createAxes3DHandle } from "../layout/axes3d";
import {
  CoordinateTransform3D,
  type CoordinateSystem3D,
  type Domain3D,
} from "../layout/coordinate-transform-3d";
import { type IMObject, type IMObject3D } from "../object/types";
import { type RuntimeState } from "../runtime/state";
import { type Camera3DProps, RegisteredCamera3D } from "./camera3d";
import { emptyObject3D } from "./empty3d";
import { type AxesCreateOptions } from "./registered-object";
import { RegisteredObject3D, type RegisteredAxes3D } from "./registered-object-3d";
import { SceneHost, type PlaybackResult } from "./scene-host";
import { type Transform3D } from "./transform";

/**
 * 3D scene authoring props (design.md §10). `coordinate` and `domain` are
 * optional (defaulting to a cartesian unit cube) so transform-only 3D scenes —
 * where the camera frames the content directly — stay terse.
 */
export interface Scene3DProps {
  /** Coordinate system family (default `"cartesian"`). */
  readonly coordinate?: CoordinateSystem3D;
  /** World-coordinate domain used by {@link Scene3D.coordinate}/`getAxes`. */
  readonly domain?: Domain3D;
  /** Background CSS color for the rendered viewport. */
  readonly background?: string;
}

/**
 * Minimal 3D Scene (design.md §10): registration + build-pass orchestration,
 * mirroring {@link Scene2D}. Composes a {@link SceneHost} over the
 * {@link RuntimeState} union, so 3D objects animate through the same seekable
 * timeline machinery as 2D ones.
 */
export class Scene3D {
  readonly kind = "scene-3d" as const;
  /** Coordinate transforms over the scene domain (design.md §7.2, §10). */
  readonly coordinate: CoordinateTransform3D;
  private readonly host: SceneHost<RegisteredObject3D>;

  constructor(
    readonly id: string,
    readonly props: Scene3DProps = {},
    /** Registry bundle for custom-animation resolution (default: global, §18). */
    registries: Registries = globalRegistries,
  ) {
    this.coordinate = new CoordinateTransform3D(props.domain, props.coordinate ?? "cartesian");
    this.host = new SceneHost(id, registries);
  }

  /** Register a 3D object definition with an optional initial transform. */
  register(object: IMObject3D, transform: Transform3D = {}): RegisteredObject3D {
    const id = this.host.nextId(object.type);
    const ro = new RegisteredObject3D(id, object, transform);
    this.host.track(ro, object, ro.initialState());
    return ro;
  }

  /** Register a transform-only empty node (for `group3D` hierarchies). */
  registerEmpty(transform: Transform3D = {}): RegisteredObject3D {
    return this.register(emptyObject3D(), transform);
  }

  /**
   * Register a camera into the scene (design.md §10.1). The camera is backed by
   * a transform node so its eye/orientation are part of the timeline.
   */
  registerCamera(props: Camera3DProps = {}): RegisteredCamera3D {
    const id = this.host.nextId("camera-3d");
    const node = new RegisteredObject3D(id, emptyObject3D("camera-3d"), {});
    const camera = new RegisteredCamera3D(node, props);
    this.host.track(node, node.object, node.initialState());
    return camera;
  }

  /**
   * Parent `child` under `parent` (design.md §9.3); the Player composes world
   * transforms at snapshot time.
   */
  setParent(child: RegisteredObject3D, parent: RegisteredObject3D | null): void {
    this.host.validateAndSetParent(child, parent);
  }

  /**
   * Group registered objects under a new transform-only parent (design.md §9.3).
   * Returns the parent so the whole group can be moved/animated together.
   */
  group3D(
    children: readonly RegisteredObject3D[],
    transform: Transform3D = {},
  ): RegisteredObject3D {
    const parent = this.registerEmpty(transform);
    for (const child of children) this.setParent(child, parent);
    return parent;
  }

  /** Parent links keyed by child id (for snapshot world-transform composition). */
  getParents(): ReadonlyMap<string, string> {
    return this.host.parents;
  }

  /**
   * Create and register 3D coordinate axes (design.md §9.1). Returns a
   * {@link RegisteredAxes3D} so visibility/motion use the standard object
   * animation API; `handle.c2p`/`p2c` map data coordinates to world space.
   */
  getAxes(props: Axes3DLayoutProps, transform: Transform3D = {}): RegisteredAxes3D {
    const ro = this.register(axes3DLayoutObject(props), transform);
    const baseCreate = ro.create.bind(ro);
    return Object.assign(ro, {
      handle: createAxes3DHandle(props),
      create(options?: AxesCreateOptions) {
        const mode = options?.mode ?? "sequential";
        return baseCreate({
          duration: options?.duration ?? 2,
          ...(options?.easing !== undefined ? { easing: options.easing } : {}),
          stroke: { mode, glyphOverlap: options?.overlap ?? 0, ...options?.stroke },
        });
      },
    }) as RegisteredAxes3D;
  }

  /** Build-pass: append animations in parallel and advance the cursor. */
  play(...animations: Animation[]): Promise<PlaybackResult> {
    return this.host.play(animations);
  }

  /** Apply immediate (duration-0) changes. */
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
   * baseline patches (design.md §17 serialization).
   */
  getInitialStatesPristine(): ReadonlyMap<string, RuntimeState> {
    return this.host.pristineStates;
  }
}
