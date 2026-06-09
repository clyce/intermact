import { createProgram, textObject, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";
import { exampleAssetFetch, exampleAssetFetchBinary } from "../lib/assetFetch";
import { loadDemoFonts } from "../lib/loadFonts";

/**
 * Side-by-side comparison: simultaneous vs left-to-right with glyph time-overlap.
 * Scrub the timeline to compare stroke reveal ordering.
 */
const program = createProgram(async (ctx) => {
  const { sans } = await loadDemoFonts(ctx);
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-7, 7], y: [-3.5, 3.5] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const simultaneous = scene.register(
    textObject({
      text: "ALL AT ONCE",
      font: sans.family,
      size: 0.75,
      align: "center",
      origin: xy(0, 1.4),
      fill: "#38bdf8",
      stroke: "#bae6fd",
      strokeWidth: 0.025,
    }),
  );
  const sequential = scene.register(
    textObject({
      text: "LEFT → RIGHT",
      font: sans.family,
      size: 0.75,
      align: "center",
      origin: xy(0, -0.8),
      fill: "#a78bfa",
      stroke: "#e9d5ff",
      strokeWidth: 0.025,
    }),
  );

  const duration = 2.8;
  // Play both writes in parallel so the comparison is visible at the same time.
  await scene.play(
    simultaneous.write({
      duration,
      stroke: { direction: "simultaneous", glyphOverlap: 0 },
    }),
    sequential.write({
      duration,
      stroke: { direction: "ltr", glyphOverlap: 0.25 },
    }),
  );
});

export function WritingStrategiesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas
        program={program}
        autoplay
        controls={{ timeline: true }}
        fetcher={exampleAssetFetch}
        fetchBinary={exampleAssetFetchBinary}
      />
    </div>
  );
}
