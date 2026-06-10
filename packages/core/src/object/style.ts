/**
 * Object styling and semantic metadata (design.md §4.1, §17).
 */

/** Line width expressed either in world units (default) or screen pixels (§15). */
export type LineWidth = number | { readonly value: number; readonly unit: "world" | "px" };

/** Visual style shared by 2D/3D objects. Renderer-agnostic. */
export interface ObjectStyle {
  /** Stroke color (CSS color string). */
  readonly stroke?: string;
  /** Fill color (CSS color string). */
  readonly fill?: string;
  /**
   * Wider underlay fill behind {@link fill} (glyph outline halo). Used instead
   * of ribbon-stroking outline contours, which spikes at sharp corners.
   */
  readonly underlayFill?: string;
  /** Stroke width; world units unless declared as px (§15). */
  readonly lineWidth?: LineWidth;
  /** Overall opacity multiplier in [0,1]. */
  readonly opacity?: number;
  /** Fill rule for self-intersecting / holed paths. */
  readonly fillRule?: "nonzero" | "evenodd";
  /** 3D material color convenience alias. */
  readonly color?: string;
  /** Point size for 3D point clouds (world units). */
  readonly pointSize?: number;
  /** Render both faces of 3D meshes/surfaces (default true for surfaces). */
  readonly doubleSided?: boolean;
}

/** Semantic layer metadata for accessibility, links, and handouts (§17). */
export interface ObjectMetadata {
  readonly label?: string;
  readonly href?: string;
  readonly a11yLabel?: string;
  readonly note?: string;
}
