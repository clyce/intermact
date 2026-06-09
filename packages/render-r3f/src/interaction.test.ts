import { describe, expect, it } from "vitest";
import { createProgram, createSignal, draggablePoint, hitTest, xy } from "@intermact/core";
import { buildProgram } from "@intermact/core";
import { collectHitEntries, projectOrtho, unprojectOrtho, type OrthoFrustum } from "./interaction";

const FRUSTUM: OrthoFrustum = { left: -4, right: 4, top: 3, bottom: -3 };

describe("ortho un-projection (M11 / §12.2)", () => {
  it("round-trips screen ↔ world", () => {
    const [x, y] = unprojectOrtho(FRUSTUM, 800, 600, 200, 150);
    const [px, py] = projectOrtho(FRUSTUM, 800, 600, x, y);
    expect(px).toBeCloseTo(200, 6);
    expect(py).toBeCloseTo(150, 6);
  });

  it("maps canvas corners to frustum corners", () => {
    expect(unprojectOrtho(FRUSTUM, 800, 600, 0, 0)).toEqual([-4, 3]);
    expect(unprojectOrtho(FRUSTUM, 800, 600, 800, 600)).toEqual([4, -3]);
  });
});

describe("hit-entry collection (M11)", () => {
  it("finds the draggable handle and hit-tests it at its signal value", async () => {
    const sig = createSignal(xy(1.5, -0.5));
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      scene.register(draggablePoint(sig, { radius: 0.15 }));
    });
    const { player } = await buildProgram(program);
    const entries = collectHitEntries(player.getSnapshot());
    expect(entries).toHaveLength(1);
    expect(hitTest(entries, xy(1.5, -0.5))).toBe(entries[0]!.id);
    expect(hitTest(entries, xy(3.5, 2.5))).toBeNull();
  });
});
