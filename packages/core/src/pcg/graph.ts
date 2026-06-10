/**
 * Graph generator with node/edge layout (design.md §6.4). Supports circular,
 * tree (BFS layering), and force-directed (Fruchterman–Reingold) layouts. The
 * force layout seeds initial positions from an injected {@link Rng} so the
 * result is reproducible (§6.7).
 */
import { type AbsXY, xy } from "../math/vec";
import { type RawContour, approxCircle, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { shapeObject } from "../constructs/shared";
import { IntermactError } from "../errors";

/** Graph layout strategy. */
export type GraphLayout = "force" | "tree" | "circular";

/** Spec for {@link graphObject}. */
export interface GraphSpec {
  /** Node ids. */
  readonly nodes: readonly string[];
  /** Undirected edges as `[fromId, toId]` pairs. */
  readonly edges: readonly (readonly [string, string])[];
  /** Layout strategy (default "circular"). */
  readonly layout?: GraphLayout;
  /** Half-extent of the layout box in world units (default 3). */
  readonly extent?: number;
  /** Node disk radius (default 0.12). */
  readonly nodeRadius?: number;
  /** Force-layout iterations (default 120). */
  readonly iterations?: number;
  /** Seeded RNG (required for "force"). */
  readonly rng?: Rng;
  readonly style?: ObjectStyle;
}

function circularLayout(nodes: readonly string[], extent: number): Map<string, AbsXY> {
  const pos = new Map<string, AbsXY>();
  nodes.forEach((id, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    pos.set(id, xy(extent * Math.cos(a), extent * Math.sin(a)));
  });
  return pos;
}

function treeLayout(
  nodes: readonly string[],
  edges: readonly (readonly [string, string])[],
  extent: number,
): Map<string, AbsXY> {
  const adjacency = new Map<string, string[]>();
  for (const id of nodes) adjacency.set(id, []);
  for (const [a, b] of edges) {
    adjacency.get(a)?.push(b);
    adjacency.get(b)?.push(a);
  }
  const depth = new Map<string, number>();
  const root = nodes[0];
  const levels: string[][] = [];
  if (root !== undefined) {
    const queue: string[] = [root];
    depth.set(root, 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = depth.get(id)!;
      (levels[d] ??= []).push(id);
      for (const n of adjacency.get(id) ?? []) {
        if (!depth.has(n)) {
          depth.set(n, d + 1);
          queue.push(n);
        }
      }
    }
  }
  // Place any disconnected nodes on a trailing level.
  const placed = new Set(depth.keys());
  const orphans = nodes.filter((id) => !placed.has(id));
  if (orphans.length) levels.push(orphans);

  const pos = new Map<string, AbsXY>();
  const rows = Math.max(1, levels.length);
  levels.forEach((row, d) => {
    const y = extent - (rows === 1 ? 0 : (2 * extent * d) / (rows - 1));
    row.forEach((id, i) => {
      const x = row.length === 1 ? 0 : -extent + (2 * extent * i) / (row.length - 1);
      pos.set(id, xy(x, y));
    });
  });
  return pos;
}

function forceLayout(
  nodes: readonly string[],
  edges: readonly (readonly [string, string])[],
  extent: number,
  iterations: number,
  rng: Rng,
): Map<string, AbsXY> {
  const n = nodes.length;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const index = new Map<string, number>();
  nodes.forEach((id, i) => {
    index.set(id, i);
    px[i] = (rng.next() * 2 - 1) * extent;
    py[i] = (rng.next() * 2 - 1) * extent;
  });
  const k = extent / Math.max(1, Math.sqrt(n));
  let temp = extent * 0.5;
  const cool = temp / (iterations + 1);

  for (let it = 0; it < iterations; it++) {
    const dispX = new Float64Array(n);
    const dispY = new Float64Array(n);
    // Repulsion between all pairs.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[i]! - px[j]!;
        let dy = py[i]! - py[j]!;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-4) {
          dx = (rng.next() - 0.5) * 1e-3;
          dy = (rng.next() - 0.5) * 1e-3;
          dist = Math.hypot(dx, dy) || 1e-4;
        }
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[i] = dispX[i]! + fx;
        dispY[i] = dispY[i]! + fy;
        dispX[j] = dispX[j]! - fx;
        dispY[j] = dispY[j]! - fy;
      }
    }
    // Attraction along edges.
    for (const [a, b] of edges) {
      const i = index.get(a);
      const j = index.get(b);
      if (i === undefined || j === undefined) continue;
      const dx = px[i]! - px[j]!;
      const dy = py[i]! - py[j]!;
      const dist = Math.hypot(dx, dy) || 1e-4;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      dispX[i] = dispX[i]! - fx;
      dispY[i] = dispY[i]! - fy;
      dispX[j] = dispX[j]! + fx;
      dispY[j] = dispY[j]! + fy;
    }
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(dispX[i]!, dispY[i]!) || 1e-4;
      px[i] = px[i]! + (dispX[i]! / d) * Math.min(d, temp);
      py[i] = py[i]! + (dispY[i]! / d) * Math.min(d, temp);
      px[i] = Math.max(-extent, Math.min(extent, px[i]!));
      py[i] = Math.max(-extent, Math.min(extent, py[i]!));
    }
    temp -= cool;
  }
  const pos = new Map<string, AbsXY>();
  nodes.forEach((id, i) => pos.set(id, xy(px[i]!, py[i]!)));
  return pos;
}

/** Build a graph object with laid-out nodes (disks) and edges (lines). */
export function graphObject(spec: GraphSpec): IMObject2D {
  const layout = spec.layout ?? "circular";
  const extent = spec.extent ?? 3;
  const radius = spec.nodeRadius ?? 0.12;
  let positions: Map<string, AbsXY>;
  if (layout === "circular") {
    positions = circularLayout(spec.nodes, extent);
  } else if (layout === "tree") {
    positions = treeLayout(spec.nodes, spec.edges, extent);
  } else {
    // Determinism (§6.7): force layout seeds initial positions from the Rng.
    // Without one the result is not reproducible, so fail fast instead of
    // silently falling back to the circular layout.
    if (!spec.rng) {
      throw new IntermactError(
        "invalid-argument",
        'graphObject: `layout: "force"` requires a seeded `rng` for reproducibility (design.md §6.7).',
      );
    }
    positions = forceLayout(spec.nodes, spec.edges, extent, spec.iterations ?? 120, spec.rng);
  }

  const contours: RawContour[] = [];
  for (const [a, b] of spec.edges) {
    const pa = positions.get(a);
    const pb = positions.get(b);
    if (pa && pb) contours.push(rawContourFromPoints([pa, pb], false));
  }
  for (const id of spec.nodes) {
    const p = positions.get(id);
    if (!p) continue;
    contours.push(rawContourFromPoints(approxCircle(p, radius, 16), true));
  }
  return shapeObject("graph", contours, {
    stroke: "#60a5fa",
    fill: "#1e3a5f",
    lineWidth: 0.012,
    ...spec.style,
  });
}
