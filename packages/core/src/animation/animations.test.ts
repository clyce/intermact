import { describe, expect, it } from "vitest";
import { circle, createProgram, xy } from "../index";
import { buildProgram } from "../program/build";
import { parallel, sequence, stagger } from "./orchestration";
import { type Player } from "./player";

function stateOf(player: Player, id: string) {
  const s = player.getSnapshot().objects.get(id)?.state;
  if (!s) throw new Error(`no state for ${id}`);
  return s;
}

describe("basic animations (M4)", () => {
  it("Create keeps the object hidden before play and draws it on", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1, style: { stroke: "#fff", fill: "#222" } }));
      id = c.id;
      await scene.wait(1);
      await scene.play(c.create({ duration: 2 }));
    });
    const { player } = await buildProgram(program);

    // Before the create starts (t < 1): hidden (revealEnd 0, fill 0).
    player.seek(0.5);
    expect(stateOf(player, id).revealEnd).toBe(0);
    expect(stateOf(player, id).fillProgress).toBe(0);

    // Stroke drawing underway, fill not yet (after-stroke-fade).
    player.seek(1.5);
    expect(stateOf(player, id).revealEnd).toBeGreaterThan(0);
    expect(stateOf(player, id).revealEnd).toBeLessThanOrEqual(1);

    // Fully created at the end.
    player.seek(3);
    expect(stateOf(player, id).revealEnd).toBeCloseTo(1);
    expect(stateOf(player, id).fillProgress).toBeCloseTo(1);
  });

  it("sequence and parallel compose and are seekable", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 0.5, style: { stroke: "#fff" } }), {
        position: xy(0, 0),
      });
      id = c.id;
      await scene.play(
        sequence(
          c.moveTo(xy(2, 0), { duration: 1, easing: "linear" }),
          c.moveTo(xy(2, 2), { duration: 1, easing: "linear" }),
        ),
      );
    });
    const { player } = await buildProgram(program);
    expect(player.duration).toBe(2);
    player.seek(0.5);
    expect(stateOf(player, id).transform.position).toEqual([1, 0]);
    player.seek(1.5);
    expect(stateOf(player, id).transform.position).toEqual([2, 1]);
  });

  it("fadeIn starts from opacity 0", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1, style: { fill: "#fff" } }));
      id = c.id;
      await scene.play(c.fadeIn({ duration: 1, easing: "linear" }));
    });
    const { player } = await buildProgram(program);
    player.seek(0);
    expect(stateOf(player, id).opacity).toBe(0);
    player.seek(0.5);
    expect(stateOf(player, id).opacity).toBeCloseTo(0.5);
    player.seek(1);
    expect(stateOf(player, id).opacity).toBeCloseTo(1);
  });

  it("stagger offsets children by lag", async () => {
    const ids: string[] = [];
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 5], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dots = [0, 1, 2].map((i) => {
        const d = scene.register(circle({ radius: 0.2, style: { fill: "#fff" } }), {
          position: xy(i, 0),
        });
        ids.push(d.id);
        return d;
      });
      await scene.play(
        stagger(
          dots.map((d, i) => d.moveTo(xy(i, 1), { duration: 1, easing: "linear" })),
          0.5,
        ),
      );
    });
    const { player } = await buildProgram(program);
    // total = 0.5*2 + 1 = 2
    expect(player.duration).toBeCloseTo(2);
    // At t=0.5: first dot halfway up, second just starting, third not started.
    player.seek(0.5);
    expect(stateOf(player, ids[0]!).transform.position[1]).toBeCloseTo(0.5);
    expect(stateOf(player, ids[2]!).transform.position[1]).toBeCloseTo(0);
  });

  it("parallel duration is the max of children", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const a = scene.register(circle({ radius: 0.3, style: { fill: "#fff" } }));
      const b = scene.register(circle({ radius: 0.3, style: { fill: "#fff" } }));
      await scene.play(
        parallel(a.moveTo(xy(1, 0), { duration: 1 }), b.moveTo(xy(0, 1), { duration: 3 })),
      );
    });
    const { player } = await buildProgram(program);
    expect(player.duration).toBe(3);
  });
});
