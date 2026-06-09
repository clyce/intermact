import { createProgram, textObject, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { loadDemoFonts } from "../lib/loadFonts";

/** Outline-font writing with left-to-right sequential reveal. */
const program = createProgram(async (ctx) => {
  const { sans, serif } = await loadDemoFonts(ctx);
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const title = scene.register(
    textObject({
      text: "INTERMACT",
      font: sans.family,
      size: 1.1,
      align: "center",
      origin: xy(0, 0.6),
      fill: "#38bdf8",
      stroke: "#bae6fd",
      strokeWidth: 0.03,
    }),
  );
  const subtitle = scene.register(
    textObject({
      text: "writing demo",
      font: serif.family,
      size: 0.6,
      align: "center",
      origin: xy(0, -1.0),
      fill: "#a78bfa",
      stroke: "#e9d5ff",
      strokeWidth: 0.02,
    }),
  );

  await scene.play(
    title.write({
      duration: 2.4,
      stroke: { direction: "ltr", glyphOverlap: 0.2 },
    }),
  );
  await scene.play(
    subtitle.write({
      duration: 1.6,
      stroke: { direction: "ltr", glyphOverlap: 0.15 },
    }),
  );
});

export function TextWritingDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
