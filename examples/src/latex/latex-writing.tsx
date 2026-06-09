import { createProgram, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/** MathJax serif LaTeX with left-to-right sequential writing. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-7, 7], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const einstein = await ctx.assets.latex(String.raw`E = mc^2`, {
    engine: "mathjax",
    size: 1.1,
    align: "center",
    origin: xy(0, 1.2),
    fill: "#38bdf8",
  });
  const integral = await ctx.assets.latex(String.raw`\int_0^1 x^2\,dx = \frac{1}{3}`, {
    engine: "mathjax",
    size: 0.85,
    align: "center",
    origin: xy(0, -1.1),
    fill: "#fbbf24",
  });

  const formula = scene.register(einstein.object);
  const integralObj = scene.register(integral.object);

  const writeOpts = { stroke: { direction: "ltr" as const, glyphOverlap: 0.1 } };
  await scene.play(formula.write({ duration: 2.4, ...writeOpts }));
  await scene.play(integralObj.write({ duration: 3, ...writeOpts }));
});

export function LatexWritingDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
