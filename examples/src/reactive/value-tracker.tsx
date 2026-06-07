import {
  circle,
  createProgram,
  derived,
  polyline,
  polygon,
  tweenSignal,
  valueTracker,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** M6 / design.md §8.2: tweenSignal drives a derived rectangle under a hyperbola. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [0, 10], y: [0, 10] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const t = valueTracker(2);
  const k = 25;

  const ax = scene.getAxes({ x: [0, 10], y: [0, 10] });
  const graph = scene.register(
    (() => {
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const x = k / 10 + (i / 64) * (10 - k / 10);
        pts.push(ax.handle.c2p([x, k / x]));
      }
      return polyline({ points: pts, style: { stroke: "#34d399", lineWidth: 0.03 } });
    })(),
  );

  scene.registerReactive(
    derived([t], () => {
      const x = t.get();
      const y = k / x;
      const p0 = ax.handle.c2p([x, 0]);
      const p1 = ax.handle.c2p([x, y]);
      const p2 = ax.handle.c2p([0, y]);
      return polygon({
        points: [p0, p1, p2],
        closed: true,
        style: { fill: "rgba(59,130,246,0.45)", stroke: "#60a5fa", lineWidth: 0.025 },
      });
    }),
  );

  const dot = scene.register(circle({ radius: 0.12, style: { fill: "#fbbf24" } }));
  dot.addUpdater(() => {
    dot.setTransform({ position: ax.handle.c2p([t.get(), k / t.get()]) });
  });

  await scene.play(ax.create({ duration: 0.5 }), graph.create({ duration: 1 }));
  await scene.play(tweenSignal(t, 8, { duration: 3, easing: "sineInOut" }));
});

export function ValueTrackerDemo() {
  return (
    <div style={{ height: 480 }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
