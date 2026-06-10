import { describe, expect, it } from "vitest";
import { createProgram } from "../program/context";
import { buildProgram } from "../program/build";
import { stagger } from "../animation/orchestration";
import { circle } from "../geometry/primitives";
import { createGeometryProvider2D } from "../geometry/provider";
import { rawContourFromPoints } from "../geometry/sampling";
import { xy } from "../math/vec";
import { type Player } from "../animation/player";

/**
 * Perf-budget benchmarks (design.md §15.2; M16). These guard against
 * regressions in the three M16 hot paths — sampling memoization (#1), Player
 * track interval-pruning, and large-timeline seeking. Budgets are intentionally
 * generous (≫ observed local time) so they catch order-of-magnitude
 * regressions without flaking on slow/contended CI; the deterministic
 * correctness assertions are the primary signal.
 */

const COUNT = 2000;

async function buildLargeTimeline(): Promise<{ player: Player; ids: string[] }> {
  const ids: string[] = [];
  const program = createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain: { x: [-1, 1], y: [-1, 1] },
    });
    ctx.mount(scene, ctx.createCamera2D(scene));
    const handles = [];
    for (let i = 0; i < COUNT; i++) {
      const dot = scene.registerEmpty({ position: xy(0, 0) });
      ids.push(dot.id);
      handles.push(dot.moveTo(xy(1, 0), { duration: 0.5, easing: "linear" }));
    }
    // Staggered starts spread tracks across the whole timeline so an early seek
    // leaves the vast majority not-yet-started (the interval-pruning win).
    await scene.play(stagger(handles, 0.01));
  });
  const built = await buildProgram(program);
  return { player: built.player, ids };
}

describe("M16 perf budgets (design.md §15.2)", () => {
  it("seeking a 2000-track staggered timeline stays correct and fast", async () => {
    const { player, ids } = await buildLargeTimeline();
    expect(player.storyboard.tracks.length).toBe(COUNT);

    // Correctness: interval pruning must yield identical results to a full scan.
    // The first dot starts at t=0 and finishes by t=0.5.
    player.seek(0);
    const first0 = player.getSnapshot().objects.get(ids[0]!)!.state;
    expect(first0.dimension === "2d" && first0.transform.position[0]).toBe(0);
    player.seek(0.5);
    const first1 = player.getSnapshot().objects.get(ids[0]!)!.state;
    expect(first1.dimension === "2d" && first1.transform.position[0]).toBeCloseTo(1);

    // Budget: many seeks near t=0 (interval pruning keeps the track scan O(log n);
    // each seek still emits a full 2000-object snapshot, so this also bounds that).
    const start = performance.now();
    for (let i = 0; i < 200; i++) player.seek((i % 50) * 0.001);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("memoized sampling serves repeated frames in O(1)", () => {
    const c = circle({ radius: 1, samples: 128, style: { fill: "#fff" } });
    // First call computes; subsequent same-opts calls are cache hits (identical ref).
    const first = c.geometry.samplePath({ samples: 256 });
    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      const again = c.geometry.samplePath({ samples: 256 });
      expect(again).toBe(first);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it("resampling a dense contour stays within budget", () => {
    const ring = [];
    for (let i = 0; i < 512; i++) {
      const a = (i / 512) * Math.PI * 2;
      ring.push(xy(Math.cos(a), Math.sin(a)));
    }
    const provider = createGeometryProvider2D({
      rawContours: [rawContourFromPoints(ring, true)],
      fillable: true,
    });
    const start = performance.now();
    // Distinct opts each iteration → genuine resample work (no memo shortcut).
    for (let i = 0; i < 300; i++) provider.samplePath({ samples: 64 + (i % 64) });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
