import { type Scene2DProps } from "@intermact/core";

/** Orthographic frustum bounds in world units. */
export interface FrustumBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Result of fitting a domain into a pixel viewport. */
export interface FitResult {
  readonly frustum: FrustumBounds;
  /** World units per pixel (for `unit: "px"` line widths). */
  readonly worldPerPixel: number;
}

/**
 * Compute the orthographic frustum that maps a scene domain into a pixel
 * viewport under a fit strategy (design.md §9, §10): `contain` letterboxes,
 * `cover` crops to fill, `stretch` matches the domain exactly (may distort).
 */
export function computeFit(
  domain: Scene2DProps["domain"],
  fit: NonNullable<Scene2DProps["fit"]>,
  width: number,
  height: number,
): FitResult {
  const cx = (domain.x[0] + domain.x[1]) / 2;
  const cy = (domain.y[0] + domain.y[1]) / 2;
  const domainW = domain.x[1] - domain.x[0];
  const domainH = domain.y[1] - domain.y[0];
  const canvasAspect = width / Math.max(height, 1);
  const domainAspect = domainW / Math.max(domainH, 1e-6);

  let halfW = domainW / 2;
  let halfH = domainH / 2;

  if (fit === "stretch") {
    // keep domain exactly
  } else if (fit === "contain") {
    if (canvasAspect > domainAspect) halfW = halfH * canvasAspect;
    else halfH = halfW / canvasAspect;
  } else {
    // cover
    if (canvasAspect > domainAspect) halfH = halfW / canvasAspect;
    else halfW = halfH * canvasAspect;
  }

  return {
    frustum: { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH },
    worldPerPixel: (2 * halfW) / Math.max(width, 1),
  };
}
