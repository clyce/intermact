import { describe, expect, it } from "vitest";
import { circle, rectangle } from "../geometry/primitives";
import { uv, xy } from "../math/vec";
import {
  composeTransform2D,
  IDENTITY_TRANSFORM_2D,
  resolveTransform2D,
  transformBounds,
} from "../runtime/world-transform";
import { buildProgram } from "../program/build";
import { createProgram } from "../program/context";
import { Scene2D } from "./scene";

const DOMAIN = { x: [-5, 5] as const, y: [-5, 5] as const };
const newScene = (): Scene2D => new Scene2D("s", { coordinate: "cartesian", domain: DOMAIN });

describe("world-transform algebra (M12 / §9.3)", () => {
  it("composes parent translate + 90° rotation onto a child", () => {
    const parent = resolveTransform2D({ position: xy(1, 0), rotation: Math.PI / 2 });
    const child = resolveTransform2D({ position: xy(2, 0) });
    const world = composeTransform2D(parent, child);
    expect(world.position[0]).toBeCloseTo(1, 6);
    expect(world.position[1]).toBeCloseTo(2, 6);
    expect(world.rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it("identity composition is a no-op", () => {
    const c = resolveTransform2D({ position: xy(3, -2), rotation: 0.5, scale: 2 });
    const world = composeTransform2D(IDENTITY_TRANSFORM_2D, c);
    expect(world.position).toEqual(c.position);
    expect(world.scale).toEqual(c.scale);
  });

  it("transforms a local AABB through scale + translation", () => {
    const local = { min: xy(-1, -1), max: xy(1, 1), size: [2, 2] as const, center: xy(0, 0) };
    const b = transformBounds(local, resolveTransform2D({ position: xy(2, 3), scale: 2 }));
    expect(b.min).toEqual(xy(0, 1));
    expect(b.max).toEqual(xy(4, 5));
    expect(b.center).toEqual(xy(2, 3));
  });
});

describe("LayoutHandle (M12 / §9.4)", () => {
  it("getBounds reflects the authoring transform", () => {
    const scene = newScene();
    const r = scene.register(rectangle({ width: 2, height: 1 }), { position: xy(1, 0) });
    const b = r.layout.getBounds();
    expect(b.center).toEqual(xy(1, 0));
    expect(b.size).toEqual([2, 1]);
  });

  it("alignTo centers the object on a world point", () => {
    const scene = newScene();
    const r = scene.register(rectangle({ width: 2, height: 1 }));
    r.layout.alignTo(xy(3, 2));
    expect(r.layout.getBounds().center[0]).toBeCloseTo(3, 6);
    expect(r.layout.getBounds().center[1]).toBeCloseTo(2, 6);
  });

  it("alignTo honors a corner anchor", () => {
    const scene = newScene();
    const r = scene.register(rectangle({ width: 2, height: 1 }));
    r.layout.alignTo(xy(0, 0), { anchor: uv(0, 0) });
    const b = r.layout.getBounds();
    expect(b.min[0]).toBeCloseTo(0, 6);
    expect(b.min[1]).toBeCloseTo(0, 6);
  });

  it("nextTo places an object to the right with a gap", () => {
    const scene = newScene();
    const a = scene.register(rectangle({ width: 2, height: 2 }));
    const b = scene.register(rectangle({ width: 1, height: 1 }));
    b.layout.nextTo(a, [1, 0], { gap: 0.5 });
    // a right edge = 1; gap 0.5; b half-width 0.5 ⇒ b center x = 1 + 0.5 + 0.5 = 2
    expect(b.layout.getBounds().center[0]).toBeCloseTo(2, 6);
    expect(b.layout.getBounds().center[1]).toBeCloseTo(0, 6);
  });

  it("fitTo scales (uniform) and centers within a box", () => {
    const scene = newScene();
    const r = scene.register(rectangle({ width: 2, height: 4 }));
    r.layout.fitTo({ min: xy(-1, -1), max: xy(1, 1), size: [2, 2], center: xy(0, 0) });
    const b = r.layout.getBounds();
    // limiting axis is height 4 → factor 0.5 ⇒ size [1,2]
    expect(b.size[0]).toBeCloseTo(1, 6);
    expect(b.size[1]).toBeCloseTo(2, 6);
    expect(b.center).toEqual(xy(0, 0));
  });

  it("arrange packs children in a row by their widths", () => {
    const scene = newScene();
    const c0 = scene.register(rectangle({ width: 1, height: 1 }));
    const c1 = scene.register(rectangle({ width: 2, height: 1 }));
    const container = scene.register(rectangle({ width: 0.01, height: 0.01 }));
    container.layout.arrange([c0, c1], { direction: "row", gap: 1, origin: xy(0, 0) });
    // origin x=0: c0 center = 0.5; advance 1 + gap 1 = 2; c1 center = 2 + 1 = 3
    expect(c0.layout.getBounds().center[0]).toBeCloseTo(0.5, 6);
    expect(c1.layout.getBounds().center[0]).toBeCloseTo(3, 6);
  });
});

describe("transform hierarchy in snapshots (M12 / §9.3)", () => {
  it("composes a rotated parent onto its child's world transform", async () => {
    let childId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({ coordinate: "cartesian", domain: DOMAIN });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const root = scene.registerEmpty({ position: xy(1, 0) });
      const child = scene.register(circle({ radius: 0.2 }), { position: xy(2, 0) });
      childId = child.id;
      scene.setParent(child, root);
      await scene.play(root.rotateTo(Math.PI / 2, { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    player.seek(1);
    const cs = player.getSnapshot().objects.get(childId);
    expect(cs).toBeDefined();
    expect(cs!.state.transform.position[0]).toBeCloseTo(1, 5);
    expect(cs!.state.transform.position[1]).toBeCloseTo(2, 5);
    expect(cs!.state.transform.rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it("multiplies opacity down the parent chain", async () => {
    let childId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({ coordinate: "cartesian", domain: DOMAIN });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const root = scene.registerEmpty({ opacity: 0.5 });
      const child = scene.register(circle({ radius: 0.2 }), { opacity: 0.5 });
      childId = child.id;
      scene.setParent(child, root);
    });
    const { player } = await buildProgram(program);
    const cs = player.getSnapshot().objects.get(childId);
    expect(cs!.state.opacity).toBeCloseTo(0.25, 6);
  });
});
