import { describe, expect, it } from "vitest";
import { createSamplingMemo, sampleOptionsKey } from "./memoize";
import { createGeometryProvider2D } from "./provider";
import { rawContourFromPoints } from "./sampling";
import { xy } from "../math/vec";

describe("sampling memoize (M16, design.md §15.2 #1)", () => {
  it("computes once per key, then serves hits", () => {
    const memo = createSamplingMemo<number>();
    let calls = 0;
    const compute = () => {
      calls++;
      return 42;
    };
    expect(memo.get("a", compute)).toBe(42);
    expect(memo.get("a", compute)).toBe(42);
    expect(memo.get("a", compute)).toBe(42);
    expect(calls).toBe(1);
    expect(memo.stats.misses).toBe(1);
    expect(memo.stats.hits).toBe(2);
  });

  it("separates entries by key and clears", () => {
    const memo = createSamplingMemo<number>();
    memo.get("a", () => 1);
    memo.get("b", () => 2);
    expect(memo.stats.misses).toBe(2);
    memo.clear();
    memo.get("a", () => 1);
    expect(memo.stats.misses).toBe(3);
  });

  it("keys by samples + arcLength", () => {
    expect(sampleOptionsKey()).toBe("natural:arc");
    expect(sampleOptionsKey({ samples: 64 })).toBe("64:arc");
    expect(sampleOptionsKey({ samples: 64, arcLength: false })).toBe("64:raw");
    expect(sampleOptionsKey({ arcLength: false })).toBe("natural:raw");
  });

  it("provider returns the identical sampled path for repeated same-opts calls", () => {
    const square = [xy(-1, -1), xy(1, -1), xy(1, 1), xy(-1, 1)];
    const provider = createGeometryProvider2D({
      rawContours: [rawContourFromPoints(square, true)],
      fillable: true,
    });
    const a = provider.samplePath({ samples: 32 });
    const b = provider.samplePath({ samples: 32 });
    // Cache hit → same reference (no re-resample / re-allocation).
    expect(a).toBe(b);
    // Different opts → distinct sampling.
    const c = provider.samplePath({ samples: 16 });
    expect(c).not.toBe(a);
    expect(c.contours[0]!.points.length).toBe(32);
    expect(a.contours[0]!.points.length).toBe(64);
  });
});
