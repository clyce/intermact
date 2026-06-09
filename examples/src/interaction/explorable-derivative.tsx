import {
  createProgram,
  derived,
  draggableValueSource,
  functionGraph,
  glyphText,
  signal,
  slopeAt,
  tangentLine,
  xy,
  type AbsXY,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * M11 / design.md Â§12.3: an explorable. Drag the handle along the curve to move
 * `x`; the tangent line and the slope readout recompute live (drag â†?signal â†? * derived geometry). Combines M8 constructs with M11 interaction.
 */
const fn = (x: number) => 0.35 * x * x * x - 1.2 * x;

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.4, 3.4], y: [-3.4, 3.4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const ax = scene.getAxes({ x: [-3, 3], y: [-3, 3] });
  const handle = ax.handle;
  const x = signal(1);

  scene.register(functionGraph(handle, fn, { style: { stroke: "#34d399", lineWidth: 0.04 } }));

  scene.registerReactive(
    derived([x], () =>
      tangentLine(handle, fn, x.get(), {
        length: 3,
        style: { stroke: "#f59e0b", lineWidth: 0.04 },
      }),
    ),
  );

  scene.registerReactive(
    derived([x], () =>
      glyphText(
        `slope=${slopeAt(fn, x.get()).toFixed(2)}`,
        { stroke: "#e2e8f0", lineWidth: 0.03 },
        { size: 0.32, origin: xy(-3.2, 3.0) },
      ),
    ),
  );

  const toWorld = (v: number): AbsXY => handle.c2p([v, fn(v)]);
  const fromWorld = (p: AbsXY): number => handle.p2c(p)[0];
  scene.registerReactive(
    draggableValueSource(x, "x", { range: [-3, 3], toWorld, fromWorld, size: 0.22 }),
  );

  await scene.play(ax.create({ duration: 0.4 }));
});

export function ExplorableDerivativeDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} />
    </div>
  );
}
