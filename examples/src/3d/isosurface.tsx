import { axes3D, createProgram, isosurface, scalarField3D, xyz } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/isosurface` (dev-roadmap.md M14, design.md §6).
 *
 * Marching-cubes (tetrahedral variant) extraction of the `f = 0` level set of an
 * implicit scalar field. The field is a smooth two-blob metaball, so the iso
 * level fuses into a single watertight surface. The mesh `Create` reveals
 * triangles in build order.
 */
function metaballs(x: number, y: number, z: number): number {
  const d0 = (x - 0.7) ** 2 + y * y + z * z;
  const d1 = (x + 0.7) ** 2 + y * y + z * z;
  // Sum of inverse-square potentials minus a threshold ⇒ implicit surface.
  return 1 / (d0 + 0.05) + 1 / (d1 + 0.05) - 2.2;
}

const field = scalarField3D({ x: [-2, 2], y: [-1.6, 1.6], z: [-1.6, 1.6] }, metaballs);

const surface = isosurface(field, {
  level: 0,
  resolution: 40,
  style: { color: "#22d3ee", doubleSided: true },
});

const axes = axes3D({ size: 1.8, style: { color: "#475569" } });

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#04060d" });
  const camera = ctx.createCamera3D(scene, {
    position: xyz(3.5, 2.6, 4),
    target: [0, 0, 0],
    fov: 45,
  });
  ctx.mount(scene, camera);
  scene.register(axes);
  const mesh = scene.register(surface);
  await scene.play(mesh.create({ duration: 2.5 }));
});

export function Isosurface3DDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
