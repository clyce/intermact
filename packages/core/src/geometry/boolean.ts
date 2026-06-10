/**
 * Polygon boolean operations (design.md §6.6 `booleanOp`) via the
 * Greiner–Hormann clipping algorithm. Operates on two simple (single-contour,
 * non-self-intersecting) polygons with transversal crossings. Degenerate inputs
 * (shared vertices, collinear overlaps) are out of scope and documented in
 * `dev-docs/phase-3-review.md`.
 */
import { type AbsXY, xy } from "../math/vec";

/** Supported boolean operations. */
export type BooleanOp = "union" | "intersect" | "subtract" | "xor";

interface GhVertex {
  x: number;
  y: number;
  next: GhVertex | null;
  prev: GhVertex | null;
  neighbour: GhVertex | null;
  intersect: boolean;
  alpha: number;
  entry: boolean;
  visited: boolean;
}

function makeVertex(x: number, y: number): GhVertex {
  return {
    x,
    y,
    next: null,
    prev: null,
    neighbour: null,
    intersect: false,
    alpha: 0,
    entry: false,
    visited: false,
  };
}

/** Even-odd point-in-polygon test on a closed ring of points. */
export function pointInPolygon(px: number, py: number, ring: readonly AbsXY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0];
    const yi = ring[i]![1];
    const xj = ring[j]![0];
    const yj = ring[j]![1];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Signed area of a closed ring (positive => counter-clockwise). */
export function signedArea(ring: readonly AbsXY[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  }
  return -area / 2;
}

function buildList(ring: readonly AbsXY[]): GhVertex[] {
  const verts = ring.map((p) => makeVertex(p[0], p[1]));
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    verts[i]!.next = verts[(i + 1) % n]!;
    verts[i]!.prev = verts[(i - 1 + n) % n]!;
  }
  return verts;
}

interface Crossing {
  readonly alpha: number;
  readonly beta: number;
  readonly x: number;
  readonly y: number;
}

function intersectSegments(a: GhVertex, b: GhVertex, c: GhVertex, d: GhVertex): Crossing | null {
  const r1x = b.x - a.x;
  const r1y = b.y - a.y;
  const r2x = d.x - c.x;
  const r2y = d.y - c.y;
  const denom = r1x * r2y - r1y * r2x;
  if (Math.abs(denom) < 1e-12) return null;
  const alpha = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / denom;
  const beta = ((c.x - a.x) * r1y - (c.y - a.y) * r1x) / denom;
  if (alpha <= 1e-9 || alpha >= 1 - 1e-9 || beta <= 1e-9 || beta >= 1 - 1e-9) return null;
  return { alpha, beta, x: a.x + alpha * r1x, y: a.y + alpha * r1y };
}

function insertBetween(start: GhVertex, end: GhVertex, v: GhVertex): void {
  // Walk from `start` toward `end` placing `v` by ascending alpha.
  let curr = start;
  while (curr.next !== end && curr.next!.intersect && curr.next!.alpha < v.alpha) {
    curr = curr.next!;
  }
  v.next = curr.next;
  v.prev = curr;
  curr.next!.prev = v;
  curr.next = v;
}

/**
 * Compute a boolean operation between two simple polygons. Returns zero or more
 * result contours (point rings). Falls back to containment/disjoint handling
 * when the polygons do not cross.
 */
export function polygonBoolean(
  subjectRing: readonly AbsXY[],
  clipRing: readonly AbsXY[],
  op: BooleanOp,
): AbsXY[][] {
  if (op === "xor") {
    return [
      ...polygonBoolean(subjectRing, clipRing, "subtract"),
      ...polygonBoolean(clipRing, subjectRing, "subtract"),
    ];
  }

  const subject = buildList(subjectRing);
  const clip = buildList(clipRing);

  // Phase 1: find and link intersections.
  let crossings = 0;
  for (let i = 0; i < subject.length; i++) {
    const a = subject[i]!;
    const b = subject[(i + 1) % subject.length]!;
    for (let j = 0; j < clip.length; j++) {
      const c = clip[j]!;
      const d = clip[(j + 1) % clip.length]!;
      const x = intersectSegments(a, b, c, d);
      if (!x) continue;
      const vs = makeVertex(x.x, x.y);
      vs.intersect = true;
      vs.alpha = x.alpha;
      const vc = makeVertex(x.x, x.y);
      vc.intersect = true;
      vc.alpha = x.beta;
      vs.neighbour = vc;
      vc.neighbour = vs;
      insertBetween(a, b, vs);
      insertBetween(c, d, vc);
      crossings++;
    }
  }

  if (crossings === 0) {
    return booleanNoCrossing(subjectRing, clipRing, op);
  }

  // Rebuild circular order arrays including intersections.
  const subjectChain = collectChain(subject[0]!);
  const clipChain = collectChain(clip[0]!);

  // Phase 2: entry/exit flags.
  const subjInClip = pointInPolygon(subject[0]!.x, subject[0]!.y, clipRing);
  const clipInSubj = pointInPolygon(clip[0]!.x, clip[0]!.y, subjectRing);
  const { sEntry, cEntry } = entryFlags(op, subjInClip, clipInSubj);
  markEntries(subjectChain, sEntry);
  markEntries(clipChain, cEntry);

  // Phase 3: trace result polygons.
  const results: AbsXY[][] = [];
  for (const startV of subjectChain) {
    if (!startV.intersect || startV.visited) continue;
    const poly: AbsXY[] = [];
    let current: GhVertex = startV;
    do {
      current.visited = true;
      if (current.neighbour) current.neighbour.visited = true;
      if (current.entry) {
        do {
          current = current.next!;
          poly.push(xy(current.x, current.y));
        } while (!current.intersect);
      } else {
        do {
          current = current.prev!;
          poly.push(xy(current.x, current.y));
        } while (!current.intersect);
      }
      current = current.neighbour!;
    } while (current !== startV && current && !current.visited);
    if (poly.length >= 3) results.push(poly);
  }
  return results;
}

function collectChain(head: GhVertex): GhVertex[] {
  const out: GhVertex[] = [];
  let v: GhVertex | null = head;
  do {
    out.push(v!);
    v = v!.next;
  } while (v && v !== head);
  return out;
}

function entryFlags(
  op: BooleanOp,
  subjInClip: boolean,
  clipInSubj: boolean,
): { sEntry: boolean; cEntry: boolean } {
  switch (op) {
    case "intersect":
      return { sEntry: !subjInClip, cEntry: !clipInSubj };
    case "union":
      return { sEntry: subjInClip, cEntry: clipInSubj };
    case "subtract":
      return { sEntry: subjInClip, cEntry: !clipInSubj };
    default:
      return { sEntry: !subjInClip, cEntry: !clipInSubj };
  }
}

function markEntries(chain: readonly GhVertex[], firstEntry: boolean): void {
  let entry = firstEntry;
  for (const v of chain) {
    if (!v.intersect) continue;
    v.entry = entry;
    entry = !entry;
  }
}

function booleanNoCrossing(
  subjectRing: readonly AbsXY[],
  clipRing: readonly AbsXY[],
  op: BooleanOp,
): AbsXY[][] {
  const subjInClip = pointInPolygon(subjectRing[0]![0], subjectRing[0]![1], clipRing);
  const clipInSubj = pointInPolygon(clipRing[0]![0], clipRing[0]![1], subjectRing);
  const ensureCcw = (ring: readonly AbsXY[]): AbsXY[] =>
    signedArea(ring) < 0 ? [...ring].reverse() : [...ring];
  const ensureCw = (ring: readonly AbsXY[]): AbsXY[] =>
    signedArea(ring) > 0 ? [...ring].reverse() : [...ring];

  switch (op) {
    case "intersect":
      if (subjInClip) return [ensureCcw(subjectRing)];
      if (clipInSubj) return [ensureCcw(clipRing)];
      return [];
    case "union":
      if (subjInClip) return [ensureCcw(clipRing)];
      if (clipInSubj) return [ensureCcw(subjectRing)];
      return [ensureCcw(subjectRing), ensureCcw(clipRing)];
    case "subtract":
      if (clipInSubj) return [ensureCcw(subjectRing), ensureCw(clipRing)]; // outer + hole
      if (subjInClip) return [];
      return [ensureCcw(subjectRing)];
    default:
      return [];
  }
}
