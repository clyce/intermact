import {
  bezierCurve,
  circle,
  createProgram,
  morph,
  rectangle,
  sequence,
  wait,
  xy,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** L1 / design.md §19.1: Create, axes, arc-length morph, seekable timeline. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const disk = scene.register(
    circle({
      radius: 1,
      style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.22)", lineWidth: 0.035 },
    }),
    { position: xy(-1.2, 0) },
  );
  const curve = scene.register(
    bezierCurve({
      points: [xy(-2, -1.5), xy(-1, 1.5), xy(1, -1.5), xy(2, 1.2)],
      style: { stroke: "#f97316", lineWidth: 0.03 },
    }),
  );

  const axes = scene.getAxes({
    x: scene.props.domain.x,
    y: scene.props.domain.y,
    style: { stroke: "#94a3b8", lineWidth: 0.025 },
    xLabel: "x",
    yLabel: "y",
  });
  await scene.play(axes.fadeIn({ duration: 0.6 }));
  await scene.play(disk.create({ duration: 1.2 }), curve.create({ duration: 1.2 }));
  await scene.play(wait(0.25));

  await scene.play(
    sequence(
      morph(
        disk,
        rectangle({
          width: 2.4,
          height: 1.4,
          cornerRadius: 0.1,
          style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.24)", lineWidth: 0.035 },
        }),
        { duration: 1.1, strategy: "arc-length" },
      ),
      disk.moveTo(xy(1.2, 0), { duration: 0.7 }),
    ),
  );
  scene.marker("after-morph");
});

export function Basic2DDemo() {
  return (
    <div style={{ height: 520 }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
