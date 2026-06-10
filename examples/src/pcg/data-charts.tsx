import {
  circle,
  createProgram,
  lineChart,
  mapData,
  scatter,
  transformObject,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/data-charts` (dev-roadmap.md M13, design.md §6.5).
 *
 * Data-driven generators map one array into geometry. `scatter` and `lineChart`
 * share the same points + size + origin, so the markers sit exactly on the
 * trend line (both use the M7 `linearScale` internally). `mapData` builds a
 * bubble row where every datum becomes a **keyed** group part — the keys flow
 * into `group2D` so a later data update could pair bubbles via
 * `transformMatching`.
 */
const series = [
  xy(0, 1.1),
  xy(1, 1.9),
  xy(2, 1.4),
  xy(3, 2.6),
  xy(4, 2.1),
  xy(5, 3.2),
  xy(6, 2.7),
  xy(7, 3.7),
];

const dots = scatter({
  points: series,
  size: [5.4, 2],
  origin: xy(-2.7, 0.5),
  radius: 0.07,
  style: { fill: "#f97316", stroke: "#f97316", lineWidth: 0.008 },
});

const trend = lineChart({
  points: series,
  size: [5.4, 2],
  origin: xy(-2.7, 0.5),
  style: { stroke: "#22c55e", lineWidth: 0.02 },
});

interface Bubble {
  readonly label: string;
  readonly weight: number;
}
const bubbleData: readonly Bubble[] = [
  { label: "alpha", weight: 0.25 },
  { label: "beta", weight: 0.55 },
  { label: "gamma", weight: 0.4 },
  { label: "delta", weight: 0.85 },
  { label: "epsilon", weight: 0.6 },
  { label: "zeta", weight: 0.35 },
];

const bubbles = mapData(
  bubbleData,
  (d, i) =>
    transformObject(
      circle({
        radius: 0.12 + d.weight * 0.38,
        samples: 48,
        style: { fill: "rgba(96,165,250,0.4)", stroke: "#60a5fa", lineWidth: 0.012 },
      }),
      { position: xy(i * 0.95, 0) },
    ),
  { key: (d) => d.label },
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.2, 3.2], y: [-2.6, 2.6] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const trendHandle = scene.register(trend);
  const dotsHandle = scene.register(dots);
  const bubblesHandle = scene.register(bubbles, { position: xy(-2.4, -1.9) });
  await scene.play(trendHandle.create({ duration: 1.4 }));
  await scene.play(dotsHandle.create({ duration: 1 }), bubblesHandle.fadeIn({ duration: 1 }));
});

export function DataChartsDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
