import { createProgram, streamlines, vectorFieldObject, vectorField2D, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/vector-field-streamlines` (dev-roadmap.md M13, design.md §6.2).
 *
 * A rotational + source vector field shown as a grid of arrows, with RK4-integrated
 * streamlines seeded on a ring. Both derive from the same {@link vectorField2D}.
 */
const field = vectorField2D({ x: [-3, 3], y: [-3, 3] }, (x, y) => {
  // Swirl around the origin plus a gentle outward push.
  const r2 = x * x + y * y + 0.4;
  return [(-y + 0.3 * x) / r2, (x + 0.3 * y) / r2];
});

const seeds = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return xy(2.6 * Math.cos(a), 2.6 * Math.sin(a));
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.2, 3.2], y: [-3.2, 3.2] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  scene.register(
    vectorFieldObject(field, {
      nx: 18,
      ny: 18,
      scale: 0.18,
      style: { stroke: "#475569", fill: "#475569" },
    }),
  );
  const lines = streamlines(field, seeds, {
    steps: 240,
    stepSize: 0.03,
    style: { stroke: "#38bdf8", lineWidth: 0.016 },
  });
  const handle = scene.register(lines);
  await scene.play(handle.create({ duration: 2.5 }));
});

export function VectorFieldStreamlinesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
