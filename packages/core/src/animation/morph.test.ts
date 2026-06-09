import { describe, expect, it } from "vitest";
import { circle, createProgram, morph, polygon, xy } from "../index";
import { buildProgram } from "../program/build";
import { type Player } from "./player";

function stateOf(player: Player, id: string) {
  const s = player.getSnapshot().objects.get(id)?.state;
  if (!s) throw new Error(`no state for ${id}`);
  return s;
}

describe("morph animation (arc-length)", () => {
  it("interpolates geometry seekably between morphable shapes", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1, style: { stroke: "#fff", fill: "#222" } }));
      id = c.id;
      const target = polygon({
        points: [xy(0, 1.2), xy(1.1, 0.4), xy(0.7, -1), xy(-0.7, -1), xy(-1.1, 0.4)],
        style: { stroke: "#fff", fill: "#444" },
      });
      await scene.play(morph(c, target, { duration: 2, easing: "linear", strategy: "arc-length" }));
    });
    const { player } = await buildProgram(program);

    player.seek(0);
    expect(stateOf(player, id).geometryOverride?.contours.length).toBeGreaterThan(0);

    player.seek(1);
    const mid = stateOf(player, id).geometryOverride;
    expect(mid?.contours.length).toBeGreaterThan(0);
    const midPoints = mid!.contours[0]!.points;
    expect(midPoints.length).toBeGreaterThan(0);

    player.seek(2);
    const end = stateOf(player, id).geometryOverride;
    expect(end?.contours[0]?.points.length).toBe(midPoints.length);
  });
});
