/**
 * Font registry (design.md §13, §22.8). Outline fonts loaded from TTF/OTF/WOFF
 * buffers are registered here; {@link glyphFor} and {@link placeString} look up
 * faces by id. Programs call {@link setDefaultFont} after {@link AssetManager.font}.
 *
 * **Scoping (design.md §0.3 / §22.8).** To avoid process-level mutable state
 * leaking between independent builds, each `buildProgram` runs against its own
 * {@link FontRegistry} (a child of the process-wide {@link getGlobalFontRegistry}
 * so globally pre-loaded fonts stay visible, while fonts loaded *during* the
 * build do not leak back out). The sync construct API (`glyphFor`, `textObject`)
 * reads the *active* registry via {@link getActiveFontRegistry}; `buildProgram`
 * swaps it in for the duration of the (synchronous) build. Concurrent interleaved
 * builds that both `await` mid-program share this single active pointer — pass an
 * explicit registry / load fonts globally if you need that edge case isolated.
 */
import { IntermactError } from "../errors";
import { type Glyph } from "./glyph";

/** A registered OpenType outline font face. */
export interface RegisteredFont {
  readonly id: string;
  readonly family: string;
  glyphFor(char: string): Glyph;
}

/**
 * A scoped collection of outline font faces plus a default id. A registry may
 * have a `parent` it falls back to for lookups (used so a per-build scope still
 * sees globally pre-loaded fonts), while writes stay local to the scope.
 */
export class FontRegistry {
  private readonly fonts = new Map<string, RegisteredFont>();
  private defaultId: string | undefined;

  constructor(private readonly parent?: FontRegistry) {}

  /** Register (or replace) a font face in this scope. */
  register(font: RegisteredFont): void {
    this.fonts.set(font.id, font);
  }

  /** Look up a font by id in this scope, then the parent chain. */
  get(id: string): RegisteredFont | undefined {
    return this.fonts.get(id) ?? this.parent?.get(id);
  }

  /** The active default font id (this scope's, else the parent's). */
  getDefaultId(): string | undefined {
    return this.defaultId ?? this.parent?.getDefaultId();
  }

  /** Set the fallback font id for sync text APIs (must be resolvable). */
  setDefault(id: string): void {
    if (!this.get(id)) {
      throw new IntermactError(
        "asset-load-error",
        `Cannot set default font: "${id}" is not registered.`,
      );
    }
    this.defaultId = id;
  }

  /** Resolve the active default font id (throws if none is set). */
  requireDefault(): string {
    const id = this.getDefaultId();
    if (!id) {
      throw new IntermactError(
        "invalid-argument",
        "No default font registered. Await ctx.assets.font(url) then call setDefaultFont(face.family) during the build pass.",
      );
    }
    return id;
  }

  /** Remove this scope's fonts + default (does not touch the parent). */
  clear(): void {
    this.fonts.clear();
    this.defaultId = undefined;
  }
}

/** The process-wide font registry (used outside an explicit build scope). */
const globalFontRegistry = new FontRegistry();
let activeFontRegistry: FontRegistry = globalFontRegistry;

/** The process-wide font registry; a build scope falls back to this. */
export function getGlobalFontRegistry(): FontRegistry {
  return globalFontRegistry;
}

/** The font registry the sync construct API currently reads/writes. */
export function getActiveFontRegistry(): FontRegistry {
  return activeFontRegistry;
}

/** Swap the active font registry, returning the previous one (restore in `finally`). */
export function setActiveFontRegistry(registry: FontRegistry): FontRegistry {
  const previous = activeFontRegistry;
  activeFontRegistry = registry;
  return previous;
}

/** Register (or replace) a font face in the active registry. */
export function registerFont(font: RegisteredFont): void {
  activeFontRegistry.register(font);
}

/** Look up a registered font by id in the active registry. */
export function getRegisteredFont(id: string): RegisteredFont | undefined {
  return activeFontRegistry.get(id);
}

/** Resolve the active default font id, if one was set during the build pass. */
export function getDefaultFontId(): string | undefined {
  return activeFontRegistry.getDefaultId();
}

/** Set the fallback font id for sync text APIs (`labelContours`, etc.). */
export function setDefaultFont(id: string): void {
  activeFontRegistry.setDefault(id);
}

/** Optional serif/math face for axis tick numerals (set during demo font preload). */
let mathTickFontId: string | undefined;

/** Register the font id used for axis tick labels (typically a serif outline face). */
export function setMathTickFont(id: string): void {
  mathTickFontId = id;
}

/** Resolve the font id for axis tick numerals (undefined when no font is registered). */
export function resolveMathTickFontId(): string | undefined {
  if (mathTickFontId && activeFontRegistry.get(mathTickFontId)) return mathTickFontId;
  return activeFontRegistry.getDefaultId();
}

/** Resolve the active default font id (throws if unset). */
export function requireDefaultFont(): string {
  return activeFontRegistry.requireDefault();
}

/** Remove all fonts from the active registry (test isolation). */
export function clearFontRegistry(): void {
  activeFontRegistry.clear();
}
