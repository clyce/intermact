import { describe, expect, it } from "vitest";
import { xy } from "../math/vec";
import { findTrait, hasTrait } from "../object/traits";
import { pointCount, pointsToTuples } from "./sampling";
import { arc, arrow, bezierCurve, circle, ellipse, line, polygon, rectangle } from "./primitives";

describe("2D primitives (§5.3)", () => {
  it("circle: bounds, closed contour, perimeter ≈ 2πr", () => {
    const c = circle({ radius: 2, samples: 256 });
    const bounds = c.geometry.getBounds();
    expect(bounds.min).toEqual([-2, -2]);
    expect(bounds.max).toEqual([2, 2]);
    const path = c.geometry.samplePath();
    expect(path.contours[0]!.closed).toBe(true);
    expect(path.totalLength).toBeCloseTo(2 * Math.PI * 2, 1);
    expect(hasTrait(c.traits, "fill")).toBe(true);
    expect(hasTrait(c.traits, "morphable")).toBe(true);
  });

  it("samplePath honors an explicit sample count", () => {
    const c = circle({ radius: 1 });
    const path = c.geometry.samplePath({ samples: 40 });
    expect(pointCount(path.contours[0]!.points)).toBe(40);
  });

  it("buffer channel matches the tuple channel", () => {
    const c = circle({ radius: 1, samples: 32 });
    const path = c.geometry.samplePath({ samples: 32 });
    const buffer = c.geometry.sampleBuffer!({ samples: 32 });
    expect(Array.from(buffer)).toEqual(Array.from(path.contours[0]!.points));
    const tuples = pointsToTuples(buffer);
    expect(tuples).toHaveLength(32);
    expect(tuples[0]![0]).toBeCloseTo(1); // angle 0 -> (r, 0)
    expect(tuples[0]![1]).toBeCloseTo(0);
  });

  it("ellipse bounds reflect independent radii", () => {
    const e = ellipse({ rx: 3, ry: 1 });
    expect(e.geometry.getBounds().size).toEqual([6, 2]);
  });

  it("rectangle: bounds and fillable", () => {
    const r = rectangle({ width: 4, height: 2 });
    const b = r.geometry.getBounds();
    expect(b.min).toEqual([-2, -1]);
    expect(b.max).toEqual([2, 1]);
    expect(hasTrait(r.traits, "fill")).toBe(true);
  });

  it("rounded rectangle stays within its bounds", () => {
    const r = rectangle({ width: 4, height: 2, cornerRadius: 0.5, samples: 64 });
    const b = r.geometry.getBounds();
    expect(b.min[0]).toBeGreaterThanOrEqual(-2.0001);
    expect(b.max[0]).toBeLessThanOrEqual(2.0001);
  });

  it("open arc is stroke-only; closed arc is fillable", () => {
    const open = arc({ radius: 1, startAngle: 0, endAngle: Math.PI });
    expect(hasTrait(open.traits, "fill")).toBe(false);
    expect(hasTrait(open.traits, "stroke")).toBe(true);
    const closed = arc({ radius: 1, startAngle: 0, endAngle: Math.PI, closed: true });
    expect(hasTrait(closed.traits, "fill")).toBe(true);
  });

  it("polygon with a hole exposes two contours", () => {
    const p = polygon({
      points: [xy(0, 0), xy(6, 0), xy(6, 6), xy(0, 6)],
      holes: [[xy(2, 2), xy(2, 4), xy(4, 4), xy(4, 2)]],
    });
    const fill = findTrait(p.traits, "fill");
    expect(fill).toBeDefined();
    expect(fill!.contours().length).toBe(2);
  });

  it("bezier curve (cubic) is an open stroke with correct endpoints", () => {
    const b = bezierCurve({ points: [xy(0, 0), xy(1, 2), xy(3, -2), xy(4, 0)] });
    const path = b.geometry.samplePath();
    expect(path.contours[0]!.closed).toBe(false);
    const tuples = pointsToTuples(path.contours[0]!.points);
    expect(tuples[0]![0]).toBeCloseTo(0);
    expect(tuples.at(-1)![0]).toBeCloseTo(4);
    expect(hasTrait(b.traits, "fill")).toBe(false);
  });

  it("quadratic bezier needs 3 points", () => {
    const b = bezierCurve({ points: [xy(0, 0), xy(1, 2), xy(2, 0)] });
    const tuples = pointsToTuples(b.geometry.samplePath().contours[0]!.points);
    expect(tuples[0]![0]).toBeCloseTo(0);
    expect(tuples.at(-1)![0]).toBeCloseTo(2);
  });

  it("line has two endpoints", () => {
    const l = line({ from: xy(-1, -1), to: xy(2, 3) });
    const tuples = pointsToTuples(l.geometry.samplePath().contours[0]!.points);
    expect(tuples).toEqual([
      [-1, -1],
      [2, 3],
    ]);
  });

  it("arrow: shaft stops at head base; head is a filled isosceles triangle", () => {
    const a = arrow({ from: xy(0, 0), to: xy(3, 0), headLength: 0.5, headWidth: 0.4 });
    const path = a.geometry.samplePath();
    expect(path.contours).toHaveLength(2);
    expect(path.contours[0]!.closed).toBe(false);
    expect(path.contours[1]!.closed).toBe(true);
    const shaft = pointsToTuples(path.contours[0]!.points);
    expect(shaft[0]).toEqual([0, 0]);
    expect(shaft.at(-1)![0]).toBeCloseTo(2.5);
    expect(shaft.at(-1)![1]).toBeCloseTo(0);
    const head = pointsToTuples(path.contours[1]!.points);
    expect(head[0]).toEqual([3, 0]);
    expect(hasTrait(a.traits, "fill")).toBe(true);
    const fill = findTrait(a.traits, "fill");
    expect(fill!.contours()).toHaveLength(1);
    expect(fill!.contours()[0]!.closed).toBe(true);
  });

  it("arrow: head base is perpendicular to shaft (diagonal)", () => {
    const from = xy(-1.2, 0);
    const to = xy(1.2, 0.3);
    const a = arrow({ from, to, headLength: 0.4, headWidth: 0.35 });
    const [shaft, head] = a.geometry.samplePath().contours;
    const shaftEnd = pointsToTuples(shaft!.points).at(-1)!;
    const [tip, wingA, wingB] = pointsToTuples(head!.points);
    const dirX = to[0] - from[0];
    const dirY = to[1] - from[1];
    const dirLen = Math.hypot(dirX, dirY);
    const ux = dirX / dirLen;
    const uy = dirY / dirLen;
    const baseX = wingB![0] - wingA![0];
    const baseY = wingB![1] - wingA![1];
    expect(ux * baseX + uy * baseY).toBeCloseTo(0, 5);
    expect(shaftEnd[0]).toBeCloseTo((wingA![0] + wingB![0]) / 2, 5);
    expect(shaftEnd[1]).toBeCloseTo((wingA![1] + wingB![1]) / 2, 5);
    const tipVecX = tip![0] - shaftEnd[0];
    const tipVecY = tip![1] - shaftEnd[1];
    expect(ux * tipVecX + uy * tipVecY).toBeGreaterThan(0);
    expect(Math.abs(tipVecX * baseY - tipVecY * baseX)).toBeGreaterThan(0);
  });
});
