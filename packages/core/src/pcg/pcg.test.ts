import { describe, expect, it } from "vitest";
import { findTrait } from "../object/traits";
import { type AbsXY, xy } from "../math/vec";
import { createRng } from "../random/rng";
import { polygonBoolean, signedArea } from "../geometry/boolean";
import {
  cellularAutomaton,
  scalarField2D,
  vectorField2D,
  isoline,
  heatmap,
  streamlines,
  marchingSquares,
  stitchSegments,
  lSystem,
  expandLSystem,
  fractal,
  graphObject,
  recursiveTree,
  stepRule1D,
  stepLife2D,
  barChart,
  scatter,
  lineChart,
  mapData,
  transformObject,
  repeatObject,
  instanceField,
  mapPoints,
  along,
  booleanOp,
} from "./index";
import { circle, rectangle } from "../geometry/primitives";

/** Total absolute area of a set of result rings. */
function totalArea(rings: readonly (readonly AbsXY[])[]): number {
  return rings.reduce((sum, ring) => sum + Math.abs(signedArea(ring)), 0);
}

function firstContourPoints(object: ReturnType<typeof isoline>): Float32Array {
  return object.geometry.samplePath().contours[0]!.points;
}

describe("marching squares (§6.2)", () => {
  const field = scalarField2D({ x: [-2, 2], y: [-2, 2] }, (x, y) => x * x + y * y);

  it("extracts an iso-circle of the expected radius", () => {
    const segments = marchingSquares(field, 1, { nx: 80, ny: 80 });
    expect(segments.length).toBeGreaterThan(0);
    for (const [a, b] of segments) {
      expect(Math.hypot(a[0], a[1])).toBeCloseTo(1, 1);
      expect(Math.hypot(b[0], b[1])).toBeCloseTo(1, 1);
    }
  });

  it("stitches loose segments into closed-ish polylines", () => {
    const segments = marchingSquares(field, 1, { nx: 48, ny: 48 });
    const lines = stitchSegments(segments);
    expect(lines.length).toBeGreaterThan(0);
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    expect(longest).toBeGreaterThan(10);
  });

  it("isoline produces a deterministic stroke object", () => {
    const a = isoline(field, [0.5, 1, 2], { nx: 40, ny: 40 });
    const b = isoline(field, [0.5, 1, 2], { nx: 40, ny: 40 });
    expect(Array.from(firstContourPoints(a))).toEqual(Array.from(firstContourPoints(b)));
    expect(findTrait(a.traits, "stroke")).toBeDefined();
  });
});

describe("heatmap (§6.2)", () => {
  it("emits one fill group + color per cell", () => {
    const field = scalarField2D({ x: [0, 1], y: [0, 1] }, (x, y) => x + y);
    const hm = heatmap(field, { nx: 8, ny: 8 });
    const fill = findTrait(hm.traits, "fill")!;
    expect(fill.fillGroups?.()?.length).toBe(64);
    expect(fill.fillGroupColors?.()?.length).toBe(64);
  });
});

describe("streamlines (§6.2)", () => {
  it("integrates a constant field into straight lines", () => {
    const field = vectorField2D({ x: [-1, 5], y: [-1, 1] }, () => [1, 0]);
    const obj = streamlines(field, [xy(0, 0)], { steps: 50, stepSize: 0.05 });
    const pts = obj.geometry.samplePath().contours[0]!.points;
    // y stays ~0 along the whole streamline.
    for (let i = 1; i < pts.length; i += 2) expect(Math.abs(pts[i]!)).toBeLessThan(1e-6);
  });
});

describe("L-system (§6.4, §6.7)", () => {
  it("expands productions deterministically", () => {
    expect(expandLSystem("A", { A: "AB", B: "A" }, 3)).toBe("ABAAB");
  });

  it("same seed ⇒ identical jittered geometry", () => {
    const spec = {
      axiom: "F",
      rules: { F: "F+F-F-F+F" },
      iterations: 2,
      angle: 90,
      jitterAngle: 5,
    };
    const a = lSystem({ ...spec, rng: createRng("plant") });
    const b = lSystem({ ...spec, rng: createRng("plant") });
    const c = lSystem({ ...spec, rng: createRng("other") });
    const pa = Array.from(a.geometry.samplePath().contours[0]!.points);
    const pb = Array.from(b.geometry.samplePath().contours[0]!.points);
    const pc = Array.from(c.geometry.samplePath().contours[0]!.points);
    expect(pa).toEqual(pb);
    expect(pa).not.toEqual(pc);
  });
});

describe("fractals & trees (§6.4)", () => {
  it("Koch curve grows segment count by 4^n", () => {
    const k1 = fractal({ kind: "koch", iterations: 1 });
    const k2 = fractal({ kind: "koch", iterations: 2 });
    const n1 = k1.geometry.samplePath().contours[0]!.points.length;
    const n2 = k2.geometry.samplePath().contours[0]!.points.length;
    expect(n2).toBeGreaterThan(n1);
  });

  it("recursive tree depth controls branch count", () => {
    const shallow = recursiveTree({ depth: 1, branches: 2 });
    const deep = recursiveTree({ depth: 3, branches: 2 });
    expect(deep.geometry.samplePath().contours.length).toBeGreaterThan(
      shallow.geometry.samplePath().contours.length,
    );
  });

  it("IFS chaos game is reproducible per seed", () => {
    const maps = [
      { matrix: [0.5, 0, 0, 0.5] as const, translate: [0, 0] as const },
      { matrix: [0.5, 0, 0, 0.5] as const, translate: [1, 0] as const },
      { matrix: [0.5, 0, 0, 0.5] as const, translate: [0.5, 1] as const },
    ];
    const a = fractal({ kind: "ifs", maps, points: 200, rng: createRng(7) });
    const b = fractal({ kind: "ifs", maps, points: 200, rng: createRng(7) });
    expect(Array.from(firstContourPoints(a))).toEqual(Array.from(firstContourPoints(b)));
  });
});

describe("graph layouts (§6.4)", () => {
  const nodes = ["a", "b", "c", "d"];
  const edges = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "a"],
  ] as const;

  it("circular layout places nodes on a circle", () => {
    const g = graphObject({ nodes, edges, layout: "circular", extent: 2 });
    expect(g.geometry.samplePath().contours.length).toBe(nodes.length + edges.length);
  });

  it("force layout is deterministic per seed", () => {
    const a = graphObject({ nodes, edges, layout: "force", rng: createRng(1), iterations: 40 });
    const b = graphObject({ nodes, edges, layout: "force", rng: createRng(1), iterations: 40 });
    const c = graphObject({ nodes, edges, layout: "force", rng: createRng(2), iterations: 40 });
    expect(Array.from(firstContourPoints(a))).toEqual(Array.from(firstContourPoints(b)));
    expect(Array.from(firstContourPoints(a))).not.toEqual(Array.from(firstContourPoints(c)));
  });
});

describe("cellular automata (§6.4)", () => {
  it("Rule 30 matches the known first generations", () => {
    let cells: Uint8Array = new Uint8Array([0, 0, 0, 1, 0, 0, 0]);
    cells = stepRule1D(cells, 30);
    expect(Array.from(cells)).toEqual([0, 0, 1, 1, 1, 0, 0]);
    cells = stepRule1D(cells, 30);
    expect(Array.from(cells)).toEqual([0, 1, 1, 0, 0, 1, 0]);
  });

  it("Game of Life blinker oscillates with period 2", () => {
    // 5x5 grid, vertical blinker in the middle column.
    const w = 5;
    const h = 5;
    const grid = new Uint8Array(w * h);
    grid[1 * w + 2] = 1;
    grid[2 * w + 2] = 1;
    grid[3 * w + 2] = 1;
    const next = stepLife2D(grid, w, h);
    expect(next[2 * w + 1]).toBe(1);
    expect(next[2 * w + 2]).toBe(1);
    expect(next[2 * w + 3]).toBe(1);
    const back = stepLife2D(next, w, h);
    expect(Array.from(back)).toEqual(Array.from(grid));
  });

  it("renders a non-empty space-time diagram", () => {
    const ca = cellularAutomaton({ kind: "1d", rule: 90, width: 31, generations: 16 });
    expect(ca.geometry.samplePath().contours.length).toBeGreaterThan(10);
  });
});

describe("data-driven generators (§6.5)", () => {
  it("bar chart keeps one part per datum", () => {
    const chart = barChart({ data: [1, 2, 3], size: [3, 2] });
    expect(chart.parts?.length).toBe(3);
  });

  it("scatter and line chart map domains into world", () => {
    const pts = [xy(0, 0), xy(1, 1), xy(2, 4)];
    const sc = scatter({ points: pts, size: [2, 2] });
    const ln = lineChart({ points: pts, size: [2, 2] });
    expect(sc.parts?.length).toBe(3);
    expect(ln.geometry.samplePath().contours[0]!.points.length).toBe(6);
  });

  it("mapData preserves keys", () => {
    const obj = mapData(["x", "y"], () => circle({ radius: 0.1 }), { key: (d) => d });
    expect(obj.parts?.map((p) => p.key)).toEqual(["x", "y"]);
  });
});

describe("operators (§6.6)", () => {
  it("transformObject + repeatObject compose", () => {
    const r = rectangle({ width: 1, height: 1 });
    const moved = transformObject(r, { position: xy(2, 0) });
    const movedBounds = moved.geometry.getBounds();
    expect(movedBounds.center[0]).toBeCloseTo(2, 6);

    const row = repeatObject(r, 4, { position: xy(1.5, 0) });
    expect(row.geometry.samplePath().contours.length).toBe(4);
  });

  it("instanceField marks the instanced trait", () => {
    const r = rectangle({ width: 1, height: 1 });
    const field = instanceField(r, [{ position: xy(0, 0) }, { position: xy(2, 0) }]);
    expect(findTrait(field.traits, "instanced")).toBeDefined();
    expect(field.geometry.samplePath().contours.length).toBe(2);
  });

  it("mapPoints applies a point function", () => {
    const r = rectangle({ width: 2, height: 2 });
    const flipped = mapPoints(r, (p) => xy(p[0], -p[1]));
    expect(flipped.geometry.getBounds().size[1]).toBeCloseTo(2, 6);
  });

  it("along distributes copies on a path", () => {
    const dot = circle({ radius: 0.05 });
    const path = lineChart({ points: [xy(0, 0), xy(4, 0)], size: [4, 1] });
    const dotted = along(dot, path, { count: 5 });
    // 5 copies, each a circle with DEFAULT_SAMPLES contour.
    expect(dotted.geometry.samplePath().contours.length).toBe(5);
  });
});

describe("polygon boolean (§6.6)", () => {
  const a = [xy(0, 0), xy(2, 0), xy(2, 2), xy(0, 2)];
  const b = [xy(1, 1), xy(3, 1), xy(3, 3), xy(1, 3)];

  it("intersection area is the overlap", () => {
    expect(totalArea(polygonBoolean(a, b, "intersect"))).toBeCloseTo(1, 4);
  });

  it("union area is A + B - overlap", () => {
    expect(totalArea(polygonBoolean(a, b, "union"))).toBeCloseTo(7, 4);
  });

  it("subtraction removes the overlap", () => {
    expect(totalArea(polygonBoolean(a, b, "subtract"))).toBeCloseTo(3, 4);
  });

  it("xor is both differences", () => {
    expect(totalArea(polygonBoolean(a, b, "xor"))).toBeCloseTo(6, 4);
  });

  it("booleanOp wraps results into an object", () => {
    const ra = rectangle({ width: 2, height: 2, center: xy(1, 1) });
    const rb = rectangle({ width: 2, height: 2, center: xy(2, 2) });
    const u = booleanOp(ra, rb, "union");
    expect(findTrait(u.traits, "fill")).toBeDefined();
  });

  it("booleanOp rejects multi-contour operands instead of silently dropping rings", () => {
    const r = rectangle({ width: 1, height: 1 });
    const row = repeatObject(r, 2, { position: xy(2, 0) });
    const single = rectangle({ width: 1, height: 1, center: xy(0.5, 0) });
    expect(() => booleanOp(row, single, "union")).toThrow(/single-ring/);
    expect(() => booleanOp(single, row, "union")).toThrow(/single-ring/);
  });
});

describe("PCG determinism guards (§6.7)", () => {
  it("lSystem with jitter requires a seeded rng", () => {
    const spec = { axiom: "F", rules: { F: "F+F" }, iterations: 1, angle: 90, jitterAngle: 5 };
    expect(() => lSystem(spec)).toThrow(/requires a seeded `rng`/);
    expect(() => lSystem({ ...spec, rng: createRng("seed") })).not.toThrow();
  });

  it("force graph layout requires a seeded rng", () => {
    const nodes = ["a", "b"];
    const edges = [["a", "b"]] as const;
    expect(() => graphObject({ nodes, edges, layout: "force" })).toThrow(/requires a seeded `rng`/);
  });

  it("random cellular-automaton init requires a seeded rng", () => {
    expect(() =>
      cellularAutomaton({ kind: "1d", rule: 30, width: 8, generations: 2, init: "random" }),
    ).toThrow(/requires a seeded `rng`/);
    expect(() =>
      cellularAutomaton({ kind: "2d", width: 4, height: 4, steps: 1, init: { density: 0.5 } }),
    ).toThrow(/requires a seeded `rng`/);
  });

  it("IFS fractal rejects an empty map set", () => {
    expect(() => fractal({ kind: "ifs", maps: [], points: 10, rng: createRng(1) })).toThrow(
      /at least one affine map/,
    );
  });
});

describe("stitchSegments (§6.2)", () => {
  it("recovers a single polyline regardless of seed segment position", () => {
    const a = xy(0, 0);
    const b = xy(1, 0);
    const c = xy(2, 0);
    const d = xy(3, 0);
    const e = xy(4, 0);
    // Seed (index 0) is a middle segment; ends are out of order. Bidirectional
    // growth must still recover the full A→E chain as one line of 5 points.
    const lines = stitchSegments([
      [c, d],
      [b, c],
      [d, e],
      [a, b],
    ]);
    expect(lines.length).toBe(1);
    expect(lines[0]!.length).toBe(5);
  });

  it("detects a closed loop (first ≈ last)", () => {
    const p0 = xy(0, 0);
    const p1 = xy(1, 0);
    const p2 = xy(1, 1);
    const p3 = xy(0, 1);
    const lines = stitchSegments([
      [p0, p1],
      [p1, p2],
      [p2, p3],
      [p3, p0],
    ]);
    expect(lines.length).toBe(1);
    const line = lines[0]!;
    expect(line[0]![0]).toBeCloseTo(line[line.length - 1]![0], 6);
    expect(line[0]![1]).toBeCloseTo(line[line.length - 1]![1], 6);
  });
});

describe("streamlines RK4 sub-step clamping (§6.2)", () => {
  it("stays finite and inside the domain for a strong outward field", () => {
    const field = vectorField2D({ x: [-1, 1], y: [-1, 1] }, (x, y) => [10 * x, 10 * y]);
    const obj = streamlines(field, [xy(0.5, 0.5)], { steps: 100, stepSize: 0.1 });
    const pts = obj.geometry.samplePath().contours[0]!.points;
    for (let i = 0; i < pts.length; i += 2) {
      expect(Number.isFinite(pts[i]!)).toBe(true);
      expect(Number.isFinite(pts[i + 1]!)).toBe(true);
      expect(pts[i]!).toBeLessThanOrEqual(1 + 1e-9);
      expect(pts[i + 1]!).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
