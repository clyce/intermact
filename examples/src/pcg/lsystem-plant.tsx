import { createProgram, createRng, lSystem } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { domainFor } from "../lib/geometryPreviewProgram";

/**
 * `examples/pcg/lsystem-plant` (dev-roadmap.md M13, design.md §6.4, §19.4).
 *
 * A classic bracketed L-system plant. Randomness (small per-branch angle jitter)
 * flows through a seeded {@link createRng}, so the plant is reproducible. The
 * `Create` reveal draws branches in growth order.
 */
const plant = lSystem({
  axiom: "X",
  rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" },
  iterations: 5,
  angle: 25,
  step: 0.06,
  startAngle: 90,
  jitterAngle: 6,
  rng: createRng("intermact-plant"),
  style: { stroke: "#4ade80", lineWidth: 0.015 },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: domainFor(plant.geometry.getBounds(), 0.1),
    fit: "contain",
    background: "#06140c",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const handle = scene.register(plant);
  await scene.play(handle.create({ duration: 3 }));
});

export function LSystemPlantDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
