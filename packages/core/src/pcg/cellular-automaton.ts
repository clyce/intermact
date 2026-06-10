/**
 * Cellular automata (design.md §6.4). Supports 1D elementary CAs (e.g. Rule 30)
 * rendered as a space-time diagram, and 2D life-like CAs (Conway's Game of Life)
 * rendered as a grid. Each generation is a pure function of the previous one, so
 * {@link cellularAutomatonFrames} yields one definition per step for timeline
 * evolution animations (§6.4).
 */
import { type AbsXY, xy } from "../math/vec";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { shapeObject } from "../constructs/shared";
import { IntermactError } from "../errors";

/** Spec for a 1D elementary cellular automaton. */
export interface CA1DSpec {
  readonly kind: "1d";
  /** Wolfram rule number 0–255. */
  readonly rule: number;
  /** Number of cells per row. */
  readonly width: number;
  /** Number of generations (rows) to evolve. */
  readonly generations: number;
  /** Initial row: explicit cells, a single centered cell, or random (needs rng). */
  readonly init?: readonly number[] | "single" | "random";
  readonly rng?: Rng;
  /** Cell size in world units (default 0.1). */
  readonly cellSize?: number;
  /** Top-left origin (default `[0,0]`); rows grow downward. */
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

/** Spec for a 2D life-like cellular automaton. */
export interface CA2DSpec {
  readonly kind: "2d";
  readonly width: number;
  readonly height: number;
  /** Number of evolution steps applied before rendering. */
  readonly steps: number;
  /** Initial grid: explicit cells (row-major) or random fill ratio (needs rng). */
  readonly init?: readonly number[] | { readonly density: number };
  readonly rng?: Rng;
  /** Cell size in world units (default 0.1). */
  readonly cellSize?: number;
  readonly origin?: AbsXY;
  readonly style?: ObjectStyle;
}

/** Discriminated CA spec. */
export type CASpec = CA1DSpec | CA2DSpec;

/** Advance one generation of an elementary (1D) CA under `rule`, wrapping edges. */
export function stepRule1D(cells: Uint8Array, rule: number): Uint8Array {
  const n = cells.length;
  const next = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = cells[(i - 1 + n) % n]!;
    const c = cells[i]!;
    const r = cells[(i + 1) % n]!;
    const pattern = (l << 2) | (c << 1) | r;
    next[i] = (rule >> pattern) & 1;
  }
  return next;
}

/** Advance one step of Conway's Game of Life on a fixed (non-wrapping) grid. */
export function stepLife2D(grid: Uint8Array, width: number, height: number): Uint8Array {
  const next = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alive = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          alive += grid[ny * width + nx]!;
        }
      }
      const cell = grid[y * width + x]!;
      next[y * width + x] = cell ? (alive === 2 || alive === 3 ? 1 : 0) : alive === 3 ? 1 : 0;
    }
  }
  return next;
}

function init1D(spec: CA1DSpec): Uint8Array {
  const cells = new Uint8Array(spec.width);
  if (Array.isArray(spec.init)) {
    (spec.init as readonly number[]).forEach((v, i) => {
      if (i < cells.length) cells[i] = v ? 1 : 0;
    });
  } else if (spec.init === "random") {
    // Determinism (§6.7): random initial rows must come from a seeded Rng.
    if (!spec.rng) {
      throw new IntermactError(
        "invalid-argument",
        'cellularAutomaton: `init: "random"` requires a seeded `rng` (design.md §6.7).',
      );
    }
    for (let i = 0; i < cells.length; i++) cells[i] = spec.rng.next() < 0.5 ? 1 : 0;
  } else {
    cells[Math.floor(spec.width / 2)] = 1;
  }
  return cells;
}

function init2D(spec: CA2DSpec): Uint8Array {
  const grid = new Uint8Array(spec.width * spec.height);
  if (Array.isArray(spec.init)) {
    (spec.init as readonly number[]).forEach((v, i) => {
      if (i < grid.length) grid[i] = v ? 1 : 0;
    });
  } else if (spec.init && "density" in spec.init) {
    // Determinism (§6.7): random density fill must come from a seeded Rng.
    if (!spec.rng) {
      throw new IntermactError(
        "invalid-argument",
        "cellularAutomaton: `init: { density }` requires a seeded `rng` (design.md §6.7).",
      );
    }
    for (let i = 0; i < grid.length; i++) grid[i] = spec.rng.next() < spec.init.density ? 1 : 0;
  }
  return grid;
}

function cellSquare(x: number, y: number, size: number): RawContour {
  return rawContourFromPoints(
    [xy(x, y), xy(x + size, y), xy(x + size, y + size), xy(x, y + size)],
    true,
  );
}

function diagram1D(spec: CA1DSpec): RawContour[] {
  const size = spec.cellSize ?? 0.1;
  const [ox, oy] = spec.origin ?? xy(0, 0);
  const contours: RawContour[] = [];
  let cells = init1D(spec);
  for (let gen = 0; gen < spec.generations; gen++) {
    const y = oy - gen * size;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) contours.push(cellSquare(ox + i * size, y - size, size));
    }
    cells = stepRule1D(cells, spec.rule);
  }
  return contours;
}

function gridSquares(
  grid: Uint8Array,
  width: number,
  height: number,
  size: number,
  origin: AbsXY,
): RawContour[] {
  const [ox, oy] = origin;
  const contours: RawContour[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x]) contours.push(cellSquare(ox + x * size, oy + y * size, size));
    }
  }
  return contours;
}

/** Render a cellular automaton as filled live cells (design.md §6.4). */
export function cellularAutomaton(spec: CASpec): IMObject2D {
  let contours: RawContour[];
  if (spec.kind === "1d") {
    contours = diagram1D(spec);
  } else {
    const size = spec.cellSize ?? 0.1;
    let grid = init2D(spec);
    for (let s = 0; s < spec.steps; s++) grid = stepLife2D(grid, spec.width, spec.height);
    contours = gridSquares(grid, spec.width, spec.height, size, spec.origin ?? xy(0, 0));
  }
  if (contours.length === 0) contours.push(cellSquare(0, 0, 0));
  return shapeObject("cellular-automaton", contours, {
    fill: "#34d399",
    stroke: "#34d399",
    lineWidth: 0.002,
    ...(spec.style ?? {}),
  });
}

/**
 * Generate one object per generation for timeline-driven evolution (§6.4). For
 * 1D this returns progressively taller space-time diagrams; for 2D it returns
 * each life generation as its own grid object.
 */
export function cellularAutomatonFrames(spec: CASpec): IMObject2D[] {
  const frames: IMObject2D[] = [];
  if (spec.kind === "1d") {
    for (let g = 1; g <= spec.generations; g++) {
      frames.push(cellularAutomaton({ ...spec, generations: g }));
    }
  } else {
    const size = spec.cellSize ?? 0.1;
    let grid = init2D(spec);
    for (let s = 0; s <= spec.steps; s++) {
      const contours = gridSquares(grid, spec.width, spec.height, size, spec.origin ?? xy(0, 0));
      if (contours.length === 0) contours.push(cellSquare(0, 0, 0));
      frames.push(
        shapeObject("cellular-automaton", contours, {
          fill: "#34d399",
          stroke: "#34d399",
          lineWidth: 0.002,
          ...(spec.style ?? {}),
        }),
      );
      grid = stepLife2D(grid, spec.width, spec.height);
    }
  }
  return frames;
}
