import {
  type AbsXY,
  circle,
  createProgram,
  polygon,
  rectangle,
  toAnimation,
  xy,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** Build a star polygon (alternating outer/inner radius). */
function star(points: number, outer: number, inner: number): AbsXY[] {
  const out: AbsXY[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    out.push(xy(r * Math.cos(a), r * Math.sin(a)));
  }
  return out;
}

const FILLED_CIRCLE = {
  radius: 1.2,
  samples: 96,
  style: { stroke: "#38bdf8", lineWidth: 0.06, fill: "rgba(56,189,248,0.2)" },
} as const;

const FILLED_RECT = {
  width: 2.4,
  height: 1.7,
  cornerRadius: 0.35,
  style: {
    stroke: "#a78bfa",
    lineWidth: { value: 3, unit: "px" as const },
    fill: "rgba(167,139,250,0.2)",
  },
} as const;

const FILLED_STAR = {
  points: star(5, 1.2, 0.5),
  style: {
    stroke: "#f59e0b",
    lineWidth: 0.05,
    fill: "rgba(245,158,11,0.22)",
    fillRule: "evenodd" as const,
  },
} as const;

const ROW_Y = { static: 2.3, strokeDraw: 0, createDraw: -2.3 } as const;
const COL_X = [-4, 0, 4] as const;
const DRAW_DURATION = 2.5;

/**
 * `examples/render/stroke-fill-showcase` (dev-roadmap.md M3).
 *
 * Three rows:
 * 1. Static filled shapes (stroke + fill, no animation).
 * 2. Stroke-only draw via trim (`revealEnd` 0→1).
 * 3. Full `Create`: stroke draw, then fill fade-in (`after-stroke-fade`).
 *
 * Scrub the timeline to compare stroke-only vs Create on the lower rows.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-3.8, 3.8] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // Row 1 — static filled reference.
  scene.register(circle(FILLED_CIRCLE), { position: xy(COL_X[0], ROW_Y.static) });
  scene.register(rectangle(FILLED_RECT), { position: xy(COL_X[1], ROW_Y.static) });
  scene.register(polygon(FILLED_STAR), { position: xy(COL_X[2], ROW_Y.static) });

  // Row 2 — stroke-only draw (no fill).
  const strokeOnly = [
    scene.register(
      circle({ radius: 1.2, samples: 96, style: { stroke: "#38bdf8", lineWidth: 0.06 } }),
      { position: xy(COL_X[0], ROW_Y.strokeDraw) },
    ),
    scene.register(
      rectangle({
        width: 2.4,
        height: 1.7,
        cornerRadius: 0.35,
        style: { stroke: "#a78bfa", lineWidth: 0.06 },
      }),
      { position: xy(COL_X[1], ROW_Y.strokeDraw) },
    ),
    scene.register(
      polygon({ points: star(5, 1.2, 0.5), style: { stroke: "#f59e0b", lineWidth: 0.05 } }),
      { position: xy(COL_X[2], ROW_Y.strokeDraw) },
    ),
  ];

  // Row 3 — Create (stroke draw + fill reveal).
  const createDraw = [
    scene.register(circle(FILLED_CIRCLE), { position: xy(COL_X[0], ROW_Y.createDraw) }),
    scene.register(rectangle(FILLED_RECT), { position: xy(COL_X[1], ROW_Y.createDraw) }),
    scene.register(polygon(FILLED_STAR), { position: xy(COL_X[2], ROW_Y.createDraw) }),
  ];

  await scene.play(
    ...strokeOnly.map((o) =>
      toAnimation({
        kind: "tween",
        targetId: o.id,
        property: { type: "reveal" },
        from: 0,
        to: 1,
        duration: DRAW_DURATION,
        easing: "cubicInOut",
      }),
    ),
    ...createDraw.map((o) =>
      o.create({
        duration: DRAW_DURATION,
        easing: "cubicInOut",
        fill: { mode: "after-stroke-fade", overlap: 0.2 },
      }),
    ),
  );
});

export function StrokeFillShowcaseDemo() {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} autoplay />
    </div>
  );
}
