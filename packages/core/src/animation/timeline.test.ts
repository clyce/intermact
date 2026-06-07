import { describe, expect, it } from "vitest";
import { createProgram } from "../program/context";
import { buildProgram } from "../program/build";
import { call } from "./orchestration";
import { xy } from "../math/vec";
import { type Player } from "./player";

function positionOf(player: Player, id: string): readonly [number, number] {
  const state = player.getSnapshot().objects.get(id)?.state;
  if (!state) throw new Error(`no state for ${id}`);
  return state.transform.position;
}

describe("retained-mode timeline + Player (M1)", () => {
  /** Build a two-leg move with a marker between the legs. */
  async function buildMover() {
    let dotId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dot = scene.registerEmpty({ position: xy(0, 0) });
      dotId = dot.id;
      await scene.play(dot.moveTo(xy(2, 0), { duration: 2, easing: "linear" }));
      scene.marker("mid");
      await scene.play(dot.moveTo(xy(2, 2), { duration: 2, easing: "linear" }));
    });
    const built = await buildProgram(program);
    return { ...built, dotId };
  }

  it("derives the total duration from the tracks", async () => {
    const { player } = await buildMover();
    expect(player.duration).toBe(4);
  });

  it("evaluates any t deterministically (seek)", async () => {
    const { player, dotId } = await buildMover();
    player.seek(0);
    expect(positionOf(player, dotId)).toEqual([0, 0]);
    player.seek(1);
    expect(positionOf(player, dotId)).toEqual([1, 0]);
    player.seek(2);
    expect(positionOf(player, dotId)).toEqual([2, 0]);
    player.seek(3);
    expect(positionOf(player, dotId)).toEqual([2, 1]);
    player.seek(4);
    expect(positionOf(player, dotId)).toEqual([2, 2]);
  });

  it("is order-independent: seeking back and forth yields identical frames", async () => {
    const { player, dotId } = await buildMover();
    player.seek(3);
    const forward = positionOf(player, dotId);
    player.seek(0.5);
    player.seek(3);
    expect(positionOf(player, dotId)).toEqual(forward);
  });

  it("clamps completed tracks to their end value", async () => {
    const { player, dotId } = await buildMover();
    player.seek(10);
    expect(positionOf(player, dotId)).toEqual([2, 2]);
  });

  it("jumps to named markers", async () => {
    const { player, dotId } = await buildMover();
    player.jumpToMarker("mid");
    expect(player.time).toBe(2);
    expect(positionOf(player, dotId)).toEqual([2, 0]);
  });

  it("advances under an external clock (update) and reaches finished", async () => {
    const { player, dotId } = await buildMover();
    player.play();
    player.update(1);
    expect(player.time).toBeCloseTo(1);
    expect(positionOf(player, dotId)).toEqual([1, 0]);
    player.update(10);
    expect(player.time).toBe(4);
    expect(player.state).toBe("finished");
  });

  it("supports negative rate (reverse) for fully-recorded tracks", async () => {
    const { player, dotId } = await buildMover();
    player.seek(4);
    player.setRate(-1);
    player.play();
    player.update(1);
    expect(player.time).toBeCloseTo(3);
    expect(positionOf(player, dotId)).toEqual([2, 1]);
  });

  it("is reproducible across rebuilds (headless determinism)", async () => {
    const a = await buildMover();
    const b = await buildMover();
    a.player.seek(2.5);
    b.player.seek(2.5);
    expect(positionOf(a.player, a.dotId)).toEqual(positionOf(b.player, b.dotId));
  });
});

describe("non-seekable side effects (§11.5)", () => {
  async function buildWithCall() {
    const fired: number[] = [];
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [0, 1], y: [0, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dot = scene.registerEmpty();
      await scene.play(dot.moveTo(xy(1, 0), { duration: 2 }));
      await scene.play(
        call(() => {
          fired.push(1);
        }),
      );
      await scene.play(dot.moveTo(xy(1, 1), { duration: 2 }));
    });
    const built = await buildProgram(program);
    return { ...built, fired };
  }

  it("does NOT fire effects while scrubbing (seek)", async () => {
    const { player, fired } = await buildWithCall();
    player.seek(3);
    expect(fired).toEqual([]);
  });

  it("fires effects on forward playback (update)", async () => {
    const { player, fired } = await buildWithCall();
    player.play();
    player.update(2.5);
    expect(fired).toEqual([1]);
  });
});
