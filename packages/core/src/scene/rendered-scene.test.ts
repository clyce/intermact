import { describe, expect, it } from "vitest";
import { buildProgram, disposeBuiltProgram } from "../program/build";
import { createProgram } from "../program/context";
import { circle } from "../geometry/primitives";
import { xy } from "../math/vec";
import { findTrait, type RenderedSceneSource } from "../object/traits";
import { type RenderSnapshot } from "../animation/snapshot";
import { type RuntimeState2D } from "../runtime/state";
import { type IMObject2D } from "../object/types";
import { render } from "./rendered-scene";
import { type RegisteredCamera2D } from "./camera";

function movingPos(snapshot: RenderSnapshot): readonly [number, number] {
  const first = [...snapshot.objects.values()][0]!;
  return (first.state as RuntimeState2D).transform.position;
}

describe("render() / RenderedScene (§10.2)", () => {
  it("composes a 2D sub-scene as a rendered-scene object finalized by the build pass", async () => {
    let panel: IMObject2D | undefined;
    const program = createProgram(async (ctx) => {
      const host = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [0, 10], y: [0, 10] },
      });
      ctx.mount(host, ctx.createCamera2D(host));
      const sub = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      const cam = ctx.createCamera2D(sub);
      const dot = sub.register(circle({ radius: 0.5, style: { fill: "#fff" } }));
      await sub.play(dot.moveTo(xy(1, 1), { duration: 1 }));
      panel = render(sub, cam, { size: [4, 4] });
      // Inside the program body (pre-finalize) the embedded source is not ready.
      expect(panel.type).toBe("rendered-scene");
      expect(findTrait(panel.traits, "rendered-scene")!.source.ready).toBe(false);
      host.register(panel, { position: xy(5, 5) });
    });

    const built = await buildProgram(program);
    const trait = findTrait(panel!.traits, "rendered-scene")!;
    expect(trait.kind).toBe("rendered-scene");
    // The build pass assembles the embedded sub-player.
    expect(trait.source.ready).toBe(true);
    expect(trait.source.duration).toBeGreaterThan(0);
    expect((trait.source.snapshot() as RenderSnapshot).objects.size).toBeGreaterThan(0);

    // It is part of the host snapshot like any other registered object.
    const hostObjects = [...built.player.getSnapshot().objects.values()];
    expect(hostObjects.some((o) => o.object.type === "rendered-scene")).toBe(true);
    disposeBuiltProgram(built);
  });

  it("seek drives the embedded sub-timeline deterministically", async () => {
    let captured: RenderedSceneSource | undefined;
    const program = createProgram(async (ctx) => {
      const host = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [0, 10], y: [0, 10] },
      });
      ctx.mount(host, ctx.createCamera2D(host));
      const sub = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      const cam = ctx.createCamera2D(sub);
      const dot = sub.register(circle({ radius: 0.5, style: { fill: "#fff" } }));
      await sub.play(dot.moveTo(xy(1, 1), { duration: 1 }));
      const panel = render(sub, cam);
      captured = findTrait(host.register(panel).object.traits, "rendered-scene")!.source;
    });
    const built = await buildProgram(program);
    const src = captured!;
    src.seek(0);
    const start = movingPos(src.snapshot() as RenderSnapshot);
    src.seek(src.duration);
    const end = movingPos(src.snapshot() as RenderSnapshot);
    expect(start).not.toEqual(end);
    // Same seek ⇒ same state (deterministic).
    src.seek(0);
    expect(movingPos(src.snapshot() as RenderSnapshot)).toEqual(start);
    disposeBuiltProgram(built);
  });

  it("rejects a 3D source scene", async () => {
    const program = createProgram(async (ctx) => {
      const host = ctx.createScene2D({ coordinate: "cartesian", domain: { x: [0, 1], y: [0, 1] } });
      ctx.mount(host, ctx.createCamera2D(host));
      const threeD = ctx.createScene3D();
      const cam = ctx.createCamera3D(threeD);
      render(threeD, cam as unknown as RegisteredCamera2D);
    });
    await expect(buildProgram(program)).rejects.toThrow(/2D source scenes/);
  });
});
