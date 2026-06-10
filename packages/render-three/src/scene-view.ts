import { Group } from "three";
import {
  findTrait,
  type IMObject2D,
  type IMObject3D,
  type ObjectRenderState,
  type RenderSnapshot,
} from "@intermact/core";
import { type RenderContext, ThreeObjectView } from "./object-view";
import { ThreeObject3DView } from "./object-view-3d";
import { InstancedObjectView } from "./object-view-instanced";

/** Common surface of a per-object three.js view (2D or 3D). */
interface ObjectViewLike {
  readonly group: Group;
  update(render: ObjectRenderState, ctx: RenderContext): void;
  dispose(): void;
}

/** Which concrete view a render state maps to, used to detect re-dispatch. */
type ViewKind = "3d" | "instanced" | "2d";

/** Pick the view kind for a render state (mirrors {@link ThreeSceneView.createView}). */
function viewKindOf(render: ObjectRenderState): ViewKind {
  if (render.object.dimension === "3d") return "3d";
  const instanced = findTrait((render.object as IMObject2D).traits, "instanced");
  return instanced && instanced.instances.length > 0 ? "instanced" : "2d";
}

/**
 * Diffs a {@link RenderSnapshot} onto a three.js scene graph (design.md §15.1).
 * Adds views for new object ids, updates existing ones, and disposes removed
 * ones. Dispatches 2D objects to {@link ThreeObjectView} and 3D objects to
 * {@link ThreeObject3DView}. Camera nodes (type `camera-3d`) are skipped — the
 * R3F layer reads their transform directly. Framework-free: R3F hosts `root` and
 * calls `update` per frame.
 */
export class ThreeSceneView {
  readonly root = new Group();
  private readonly views = new Map<string, { kind: ViewKind; view: ObjectViewLike }>();

  update(snapshot: RenderSnapshot, ctx: RenderContext): void {
    // Remove views whose objects are gone.
    for (const [id, entry] of this.views) {
      if (!snapshot.objects.has(id)) {
        this.root.remove(entry.view.group);
        entry.view.dispose();
        this.views.delete(id);
      }
    }
    for (const [id, render] of snapshot.objects) {
      // Camera nodes and transform-only empties carry no geometry; rendered-scene
      // panels are composited by the R3F layer (offscreen render target), not the
      // snapshot diff.
      const t = render.object.type;
      if (t === "camera-3d" || t === "empty-3d" || t === "rendered-scene") continue;
      const kind = viewKindOf(render);
      let entry = this.views.get(id);
      // Re-dispatch if the object's nature changed (e.g. it gained/lost an
      // instanced trait, or a 2D↔3D replacement reused the same id).
      if (entry && entry.kind !== kind) {
        this.root.remove(entry.view.group);
        entry.view.dispose();
        this.views.delete(id);
        entry = undefined;
      }
      if (!entry) {
        const view = this.createView(render);
        entry = { kind, view };
        this.views.set(id, entry);
        this.root.add(view.group);
      }
      entry.view.update(render, ctx);
    }
  }

  /**
   * Pick the per-object view: 3D objects → {@link ThreeObject3DView}; 2D objects
   * advertising an {@link InstancedTrait} → {@link InstancedObjectView} (real GPU
   * instancing, design.md §15.2); all other 2D objects → {@link ThreeObjectView}.
   */
  private createView(render: ObjectRenderState): ObjectViewLike {
    if (render.object.dimension === "3d") {
      return new ThreeObject3DView(render.object as IMObject3D);
    }
    const object = render.object as IMObject2D;
    const instanced = findTrait(object.traits, "instanced");
    if (instanced && instanced.instances.length > 0) {
      return new InstancedObjectView(object);
    }
    return new ThreeObjectView(object);
  }

  dispose(): void {
    for (const { view } of this.views.values()) {
      this.root.remove(view.group);
      view.dispose();
    }
    this.views.clear();
  }
}
