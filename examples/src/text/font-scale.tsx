import { createProgram, textObject, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";
import { exampleAssetFetch, exampleAssetFetchBinary } from "../lib/assetFetch";
import { loadDemoFonts } from "../lib/loadFonts";

/** Vector outline glyphs at multiple scales (DejaVu Sans). */
const program = createProgram(async (ctx) => {
  const { sans } = await loadDemoFonts(ctx);
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const sizes = [0.45, 0.7, 1.0, 1.4, 2.0] as const;
  sizes.forEach((size, i) => {
    scene.register(
      textObject({
        text: "SOLID",
        font: sans.family,
        size,
        align: "center",
        origin: xy(0, 2.4 - i * 1.1),
        fill: "#38bdf8",
      }),
    );
  });

  scene.register(
    textObject({
      text: "HOLLOW",
      font: sans.family,
      size: 0.9,
      align: "center",
      origin: xy(0, -1.3),
      stroke: "#a78bfa",
      strokeWidth: 0.02,
    }),
  );

  scene.register(
    textObject({
      text: "OUTLINED",
      font: sans.family,
      size: 0.75,
      align: "center",
      origin: xy(0, -2.3),
      fill: "#f472b6",
      stroke: "#fde68a",
      strokeWidth: 0.018,
    }),
  );
});

export function FontScaleDemo() {
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
