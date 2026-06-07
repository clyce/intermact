import { describe, expect, it } from "vitest";
import { clamp, lerp, uv, V2, V3, xy, xyz } from "./vec";

describe("vector algebra (§7.1)", () => {
  it("adds/subtracts/scales preserving 2D values", () => {
    expect(V2.add(xy(1, 2), xy(3, 4))).toEqual([4, 6]);
    expect(V2.sub(xy(3, 4), xy(1, 1))).toEqual([2, 3]);
    expect(V2.scale(xy(2, 3), 2)).toEqual([4, 6]);
  });

  it("lerps between 2D points", () => {
    expect(V2.lerp(xy(0, 0), xy(10, 20), 0.5)).toEqual([5, 10]);
  });

  it("computes length and distance", () => {
    expect(V2.len(xy(3, 4))).toBe(5);
    expect(V2.distance(xy(0, 0), xy(3, 4))).toBe(5);
  });

  it("normalizes and guards the zero vector", () => {
    expect(V2.normalize(xy(0, 0))).toEqual([0, 0]);
    expect(V2.len(V2.normalize(xy(3, 4)))).toBeCloseTo(1);
  });

  it("supports 3D add/lerp/len", () => {
    expect(V3.add(xyz(1, 1, 1), xyz(2, 2, 2))).toEqual([3, 3, 3]);
    expect(V3.lerp(xyz(0, 0, 0), xyz(2, 4, 6), 0.5)).toEqual([1, 2, 3]);
    expect(V3.len(xyz(0, 3, 4))).toBe(5);
  });

  it("clamp and lerp scalars", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it("constructs normalized uv points", () => {
    expect(uv(0.5, 0.25)).toEqual([0.5, 0.25]);
  });
});
