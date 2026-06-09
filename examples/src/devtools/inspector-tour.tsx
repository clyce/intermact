import {
  createProgram,
  derived,
  draggablePointSource,
  line,
  rectangle,
  signal,
  xy,
  type AbsXY,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M12 / design.md §16: Inspector tour. Open the panel (top-right): it shows the
 * scene registry with live runtime state, the active timeline tracks while
 * playing, and the reactive graph (the draggable point's signal feeds a derived
 * line). Select a row to highlight its world bounds. Drag the green handle.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3.5, 3.5] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const ax = scene.getAxes({ x: [-4, 4], y: [-3, 3] });
  const p = signal<AbsXY>(xy(2, 1.5));

  scene.registerReactive(
    derived([p], () =>
      line({ from: xy(0, 0), to: p.get(), style: { stroke: "#34d399", lineWidth: 0.05 } }),
    ),
  );
  scene.registerReactive(draggablePointSource(p, { radius: 0.18 }));

  const box = scene.register(
    rectangle({
      width: 1,
      height: 1,
      cornerRadius: 0.1,
      style: { stroke: "#f59e0b", lineWidth: 0.05 },
    }),
    { position: xy(-3, 2) },
  );

  await scene.play(ax.create({ duration: 0.5 }));
  await scene.play(box.create({ duration: 0.4 }));
  await scene.play(box.moveTo(xy(3, -2), { duration: 1.2 }));
  await scene.play(box.rotateTo(Math.PI / 4, { duration: 0.6 }));
});

export function InspectorTourDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} controls={{ timeline: true, inspector: true }} />
    </div>
  );
}
