import { createProgram, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * MathJax serif LaTeX: write on the Pythagorean identity, then morph to `c^2`
 * by matching token part keys.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const fill = "#e2e8f0";
  const { object: source } = await ctx.assets.latex(String.raw`a^2+b^2=c^2`, {
    engine: "mathjax",
    size: 1.2,
    align: "center",
    origin: xy(0, 0),
    fill,
  });
  const { object: target } = await ctx.assets.latex(String.raw`c^2`, {
    engine: "mathjax",
    size: 1.6,
    align: "center",
    origin: xy(0, 0),
    fill,
  });

  const formula = scene.register(source);

  await scene.play(
    formula.write({
      duration: 2,
      stroke: { direction: "ltr", glyphOverlap: 0.1 },
    }),
  );
  await scene.wait(0.4);
  await scene.play(formula.transformMatchingTo(target, { duration: 2, easing: "sineInOut" }));
});

export function TransformMatchingTexDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
