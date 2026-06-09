import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * `examples/timeline/seek-basics` (dev-roadmap.md M1).
 *
 * A single eased tween whose progress bar can be scrubbed, sped up, slowed, and
 * reversed — directly validating the seekable, deterministic timeline.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-1, 7], y: [-2, 2] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dot = scene.register(circle({ radius: 0.18, style: { fill: "#38bdf8" } }), {
    position: xy(0, 0),
  });
  await scene.play(dot.moveTo(xy(6, 0), { duration: 2, easing: "cubicInOut" }));
  await scene.play(dot.scaleTo(2.2, { duration: 1, easing: "backInOut" }));
});

export function SeekBasicsDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} />
    </div>
  );
}
