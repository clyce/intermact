/**
 * Runtime font registry (design.md §13). Outline fonts loaded from TTF/OTF/WOFF
 * buffers are registered here; {@link glyphFor} and {@link placeString} look up
 * faces by id. Programs call {@link setDefaultFont} after {@link AssetManager.font}.
 */
import { IntermactError } from "../errors";
import { type Glyph } from "./glyph";

/** A registered OpenType outline font face. */
export interface RegisteredFont {
  readonly id: string;
  readonly family: string;
  glyphFor(char: string): Glyph;
}

const registry = new Map<string, RegisteredFont>();
let defaultFontId: string | undefined;

/** Register (or replace) a font face. */
export function registerFont(font: RegisteredFont): void {
  registry.set(font.id, font);
}

/** Look up a registered font by id. */
export function getRegisteredFont(id: string): RegisteredFont | undefined {
  return registry.get(id);
}

/** Resolve the active default font id, if one was set during the build pass. */
export function getDefaultFontId(): string | undefined {
  return defaultFontId;
}

/** Set the fallback font id for sync text APIs (`labelContours`, etc.). */
export function setDefaultFont(id: string): void {
  if (!registry.has(id)) {
    throw new IntermactError(
      "asset-load-error",
      `Cannot set default font: "${id}" is not registered.`,
    );
  }
  defaultFontId = id;
}

/** Resolve the active default font id (throws if unset). */
export function requireDefaultFont(): string {
  if (!defaultFontId) {
    throw new IntermactError(
      "invalid-argument",
      "No default font registered. Await ctx.assets.font(url) then call setDefaultFont(face.family) during the build pass.",
    );
  }
  return defaultFontId;
}

/** Remove all registered fonts (test isolation). */
export function clearFontRegistry(): void {
  registry.clear();
  defaultFontId = undefined;
}
