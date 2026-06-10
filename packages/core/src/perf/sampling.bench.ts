import { bench, describe } from "vitest";
import { circle } from "../geometry/primitives";
import { createGeometryProvider2D } from "../geometry/provider";
import { marchingCubes } from "../geometry/marching-cubes";
import { rawContourFromPoints } from "../geometry/sampling";
import { xy } from "../math/vec";

/**
 * Local profiling benchmarks (design.md §15.2). Run with `pnpm run bench`. These
 * are NOT part of `vitest run` (they match `*.bench.ts`); the CI regression
 * guard lives in `perf-budget.test.ts`. Use these numbers to investigate a
 * budget regression or to validate an optimization.
 */

const denseRing = (() => {
  const ring = [];
  for (let i = 0; i < 1024; i++) {
    const a = (i / 1024) * Math.PI * 2;
    ring.push(xy(Math.cos(a), Math.sin(a)));
  }
  return rawContourFromPoints(ring, true);
})();

describe("sampling", () => {
  const memoProvider = createGeometryProvider2D({ rawContours: [denseRing], fillable: true });
  bench("memoized samplePath (cache hit)", () => {
    memoProvider.samplePath({ samples: 256 });
  });

  bench("fresh resample (cache miss every call)", () => {
    const provider = createGeometryProvider2D({ rawContours: [denseRing], fillable: true });
    provider.samplePath({ samples: 256 });
  });

  const c = circle({ radius: 1, samples: 128, style: { fill: "#fff" } });
  bench("circle samplePath default", () => {
    c.geometry.samplePath();
  });
});

describe("isosurface", () => {
  const sphere = (x: number, y: number, z: number) => Math.hypot(x, y, z) - 1;
  const box = { min: [-1.5, -1.5, -1.5] as const, max: [1.5, 1.5, 1.5] as const };
  bench("marching-cubes res 24 sphere", () => {
    marchingCubes(sphere, { ...box, resolution: 24, level: 0 });
  });
});
