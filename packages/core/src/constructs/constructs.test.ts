import { beforeAll, describe, expect, it } from "vitest";
import { loadTestFont } from "../text/test-font";
import { xy } from "../math/vec";
import { createAxesHandle } from "../layout/axes";
import { findTrait } from "../object/traits";
import {
  areaUnderCurve,
  parametricGraph,
  riemannRectangles,
  riemannSum,
  slopeAt,
  tangentLine,
} from "./graphs";
import { numberLine } from "./number-line";
import { numberPlane, polarPlane } from "./planes";
import { matrixObject } from "./matrix";
import { tableObject } from "./table";
import { brace } from "./brace";

const SCENE_DOMAIN = { x: [-4, 4] as const, y: [-3, 3] as const };

beforeAll(async () => {
  await loadTestFont();
});

describe("AxesHandle (M8 c2p fit)", () => {
  it("maps data coordinates onto the scene domain and inverts", () => {
    const h = createAxesHandle({ x: [-4, 4], y: [-3, 3] }, SCENE_DOMAIN);
    expect(h.c2p([0, 0])).toEqual([0, 0]);
    expect(h.c2p([4, 3])).toEqual([4, 3]);
    const back = h.p2c(h.c2p([1.5, -2]));
    expect(back[0]).toBeCloseTo(1.5, 12);
    expect(back[1]).toBeCloseTo(-2, 12);
  });

  it("maps a sub-domain onto a wider scene domain via scales", () => {
    const h = createAxesHandle({ x: [-6, 6], y: [-2, 2] }, { x: [-6.5, 6.5], y: [-2.6, 2.6] });
    expect(h.c2p([6, 2])).toEqual([6.5, 2.6]);
    expect(h.xScale(0)).toBeCloseTo(0, 12);
  });
});

describe("Riemann sum (M8 convergence)", () => {
  it("converges to the integral of x^2 on [0,1] (=1/3)", () => {
    const fn = (x: number) => x * x;
    const coarse = riemannSum(fn, [0, 1], 4, "midpoint");
    const fine = riemannSum(fn, [0, 1], 2000, "midpoint");
    expect(Math.abs(fine - 1 / 3)).toBeLessThan(Math.abs(coarse - 1 / 3));
    expect(fine).toBeCloseTo(1 / 3, 4);
  });

  it("builds n rectangle contours glued to axes", () => {
    const h = createAxesHandle({ x: [0, 1], y: [0, 1] }, SCENE_DOMAIN);
    const rects = riemannRectangles(h, (x) => x * x, { domain: [0, 1], n: 5 });
    const fill = findTrait(rects.traits, "fill");
    expect(fill).toBeDefined();
    expect(fill!.contours().length).toBe(5);
  });
});

describe("Tangent line (M8 derivative)", () => {
  it("computes the slope via central difference", () => {
    expect(slopeAt((x) => x * x, 2)).toBeCloseTo(4, 6);
    expect(slopeAt(Math.sin, 0)).toBeCloseTo(1, 6);
  });

  it("draws a stroke object aligned to the curve point", () => {
    const h = createAxesHandle({ x: [-2, 2], y: [-2, 2] }, SCENE_DOMAIN);
    const t = tangentLine(h, (x) => x * x, 1, { length: 1 });
    expect(findTrait(t.traits, "stroke")).toBeDefined();
  });
});

describe("Area / parametric (M8)", () => {
  it("areaUnderCurve is fillable and closed", () => {
    const h = createAxesHandle({ x: [0, 3], y: [0, 9] }, SCENE_DOMAIN);
    const area = areaUnderCurve(h, (x) => x, [0, 2]);
    const fill = findTrait(area.traits, "fill");
    expect(fill).toBeDefined();
    expect(fill!.contours()[0]!.closed).toBe(true);
  });

  it("parametricGraph samples a curve glued to axes", () => {
    const h = createAxesHandle({ x: [-1, 1], y: [-1, 1] }, SCENE_DOMAIN);
    const circle = parametricGraph(h, (t) => [Math.cos(t), Math.sin(t)], {
      domain: [0, Math.PI * 2],
      samples: 32,
    });
    const stroke = findTrait(circle.traits, "stroke");
    expect(stroke).toBeDefined();
    expect(stroke!.samplePath().contours[0]!.points.length).toBeGreaterThan(0);
  });
});

describe("Planes & number line (M8 layout)", () => {
  it("numberPlane draws one line per x and y tick", () => {
    const plane = numberPlane({ x: [-2, 2], y: [-2, 2], tickCount: 4 });
    const stroke = findTrait(plane.traits, "stroke");
    const lines = stroke!.samplePath().contours.length;
    expect(lines).toBeGreaterThanOrEqual(8); // ~5 x-lines + ~5 y-lines
  });

  it("polarPlane draws rings + spokes", () => {
    const plane = polarPlane({ maxRadius: 3, radiusStep: 1, spokes: 8 });
    const lines = findTrait(plane.traits, "stroke")!.samplePath().contours.length;
    expect(lines).toBe(3 + 8); // 3 rings + 8 spokes
  });

  it("numberLine spans its length symmetrically about the center", () => {
    const nl = numberLine({ domain: [0, 10], center: xy(0, 0), length: 10, showLabels: false });
    const b = nl.geometry.getBounds();
    expect(b.center[0]).toBeCloseTo(0, 6);
    expect(b.size[0]).toBeCloseTo(10, 6);
  });
});

describe("Matrix / table / brace (M8 layout)", () => {
  it("matrixObject is centered and sized by its grid", () => {
    const m = matrixObject({
      values: [
        [1, 2],
        [3, 4],
      ],
      cellWidth: 1,
      cellHeight: 0.6,
    });
    const b = m.geometry.getBounds();
    expect(b.center[0]).toBeCloseTo(0, 1);
    expect(b.size[0]).toBeGreaterThan(2); // 2 cols * 1 + bracket padding
  });

  it("tableObject draws a bordered grid", () => {
    const t = tableObject({
      data: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      cellWidth: 1,
      cellHeight: 0.5,
    });
    const b = t.geometry.getBounds();
    expect(b.size[0]).toBeCloseTo(3, 1);
    expect(b.size[1]).toBeGreaterThan(0.8);
  });

  it("brace spans the bottom edge of a bounds box", () => {
    const bounds = {
      min: xy(-1, -1),
      max: xy(1, 1),
      size: [2, 2] as const,
      center: xy(0, 0),
    };
    const b = brace(bounds, [0, -1], { depth: 0.3, gap: 0.1 });
    const bb = b.geometry.getBounds();
    // brace sits below the box (max y at the edge minus gap)
    expect(bb.max[1]).toBeLessThanOrEqual(-1 - 0.1 + 1e-6);
    expect(bb.min[1]).toBeGreaterThanOrEqual(-1 - 0.1 - 0.3 - 1e-6);
  });
});
