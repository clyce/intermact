import { createProgram, heatmap, isoline, scalarField2D } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/scalar-field-isolines` (dev-roadmap.md M13, design.md §6.2).
 *
 * A scalar field `f(x,y) = sin(x)·cos(y)` rendered as a color-mapped heatmap with
 * marching-squares iso-lines layered on top. The heatmap uses the per-cell fill
 * color channel; the iso-lines are stitched marching-squares output.
 */
const field = scalarField2D(
  { x: [-3.2, 3.2], y: [-3.2, 3.2] },
  (x, y) => Math.sin(x) * Math.cos(y),
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.4, 3.4], y: [-3.4, 3.4] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  scene.register(heatmap(field, { nx: 56, ny: 56 }));
  const lines = isoline(field, [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75], {
    nx: 96,
    ny: 96,
    style: { stroke: "#e2e8f0", lineWidth: 0.012, opacity: 0.85 },
  });
  const handle = scene.register(lines);
  await scene.play(handle.create({ duration: 2 }));
});

export function ScalarFieldIsolinesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
