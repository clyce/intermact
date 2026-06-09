/**
 * OpenType / TrueType outline font loader (design.md §13 long-term path).
 *
 * Parses font binaries with `opentype.js`, converts each glyph outline to
 * filled {@link RawContour}s via {@link parseSvgPath}, and registers the face
 * for use with {@link placeString} / {@link textObject} (`font` prop).
 */
import { parse as parseFontBuffer } from "opentype.js";
import { registerFont, type RegisteredFont } from "./font-registry";
import { parseSvgPath } from "./svg-path";
import { type Glyph } from "./glyph";

/** Cap height in em units (matches the built-in stroke font). */
const CAP_HEIGHT_EM = 0.7;

/**
 * Parse a font binary and register it under `id` (typically the asset URL).
 * Returns the registered face handle.
 */
export function loadOutlineFontFromBuffer(buffer: ArrayBuffer, id: string): RegisteredFont {
  const font = parseFontBuffer(buffer);
  const family = font.names.fontFamily?.en ?? id;
  const ascender = font.ascender;
  const unitsPerEm = font.unitsPerEm;
  const emScale = CAP_HEIGHT_EM / ascender;
  const glyphCache = new Map<string, Glyph>();

  const glyphFor = (char: string): Glyph => {
    const cached = glyphCache.get(char);
    if (cached) return cached;

    if (char === " ") {
      const adv = font.getAdvanceWidth(" ", unitsPerEm) * emScale;
      const spaceGlyph: Glyph = { contours: [], advance: adv };
      glyphCache.set(char, spaceGlyph);
      return spaceGlyph;
    }

    const otGlyph = font.charToGlyph(char);
    const advance = otGlyph.advanceWidth * emScale;
    const path = otGlyph.getPath(0, 0, unitsPerEm);
    const d = path.toPathData(3);
    if (!d) {
      const empty: Glyph = { contours: [], advance };
      glyphCache.set(char, empty);
      return empty;
    }
    // opentype.js `toPathData()` is SVG y-down and often omits `Z`; Intermact geometry is y-up.
    // Glyph outlines are always treated as closed rings for fill + triangulation.
    const contours = parseSvgPath(d, { scale: emScale, flipY: true }).map((c) => ({
      points: c.points,
      closed: true,
    }));
    const glyph: Glyph = { contours, advance };
    glyphCache.set(char, glyph);
    return glyph;
  };

  const registered: RegisteredFont = { id, family, glyphFor };
  registerFont(registered);
  return registered;
}
