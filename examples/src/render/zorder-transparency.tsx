import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * `examples/render/zorder-transparency` (dev-roadmap.md M3).
 *
 * Three translucent discs with distinct zIndex values composited via the
 * painter's algorithm (renderOrder, depthWrite off). One disc sweeps across the
 * others so the blending and ordering are visible.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  scene.register(
    circle({
      radius: 1.6,
      samples: 96,
      style: { fill: "rgba(56,189,248,0.55)", stroke: "#38bdf8", lineWidth: 0.04 },
    }),
    { position: xy(-1.4, 0), zIndex: 1 },
  );
  scene.register(
    circle({
      radius: 1.6,
      samples: 96,
      style: { fill: "rgba(244,63,94,0.55)", stroke: "#f43f5e", lineWidth: 0.04 },
    }),
    { position: xy(1.4, 0), zIndex: 2 },
  );
  const sweeper = scene.register(
    circle({
      radius: 1.2,
      samples: 96,
      style: { fill: "rgba(34,197,94,0.55)", stroke: "#22c55e", lineWidth: 0.04 },
    }),
    { position: xy(-4, 0), zIndex: 3 },
  );

  scene.marker("start");
  await scene.play(sweeper.moveTo(xy(4, 0), { duration: 3, easing: "sineInOut" }));
  await scene.play(sweeper.moveTo(xy(-4, 0), { duration: 3, easing: "sineInOut" }));
});

export function ZOrderTransparencyDemo() {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} autoplay />
    </div>
  );
}
