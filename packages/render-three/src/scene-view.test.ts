import { describe, expect, it, beforeAll } from "vitest";
import {
  buildProgram,
  circle,
  createProgram,
  polyline,
  xy,
  type IMObject2D,
} from "@intermact/core";
import type { Mesh } from "three";
import { loadTestFont } from "../../core/src/text/test-font";
import { buildStrokeGeometry } from "./stroke";
import { buildFillGeometry } from "./fill";
import { ThreeObjectView } from "./object-view";
import { ThreeSceneView } from "./scene-view";

beforeAll(async () => {
  await loadTestFont();
});

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

  it("path-order reveal walks multiple contours sequentially (not in parallel)", () => {
    const a = {
      points: new Float32Array([0, 0, 1, 0]),
      closed: false,
      cumulativeLength: new Float32Array([0, 1]),
    };
    const b = {
      points: new Float32Array([1, 0, 2, 0]),
      closed: false,
      cumulativeLength: new Float32Array([0, 1]),
    };
    const path = { contours: [a, b], totalLength: 2 };
    const half = buildStrokeGeometry(path, 0.05, 0, 0.5, { mode: "path-order" });
    const full = buildStrokeGeometry(path, 0.05, 0, 1, { mode: "path-order" });
    const parallel = buildStrokeGeometry(path, 0.05, 0, 0.5, { mode: "contour-parallel" });
    expect(half.getAttribute("position").count).toBeLessThan(full.getAttribute("position").count);
    expect(half.getAttribute("position").count).toBeLessThan(
      parallel.getAttribute("position").count,
    );
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

describe("axes create rendering", () => {
  it("axes stay visible after sequential create completes", async () => {
    let axId = "";
    let graphId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [0, 10], y: [0, 10] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const ax = scene.getAxes({ x: [0, 10], y: [0, 10], showTickLabels: false });
      axId = ax.id;
      const graph = scene.register(
        polyline({
          points: [ax.handle.c2p([1, 9]), ax.handle.c2p([9, 1])],
          style: { stroke: "#34d399", lineWidth: 0.03 },
        }),
      );
      graphId = graph.id;
      await scene.play(ax.create({ duration: 0.5 }), graph.create({ duration: 1 }));
    });
    const { player } = await buildProgram(program);
    player.seek(2);
    const axRender = player.getSnapshot().objects.get(axId)!;
    const graphRender = player.getSnapshot().objects.get(graphId)!;
    expect(axRender.state.revealEnd).toBeCloseTo(1, 2);
    const axView = new ThreeObjectView(axRender.object as IMObject2D);
    axView.update(axRender, { worldPerPixel: 0.01 });
    const axStroke = axView.group.children.find((c) => c.renderOrder > 0) as Mesh | undefined;
    expect(axStroke?.geometry.getAttribute("position").count).toBeGreaterThan(0);
    const graphView = new ThreeObjectView(graphRender.object as IMObject2D);
    graphView.update(graphRender, { worldPerPixel: 0.01 });
    const graphStroke = graphView.group.children.find((c) => c.renderOrder > 0) as Mesh | undefined;
    expect(graphStroke?.geometry.getAttribute("position").count).toBeGreaterThan(0);
    axView.dispose();
    graphView.dispose();
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
