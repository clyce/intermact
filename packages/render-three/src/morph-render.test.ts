import { describe, expect, it } from "vitest";
import {
  buildProgram,
  circle,
  createProgram,
  morph,
  rectangle,
  xy,
  type IMObject2D,
  type RuntimeState2D,
} from "@intermact/core";
import type { Mesh } from "three";
import { ThreeObjectView } from "./object-view";

/** Count stroke vertices on the first stroke mesh in a {@link ThreeObjectView}. */
function strokeVertexCount(view: ThreeObjectView): number {
  const stroke = view.group.children.find((c) => c.renderOrder > 0) as Mesh | undefined;
  return stroke?.geometry.getAttribute("position").count ?? 0;
}

describe("morph geometryVersion ↔ ThreeObjectView (phase-2-review P1)", () => {
  it("rebuilds stroke geometry when morph progress changes geometryVersion", async () => {
    let targetId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));

      const disk = scene.register(
        circle({ radius: 1, samples: 48, style: { stroke: "#38bdf8", lineWidth: 0.04 } }),
        { position: xy(0, 0) },
      );
      targetId = disk.id;
      await scene.play(
        morph(
          disk,
          rectangle({
            width: 2,
            height: 1.2,
            samples: 48,
            style: { stroke: "#a78bfa", lineWidth: 0.04 },
          }),
          { duration: 1, strategy: "arc-length" },
        ),
      );
    });

    const { player } = await buildProgram(program);
    player.seek(0);
    const atStart = player.getSnapshot().objects.get(targetId)!;
    player.seek(0.5);
    const atMid = player.getSnapshot().objects.get(targetId)!;
    player.seek(1);
    const atEnd = player.getSnapshot().objects.get(targetId)!;

    expect(atStart.state.geometryVersion).toBeLessThan(atMid.state.geometryVersion);
    expect(atMid.state.geometryVersion).toBeLessThan(atEnd.state.geometryVersion);
    expect((atMid.state as RuntimeState2D).geometryOverride).toBeDefined();
    expect((atEnd.state as RuntimeState2D).geometryOverride).toBeDefined();

    const startPts = (atStart.state as RuntimeState2D).geometryOverride!.contours[0]!.points;
    const endPts = (atEnd.state as RuntimeState2D).geometryOverride!.contours[0]!.points;
    expect(startPts[0]).not.toBeCloseTo(endPts[0]!, 1);

    const view = new ThreeObjectView(atStart.object as IMObject2D);
    view.update(atStart, { worldPerPixel: 0.01 });
    expect(strokeVertexCount(view)).toBeGreaterThan(0);
    view.update(atMid, { worldPerPixel: 0.01 });
    expect(strokeVertexCount(view)).toBeGreaterThan(0);
    view.update(atEnd, { worldPerPixel: 0.01 });
    expect(strokeVertexCount(view)).toBeGreaterThan(0);
    view.dispose();
  });
});
