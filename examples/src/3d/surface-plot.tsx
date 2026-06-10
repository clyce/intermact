import { createProgram, surface3D, xyz } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/surface-plot` (dev-roadmap.md M14, design.md §5.3, §10).
 *
 * A parametric surface `z = sin(x)·cos(y)` swept over a `(u,v)` grid into a mesh
 * {@link surface3D}, with {@link Scene3D.getAxes} tick marks and serif numerals.
 * Drag to orbit, wheel to dolly.
 */
const surface = surface3D({
  fn: (u, v) => {
    const x = (u - 0.5) * 5;
    const z = (v - 0.5) * 5;
    const y = Math.sin(x) * Math.cos(z);
    return [x, y, z];
  },
  uSegments: 56,
  vSegments: 56,
  style: { color: "#38bdf8", doubleSided: true },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({
    background: "#05070f",
    domain: { x: [-3, 3], y: [-2, 2], z: [-3, 3] },
  });
  const camera = ctx.createCamera3D(scene, {
    position: xyz(5, 4, 6),
    target: [0, 0, 0],
    fov: 45,
  });
  ctx.mount(scene, camera);

  const axes = scene.getAxes({
    x: [-3, 3],
    y: [-2, 2],
    z: [-3, 3],
    showTicks: true,
    showTickLabels: true,
    tickCount: 5,
    style: { stroke: "#94a3b8" },
  });
  const mesh = scene.register(surface);
  await scene.play(axes.create({ duration: 1.5, mode: "sequential" }));
  await scene.play(mesh.create({ duration: 2.5 }));
});

export function SurfacePlot3DDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
