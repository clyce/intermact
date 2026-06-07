/**
 * Scene authoring props (design.md §7.2). The coordinate transform/aspect-ratio
 * machinery lands in M5; here we capture the declarative shape used at scene
 * creation.
 */

/** A numeric interval `[min, max]`. */
export type Interval = readonly [number, number];

/** 2D scene properties: coordinate system, world domain, fit and background. */
export interface Scene2DProps {
  readonly coordinate: "cartesian" | "polar";
  readonly domain: { readonly x: Interval; readonly y: Interval };
  /** Aspect-ratio strategy when pixel ratio != domain ratio (default contain). */
  readonly fit?: "contain" | "cover" | "stretch";
  readonly background?: string;
}
