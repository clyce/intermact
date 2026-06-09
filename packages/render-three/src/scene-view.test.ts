import { describe, expect, it } from "vitest";
import { buildProgram, circle, createProgram, xy } from "@intermact/core";
import { buildStrokeGeometry } from "./stroke";
import { buildFillGeometry } from "./fill";
import { ThreeSceneView } from "./scene-view";

describe("render-three geometry builders (M3 smoke)", () => {
  it("builds a non-empty stroke ribbon from a circle", () => {
    const c = circle({ radius: 1, samples: 64, style: { stroke: "#fff" } });
    const geometry = buildStrokeGeometry(c.geometry.samplePath(), 0.05);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("builds an indexed fill geometry from a circle", () => {
    const c = circle({ radius: 1, samples: 64, style: { fill: "#000" } });
    const geometry = buildFillGeometry(c.geometry.samplePath().contours);
    expect(geometry.getIndex()!.count).toBeGreaterThan(0);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("trims the stroke ribbon when revealEnd < 1", () => {
    const c = circle({ radius: 1, samples: 64, style: { stroke: "#fff" } });
    const full = buildStrokeGeometry(c.geometry.samplePath(), 0.05, 0, 1);
    const half = buildStrokeGeometry(c.geometry.samplePath(), 0.05, 0, 0.5);
    expect(half.getAttribute("position").count).toBeLessThan(full.getAttribute("position").count);
  });

  it("closed contours reveal smoothly near completion (closing segment included)", () => {
    const c = circle({ radius: 1, samples: 64, style: { stroke: "#fff" } });
    const path = c.geometry.samplePath();
    // Compare within the trimmed (open) regime so the constant per-end round-cap
    // vertices cancel and the deltas reflect only revealed arc length.
    const at50 = buildStrokeGeometry(path, 0.05, 0, 0.5);
    const at95 = buildStrokeGeometry(path, 0.05, 0, 0.95);
    const at99 = buildStrokeGeometry(path, 0.05, 0, 0.99);
    const n50 = at50.getAttribute("position").count;
    const n95 = at95.getAttribute("position").count;
    const n99 = at99.getAttribute("position").count;
    expect(n95).toBeGreaterThan(n50);
    expect(n99).toBeGreaterThan(n95);
    // The final 4% should add no more geometry than a comparable earlier window
    // (the closing segment is counted in arc length ⇒ no jump at the very end).
    expect(n99 - n95).toBeLessThanOrEqual(n95 - n50);
    // A fully revealed (closed) ribbon still produces geometry.
    expect(buildStrokeGeometry(path, 0.05, 0, 1).getAttribute("position").count).toBeGreaterThan(0);
  });
});

describe("ThreeSceneView diff (M3 smoke)", () => {
  it("adds, updates, and removes object views from snapshots", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      scene.register(
        circle({ radius: 1, style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.3)" } }),
        {
          position: xy(0, 0),
        },
      );
    });
    const { player } = await buildProgram(program);

    const view = new ThreeSceneView();
    view.update(player.getSnapshot(), { worldPerPixel: 1 });
    expect(view.root.children.length).toBe(1);
    // The object group should hold a fill + stroke mesh.
    const group = view.root.children[0]!;
    expect(group.children.length).toBe(2);

    view.dispose();
    expect(view.root.children.length).toBe(0);
  });
});
