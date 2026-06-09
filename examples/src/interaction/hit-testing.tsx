import {
  circle,
  createProgram,
  derived,
  interactive,
  line,
  pickBandFromObject,
  signal,
  xy,
  type AbsXY,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * M11 / design.md §12.1: hit-testing thin strokes via pick proxies. Each spoke
 * and the ring carry a band pick proxy, so clicks register precisely on the
 * 1px-thin geometry (not just its bounding box). Click a shape to select it.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const selected = signal(-1);
  const spokes: AbsXY[] = [xy(3, 0), xy(0, 2.4), xy(-3, 0), xy(0, -2.4)];

  spokes.forEach((tip, i) => {
    scene.registerReactive(
      derived([selected], () => {
        const obj = line({
          from: xy(0, 0),
          to: tip,
          style: { stroke: selected.get() === i ? "#f472b6" : "#38bdf8", lineWidth: 0.04 },
        });
        return interactive(obj, {
          pick: pickBandFromObject(obj, 0.18),
          binding: { onPointerDown: () => selected.set(i) },
          cursor: "pointer",
        });
      }),
    );
  });

  scene.registerReactive(
    derived([selected], () => {
      const ring = circle({
        radius: 1.2,
        style: { stroke: selected.get() === 4 ? "#f472b6" : "#a78bfa", lineWidth: 0.04 },
      });
      return interactive(ring, {
        pick: pickBandFromObject(ring, 0.18),
        binding: { onPointerDown: () => selected.set(4) },
        cursor: "pointer",
      });
    }),
  );
});

export function HitTestingDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} />
    </div>
  );
}
