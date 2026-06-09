/**
 * SVG `d` path parser (design.md §13 step 2). Parses the path mini-language into
 * flattened {@link RawContour}s (curves are sampled to polylines via the shared
 * curve samplers). This is the pipeline primitive shared by the built-in stroke
 * font, `AssetManager.svg`, and any future MathJax/opentype glyph-path provider.
 */
import { type AbsXY, xy } from "../math/vec";
import { sampleArc, sampleBezier } from "../geometry/curves";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";

/** Options for {@link parseSvgPath}. */
export interface SvgPathParseOptions {
  /** Polyline samples per Bézier/arc segment (default 16). */
  readonly samplesPerCurve?: number;
  /** Multiply all coordinates (e.g. font unit → em). */
  readonly scale?: number;
  /** Flip the Y axis (SVG is y-down; most Intermact geometry is y-up). */
  readonly flipY?: boolean;
}

/** Tokenize a path string into commands and numbers. */
function tokenize(d: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const re = /([a-zA-Z])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else tokens.push(parseFloat(m[2]!));
  }
  return tokens;
}

/**
 * Parse an SVG path `d` string into raw contours. Supports
 * M/L/H/V/C/S/Q/T/A/Z (and lowercase relative variants).
 */
export function parseSvgPath(d: string, opts: SvgPathParseOptions = {}): RawContour[] {
  const steps = Math.max(2, opts.samplesPerCurve ?? 16);
  const tokens = tokenize(d);
  let i = 0;

  const contours: RawContour[] = [];
  let current: AbsXY[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let prevCmd = "";

  const num = (): number => tokens[i++] as number;
  const push = (x: number, y: number): void => {
    current.push(xy(x, y));
  };
  const flush = (closed: boolean): void => {
    if (current.length > 0) contours.push(rawContourFromPoints(current, closed));
    current = [];
  };
  const appendSamples = (pts: readonly AbsXY[]): void => {
    // Skip the first sample (== current point) to avoid duplicates.
    for (let k = 1; k < pts.length; k++) current.push(pts[k]!);
  };

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (typeof cmd === "string") {
      i++;
    } else {
      // Implicit repeat of the previous command (M→L, m→l).
      cmd = prevCmd === "M" ? "L" : prevCmd === "m" ? "l" : prevCmd;
    }
    const rel = (cmd as string) === (cmd as string).toLowerCase();
    const C = (cmd as string).toUpperCase();

    switch (C) {
      case "M": {
        const x = num();
        const y = num();
        cx = rel ? cx + x : x;
        cy = rel ? cy + y : y;
        flush(false);
        startX = cx;
        startY = cy;
        push(cx, cy);
        break;
      }
      case "L": {
        const x = num();
        const y = num();
        cx = rel ? cx + x : x;
        cy = rel ? cy + y : y;
        push(cx, cy);
        break;
      }
      case "H": {
        const x = num();
        cx = rel ? cx + x : x;
        push(cx, cy);
        break;
      }
      case "V": {
        const y = num();
        cy = rel ? cy + y : y;
        push(cx, cy);
        break;
      }
      case "C": {
        const c1x = (rel ? cx : 0) + num();
        const c1y = (rel ? cy : 0) + num();
        const c2x = (rel ? cx : 0) + num();
        const c2y = (rel ? cy : 0) + num();
        const ex = (rel ? cx : 0) + num();
        const ey = (rel ? cy : 0) + num();
        appendSamples(sampleBezier([xy(cx, cy), xy(c1x, c1y), xy(c2x, c2y), xy(ex, ey)], steps));
        prevCtrlX = c2x;
        prevCtrlY = c2y;
        cx = ex;
        cy = ey;
        break;
      }
      case "S": {
        const reflect = prevCmd.toUpperCase() === "C" || prevCmd.toUpperCase() === "S";
        const c1x = reflect ? 2 * cx - prevCtrlX : cx;
        const c1y = reflect ? 2 * cy - prevCtrlY : cy;
        const c2x = (rel ? cx : 0) + num();
        const c2y = (rel ? cy : 0) + num();
        const ex = (rel ? cx : 0) + num();
        const ey = (rel ? cy : 0) + num();
        appendSamples(sampleBezier([xy(cx, cy), xy(c1x, c1y), xy(c2x, c2y), xy(ex, ey)], steps));
        prevCtrlX = c2x;
        prevCtrlY = c2y;
        cx = ex;
        cy = ey;
        break;
      }
      case "Q": {
        const c1x = (rel ? cx : 0) + num();
        const c1y = (rel ? cy : 0) + num();
        const ex = (rel ? cx : 0) + num();
        const ey = (rel ? cy : 0) + num();
        appendSamples(sampleBezier([xy(cx, cy), xy(c1x, c1y), xy(ex, ey)], steps));
        prevCtrlX = c1x;
        prevCtrlY = c1y;
        cx = ex;
        cy = ey;
        break;
      }
      case "T": {
        const reflect = prevCmd.toUpperCase() === "Q" || prevCmd.toUpperCase() === "T";
        const c1x = reflect ? 2 * cx - prevCtrlX : cx;
        const c1y = reflect ? 2 * cy - prevCtrlY : cy;
        const ex = (rel ? cx : 0) + num();
        const ey = (rel ? cy : 0) + num();
        appendSamples(sampleBezier([xy(cx, cy), xy(c1x, c1y), xy(ex, ey)], steps));
        prevCtrlX = c1x;
        prevCtrlY = c1y;
        cx = ex;
        cy = ey;
        break;
      }
      case "A": {
        // Elliptical arc: rx ry rot largeArc sweep x y. Approximated as a circular
        // arc through endpoints (sufficient for glyph paths, which rarely use A).
        const rx = num();
        num(); // ry (treated == rx)
        num(); // x-axis-rotation
        num(); // large-arc-flag
        const sweep = num();
        const ex = (rel ? cx : 0) + num();
        const ey = (rel ? cy : 0) + num();
        const mx = (cx + ex) / 2;
        const my = (cy + ey) / 2;
        const a0 = Math.atan2(cy - my, cx - mx);
        const a1 = Math.atan2(ey - my, ex - mx);
        const r = Math.max(rx, Math.hypot(ex - cx, ey - cy) / 2);
        appendSamples(sampleArc(mx, my, r, a0, sweep ? a1 : a1 - Math.PI * 2, steps));
        cx = ex;
        cy = ey;
        break;
      }
      case "Z": {
        push(startX, startY);
        flush(true);
        cx = startX;
        cy = startY;
        break;
      }
      default:
        break;
    }
    prevCmd = cmd as string;
  }
  flush(false);

  const scale = opts.scale ?? 1;
  const flipY = opts.flipY ?? false;
  if (scale === 1 && !flipY) return contours;
  return contours.map((c) => {
    const out = new Float32Array(c.points.length);
    for (let k = 0; k < c.points.length; k += 2) {
      out[k] = c.points[k]! * scale;
      out[k + 1] = c.points[k + 1]! * scale * (flipY ? -1 : 1);
    }
    return { points: out, closed: c.closed };
  });
}
