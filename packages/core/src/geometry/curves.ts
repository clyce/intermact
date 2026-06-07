import { type AbsXY, xy } from "../math/vec";
import { IntermactError } from "../errors";

/**
 * Parametric curve samplers (arc, quadratic/cubic Bézier chains). These produce
 * dense polylines that the geometry provider can arc-length resample (§5.2).
 */

/** Sample points along a circular arc from `startAngle` to `endAngle`. */
export function sampleArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  steps: number,
): AbsXY[] {
  const out: AbsXY[] = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = startAngle + (endAngle - startAngle) * t;
    out.push(xy(cx + radius * Math.cos(a), cy + radius * Math.sin(a)));
  }
  return out;
}

/** Sample an ellipse arc with independent radii. */
export function sampleEllipseArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  steps: number,
): AbsXY[] {
  const out: AbsXY[] = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = startAngle + (endAngle - startAngle) * t;
    out.push(xy(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
  }
  return out;
}

function quadraticPoint(p0: AbsXY, p1: AbsXY, p2: AbsXY, t: number): AbsXY {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  return xy(x, y);
}

function cubicPoint(p0: AbsXY, c1: AbsXY, c2: AbsXY, p1: AbsXY, t: number): AbsXY {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1];
  return xy(x, y);
}

/**
 * Sample a Bézier defined by control points. 3 points => one quadratic; 4
 * points => one cubic; otherwise a cubic chain requiring `3k + 1` points
 * (`p0,c1,c2,p1,c3,c4,p2,...`).
 */
export function sampleBezier(points: readonly AbsXY[], stepsPerSegment = 32): AbsXY[] {
  if (points.length === 3) {
    const [p0, p1, p2] = points as [AbsXY, AbsXY, AbsXY];
    return sampleSegment((t) => quadraticPoint(p0, p1, p2, t), stepsPerSegment, true);
  }
  if (points.length < 4 || (points.length - 1) % 3 !== 0) {
    throw new IntermactError(
      "invalid-argument",
      `bezierCurve expects 3 points (quadratic) or 3k+1 points (cubic chain); got ${points.length}.`,
    );
  }
  const out: AbsXY[] = [];
  const segments = (points.length - 1) / 3;
  for (let s = 0; s < segments; s++) {
    const i = s * 3;
    const seg = sampleSegment(
      (t) => cubicPoint(points[i]!, points[i + 1]!, points[i + 2]!, points[i + 3]!, t),
      stepsPerSegment,
      s === 0,
    );
    out.push(...seg);
  }
  return out;
}

/** Sample a parametric segment; `includeStart` avoids duplicate join points. */
function sampleSegment(fn: (t: number) => AbsXY, steps: number, includeStart: boolean): AbsXY[] {
  const out: AbsXY[] = [];
  const n = Math.max(2, steps);
  for (let i = includeStart ? 0 : 1; i < n; i++) out.push(fn(i / (n - 1)));
  return out;
}
