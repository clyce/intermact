import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** M4: Create / Fade / Move / Rotate / Scale gallery. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const a = scene.register(
    circle({
      radius: 0.6,
      style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.25)", lineWidth: 0.04 },
    }),
    { position: xy(-2.5, 0) },
  );
  const b = scene.register(
    circle({
      radius: 0.5,
      style: { stroke: "#f97316", fill: "rgba(249,115,22,0.2)", lineWidth: 0.035 },
    }),
    { position: xy(0, 0) },
  );
  const c = scene.register(
    circle({
      radius: 0.45,
      style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.22)", lineWidth: 0.03 },
    }),
    { position: xy(2.5, 0) },
  );

  await scene.play(a.create({ duration: 1.2 }), b.fadeIn({ duration: 0.8 }));
  await scene.play(b.moveTo(xy(0, 1.5), { duration: 1, easing: "cubicInOut" }));
  await scene.play(c.create({ duration: 1 }), c.rotateTo(Math.PI / 4, { duration: 0.8 }));
  await scene.play(c.scaleTo(1.6, { duration: 0.7, easing: "backOut" }));
});

export function CreateFadeMoveDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
