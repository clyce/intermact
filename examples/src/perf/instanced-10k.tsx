import { circle, createProgram, instanceField, xy, type ObjectTransform2D } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/perf/instanced-10k` (dev-roadmap.md M16, design.md §15.2 #3).
 *
 * A 100×100 grid of 10,000 dots produced by {@link instanceField}. The renderer
 * draws them with a single three.js `InstancedMesh` (one geometry, 10k instance
 * matrices) instead of 10k separate meshes — the real GPU-instancing path that
 * replaces the M13 baked-group fallback. A whole-field `fadeIn` shows the group
 * transform/opacity still animates as one object.
 */
const SIDE = 100;
const SPACING = 1;
const HALF = ((SIDE - 1) * SPACING) / 2;

const transforms: ObjectTransform2D[] = [];
for (let i = 0; i < SIDE; i++) {
  for (let j = 0; j < SIDE; j++) {
    const x = i * SPACING - HALF;
    const y = j * SPACING - HALF;
    // Radial scale ripple so the instancing is visually obvious.
    const r = Math.hypot(x, y) / HALF;
    transforms.push({ position: xy(x, y), scale: 0.35 + 0.4 * (1 - r) });
  }
}

const dot = circle({ radius: 0.4, samples: 16, style: { fill: "#38bdf8" } });
const field = instanceField(dot, transforms);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-HALF - 2, HALF + 2], y: [-HALF - 2, HALF + 2] },
    fit: "contain",
    background: "#05070f",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const handle = scene.register(field);
  await scene.play(handle.fadeIn({ duration: 1.5 }));
});

export function Instanced10kDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
