import {
  bezierCurve,
  createProgram,
  derived,
  draggablePointSource,
  line,
  signal,
  xy,
  type AbsXY,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M11 / design.md §12.3: draggable control points wired to signals. Drag any
 * handle �?the Bézier curve and its control polygon recompute through the
 * reactive engine (no rebuild, no animation). Try it with the mouse.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3.2, 3.2] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const p0 = signal<AbsXY>(xy(-3.5, -2));
  const p1 = signal<AbsXY>(xy(-1, 2.6));
  const p2 = signal<AbsXY>(xy(1.5, -2.4));
  const p3 = signal<AbsXY>(xy(3.6, 1.8));

  scene.registerReactive(
    derived([p0, p1, p2, p3], () =>
      bezierCurve({
        points: [p0.get(), p1.get(), p2.get(), p3.get()],
        style: { stroke: "#38bdf8", lineWidth: 0.05 },
      }),
    ),
  );

  scene.registerReactive(
    derived([p0, p1, p2, p3], () =>
      line({
        from: p0.get(),
        to: p1.get(),
        style: { stroke: "#475569", lineWidth: 0.02 },
      }),
    ),
  );
  scene.registerReactive(
    derived([p2, p3], () =>
      line({ from: p2.get(), to: p3.get(), style: { stroke: "#475569", lineWidth: 0.02 } }),
    ),
  );

  for (const p of [p0, p1, p2, p3]) {
    scene.registerReactive(draggablePointSource(p, { radius: 0.16 }));
  }
});

export function DraggableBezierDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} controls={{ timeline: true }} />
    </div>
  );
}
