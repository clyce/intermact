import { describe, expect, it } from "vitest";
import { createProgram } from "../program/context";
import { buildProgram } from "../program/build";
import { circle } from "../geometry/primitives";
import { xy } from "../math/vec";

describe("Scene2D.setParent (M12 / §9.3)", () => {
  it("rejects self-parenting and cycles", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      const a = scene.register(circle({ radius: 0.2 }));
      const b = scene.register(circle({ radius: 0.2 }));
      expect(() => scene.setParent(a, a)).toThrow(/itself/i);
      scene.setParent(b, a);
      expect(() => scene.setParent(a, b)).toThrow(/cycle/i);
    });
    await buildProgram(program);
  });

  it("composes world transforms through the parent chain", async () => {
    let childId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const parent = scene.register(circle({ radius: 0.1 }), { position: xy(1, 0) });
      const child = scene.register(circle({ radius: 0.1 }), { position: xy(0, 1) });
      childId = child.id;
      scene.setParent(child, parent);
    });
    const { player } = await buildProgram(program);
    const snap = player.getSnapshot().objects.get(childId)!;
    expect(snap.state.transform.position[0]).toBeCloseTo(1, 6);
    expect(snap.state.transform.position[1]).toBeCloseTo(1, 6);
  });
});
