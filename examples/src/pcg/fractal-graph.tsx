import {
  createProgram,
  createRng,
  fractal,
  graphObject,
  transformObject,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/fractal-graph` (dev-roadmap.md M13, design.md §6.4).
 *
 * Left: a Sierpinski-triangle fractal via the `sierpinski` recursive subdivision
 * (not the chaos-game IFS). Right: a force-directed graph laid out from a seeded
 * RNG (reproducible). Both are positioned with the `transformObject` operator,
 * demonstrating operator composition over generated geometry.
 */
const sierpinski = transformObject(
  fractal({
    kind: "sierpinski",
    iterations: 5,
    size: 2.4,
    style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.35)", lineWidth: 0.006 },
  }),
  { position: xy(-2.6, 0) },
);

const nodes = ["a", "b", "c", "d", "e", "f", "g", "h"];
const edges = [
  ["a", "b"],
  ["a", "c"],
  ["b", "d"],
  ["c", "d"],
  ["d", "e"],
  ["e", "f"],
  ["e", "g"],
  ["f", "h"],
  ["g", "h"],
  ["b", "g"],
] as const;

const graph = transformObject(
  graphObject({
    nodes,
    edges: edges.map(([a, b]) => [a, b] as const),
    layout: "force",
    extent: 1.6,
    nodeRadius: 0.14,
    iterations: 200,
    rng: createRng("intermact-graph"),
    style: { stroke: "#60a5fa", fill: "#1e3a5f", lineWidth: 0.014 },
  }),
  { position: xy(2.6, 0) },
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4.8, 4.8], y: [-2.6, 2.6] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const fractalHandle = scene.register(sierpinski);
  const graphHandle = scene.register(graph);
  await scene.play(fractalHandle.create({ duration: 1.6 }), graphHandle.create({ duration: 1.6 }));
});

export function FractalGraphDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
