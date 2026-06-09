import { describe, expect, it } from "vitest";
import { circle, createProgram, group2D, morph, polygon, transformMatching, xy } from "../index";
import { createRng } from "../random/rng";
import { buildProgram } from "../program/build";
import { type Player } from "./player";
import { buildMatchingFrames, buildMorphFrames, pairContours, normalizedContoursOf } from "./morph";

function stateOf(player: Player, id: string) {
  const s = player.getSnapshot().objects.get(id)?.state;
  if (!s) throw new Error(`no state for ${id}`);
  return s;
}

function pentagon() {
  return polygon({
    points: [xy(0, 1.2), xy(1.1, 0.4), xy(0.7, -1), xy(-0.7, -1), xy(-1.1, 0.4)],
    style: { stroke: "#fff" },
  });
}

function allFinite(buf: Float32Array): boolean {
  for (let i = 0; i < buf.length; i++) if (!Number.isFinite(buf[i]!)) return false;
  return true;
}

describe("morph frame builders (M9)", () => {
  it("arc-length pairs to equal point counts regardless of source counts", () => {
    const src = circle({ radius: 1 }); // 64-pt contour
    const tgt = pentagon(); // 5-pt contour
    const aligned = buildMorphFrames(src, tgt, "arc-length", 48);
    expect(aligned.from.length).toBe(1);
    expect(aligned.from[0]!.length).toBe(48 * 2);
    expect(aligned.to[0]!.length).toBe(48 * 2);
  });

  it("anchor strategy reduces mean-squared distance vs arc-length", () => {
    const src = pentagon();
    // Same pentagon rotated in vertex order: anchor should re-align it.
    const tgt = polygon({
      points: [xy(0.7, -1), xy(-0.7, -1), xy(-1.1, 0.4), xy(0, 1.2), xy(1.1, 0.4)],
      style: { stroke: "#fff" },
    });
    const count = 64;
    const arc = buildMorphFrames(src, tgt, "arc-length", count);
    const anc = buildMorphFrames(src, tgt, "anchor", count);
    const cost = (b: { from: Float32Array[]; to: Float32Array[] }) => {
      let c = 0;
      for (let i = 0; i < b.from[0]!.length; i++) c += (b.from[0]![i]! - b.to[0]![i]!) ** 2;
      return c;
    };
    expect(cost(anc)).toBeLessThanOrEqual(cost(arc));
  });

  it("pads mismatched contour counts with collapsed contours", () => {
    const one = circle({ radius: 1 });
    const two = group2D([
      circle({ radius: 1, center: xy(-2, 0) }),
      circle({ radius: 1, center: xy(2, 0) }),
    ]);
    const aligned = pairContours(normalizedContoursOf(one), normalizedContoursOf(two), 32);
    expect(aligned.from.length).toBe(2); // padded to the larger count
    // One source contour is real; the padded one is collapsed (zero extent).
    const extents = aligned.from.map((buf) => {
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < buf.length; i += 2) {
        minX = Math.min(minX, buf[i]!);
        maxX = Math.max(maxX, buf[i]!);
      }
      return maxX - minX;
    });
    expect(Math.min(...extents)).toBeCloseTo(0, 6);
  });
});

describe("matching strategy (M9 transformer/remover/introducer)", () => {
  it("transforms shared keys, collapses source-only, grows target-only", () => {
    const source = group2D([
      { key: "a", object: circle({ radius: 1, center: xy(-2, 0) }) },
      { key: "b", object: circle({ radius: 1, center: xy(2, 0) }) },
    ]);
    const target = group2D([
      { key: "a", object: circle({ radius: 1.3, center: xy(-2, 0) }) },
      { key: "c", object: circle({ radius: 1, center: xy(2, 0) }) },
    ]);
    const count = 32;
    const aligned = buildMatchingFrames(source, target, undefined, count);
    expect(aligned.from.length).toBe(3); // a (transform) + b (remove) + c (introduce)

    const extent = (buf: Float32Array) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < buf.length; i += 2) {
        min = Math.min(min, buf[i]!);
        max = Math.max(max, buf[i]!);
      }
      return max - min;
    };
    // remover "b": from has extent, to is collapsed.
    const removerIdx = aligned.to.findIndex((b) => extent(b) < 1e-6);
    expect(removerIdx).toBeGreaterThanOrEqual(0);
    expect(extent(aligned.from[removerIdx]!)).toBeGreaterThan(0.5);
    // introducer "c": from collapsed, to has extent.
    const introIdx = aligned.from.findIndex((b) => extent(b) < 1e-6);
    expect(introIdx).toBeGreaterThanOrEqual(0);
    expect(extent(aligned.to[introIdx]!)).toBeGreaterThan(0.5);
  });

  it("respects a custom matchBy", () => {
    const source = group2D([{ key: "x1", object: circle({ radius: 1 }) }]);
    const target = group2D([{ key: "x2", object: circle({ radius: 1.5 }) }]);
    // Map both onto "x" so they transform instead of remove+introduce.
    const aligned = buildMatchingFrames(source, target, () => "x", 32);
    expect(aligned.from.length).toBe(1);
    const extent = (buf: Float32Array) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < buf.length; i += 2) {
        min = Math.min(min, buf[i]!);
        max = Math.max(max, buf[i]!);
      }
      return max - min;
    };
    expect(extent(aligned.from[0]!)).toBeGreaterThan(0.5);
    expect(extent(aligned.to[0]!)).toBeGreaterThan(0.5);
  });
});

describe("property-based: random shapes morph without NaN/throw (M9)", () => {
  it("stays finite across t for 40 random shape pairs", () => {
    const rng = createRng("morph-fuzz");
    const randomShape = () => {
      const n = rng.int(3, 14);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 0.5 + rng.next() * 2;
        pts.push(xy(Math.cos(a) * r, Math.sin(a) * r));
      }
      return polygon({ points: pts, style: { stroke: "#fff" } });
    };
    for (let trial = 0; trial < 40; trial++) {
      const src = randomShape();
      const tgt = randomShape();
      const strategy = rng.pick(["arc-length", "anchor"] as const);
      const aligned = buildMorphFrames(src, tgt, strategy, 48);
      for (const t of [0, 0.37, 0.5, 0.83, 1]) {
        aligned.from.forEach((f, i) => {
          const to = aligned.to[i]!;
          const out = new Float32Array(f.length);
          for (let j = 0; j < f.length; j++) out[j] = f[j]! + (to[j]! - f[j]!) * t;
          expect(allFinite(out)).toBe(true);
        });
      }
    }
  });
});

describe("morph strategies are seekable (M9 integration)", () => {
  it("cross-fade dips opacity to 0 at the midpoint and recovers", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-2, 2], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1, style: { stroke: "#fff" } }));
      id = c.id;
      await scene.play(morph(c, pentagon(), { duration: 2, strategy: "cross-fade" }));
    });
    const { player } = await buildProgram(program);
    player.seek(0);
    expect(stateOf(player, id).opacity).toBeCloseTo(1, 5);
    player.seek(1);
    expect(stateOf(player, id).opacity).toBeCloseTo(0, 5);
    player.seek(2);
    expect(stateOf(player, id).opacity).toBeCloseTo(1, 5);
  });

  it("matching morph produces a seekable multi-part geometry override", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const source = scene.register(
        group2D([
          { key: "a", object: circle({ radius: 1, center: xy(-2, 0) }) },
          { key: "b", object: circle({ radius: 1, center: xy(2, 0) }) },
        ]),
      );
      id = source.id;
      const target = group2D([
        { key: "a", object: circle({ radius: 1.4, center: xy(-2, 0) }) },
        { key: "c", object: circle({ radius: 1, center: xy(2, 0) }) },
      ]);
      await scene.play(transformMatching(source, target, { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    player.seek(0.5);
    const mid = stateOf(player, id).geometryOverride;
    expect(mid?.contours.length).toBe(3);
  });
});
