import { circle, createProgram, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/** M5: getAxes + fadeIn/fadeOut via RegisteredObject animation API. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const axes = scene.getAxes({
    x: [-4, 4],
    y: [-3, 3],
    showTickLabels: false,
    style: { stroke: "#64748b", lineWidth: 0.025 },
    xLabel: "x",
    yLabel: "y",
  });
  const dot = scene.register(
    circle({ radius: 0.4, style: { fill: "#38bdf8", stroke: "#7dd3fc", lineWidth: 0.03 } }),
    { position: xy(1.5, 1) },
  );

  await scene.play(axes.create({ duration: 2, mode: "sequential" }));
  await scene.play(dot.create({ duration: 1 }));
  await scene.wait(0.5);
  await scene.play(axes.fadeOut({ duration: 0.6 }));
  await scene.wait(0.5);
  await scene.play(axes.fadeIn({ duration: 0.6 }));
});

export function CartesianAxesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
