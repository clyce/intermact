import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, beforeAll } from "vitest";
import {
  buildProgram,
  clearFontRegistry,
  computeGlyphRevealSpans,
  createAssetManager,
  createProgram,
  findTrait,
  setDefaultFont,
  textObject,
  xy,
  type IMObject2D,
} from "@intermact/core";
import type { Mesh } from "three";
import { loadTestFont } from "../../core/src/text/test-font";
import { ThreeObjectView } from "./object-view";
import { buildStrokeGeometry } from "./stroke";

const require = createRequire(import.meta.url);

beforeAll(async () => {
  clearFontRegistry();
  const fontPath =
    require.resolve("@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff");
  const assets = createAssetManager({
    fetchBinary: async () => {
      const b = readFileSync(fontPath);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  });
  const face = await assets.font(fontPath);
  setDefaultFont(face.family);
});

describe("text write rendering (M3)", () => {
  it("keeps fill-only lines visible after write completes", async () => {
    let lineId = "";
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-6, 6], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const line = scene.register(
        textObject({
          text: "stay visible",
          size: 0.8,
          align: "center",
          origin: xy(0, 0),
          fill: "#a78bfa",
        }),
      );
      lineId = line.id;
      await scene.play(
        line.write({ duration: 1.2, stroke: { direction: "ltr", glyphOverlap: 0.1 } }),
      );
    });
    const { player } = await buildProgram(program);
    player.seek(1.2);
    const render = player.getSnapshot().objects.get(lineId)!;
    expect(render.state.fillProgress).toBeCloseTo(1, 5);
    expect(render.object.style?.fill).toBe("#a78bfa");
    const fill = findTrait(render.object.traits, "fill");
    expect(fill?.contours().length).toBeGreaterThan(0);

    const view = new ThreeObjectView(render.object as IMObject2D);
    view.update(render, { worldPerPixel: 0.01 });
    expect(view.group.children.length).toBeGreaterThan(0);
    view.dispose();
  });

  it("LTR stroke uses fewer vertices than simultaneous at the same global reveal", async () => {
    let seqId = "";
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-7, 7], y: [-3.5, 3.5] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const seq = scene.register(
        textObject({
          text: "ABC",
          size: 1,
          align: "center",
          origin: xy(0, 0),
          fill: "#a78bfa",
          stroke: "#e9d5ff",
          strokeWidth: 0.03,
        }),
      );
      seqId = seq.id;
      await scene.play(seq.write({ duration: 2, stroke: { direction: "ltr", glyphOverlap: 0 } }));
    });
    const { player } = await buildProgram(program);
    player.seek(0.6);
    const render = player.getSnapshot().objects.get(seqId)!;
    const spans = render.state.glyphWriteSpans;
    expect(spans?.length).toBe(3);
    const layout = findTrait(render.object.traits, "text-layout");
    const contourGlyphIndex = layout?.contourGlyphIndex() ?? [];
    expect(contourGlyphIndex.length).toBeGreaterThan(0);
    const path = findTrait(render.object.traits, "stroke")!.samplePath();
    const revealEnd = render.state.revealEnd;
    const simSpans = computeGlyphRevealSpans(3, 0, "simultaneous");
    const withLtr = buildStrokeGeometry(path, 0.03, 0, revealEnd, {
      contourGlyphIndex,
      glyphWriteSpans: spans!,
    });
    const withSim = buildStrokeGeometry(path, 0.03, 0, revealEnd, {
      contourGlyphIndex,
      glyphWriteSpans: simSpans,
    });
    const ltrVerts = withLtr.getAttribute("position").count;
    const simVerts = withSim.getAttribute("position").count;
    expect(ltrVerts).toBeLessThan(simVerts);
  });

  it("keeps completed multi-font line visible when the next line starts", async () => {
    const ids: string[] = [];
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-7, 7], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      for (const [text, y] of [
        ["DejaVu Sans — clean sans-serif outlines", 1.6],
        ["DejaVu Serif — traditional serif outlines", 0.2],
      ] as const) {
        const reg = scene.register(
          textObject({
            text,
            size: 0.5,
            align: "center",
            origin: xy(0, y),
            fill: "#a78bfa",
          }),
        );
        ids.push(reg.id);
        await scene.play(reg.write({ duration: 2.2, stroke: { direction: "ltr" } }));
      }
    });
    const { player } = await buildProgram(program);
    for (const t of [2.19, 2.2, 2.21, 2.5]) {
      player.seek(t);
      const line1 = player.getSnapshot().objects.get(ids[0]!)!;
      const view = new ThreeObjectView(line1.object as IMObject2D);
      view.update(line1, { worldPerPixel: 0.01 });
      const visibleMeshes = view.group.children.filter((c) => c.visible);
      expect(visibleMeshes.length, `t=${t}`).toBeGreaterThan(0);
      view.dispose();
    }
  });

  it("ThreeObjectView applies per-glyph LTR stroke during write", async () => {
    let seqId = "";
    const program = createProgram(async (ctx) => {
      await loadTestFont();
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-7, 7], y: [-3.5, 3.5] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const seq = scene.register(
        textObject({
          text: "ABCDE",
          size: 1,
          align: "center",
          origin: xy(0, 0),
          fill: "#a78bfa",
          stroke: "#e9d5ff",
          strokeWidth: 0.03,
        }),
      );
      seqId = seq.id;
      await scene.play(seq.write({ duration: 2, stroke: { direction: "ltr", glyphOverlap: 0 } }));
    });
    const { player } = await buildProgram(program);
    player.seek(0.2);
    const render = player.getSnapshot().objects.get(seqId)!;
    const spans = render.state.glyphWriteSpans!;
    const layout = findTrait(render.object.traits, "text-layout");
    const contourGlyphIndex = layout!.contourGlyphIndex();
    const path = findTrait(render.object.traits, "stroke")!.samplePath();
    const revealEnd = render.state.revealEnd;
    const expectedLtr = buildStrokeGeometry(path, 0.03, 0, revealEnd, {
      contourGlyphIndex,
      glyphWriteSpans: spans,
    });
    const expectedSim = buildStrokeGeometry(path, 0.03, 0, revealEnd);
    expect(expectedLtr.getAttribute("position").count).toBeLessThan(
      expectedSim.getAttribute("position").count,
    );
    const view = new ThreeObjectView(render.object as IMObject2D);
    view.update(render, { worldPerPixel: 0.01 });
    const strokeMesh = view.group.children.find((c) => c.renderOrder > 0);
    expect(strokeMesh).toBeTruthy();
    const viewVerts = (strokeMesh as Mesh).geometry.getAttribute("position").count;
    expect(viewVerts).toBe(expectedLtr.getAttribute("position").count);
    expect(viewVerts).toBeLessThan(expectedSim.getAttribute("position").count);
    view.dispose();
  });
});
