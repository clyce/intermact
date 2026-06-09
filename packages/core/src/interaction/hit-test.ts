/**
 * Analytic hit-testing against pick proxies (design.md §12.1). For 2D ortho
 * scenes we un-project the pointer to scene space (render layer) and test it
 * against proxies here — exact for thin strokes/points and free of WebGL raycast
 * precision issues (the documented alternative to invisible pick meshes).
 */
import { type AbsXY, xy } from "../math/vec";
import { type IMObject2D } from "../object/types";
import { findTrait } from "../object/traits";
import { type PickProxy } from "./types";

/** Point inside a disc. */
export function pointInDisc(p: AbsXY, center: AbsXY, r: number): boolean {
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  return dx * dx + dy * dy <= r * r;
}

/** Point inside an axis-aligned rectangle. */
export function pointInRect(p: AbsXY, min: AbsXY, max: AbsXY): boolean {
  return p[0] >= min[0] && p[0] <= max[0] && p[1] >= min[1] && p[1] <= max[1];
}

/** Distance from a point to a segment. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Minimum distance from a point to an interleaved polyline buffer. */
export function distanceToPolyline(p: AbsXY, points: Float32Array): number {
  let best = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    best = Math.min(
      best,
      distanceToSegment(p[0], p[1], points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!),
    );
  }
  return best;
}

/** Test a world-space point against a proxy translated by `offset`. */
export function hitProxy(proxy: PickProxy, p: AbsXY, offset: AbsXY): boolean {
  const local = xy(p[0] - offset[0], p[1] - offset[1]);
  switch (proxy.kind) {
    case "disc":
      return pointInDisc(local, proxy.center, proxy.radius);
    case "rect":
      return pointInRect(local, proxy.min, proxy.max);
    case "band":
      return proxy.polylines.some((pl) => distanceToPolyline(local, pl) <= proxy.width);
    default:
      return false;
  }
}

/** One candidate for {@link hitTest}. */
export interface HitEntry {
  readonly id: string;
  readonly proxy: PickProxy;
  /** World translation applied to the proxy (object's runtime position). */
  readonly offset: AbsXY;
  readonly zIndex: number;
}

/** Return the id of the topmost entry hit by `p` (highest zIndex, then latest). */
export function hitTest(entries: readonly HitEntry[], p: AbsXY): string | null {
  let bestId: string | null = null;
  let bestZ = -Infinity;
  for (const e of entries) {
    if (hitProxy(e.proxy, p, e.offset) && e.zIndex >= bestZ) {
      bestZ = e.zIndex;
      bestId = e.id;
    }
  }
  return bestId;
}

/** Build a band pick proxy from an object's sampled stroke contours. */
export function pickBandFromObject(object: IMObject2D, width: number): PickProxy {
  const stroke = findTrait(object.traits, "stroke");
  const contours = stroke ? stroke.samplePath().contours : [];
  return { kind: "band", polylines: contours.map((c) => c.points), width };
}

/** Build a rect pick proxy from an object's local bounds. */
export function pickRectFromObject(object: IMObject2D, pad = 0): PickProxy {
  const b = object.geometry.getBounds();
  return {
    kind: "rect",
    min: xy(b.min[0] - pad, b.min[1] - pad),
    max: xy(b.max[0] + pad, b.max[1] + pad),
  };
}
