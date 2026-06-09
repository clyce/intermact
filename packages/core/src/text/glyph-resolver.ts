/**
 * Glyph resolver backed by registered OpenType outline fonts.
 */
import { IntermactError } from "../errors";
import { getRegisteredFont, requireDefaultFont } from "./font-registry";
import { type Glyph } from "./glyph";

/** Resolve `fontId` or the default registered font. */
export function resolveFontId(fontId?: string): string {
  return fontId ?? requireDefaultFont();
}

/** Resolve a glyph for `char` from a registered outline font. */
export function glyphFor(char: string, fontId?: string): Glyph {
  const id = resolveFontId(fontId);
  const face = getRegisteredFont(id);
  if (!face) {
    throw new IntermactError(
      "asset-load-error",
      `Font "${id}" is not registered. Load it via ctx.assets.font() first.`,
    );
  }
  return face.glyphFor(char);
}
