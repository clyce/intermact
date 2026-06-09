import { circle, createProgram, parallel, sequence, stagger, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/** M4: sequence / parallel / stagger orchestration. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-1, 9], y: [-1, 5] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dots = Array.from({ length: 5 }, (_, i) =>
    scene.register(circle({ radius: 0.25, style: { fill: "#e2e8f0" } }), {
      position: xy(i * 1.5, 0),
    }),
  );

  await scene.play(
    stagger(
      dots.map((d, i) => d.moveTo(xy(i * 1.5, 2), { duration: 0.8, easing: "sineOut" })),
      0.25,
    ),
  );
  await scene.play(
    parallel(
      ...dots.map((d, i) => d.moveTo(xy(i * 1.5, 3.5), { duration: 1, easing: "quadInOut" })),
    ),
  );
  await scene.play(
    sequence(dots[0]!.fadeOut({ duration: 0.4 }), dots[4]!.fadeOut({ duration: 0.4 })),
  );
});

export function SequenceParallelStaggerDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
