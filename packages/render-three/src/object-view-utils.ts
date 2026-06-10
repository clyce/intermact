import {
  type IMObject2D,
  type LineWidth,
  type ObjectStyle,
  type RuntimeState2D,
} from "@intermact/core";

/** Context the renderer passes to object views (e.g. for px→world line width). */
export interface RenderContext {
  /** World units per device-independent pixel, for `unit: "px"` line widths. */
  readonly worldPerPixel: number;
}

/** Fallback stroke width (world units) when an object declares none. */
export const DEFAULT_LINE_WIDTH = 0.02;

/**
 * Resolve a {@link LineWidth} to world units, converting `unit: "px"` widths via
 * the context's `worldPerPixel`. Shared by the standard and instanced 2D object
 * views (design.md §15.2, §13.6.1 DRY).
 */
export function resolveLineWidth(width: LineWidth | undefined, ctx: RenderContext): number {
  if (width === undefined) return DEFAULT_LINE_WIDTH;
  if (typeof width === "number") return width;
  return width.unit === "px" ? width.value * ctx.worldPerPixel : width.value;
}

/** Merge an object's authoring style with per-frame runtime style overrides. */
export function effectiveStyle(object: IMObject2D, state: RuntimeState2D): ObjectStyle {
  return { ...object.style, ...state.styleOverrides };
}
