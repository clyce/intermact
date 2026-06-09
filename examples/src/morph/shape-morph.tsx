import { circle, createProgram, polygon, rectangle, xy, type AbsXY } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M9 / design.md §11.4: arc-length & anchor morph between shapes with different
 * point counts. Each object morphs once from its registered shape — scrub the
 * timeline to see it both ways.
 */
function star(points: number, outer: number, inner: number, center: AbsXY): AbsXY[] {
  const pts: AbsXY[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(xy(center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)));
  }
  return pts;
}

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-2.6, 2.6] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const stroke = { stroke: "#38bdf8", lineWidth: 0.04 };
  const fill = { stroke: "#a78bfa", fill: "rgba(167,139,250,0.25)", lineWidth: 0.04 };

  const c = scene.register(circle({ radius: 1.1, center: xy(-4, 0), style: stroke }));
  const tri = scene.register(
    polygon({
      points: [xy(-1.1, -1), xy(1.1, -1), xy(0, 1.1)],
      style: fill,
    }),
  );
  const sq = scene.register(rectangle({ width: 2, height: 2, center: xy(4, 0), style: stroke }));

  await scene.play(
    c.morphTo(polygon({ points: star(5, 1.2, 0.5, xy(-4, 0)), style: stroke }), {
      strategy: "arc-length",
      duration: 1.6,
    }),
    tri.morphTo(circle({ radius: 1.1 }), { strategy: "anchor", duration: 1.6 }),
    sq.morphTo(polygon({ points: star(6, 1.2, 0.55, xy(4, 0)), style: stroke }), {
      strategy: "anchor",
      duration: 1.6,
    }),
  );
});

export function ShapeMorphDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
