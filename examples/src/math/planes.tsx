import {
  createAxesHandle,
  createProgram,
  numberPlane,
  parametricGraph,
  polarPlane,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M8 / design.md §7.4: coordinate planes. A cartesian {@link numberPlane}
 * (left) and a {@link polarPlane} (right). ComplexPlane shares the cartesian
 * grid with Re/Im semantics. A rose curve is drawn on the polar grid via
 * `parametricGraph` to show data �?world placement.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5.6, 5.6], y: [-3.3, 3.3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const cartesian = scene.register(numberPlane({ x: [-5.2, -0.4], y: [-3, 3], tickCount: 6 }));

  const polarCenter: [number, number] = [2.8, 0];
  const polar = scene.register(
    polarPlane({
      center: xy(polarCenter[0], polarCenter[1]),
      maxRadius: 2.6,
      radiusStep: 0.65,
      spokes: 12,
    }),
  );

  const identity = createAxesHandle(
    { x: [-5.6, 5.6], y: [-3.3, 3.3] },
    { x: [-5.6, 5.6], y: [-3.3, 3.3] },
  );
  const rose = scene.register(
    parametricGraph(
      identity,
      (t) => {
        const r = 2.4 * Math.cos(3 * t);
        return [polarCenter[0] + r * Math.cos(t), polarCenter[1] + r * Math.sin(t)];
      },
      { domain: [0, Math.PI * 2], samples: 400, style: { stroke: "#f472b6", lineWidth: 0.03 } },
    ),
  );

  await scene.play(cartesian.create({ duration: 1 }), polar.create({ duration: 1 }));
  await scene.play(rose.create({ duration: 1.4 }));
});

export function PlanesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
