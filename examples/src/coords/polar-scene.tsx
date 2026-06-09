import { circle, createProgram, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/** M5: polar coordinate scene �?points placed via fromPolar. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "polar",
    domain: { x: [-4, 4], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const axes = scene.getAxes({
    x: [-4, 4],
    y: [-4, 4],
    style: { stroke: "#475569", lineWidth: 0.025 },
  });
  await scene.play(axes.fadeIn({ duration: 0.5 }));

  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2;
    const p = scene.coordinate.fromPolar(2.5, theta);
    const c = scene.register(circle({ radius: 0.2, style: { fill: `hsl(${i * 45}, 75%, 60%)` } }), {
      position: p,
    });
    await scene.play(c.create({ duration: 0.35 }));
  }

  const hub = scene.register(circle({ radius: 0.15, style: { fill: "#f8fafc" } }), {
    position: xy(0, 0),
  });
  await scene.play(hub.fadeIn({ duration: 0.4 }));
});

export function PolarSceneDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
