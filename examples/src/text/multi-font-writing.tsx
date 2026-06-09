import { createProgram, textObject, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { loadDemoFonts } from "../lib/loadFonts";

/** DejaVu Sans vs Serif outline fonts with sequential left-to-right writing. */
const program = createProgram(async (ctx) => {
  const { sans, serif } = await loadDemoFonts(ctx);
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-7, 7], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const sansLine = scene.register(
    textObject({
      text: "DejaVu Sans — clean sans-serif outlines",
      font: sans.family,
      size: 0.5,
      align: "center",
      origin: xy(0, 1.6),
      fill: "#a78bfa",
      stroke: "#c4b5fd",
      strokeWidth: 0.02,
    }),
  );
  const serifLine = scene.register(
    textObject({
      text: "DejaVu Serif — traditional serif outlines",
      font: serif.family,
      size: 0.5,
      align: "center",
      origin: xy(0, 0.2),
      fill: "#fbbf24",
      stroke: "#fde68a",
      strokeWidth: 0.02,
    }),
  );
  const mixedLine = scene.register(
    textObject({
      text: "Multi-font writing",
      font: sans.family,
      size: 0.65,
      align: "center",
      origin: xy(0, -1.4),
      fill: "#38bdf8",
      stroke: "#bae6fd",
      strokeWidth: 0.025,
    }),
  );

  const writeOpts = { duration: 2.2, stroke: { direction: "ltr" as const, glyphOverlap: 0.12 } };
  await scene.play(sansLine.write(writeOpts));
  await scene.play(serifLine.write(writeOpts));
  await scene.play(mixedLine.write(writeOpts));
});

export function MultiFontWritingDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
