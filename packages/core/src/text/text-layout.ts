/**
 * Text layout & composition (design.md §13). Lays out glyph runs from registered
 * OpenType / MathJax outline fonts into world-space contours and composes them
 * into a single {@link IMObject2D} with keyed parts and {@link TextLayoutTrait}.
 */
import { type AbsXY, xy } from "../math/vec";
import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "../geometry/provider";
import { type RawContour } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type ObjectTrait, type TextLayoutTrait, type TextToken } from "../object/traits";
import { type IMObject2D, type ObjectPart2D } from "../object/types";
import { glyphFor, resolveFontId } from "./glyph-resolver";

const GLYPH_SAMPLES = 64;

/** A positioned glyph: world-space filled contours + its matching key. */
export interface PlacedGlyph {
  readonly key: string;
  readonly text: string;
  readonly contours: RawContour[];
  readonly scale: number;
  readonly worldOffset: readonly [number, number];
  /** Index in the original glyph list (for writing order). */
  readonly glyphIndex: number;
}

/** Affine-transform a raw contour (scale then translate). */
export function transformContour(
  c: RawContour,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): RawContour {
  const out = new Float32Array(c.points.length);
  for (let i = 0; i < c.points.length; i += 2) {
    out[i] = c.points[i]! * sx + tx;
    out[i + 1] = c.points[i + 1]! * sy + ty;
  }
  return { points: out, closed: c.closed };
}

/** Options shared by glyph placement. */
export interface PlaceOptions {
  readonly scale?: number;
  readonly letterSpacing?: number;
  readonly keyOf?: (char: string, index: number) => string;
  /** Registered font id (default: {@link requireDefaultFont}). */
  readonly font?: string;
}

/** Place a string's glyphs starting at `(x, baselineY)`; returns run + width. */
export function placeString(
  text: string,
  x: number,
  baselineY: number,
  opts: PlaceOptions = {},
): { glyphs: PlacedGlyph[]; width: number } {
  const scale = opts.scale ?? 1;
  const spacing = opts.letterSpacing ?? 0;
  const keyOf = opts.keyOf ?? ((c, i) => `${c}@${i}`);
  const font = resolveFontId(opts.font);
  const glyphs: PlacedGlyph[] = [];
  let cursor = x;
  [...text].forEach((char, index) => {
    const g = glyphFor(char, font);
    if (g.contours.length > 0) {
      glyphs.push({
        key: keyOf(char, index),
        text: char,
        scale,
        glyphIndex: index,
        worldOffset: [cursor, baselineY],
        contours: g.contours.map((c) => transformContour(c, scale, scale, cursor, baselineY)),
      });
    }
    cursor += g.advance * scale + spacing;
  });
  return { glyphs, width: cursor - x };
}

/** Translate a run's glyphs by `(dx, dy)` (used for alignment). */
export function shiftGlyphs(glyphs: readonly PlacedGlyph[], dx: number, dy: number): PlacedGlyph[] {
  return glyphs.map((g) => ({
    ...g,
    worldOffset: [g.worldOffset[0] + dx, g.worldOffset[1] + dy] as [number, number],
    contours: g.contours.map((c) => transformContour(c, 1, 1, dx, dy)),
  }));
}

function glyphWritingOrder(glyphs: readonly PlacedGlyph[]): readonly number[] {
  return [...glyphs]
    .map((g, i) => ({ i, x: g.worldOffset[0] }))
    .sort((a, b) => a.x - b.x)
    .map((e) => e.i);
}

/** Build a single-glyph object (stroke + fill + morphable). */
function glyphObject(contours: readonly RawContour[], style?: ObjectStyle): IMObject2D {
  const fillable = contours.some((c) => c.closed);
  const fillRule = style?.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({
    rawContours: contours,
    fillable,
    fillRule,
    fillGroups: fillable ? [contours] : undefined,
    contourGlyphIndex: contours.map(() => 0),
  });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (fillable) traits.push(fillTraitFrom(provider, fillRule));
  traits.push(morphableTraitFrom(provider, GLYPH_SAMPLES));
  return {
    type: "glyph",
    dimension: "2d",
    traits,
    geometry: provider,
    ...(style ? { style } : {}),
  };
}

/**
 * Compose placed glyphs into one text object: aggregated geometry + keyed parts
 * + a {@link TextLayoutTrait}.
 */
export function composeGlyphs(
  glyphs: readonly PlacedGlyph[],
  type: string,
  style?: ObjectStyle,
  glyphProps?: GlyphStyleProps,
): IMObject2D {
  const resolved = style ?? (glyphProps ? resolveGlyphStyle(glyphProps) : undefined);
  const rawContours: RawContour[] = [];
  const fillGroups: RawContour[][] = [];
  const contourGlyphIndex: number[] = [];
  const parts: ObjectPart2D[] = [];
  const tokens: TextToken[] = [];

  glyphs.forEach((g, gi) => {
    fillGroups.push([...g.contours]);
    for (const c of g.contours) {
      rawContours.push(c);
      contourGlyphIndex.push(gi);
    }
    parts.push({ key: g.key, object: glyphObject(g.contours, resolved) });
    tokens.push({ key: g.key, text: g.text });
  });

  const fillable = rawContours.some((c) => c.closed);
  const fillRule = resolved?.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({
    rawContours,
    fillable,
    fillRule,
    fillGroups,
    contourGlyphIndex,
  });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (fillable) traits.push(fillTraitFrom(provider, fillRule));
  traits.push(morphableTraitFrom(provider, GLYPH_SAMPLES));
  const layoutTrait: TextLayoutTrait = {
    kind: "text-layout",
    tokens: () => tokens,
    contourGlyphIndex: () => contourGlyphIndex,
    glyphOrder: () => glyphWritingOrder(glyphs),
  };
  traits.push(layoutTrait);

  return {
    type,
    dimension: "2d",
    traits,
    geometry: provider,
    parts,
    ...(resolved ? { style: resolved } : {}),
  };
}

const CAP_HEIGHT = 0.7;

/** Options for {@link labelContours} / {@link glyphText}. */
export interface LabelOptions {
  readonly size?: number;
  readonly origin?: AbsXY;
  readonly align?: "left" | "center" | "right";
  readonly baseline?: "bottom" | "middle" | "top";
  readonly letterSpacing?: number;
  readonly font?: string;
}

/** Lay out a label string into contours using a registered outline font. */
export function labelContours(
  text: string,
  opts: LabelOptions = {},
): { contours: RawContour[]; width: number; height: number } {
  const size = opts.size ?? 0.36;
  const scale = size / CAP_HEIGHT;
  const placed = placeString(text, 0, 0, {
    scale,
    letterSpacing: (opts.letterSpacing ?? 0) * scale,
    ...(opts.font ? { font: opts.font } : {}),
  });
  const [ox, oy] = opts.origin ?? xy(0, 0);
  const alignOffset =
    opts.align === "center" ? -placed.width / 2 : opts.align === "right" ? -placed.width : 0;
  const baselineOffset =
    opts.baseline === "middle" ? -size / 2 : opts.baseline === "top" ? -size : 0;
  const shifted = shiftGlyphs(placed.glyphs, ox + alignOffset, oy + baselineOffset);
  return { contours: shifted.flatMap((g) => g.contours), width: placed.width, height: size };
}

/** Build a label object using an outline font. */
export function glyphText(
  text: string,
  style: ObjectStyle = { fill: "#e2e8f0", fillRule: "nonzero" },
  opts: LabelOptions = {},
): IMObject2D {
  const { contours } = labelContours(text, opts);
  const provider = createGeometryProvider2D({
    rawContours: contours,
    fillable: contours.some((c) => c.closed),
    fillGroups: [contours],
  });
  return {
    type: "glyph-text",
    dimension: "2d",
    traits: [strokeTraitFrom(provider), fillTraitFrom(provider, "nonzero")],
    geometry: provider,
    style,
  };
}

const DEFAULT_TEXT_COLOR = "#e2e8f0";
const DEFAULT_OUTLINE_WIDTH = 0.02;

/** Fill/outline options shared by {@link textObject} and LaTeX layout. */
export interface GlyphStyleProps {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly style?: ObjectStyle;
}

/** Resolve glyph fill/outline props into an {@link ObjectStyle}. */
export function resolveGlyphStyle(props: GlyphStyleProps): ObjectStyle {
  if (props.style) return props.style;
  const hasFill = props.fill !== undefined;
  const hasStroke = props.stroke !== undefined;
  if (!hasFill && !hasStroke) return { fill: DEFAULT_TEXT_COLOR, fillRule: "nonzero" };
  if (hasFill && hasStroke) {
    return {
      fillRule: "nonzero",
      fill: props.fill,
      stroke: props.stroke,
      lineWidth: props.strokeWidth ?? DEFAULT_OUTLINE_WIDTH,
    };
  }
  return {
    fillRule: "nonzero",
    ...(hasFill ? { fill: props.fill } : {}),
    ...(hasStroke ? { stroke: props.stroke, lineWidth: props.strokeWidth ?? DEFAULT_OUTLINE_WIDTH } : {}),
  };
}

/** Authoring props for {@link textObject}. */
export interface TextObjectProps extends GlyphStyleProps {
  readonly text: string;
  readonly font?: string;
  readonly size?: number;
  readonly origin?: AbsXY;
  readonly align?: "left" | "center" | "right";
  readonly letterSpacing?: number;
  readonly partKey?: (char: string, index: number) => string;
}

/** Lay out plain text into a writable/fillable glyph object (design.md §13). */
export function textObject(props: TextObjectProps): IMObject2D {
  const size = props.size ?? 1;
  const origin = props.origin ?? xy(0, 0);
  const placed = placeString(props.text, 0, 0, {
    scale: size,
    ...(props.font ? { font: props.font } : {}),
    ...(props.letterSpacing !== undefined ? { letterSpacing: props.letterSpacing * size } : {}),
    ...(props.partKey ? { keyOf: props.partKey } : {}),
  });
  const alignOffset =
    props.align === "center" ? -placed.width / 2 : props.align === "right" ? -placed.width : 0;
  const glyphs = shiftGlyphs(placed.glyphs, origin[0] + alignOffset, origin[1]);
  return composeGlyphs(glyphs, "text", resolveGlyphStyle(props), props);
}
