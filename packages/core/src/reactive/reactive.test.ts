import { describe, expect, it } from "vitest";
import { circle, createProgram, polygon, tweenSignal, xy } from "../index";
import { buildProgram } from "../program/build";
import { derived } from "./derived";
import { signal, valueTracker } from "./signal";
import { tweenSignal } from "./tween-signal";

describe("reactive layer (M6)", () => {
  it("bumps geometryVersion monotonically on each derived rebuild", async () => {
    let amp = signal(1);
    let objId = "";
    const program = createProgram(async (ctx) => {
      amp = ctx.signal(1);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const ro = scene.registerReactive(
        derived([amp], () => circle({ radius: amp.get() * 0.3, style: { fill: "#fff" } })),
      );
      objId = ro.id;
      await scene.wait(0);
    });
    const { player } = await buildProgram(program);
    player.getSnapshot();
    const v1 = player.getSnapshot().objects.get(objId)!.state.geometryVersion;
    amp.set(2);
    player.getSnapshot();
    const v2 = player.getSnapshot().objects.get(objId)!.state.geometryVersion;
    amp.set(3);
    player.getSnapshot();
    const v3 = player.getSnapshot().objects.get(objId)!.state.geometryVersion;
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it("derived rebuilds when deps change", async () => {
    let amp = signal(1);
    let buildCount = 0;
    const program = createProgram(async (ctx) => {
      amp = ctx.signal(1);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      scene.registerReactive(
        derived([amp], () => {
          buildCount++;
          return circle({ radius: amp.get() * 0.3, style: { fill: "#fff" } });
        }),
      );
      await scene.wait(0.1);
    });
    const { player } = await buildProgram(program);
    player.seek(0.1);
    player.getSnapshot();
    const initialBuilds = buildCount;
    amp.set(2);
    player.getSnapshot();
    expect(buildCount).toBeGreaterThan(initialBuilds);
  });

  it("addUpdater setTransform syncs into runtime snapshots", async () => {
    let dotId = "";
    const program = createProgram(async (ctx) => {
      const t = ctx.valueTracker(0);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 6], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dot = scene.register(circle({ radius: 0.1, style: { fill: "#fbbf24" } }), {
        position: xy(0, 0),
      });
      dotId = dot.id;
      dot.addUpdater(() => {
        dot.setTransform({ position: xy(t.get(), 0) });
      });
      await scene.play(tweenSignal(t, 4, { duration: 1, easing: "linear" }));
    });
    const { player } = await buildProgram(program);
    player.seek(0.5);
    const state = player.getSnapshot().objects.get(dotId)!;
    expect(state.state.transform.position[0]).toBeCloseTo(2, 1);
  });

  it("derived polygon tracks tweenSignal across seeks", async () => {
    let polyId = "";
    const program = createProgram(async (ctx) => {
      const t = ctx.valueTracker(2);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [0, 10], y: [0, 10] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const ax = scene.getAxes({ x: [0, 10], y: [0, 10], showTickLabels: false });
      const ro = scene.registerReactive(
        derived([t], () => {
          const x = t.get();
          const y = 25 / x;
          return polygon({
            points: [
              ax.handle.c2p([x, 0]),
              ax.handle.c2p([x, y]),
              ax.handle.c2p([0, y]),
              ax.handle.c2p([0, 0]),
            ],
            closed: true,
            style: { fill: "rgba(59,130,246,0.45)" },
          });
        }),
      );
      polyId = ro.id;
      await scene.play(tweenSignal(t, 8, { duration: 2, easing: "linear" }));
    });
    const { player } = await buildProgram(program);
    player.seek(0.5);
    const b0 = player.getSnapshot().objects.get(polyId)!.object.geometry.getBounds();
    player.seek(1.5);
    const b1 = player.getSnapshot().objects.get(polyId)!.object.geometry.getBounds();
    expect(b1.max[0]).not.toBeCloseTo(b0.max[0], 0);
  });

  it("tweenSignal is seekable", async () => {
    let t = valueTracker(0);
    const program = createProgram(async (ctx) => {
      t = ctx.valueTracker(0);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      await scene.play(tweenSignal(t, 10, { duration: 2, easing: "linear" }));
    });
    const { player } = await buildProgram(program);
    player.seek(0);
    expect(t.get()).toBeCloseTo(0);
    player.seek(1);
    expect(t.get()).toBeCloseTo(5);
    player.seek(2);
    expect(t.get()).toBeCloseTo(10);
  });
});
