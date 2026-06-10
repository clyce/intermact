import { type RenderSnapshot } from "../animation/snapshot";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type ResolvedTransform2D, type RuntimeState2D } from "../runtime/state";

/**
 * Headless SVG snapshot (design.md §17 export). Rasterizing a frame normally
 * needs the GL renderer, but for static snapshots and tests we can emit a
 * standalone SVG string from a {@link RenderSnapshot} with zero DOM/GL deps. The
 * browser export glue (`export/video-render`) wraps this (or the GL canvas) into
 * PNG/WebP via an `Image` + `<canvas>` or `OffscreenCanvas`. 2D only; 3D frames
 * export through the GL renderer.
 */

/** A 2D domain rectangle (mirrors `Scene2DProps.domain`). */
export interface SvgDomain {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
}

/** Options for {@link snapshotToSVG}. */
export interface SvgSnapshotOptions {
  readonly domain: SvgDomain;
  readonly width?: number;
  readonly height?: number;
  readonly background?: string;
}

function lineWidthPx(style: ObjectStyle | undefined, scale: number): number {
  const lw = style?.lineWidth;
  if (lw === undefined) return 2;
  const value = typeof lw === "number" ? lw : lw.value;
  const unit = typeof lw === "number" ? "world" : lw.unit;
  return unit === "px" ? value : value * scale;
}

function applyTransform(p: readonly [number, number], t: ResolvedTransform2D): [number, number] {
  const sx = p[0] * t.scale[0];
  const sy = p[1] * t.scale[1];
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return [sx * cos - sy * sin + t.position[0], sx * sin + sy * cos + t.position[1]];
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Render a single 2D snapshot into a standalone SVG document string. */
export function snapshotToSVG(snapshot: RenderSnapshot, options: SvgSnapshotOptions): string {
  const width = options.width ?? 800;
  const height = options.height ?? 450;
  const [xMin, xMax] = options.domain.x;
  const [yMin, yMax] = options.domain.y;
  const spanX = xMax - xMin || 1;
  const spanY = yMax - yMin || 1;
  const worldScale = width / spanX;
  const toScreen = (wx: number, wy: number): [number, number] => [
    ((wx - xMin) / spanX) * width,
    height - ((wy - yMin) / spanY) * height,
  ];

  const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();
  const body: string[] = [];

  const ordered = [...snapshot.objects.values()].sort((a, b) => {
    const az = a.state.dimension === "2d" ? a.state.transform.zIndex : 0;
    const bz = b.state.dimension === "2d" ? b.state.transform.zIndex : 0;
    return az - bz;
  });

  for (const entry of ordered) {
    if (entry.state.dimension !== "2d") continue;
    const state = entry.state as RuntimeState2D;
    if (!state.visible || state.opacity <= 0) continue;
    const object = entry.object as IMObject2D;
    const transform = state.transform;

    const override = state.geometryOverride;
    const contours = override
      ? override.contours.map((c) => ({ points: c.points, closed: c.closed }))
      : object.geometry.samplePath().contours.map((c) => ({ points: c.points, closed: c.closed }));

    const fillColor = object.style?.fill ?? object.style?.color;
    const strokeColor = object.style?.stroke ?? object.style?.color ?? "#e2e8f0";
    const strokePx = lineWidthPx(object.style, worldScale);
    const reveal = Math.max(0, Math.min(1, state.revealEnd));

    for (const contour of contours) {
      const n = contour.points.length >> 1;
      if (n < 2) continue;
      const drawn = Math.max(2, Math.ceil(n * reveal));
      const segs: string[] = [];
      for (let i = 0; i < drawn; i++) {
        const wp = applyTransform([contour.points[i * 2]!, contour.points[i * 2 + 1]!], transform);
        const [sx, sy] = toScreen(wp[0], wp[1]);
        segs.push(`${i === 0 ? "M" : "L"}${fmt(sx)} ${fmt(sy)}`);
      }
      const closed = contour.closed && reveal >= 1;
      const d = segs.join(" ") + (closed ? " Z" : "");
      const doFill = closed && fillColor && state.fillProgress > 0;
      const fillAttr = doFill
        ? `fill="${escapeAttr(fillColor)}" fill-opacity="${fmt(state.opacity * state.fillProgress)}"`
        : `fill="none"`;
      body.push(
        `<path d="${d}" ${fillAttr} stroke="${escapeAttr(strokeColor)}" ` +
          `stroke-width="${fmt(strokePx)}" stroke-opacity="${fmt(state.opacity)}" ` +
          `stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }
  }

  const bg = options.background ?? "#0b1020";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${escapeAttr(bg)}"/>` +
    body.join("") +
    `</svg>`
  );
}
