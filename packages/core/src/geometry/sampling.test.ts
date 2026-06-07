import { describe, expect, it } from "vitest";
import { xy } from "../math/vec";
import {
  cumulativeLengths,
  pointCount,
  pointsToTuples,
  rawContourFromPoints,
  resampleByArcLength,
} from "./sampling";

describe("arc-length sampling (§5.2)", () => {
  it("computes cumulative lengths of an open polyline", () => {
    const c = rawContourFromPoints([xy(0, 0), xy(3, 0), xy(3, 4)], false);
    const { cumulative, total } = cumulativeLengths(c.points, false);
    expect(Array.from(cumulative)).toEqual([0, 3, 7]);
    expect(total).toBe(7);
  });

  it("includes the closing segment for closed polylines", () => {
    const square = rawContourFromPoints([xy(0, 0), xy(2, 0), xy(2, 2), xy(0, 2)], true);
    const { total } = cumulativeLengths(square.points, true);
    expect(total).toBe(8);
  });

  it("resamples to an exact requested point count", () => {
    const c = rawContourFromPoints([xy(0, 0), xy(10, 0)], false);
    const out = resampleByArcLength(c.points, false, 11);
    expect(pointCount(out)).toBe(11);
    // Uniform spacing along x for a straight line.
    const tuples = pointsToTuples(out);
    expect(tuples[5]![0]).toBeCloseTo(5);
    expect(tuples[10]![0]).toBeCloseTo(10);
  });

  it("spaces resampled points uniformly by arc length on an L-shape", () => {
    const c = rawContourFromPoints([xy(0, 0), xy(4, 0), xy(4, 4)], false);
    const out = resampleByArcLength(c.points, false, 9); // total length 8 -> step 1
    const tuples = pointsToTuples(out);
    // midpoint (index 4) is at arc length 4 = the corner.
    expect(tuples[4]![0]).toBeCloseTo(4);
    expect(tuples[4]![1]).toBeCloseTo(0);
  });
});
