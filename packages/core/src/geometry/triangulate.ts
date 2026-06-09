import earcut from "earcut";
import { type SampledContour2D } from "../object/geometry-provider";

/**
 * Polygon triangulation (design.md §5.2). Uses earcut for concave / holed shapes.
 * Supports multiple disjoint fill groups (one per glyph) so holes such as the
 * inner loop of "0" stay with their outer ring instead of pairing globally.
 */
export interface Triangulation {
  /** Interleaved vertex coordinates `[x0,y0,...]`. */
  readonly vertices: Float32Array;
  /** Triangle vertex indices into `vertices` (groups of 3). */
  readonly indices: Uint32Array;
}

interface Ring {
  readonly points: Float32Array;
  readonly area: number;
}

function signedArea(points: Float32Array): number {
  const n = points.length >> 1;
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += points[j * 2]! * points[i * 2 + 1]! - points[i * 2]! * points[j * 2 + 1]!;
  }
  return a / 2;
}

function ringCentroid(points: Float32Array): [number, number] {
  let sx = 0;
  let sy = 0;
  const n = points.length >> 1;
  for (let i = 0; i < n; i++) {
    sx += points[i * 2]!;
    sy += points[i * 2 + 1]!;
  }
  return [sx / n, sy / n];
}

/** Even-odd ray cast: is `(px,py)` inside the polygon `points`? */
function pointInPolygon(px: number, py: number, points: Float32Array): boolean {
  const n = points.length >> 1;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2]!;
    const yi = points[i * 2 + 1]!;
    const xj = points[j * 2]!;
    const yj = points[j * 2 + 1]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ensureWinding(points: Float32Array, wantPositive: boolean): Float32Array {
  const area = signedArea(points);
  const isPositive = area > 0;
  if (isPositive === wantPositive) return points;
  const out = new Float32Array(points.length);
  for (let i = 0, j = points.length - 2; i < points.length; i += 2, j -= 2) {
    out[i] = points[j]!;
    out[i + 1] = points[j + 1]!;
  }
  return out;
}

/**
 * Classify closed rings in one glyph group: largest containing rings are solids
 * (CCW), nested smaller rings become holes (CW). Disjoint solids are allowed.
 */
function classifyFillGroup(contours: readonly SampledContour2D[]): {
  solids: Ring[];
  holesBySolid: Map<number, Ring[]>;
} {
  const rings: Array<Ring & { index: number }> = [];
  contours.forEach((c, index) => {
    if (c.points.length >= 6) rings.push({ points: c.points, area: signedArea(c.points), index });
  });

  const solids: Ring[] = [];
  const holesBySolid = new Map<number, Ring[]>();
  const assigned = new Set<number>();

  const byArea = [...rings].sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  for (const candidate of byArea) {
    if (assigned.has(candidate.index)) continue;
    const [cx, cy] = ringCentroid(candidate.points);
    let parent = -1;
    let parentArea = Infinity;
    solids.forEach((solid, si) => {
      const a = Math.abs(solid.area);
      if (a < parentArea && a > Math.abs(candidate.area) && pointInPolygon(cx, cy, solid.points)) {
        parent = si;
        parentArea = a;
      }
    });

    if (parent < 0) {
      const si = solids.length;
      solids.push({
        points: ensureWinding(candidate.points, true),
        area: Math.abs(candidate.area),
      });
      assigned.add(candidate.index);
      for (const other of rings) {
        if (assigned.has(other.index) || other.index === candidate.index) continue;
        const [hx, hy] = ringCentroid(other.points);
        if (pointInPolygon(hx, hy, solids[si]!.points)) {
          const list = holesBySolid.get(si) ?? [];
          list.push({ points: ensureWinding(other.points, false), area: other.area });
          holesBySolid.set(si, list);
          assigned.add(other.index);
        }
      }
    }
  }

  if (solids.length === 0 && rings.length > 0) {
    for (const r of rings) {
      solids.push({ points: ensureWinding(r.points, true), area: Math.abs(r.area) });
    }
  }

  return { solids, holesBySolid };
}

function triangulateRings(
  solids: readonly Ring[],
  holesBySolid: ReadonlyMap<number, Ring[]>,
): Triangulation {
  const verts: number[] = [];
  const indices: number[] = [];
  solids.forEach((solid, si) => {
    const base = verts.length / 2;
    const groupVerts: number[] = [];
    for (let i = 0; i < solid.points.length; i++) groupVerts.push(solid.points[i]!);
    const holeIndices: number[] = [];
    for (const hole of holesBySolid.get(si) ?? []) {
      holeIndices.push(groupVerts.length / 2);
      for (let i = 0; i < hole.points.length; i++) groupVerts.push(hole.points[i]!);
    }
    const tri = earcut(groupVerts, holeIndices.length ? holeIndices : undefined, 2);
    for (let i = 0; i < groupVerts.length; i++) verts.push(groupVerts[i]!);
    for (const idx of tri) indices.push(idx + base);
  });
  return { vertices: Float32Array.from(verts), indices: Uint32Array.from(indices) };
}

/**
 * Triangulate one or more contours (legacy flat path). Prefer
 * {@link triangulateGroups} for multi-glyph text.
 */
export function triangulate(contours: readonly SampledContour2D[]): Triangulation {
  return triangulateGroups([contours]);
}

/** Triangulate each fill group independently, then merge meshes. */
export function triangulateGroups(groups: readonly (readonly SampledContour2D[])[]): Triangulation {
  const verts: number[] = [];
  const indices: number[] = [];
  for (const group of groups) {
    const closed = group.filter((c) => c.closed);
    if (!closed.length) continue;
    const { solids, holesBySolid } = classifyFillGroup(closed);
    const part = triangulateRings(solids, holesBySolid);
    const base = verts.length / 2;
    for (let i = 0; i < part.vertices.length; i++) verts.push(part.vertices[i]!);
    for (const idx of part.indices) indices.push(idx + base);
  }
  return { vertices: Float32Array.from(verts), indices: Uint32Array.from(indices) };
}

/** Sum of triangle areas in a triangulation (handy for tests/diagnostics). */
export function triangulationArea(tri: Triangulation): number {
  const { vertices, indices } = tri;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 2;
    const b = indices[i + 1]! * 2;
    const c = indices[i + 2]! * 2;
    const ax = vertices[a]!;
    const ay = vertices[a + 1]!;
    const bx = vertices[b]!;
    const by = vertices[b + 1]!;
    const cx = vertices[c]!;
    const cy = vertices[c + 1]!;
    area += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  }
  return area;
}
