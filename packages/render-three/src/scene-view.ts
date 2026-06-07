import { Group } from "three";
import { type RenderSnapshot } from "@intermact/core";
import { type RenderContext, ThreeObjectView } from "./object-view";

/**
 * Diffs a {@link RenderSnapshot} onto a three.js scene graph (design.md §15.1).
 * Adds views for new object ids, updates existing ones, and disposes removed
 * ones. Framework-free: R3F simply hosts `root` and calls `update` per frame.
 */
export class ThreeSceneView {
  readonly root = new Group();
  private readonly views = new Map<string, ThreeObjectView>();

  update(snapshot: RenderSnapshot, ctx: RenderContext): void {
    // Remove views whose objects are gone.
    for (const [id, view] of this.views) {
      if (!snapshot.objects.has(id)) {
        this.root.remove(view.group);
        view.dispose();
        this.views.delete(id);
      }
    }
    // Add/update views for present objects (2D only in Phase-1).
    for (const [id, render] of snapshot.objects) {
      if (render.object.dimension !== "2d") continue;
      let view = this.views.get(id);
      if (!view) {
        view = new ThreeObjectView(render.object);
        this.views.set(id, view);
        this.root.add(view.group);
      }
      view.update(render, ctx);
    }
  }

  dispose(): void {
    for (const view of this.views.values()) {
      this.root.remove(view.group);
      view.dispose();
    }
    this.views.clear();
  }
}
