import { type Animation } from "../animation/spec";
import {
  StoryboardBuilder,
  type AnimationResolver,
  type Storyboard,
  type TimelineOp,
} from "../animation/storyboard";
import { IntermactError } from "../errors";
import { type Registries } from "../extend/types";
import { type IMObject } from "../object/types";
import { type RuntimeState } from "../runtime/state";

/** Result of a build-time `play` call (resolves immediately). */
export interface PlaybackResult {
  readonly duration: number;
}

/** Minimal shape a registered node must expose for hierarchy bookkeeping. */
export interface SceneNode {
  readonly id: string;
  parentId?: string;
}

/**
 * Shared scene bookkeeping composed by {@link Scene2D}/`Scene3D`
 * (design.md §9.1, §13.6.1). Owns the object/state registries, the parent
 * graph, the id counter, and the {@link StoryboardBuilder}, and exposes the
 * dimension-agnostic build-pass surface (`play`/`commit`/`wait`/`marker`/…)
 * plus cycle-safe re-parenting. Scenes *hold* one of these (composition over
 * inheritance) so the 2D/3D authoring APIs stay identical without a shared
 * base class.
 */
export class SceneHost<R extends SceneNode> {
  readonly objects = new Map<string, IMObject>();
  readonly initialStates = new Map<string, RuntimeState>();
  /** Pristine baseline states (pre compile-time baseline patches) for serialization. */
  readonly pristineStates = new Map<string, RuntimeState>();
  readonly registered = new Map<string, R>();
  readonly parents = new Map<string, string>();
  readonly builder: StoryboardBuilder;
  private counter = 0;

  constructor(
    /** Owning scene id (namespaces generated object ids and error messages). */
    readonly sceneId: string,
    /** Registry bundle for custom-animation resolution (design.md §18). */
    registries: Registries,
  ) {
    const resolveAnimation: AnimationResolver = (type) => registries.animations.get(type);
    this.builder = new StoryboardBuilder(this.initialStates, this.objects, resolveAnimation);
  }

  /** Allocate the next namespaced id for a `prefix` (typically an object type). */
  nextId(prefix: string): string {
    return `${this.sceneId}:${prefix}-${this.counter++}`;
  }

  /** Record a freshly-registered node's definition and baseline state. */
  track(ro: R, object: IMObject, baseline: RuntimeState): void {
    this.objects.set(ro.id, object);
    this.initialStates.set(ro.id, baseline);
    this.pristineStates.set(ro.id, baseline);
    this.registered.set(ro.id, ro);
  }

  /**
   * Parent `child` under `parent` with self/registration/cycle guards
   * (design.md §9.3). Passing `null` detaches. Mutates the `parents` graph and
   * `child.parentId`.
   */
  validateAndSetParent(child: R, parent: R | null): void {
    if (parent === child) {
      throw new IntermactError("invalid-argument", `Cannot parent object "${child.id}" to itself.`);
    }
    if (parent && !this.registered.has(parent.id)) {
      throw new IntermactError(
        "invalid-argument",
        `Parent "${parent.id}" is not registered in scene "${this.sceneId}".`,
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

  /** Remove a node and any parent links that reference it. */
  untrack(id: string): void {
    this.objects.delete(id);
    this.initialStates.delete(id);
    this.pristineStates.delete(id);
    this.registered.delete(id);
    this.parents.delete(id);
    for (const [child, parent] of [...this.parents]) {
      if (parent === id) this.parents.delete(child);
    }
  }

  /** Remove all nodes. */
  clearAll(): void {
    this.objects.clear();
    this.initialStates.clear();
    this.pristineStates.clear();
    this.registered.clear();
    this.parents.clear();
  }

  /** Build-pass: append animations in parallel and advance the cursor (§3.2). */
  play(animations: Animation[]): Promise<PlaybackResult> {
    const duration = this.builder.play(animations);
    return Promise.resolve({ duration });
  }

  /** Apply immediate (duration-0) changes without a visible transition. */
  commit(animations: Animation[]): void {
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

  /** Finalize the accumulated timeline. */
  buildStoryboard(): Storyboard {
    return this.builder.build();
  }

  /** Ordered build-pass op-log for serialization (design.md §17). */
  getTimelineOps(): readonly TimelineOp[] {
    return this.builder.getOps();
  }
}
