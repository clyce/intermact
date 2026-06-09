/**
 * Shared glyph types for OpenType / MathJax outline providers.
 */
import { type RawContour } from "../geometry/sampling";

/** A laid-out glyph: filled contours in the normalized em box + horizontal advance. */
export interface Glyph {
  readonly contours: readonly RawContour[];
  /** Horizontal advance in em units (same scale as contour coordinates). */
  readonly advance: number;
}
