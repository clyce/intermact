import { describe, expect, it } from "vitest";
import { circle, createProgram } from "../index";
import { buildProgram } from "../program/build";
import { derived } from "./derived";
import { signal, valueTracker } from "./signal";
import { tweenSignal } from "./tween-signal";

describe("reactive layer (M6)", () => {
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
