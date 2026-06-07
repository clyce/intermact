import { describe, expect, it } from "vitest";
import { CoordinateTransform2D } from "./coordinate-transform";
import { uv, xy } from "../math/vec";

describe("CoordinateTransform2D (M5)", () => {
  const transform = new CoordinateTransform2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-2, 2] },
  });

  it("round-trips abs↔rel", () => {
    const p = xy(1.5, -0.5);
    const back = transform.relToAbs(transform.absToRel(p));
    expect(back[0]).toBeCloseTo(p[0]);
    expect(back[1]).toBeCloseTo(p[1]);
  });

  it("maps corners to UV corners", () => {
    expect(transform.absToRel(xy(-4, -2))).toEqual(uv(0, 0));
    expect(transform.absToRel(xy(4, 2))).toEqual(uv(1, 1));
  });

  it("round-trips polar", () => {
    const p = xy(3, 4);
    const { r, theta } = transform.toPolar(p);
    const back = transform.fromPolar(r, theta);
    expect(back[0]).toBeCloseTo(p[0]);
    expect(back[1]).toBeCloseTo(p[1]);
  });
});
