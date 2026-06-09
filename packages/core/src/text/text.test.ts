import { describe, expect, it, beforeAll } from "vitest";
import { createProgram } from "../program/context";
import { buildProgram } from "../program/build";
import { createAssetManager } from "../resource/asset-manager";
import { findTrait } from "../object/traits";
import { loadTestFont } from "./test-font";
import { parseSvgPath } from "./svg-path";
import { glyphFor } from "./glyph-resolver";
import { textObject } from "./text-layout";
import { layoutMathJaxLatex } from "./mathjax-latex";
import { buildMatchingFrames } from "../animation/morph";
import { computeGlyphRevealSpans, glyphLocalFill, glyphLocalReveal } from "./write-spans";
import { triangulateGroups, triangulationArea } from "../geometry/triangulate";
import { toSampledContour } from "../geometry/sampling";
import { rawContourFromPoints } from "../geometry/sampling";
import { xy } from "../math/vec";

describe("SVG path parser (M10)", () => {
  it("parses a closed polygon path", () => {
    const contours = parseSvgPath("M0 0 L10 0 L10 10 Z");
    expect(contours).toHaveLength(1);
    expect(contours[0]!.closed).toBe(true);
  });
});

describe("outline fonts (OpenType)", () => {
  beforeAll(async () => {
    await loadTestFont();
  });

  it("produces closed contours suitable for fill traits", () => {
    const g = glyphFor("A");
    expect(g.contours.length).toBeGreaterThan(0);
    expect(g.contours.some((c) => c.closed)).toBe(true);
    const t = textObject({ text: "A", size: 1, fill: "#fff" });
    expect(findTrait(t.traits, "fill")).toBeTruthy();
  });

  it("orients glyphs y-up (cap above baseline)", () => {
    const g = glyphFor("A");
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of g.contours) {
      for (let i = 1; i < c.points.length; i += 2) {
        minY = Math.min(minY, c.points[i]!);
        maxY = Math.max(maxY, c.points[i]!);
      }
    }
    expect(maxY).toBeGreaterThan(0.2);
    expect(minY).toBeGreaterThanOrEqual(-0.05);
  });

  it("keeps caps above baseline at negative scene origins", () => {
    const t = textObject({
      text: "Multi-font writing",
      size: 0.65,
      align: "center",
      origin: xy(0, -2.2),
    });
    const b = t.geometry.getBounds();
    // Caps extend upward (y-up); descenders in "writing" may sit slightly below baseline.
    expect(b.max[1]).toBeGreaterThan(-2.2 + 0.15);
    expect(b.min[1]).toBeLessThan(-2.2);
  });

  it("produces separated glyph advances (not stacked)", () => {
    const a = glyphFor("A");
    expect(a.advance).toBeGreaterThan(0.1);
    expect(glyphFor("V").advance).toBeGreaterThan(0.1);
    const placed = textObject({ text: "AV", font: undefined, size: 1, fill: "#fff" });
    const b = placed.geometry.getBounds();
    expect(b.size[0]).toBeGreaterThan(a.advance * 0.8);
  });

  it("creates one part per rendered glyph with a text-layout trait", () => {
    const t = textObject({ text: "AB", size: 1 });
    expect(t.parts?.length).toBe(2);
    const layout = findTrait(t.traits, "text-layout");
    expect(layout?.tokens().length).toBe(2);
    expect(layout?.glyphOrder().length).toBe(2);
  });
});

describe("fill groups (glyph holes)", () => {
  it("keeps inner loops as holes within the same glyph group", () => {
    const outer = toSampledContour(
      rawContourFromPoints([xy(0, 0), xy(4, 0), xy(4, 4), xy(0, 4)], true).points,
      true,
    );
    const hole = toSampledContour(
      rawContourFromPoints([xy(1, 1), xy(1, 3), xy(3, 3), xy(3, 1)], true).points,
      true,
    );
    const ring = triangulateGroups([[outer, hole]]);
    const solid = triangulateGroups([[outer]]);
    expect(triangulationArea(ring)).toBeCloseTo(triangulationArea(solid) - 4, 0);
  });
});

describe("sequential write spans", () => {
  it("staggers glyph windows with overlap", () => {
    const spans = computeGlyphRevealSpans(3, 0.2);
    expect(spans[0]!.start).toBe(0);
    expect(spans[1]!.start).toBeLessThan(spans[1]!.end);
    expect(glyphLocalReveal(0.5, spans[0]!)).toBe(1);
    expect(spans[2]!.end - spans[2]!.start).toBeGreaterThan(0);
  });

  it("gives every glyph positive width including the last", () => {
    const spans = computeGlyphRevealSpans(10, 0.15);
    for (const span of spans) {
      expect(span.end - span.start).toBeGreaterThan(0);
      expect(glyphLocalFill(1, span)).toBeCloseTo(1, 5);
    }
  });

  it("uses full [0,1] windows for simultaneous direction", () => {
    const spans = computeGlyphRevealSpans(5, 0.3, "simultaneous");
    expect(spans.every((s) => s.start === 0 && s.end === 1)).toBe(true);
    expect(glyphLocalReveal(0.2, spans[0]!)).toBe(0.2);
  });

  it("reveals right-to-left by assigning earlier windows to higher glyph indices", () => {
    const order = [0, 1, 2];
    const temporal = computeGlyphRevealSpans(order.length, 0, "rtl");
    const glyphWriteSpans: { start: number; end: number }[] = [];
    order.forEach((gi, i) => {
      glyphWriteSpans[gi] = temporal[i]!;
    });
    expect(glyphWriteSpans[2]!.start).toBeLessThan(glyphWriteSpans[1]!.start);
    expect(glyphWriteSpans[1]!.start).toBeLessThan(glyphWriteSpans[0]!.start);
  });
});

describe("MathJax LaTeX engine", () => {
  it("lays out serif math glyphs from TeX", async () => {
    const { glyphs, width } = await layoutMathJaxLatex(String.raw`E=mc^2`, { size: 1 });
    expect(glyphs.length).toBeGreaterThan(2);
    expect(width).toBeGreaterThan(0.5);
  });

  it("includes fraction bar geometry from MathJax rect rules", async () => {
    const { glyphs } = await layoutMathJaxLatex(String.raw`\frac{1}{3}`, { size: 1 });
    const hasFracBar = glyphs.some((g) => g.key.startsWith("frac@"));
    expect(hasFracBar).toBe(true);
    const bar = glyphs.find((g) => g.key.startsWith("frac@"))!;
    expect(bar.contours.length).toBeGreaterThan(0);
    const xs = bar.contours[0]!.points.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.1);
  });

  it("keys tokens for transformMatching across formulas", async () => {
    const { latexObjectFromGlyphs } = await import("./latex");
    const a = await layoutMathJaxLatex(String.raw`a^2+b^2=c^2`, { size: 1 });
    const b = await layoutMathJaxLatex(String.raw`c^2`, { size: 1 });
    const srcLayout = latexObjectFromGlyphs(a.glyphs, a.width, { size: 1 });
    const tgtLayout = latexObjectFromGlyphs(b.glyphs, b.width, { size: 1 });
    const aligned = buildMatchingFrames(srcLayout, tgtLayout, undefined, 32);
    expect(aligned.from.length).toBe(aligned.to.length);
    expect(aligned.from.length).toBeGreaterThan(0);
  });
});

describe("AssetManager prepare stage (M10 / §14)", () => {
  beforeAll(async () => {
    await loadTestFont();
  });

  it("resolves mathjax latex via assets.latex", async () => {
    const assets = createAssetManager();
    const layout = await assets.latex(String.raw`\frac{1}{2}`, {
      engine: "mathjax",
      size: 1,
      fill: "#fff",
    });
    expect(layout.tokens.length).toBeGreaterThan(0);
    expect(layout.object.parts!.length).toBeGreaterThan(0);
  });

  it("multi-font writing demo finishes all three lines upright", async () => {
    const ids: string[] = [];
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-7, 7], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const lines = [
        textObject({
          text: "DejaVu Sans — clean sans-serif outlines",
          size: 0.5,
          align: "center",
          origin: xy(0, 1.2),
          fill: "#a78bfa",
        }),
        textObject({
          text: "DejaVu Serif — traditional serif outlines",
          size: 0.5,
          align: "center",
          origin: xy(0, -0.5),
          fill: "#fbbf24",
        }),
        textObject({
          text: "Multi-font writing",
          size: 0.65,
          align: "center",
          origin: xy(0, -2.2),
          fill: "#38bdf8",
          stroke: "#bae6fd",
          strokeWidth: 0.025,
        }),
      ];
      const writeOpts = {
        duration: 2.2,
        stroke: { direction: "ltr" as const, glyphOverlap: 0.12 },
      };
      for (const obj of lines) {
        const reg = scene.register(obj);
        ids.push(reg.id);
        await scene.play(reg.write(writeOpts));
      }
    });
    const { player } = await buildProgram(program);
    player.seek(6.6);
    const origins = [1.2, -0.5, -2.2];
    ids.forEach((id, i) => {
      const snap = player.getSnapshot().objects.get(id);
      expect(snap?.state.revealEnd).toBeCloseTo(1, 5);
      expect(snap?.state.fillProgress).toBeCloseTo(1, 5);
      const b = snap!.object.geometry.getBounds();
      expect(b.max[1]).toBeGreaterThan(origins[i]! + 0.08);
    });
  });

  it("multi-font writing demo keeps lines upright after first write", async () => {
    let sansId = "";
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-7, 7], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const sansLine = scene.register(
        textObject({
          text: "DejaVu Sans — clean sans-serif outlines",
          size: 0.5,
          align: "center",
          origin: xy(0, 1.2),
          fill: "#a78bfa",
        }),
      );
      sansId = sansLine.id;
      await scene.play(sansLine.write({ duration: 2.2, stroke: { direction: "ltr" } }));
    });
    const { player } = await buildProgram(program);
    player.seek(2.2);
    const snap = player.getSnapshot().objects.get(sansId);
    expect(snap?.state.revealEnd).toBe(1);
    expect(snap?.state.fillProgress).toBe(1);
    const obj = snap?.object;
    expect(obj).toBeTruthy();
    const b = obj!.geometry.getBounds();
    expect(b.max[1]).toBeGreaterThan(1.2 + 0.1);
    expect(b.min[1]).toBeLessThan(1.2 + 0.05);
  });

  it("bakes awaited assets into a seekable program", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const { object } = await ctx.assets.latex(String.raw`x^2`, { size: 1, engine: "mathjax" });
      const formula = scene.register(object);
      id = formula.id;
      await scene.play(formula.write({ duration: 1, stroke: { direction: "ltr" } }));
    });
    const { player } = await buildProgram(program);
    player.seek(1);
    const snap = player.getSnapshot().objects.get(id);
    expect(snap).toBeTruthy();
    expect(snap!.state.glyphWriteSpans?.length).toBeGreaterThan(0);
  });
});
