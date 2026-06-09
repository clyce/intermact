import { createProgram, functionGraph, parametricGraph } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * M8 / design.md §7.4: Axes + FunctionGraph, verifying `c2p` keeps the curve
 * glued to the (now tick-and-label bearing) axes. A parametric Lissajous curve
 * shares the same axes handle.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-3.2, 3.2] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const ax = scene.getAxes({ x: [-6, 6], y: [-3, 3], tickCount: 6 });
  const sine = scene.register(
    functionGraph(ax.handle, (x) => 2 * Math.sin(x), {
      domain: [-6, 6],
      samples: 200,
      style: { stroke: "#22c55e", lineWidth: 0.035 },
    }),
  );
  const lissajous = scene.register(
    parametricGraph(ax.handle, (t) => [3 * Math.sin(2 * t), 2 * Math.sin(3 * t)], {
      domain: [0, Math.PI * 2],
      samples: 256,
      style: { stroke: "#f472b6", lineWidth: 0.03 },
    }),
  );

  await scene.play(ax.create({ duration: 0.8 }));
  await scene.play(sine.create({ duration: 1.2 }));
  await scene.play(lissajous.create({ duration: 1.4 }));
});

export function AxesFunctionGraphDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
