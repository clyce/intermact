import {
  createProgram,
  lattice,
  parametricCurve2D,
  recursiveTree,
  tiling,
  transformObject,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/generators-extra` (dev-roadmap.md M13, design.md §6.3–§6.4).
 *
 * Four more pure generators in one scene: a hexagonal `tiling`, a `lattice`
 * grid with node dots, a self-similar `recursiveTree`, and a closed
 * `parametricCurve2D` rose. Each is positioned with `transformObject` so the
 * generators themselves stay origin-centric and scene-free.
 */

// Top-left: hexagonal tiling outline.
const hexes = transformObject(
  tiling({
    pattern: "hex",
    rows: 4,
    cols: 4,
    size: 0.34,
    style: { stroke: "#38bdf8", lineWidth: 0.012 },
  }),
  { position: xy(-3.4, -0.4) },
);

// Top-right: rectangular lattice with dots at the nodes.
const grid = transformObject(
  lattice({
    rows: 4,
    cols: 5,
    spacing: 0.42,
    dots: true,
    dotRadius: 0.045,
    style: { stroke: "#475569", lineWidth: 0.008 },
  }),
  { position: xy(1.2, 0.6) },
);

// Bottom-left: a self-similar binary branching tree.
const tree = transformObject(
  recursiveTree({
    depth: 7,
    length: 1.1,
    lengthRatio: 0.72,
    branchAngle: 26,
    branches: 2,
    style: { stroke: "#a3e635", lineWidth: 0.014 },
  }),
  { position: xy(-2.6, -1.6) },
);

// Bottom-right: a closed parametric rose curve r = cos(3θ).
const rose = transformObject(
  parametricCurve2D({
    domain: [0, Math.PI * 2],
    fn: (t) => {
      const r = Math.cos(3 * t);
      return [r * Math.cos(t), r * Math.sin(t)];
    },
    samples: 400,
    closed: true,
    style: { stroke: "#f472b6", fill: "rgba(244,114,182,0.18)", lineWidth: 0.016 },
  }),
  { position: xy(2.6, -1.4), scale: 1.4 },
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4.8, 4.8], y: [-2.8, 2.8] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const handles = [hexes, grid, tree, rose].map((o) => scene.register(o));
  await scene.play(...handles.map((h) => h.create({ duration: 1.6 })));
});

export function GeneratorsExtraDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
