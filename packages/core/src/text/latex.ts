/**
 * LaTeX → MathJax SVG → glyph layout (design.md §13). Use
 * {@link AssetManager.latex} with `engine: "mathjax"` during the build pass.
 */
import { type AbsXY, xy } from "../math/vec";
import { type IMObject2D } from "../object/types";
import {
  composeGlyphs,
  resolveGlyphStyle,
  shiftGlyphs,
  type GlyphStyleProps,
  type PlacedGlyph,
} from "./text-layout";

/** A LaTeX token surfaced to the matching key function. */
export interface LatexToken {
  readonly value: string;
  readonly role: "base" | "sup" | "sub";
}

/** Authoring props for MathJax LaTeX layout (via {@link AssetManager.latex}). */
export interface LatexObjectProps extends GlyphStyleProps {
  readonly tex: string;
  readonly engine?: "mathjax";
  readonly size?: number;
  readonly origin?: AbsXY;
  readonly align?: "left" | "center" | "right";
  readonly partKey?: (token: LatexToken) => string;
}

/** Compose pre-laid MathJax glyphs into a LaTeX object. */
export function latexObjectFromGlyphs(
  glyphs: readonly PlacedGlyph[],
  width: number,
  props: Omit<LatexObjectProps, "tex">,
): IMObject2D {
  const origin = props.origin ?? xy(0, 0);
  const alignOffset = props.align === "center" ? -width / 2 : props.align === "right" ? -width : 0;
  const shifted = shiftGlyphs(glyphs, origin[0] + alignOffset, origin[1]);
  return composeGlyphs(shifted, "latex", resolveGlyphStyle(props), props);
}
