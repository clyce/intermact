/**
 * MathJax 3 → SVG → {@link parseSvgPath} LaTeX layout (design.md §13 production path).
 *
 * Headless `mathjax-full` with the lite adaptor produces filled serif math glyphs
 * (STIX / Computer Modern in SVG output). Contours feed the same
 * {@link composeGlyphs} / `write()` pipeline as the built-in subset engine.
 */
import { type RawContour } from "../geometry/sampling";
import { type LatexObjectProps, type LatexToken } from "./latex";
import {
  type PlacedGlyph,
  transformContour,
} from "./text-layout";
import { parseSvgPath } from "./svg-path";

interface ExtractedPath {
  readonly d: string;
  readonly tx: number;
  readonly ty: number;
  readonly flipY: boolean;
  readonly key: string;
  readonly text: string;
}

interface MathJaxLiteNode {
  // Opaque lite-adaptor element; only passed back to innerHTML.
}

interface MathJaxContext {
  convert(tex: string, display: boolean): MathJaxLiteNode;
  innerHTML(node: MathJaxLiteNode): string;
}

let mjInit: Promise<MathJaxContext> | null = null;

/** Lazily boot MathJax (heavy; only loaded when `engine: "mathjax"` is used). */
async function getMathJax(): Promise<MathJaxContext> {
  if (!mjInit) {
    mjInit = (async () => {
      const { mathjax } = await import("mathjax-full/js/mathjax.js");
      const { TeX } = await import("mathjax-full/js/input/tex.js");
      const { SVG } = await import("mathjax-full/js/output/svg.js");
      const { liteAdaptor } = await import("mathjax-full/js/adaptors/liteAdaptor.js");
      const { RegisterHTMLHandler } = await import("mathjax-full/js/handlers/html.js");
      const { AllPackages } = await import("mathjax-full/js/input/tex/AllPackages.js");

      const adaptor = liteAdaptor();
      RegisterHTMLHandler(adaptor);
      const tex = new TeX({ packages: AllPackages });
      const svg = new SVG({ fontCache: "none" });
      const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });

      return {
        convert(texSrc: string, display: boolean) {
          return doc.convert(texSrc, { display });
        },
        innerHTML(node: MathJaxLiteNode) {
          return adaptor.innerHTML(node as Parameters<typeof adaptor.innerHTML>[0]);
        },
      };
    })();
  }
  return mjInit;
}

/** Walk MathJax SVG markup and collect path `d` strings with cumulative transforms. */
function extractMathJaxPaths(svgHtml: string): ExtractedPath[] {
  const results: ExtractedPath[] = [];
  const stack: Array<{ tx: number; ty: number; flipY: boolean }> = [
    { tx: 0, ty: 0, flipY: false },
  ];
  const tagRe = /<\/?g\b[^>]*>|<path\b[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  let pathIndex = 0;

  while ((m = tagRe.exec(svgHtml)) !== null) {
    const tag = m[0]!;
    if (tag.startsWith("</g")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (tag.startsWith("<g")) {
      let tx = 0;
      let ty = 0;
      let flipY = false;
      const tr = /transform="([^"]+)"/.exec(tag);
      if (tr) {
        const body = tr[1]!;
        if (/scale\s*\(\s*1\s*,\s*-1\s*\)/.test(body)) flipY = true;
        const transl = /translate\s*\(\s*([\d.]+)\s*(?:,\s*([\d.-]+))?\s*\)/.exec(body);
        if (transl) {
          tx = parseFloat(transl[1]!);
          ty = parseFloat(transl[2] ?? "0");
        }
      }
      const top = stack[stack.length - 1]!;
      stack.push({
        tx: top.tx + tx,
        ty: top.ty + ty,
        flipY: top.flipY !== flipY ? !top.flipY : top.flipY,
      });
      continue;
    }
    if (tag.startsWith("<path")) {
      const d = /d="([^"]+)"/.exec(tag)?.[1];
      if (!d) continue;
      const dataC = /data-c="([^"]+)"/.exec(tag)?.[1];
      const text = dataC ? String.fromCodePoint(parseInt(dataC, 16)) : `·`;
      const key = dataC ? text : `mj@${pathIndex}`;
      const top = stack[stack.length - 1]!;
      results.push({
        d,
        tx: top.tx,
        ty: top.ty,
        flipY: top.flipY,
        key,
        text,
      });
      pathIndex++;
    }
  }
  return results;
}

function contourBounds(contours: readonly RawContour[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of contours) {
    for (let i = 0; i < c.points.length; i += 2) {
      minX = Math.min(minX, c.points[i]!);
      maxX = Math.max(maxX, c.points[i]!);
      minY = Math.min(minY, c.points[i + 1]!);
      maxY = Math.max(maxY, c.points[i + 1]!);
    }
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Lay out a TeX string via MathJax SVG into {@link PlacedGlyph}s ready for
 * {@link composeGlyphs}. Math output uses serif glyph outlines by default.
 */
export async function layoutMathJaxLatex(
  tex: string,
  props: Omit<LatexObjectProps, "tex"> = {},
): Promise<{ glyphs: PlacedGlyph[]; width: number }> {
  const mj = await getMathJax();
  const node = mj.convert(tex, false);
  const html = mj.innerHTML(node);
  const paths = extractMathJaxPaths(html);
  const size = props.size ?? 1;
  const partKey = props.partKey ?? ((t: LatexToken) => t.value);

  const entries: Array<{ key: string; text: string; contours: RawContour[] }> = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i]!;
    let contours = parseSvgPath(p.d, { flipY: p.flipY });
    contours = contours.map((c) => transformContour(c, 1, 1, p.tx, p.ty));
    const tokenKey = partKey({ value: p.key, role: "base" });
    const uniqueKey = paths.filter((x) => x.key === p.key).length > 1 ? `${tokenKey}@${i}` : tokenKey;
    entries.push({ key: uniqueKey, text: p.text, contours });
  }

  const flat = entries.flatMap((e) => e.contours);
  const b = contourBounds(flat);
  const height = Math.max(b.maxY - b.minY, 1e-6);
  const scale = size / height;

  const glyphs: PlacedGlyph[] = entries.map((e, gi) => {
    const contours = e.contours.map((c) =>
      transformContour(c, scale, scale, -b.minX * scale, -b.minY * scale),
    );
    let minX = Infinity;
    for (const c of contours) {
      for (let i = 0; i < c.points.length; i += 2) minX = Math.min(minX, c.points[i]!);
    }
    return {
      key: e.key,
      text: e.text,
      contours,
      scale: 1,
      glyphIndex: gi,
      worldOffset: [Number.isFinite(minX) ? minX : 0, 0] as [number, number],
    };
  });

  return { glyphs, width: (b.maxX - b.minX) * scale };
}
