/**
 * Asset manager & prepare stage (design.md §14). Fonts/LaTeX/SVG/data are
 * resolved during the build pass so that play-time `seek(t)` is fully
 * deterministic (no pending async).
 */
import { IntermactError } from "../errors";
import { type RawContour } from "../geometry/sampling";
import { type IMObject2D } from "../object/types";
import { type TextToken } from "../object/traits";
import { findTrait } from "../object/traits";
import { getRegisteredFont } from "../text/font-registry";
import { loadOutlineFontFromBuffer } from "../text/opentype-font";
import { latexObjectFromGlyphs, type LatexObjectProps } from "../text/latex";
import { layoutMathJaxLatex } from "../text/mathjax-latex";
import { parseSvgPath } from "../text/svg-path";

/** A resolved outline font handle. */
export interface FontAsset {
  readonly family: string;
}

/** A resolved LaTeX layout: the glyph object + its token map. */
export interface GlyphLayout {
  readonly object: IMObject2D;
  readonly tokens: readonly TextToken[];
}

/** A parsed SVG: flattened contours from all `<path d>` elements. */
export interface ParsedSvg {
  readonly contours: readonly RawContour[];
}

/** Declarative preload spec (design.md §14). */
export type AssetSpec =
  | { readonly kind: "font"; readonly src: string }
  | { readonly kind: "latex"; readonly tex: string }
  | { readonly kind: "svg"; readonly src: string }
  | { readonly kind: "data"; readonly src: string };

/** Optional host hook to resolve URL/path sources to text (e.g. fs/fetch). */
export type AssetFetcher = (src: string) => Promise<string>;

/** Optional host hook to resolve URL/path sources to binary (fonts). */
export type BinaryAssetFetcher = (src: string) => Promise<ArrayBuffer>;

/** Options for {@link createAssetManager}. */
export interface AssetManagerOptions {
  readonly fetcher?: AssetFetcher;
  readonly fetchBinary?: BinaryAssetFetcher;
}

/** Build-time asset resolver (design.md §14). */
export interface AssetManager {
  font(src: string): Promise<FontAsset>;
  latex(tex: string, opts?: Omit<LatexObjectProps, "tex">): Promise<GlyphLayout>;
  svg(src: string): Promise<ParsedSvg>;
  data<T>(src: string): Promise<T>;
  preload(specs: readonly AssetSpec[]): Promise<void>;
}

function isInline(src: string): boolean {
  return src.includes("<") || src.trim().startsWith("{") || src.trim().startsWith("[");
}

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;

function isFontUrl(src: string): boolean {
  return FONT_EXT.test(src);
}

function parseSvgString(svg: string): ParsedSvg {
  const contours: RawContour[] = [];
  const re = /\bd\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    contours.push(...parseSvgPath(m[1]!));
  }
  return { contours };
}

function glyphLayoutFromObject(object: IMObject2D): GlyphLayout {
  const trait = findTrait(object.traits, "text-layout");
  return { object, tokens: trait ? trait.tokens() : [] };
}

/** Create the default {@link AssetManager}. Pass fetchers to resolve URLs. */
export function createAssetManager(options: AssetManagerOptions = {}): AssetManager {
  const { fetcher, fetchBinary } = options;

  const resolveText = async (src: string): Promise<string> => {
    if (isInline(src)) return src;
    if (fetcher) return fetcher(src);
    throw new IntermactError(
      "asset-load-error",
      `No fetcher configured to resolve external asset "${src}". Pass inline content or a fetcher.`,
    );
  };

  const resolveBinary = async (src: string): Promise<ArrayBuffer> => {
    if (fetchBinary) return fetchBinary(src);
    throw new IntermactError(
      "asset-load-error",
      `No fetchBinary configured to resolve font "${src}".`,
    );
  };

  const manager: AssetManager = {
    async font(src: string): Promise<FontAsset> {
      const existing = getRegisteredFont(src);
      if (existing) return { family: existing.id };
      if (!isFontUrl(src) && !src.startsWith("data:")) {
        throw new IntermactError(
          "asset-load-error",
          `Font source "${src}" is not a recognized font URL (.ttf/.otf/.woff).`,
        );
      }
      const buffer = await resolveBinary(src);
      const face = loadOutlineFontFromBuffer(buffer, src);
      return { family: face.id };
    },

    async latex(tex: string, opts?: Omit<LatexObjectProps, "tex">): Promise<GlyphLayout> {
      const laid = await layoutMathJaxLatex(tex, opts ?? {});
      const object = latexObjectFromGlyphs(laid.glyphs, laid.width, opts ?? {});
      return glyphLayoutFromObject(object);
    },

    async svg(src: string): Promise<ParsedSvg> {
      return parseSvgString(await resolveText(src));
    },

    async data<T>(src: string): Promise<T> {
      return JSON.parse(await resolveText(src)) as T;
    },

    async preload(specs: readonly AssetSpec[]): Promise<void> {
      await Promise.all(
        specs.map((s) => {
          switch (s.kind) {
            case "font":
              return manager.font(s.src);
            case "latex":
              return manager.latex(s.tex);
            case "svg":
              return manager.svg(s.src);
            case "data":
              return manager.data(s.src);
            default:
              return Promise.resolve();
          }
        }),
      );
    },
  };
  return manager;
}
