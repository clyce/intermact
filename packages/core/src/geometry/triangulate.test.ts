import { describe, expect, it } from "vitest";
import { xy } from "../math/vec";
import { rawContourFromPoints, toSampledContour } from "./sampling";
import { triangulate, triangulationArea } from "./triangulate";

describe("triangulation (§5.2)", () => {
  it("triangulates a simple square to its full area", () => {
    const square = toSampledContour(
      rawContourFromPoints([xy(0, 0), xy(4, 0), xy(4, 4), xy(0, 4)], true).points,
      true,
    );
    const tri = triangulate([square]);
    expect(tri.indices.length).toBe(6); // two triangles
    expect(triangulationArea(tri)).toBeCloseTo(16);
  });

  it("triangulates a square with a square hole (outer area minus hole)", () => {
    const outer = toSampledContour(
      rawContourFromPoints([xy(0, 0), xy(6, 0), xy(6, 6), xy(0, 6)], true).points,
      true,
    );
    const hole = toSampledContour(
      rawContourFromPoints([xy(2, 2), xy(2, 4), xy(4, 4), xy(4, 2)], true).points,
      true,
    );
    const tri = triangulate([outer, hole]);
    expect(triangulationArea(tri)).toBeCloseTo(36 - 4);
  });
});
