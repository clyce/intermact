import { barChart, createProgram, lineChart, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/data-driven-bars` (dev-roadmap.md M13, design.md §6.5).
 *
 * A bar chart and an overlaid trend line generated from the same data array.
 * `barChart` keeps one keyed part per datum (via `group2D`), so data updates can
 * be matched with `transformMatching` in later milestones.
 */
const values = [3, 5, 2, 8, 6, 9, 4, 7];

const bars = barChart({
  data: values.map((value, i) => ({ value, label: `d${i}` })),
  size: [6, 3.2],
  origin: xy(-3, -1.6),
  gap: 0.25,
  style: { fill: "#60a5fa", stroke: "#3b82f6", lineWidth: 0.01 },
});

const trend = lineChart({
  points: values.map((v, i) => xy(i + 0.5, v)),
  size: [6, 3.2],
  xDomain: [0, values.length],
  yDomain: [0, Math.max(...values)],
  origin: xy(-3, -1.6),
  style: { stroke: "#f97316", lineWidth: 0.03 },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.4, 3.4], y: [-2, 2] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const barHandle = scene.register(bars);
  const trendHandle = scene.register(trend);
  await scene.play(barHandle.create({ duration: 1.5 }));
  await scene.play(trendHandle.create({ duration: 1 }));
});

export function DataDrivenBarsDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
