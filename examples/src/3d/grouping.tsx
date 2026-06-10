import { axes3D, createProgram, meshObject, polyline3D, xyz, type Vec3 } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/grouping` (dev-roadmap.md M14, design.md §9.3, §10).
 *
 * `Scene3D.group3D` parents several registered objects under one transform-only
 * empty node, so the whole assembly orbits together — the Player composes world
 * transforms down the hierarchy at snapshot time. A closed `polyline3D` ring
 * frames the three cubes; rotating only the group handle spins all four.
 */

/** A unit cube (8 corners, 12 triangles) at `size` with a flat color. */
function cube(size: number, color: string) {
  const s = size / 2;
  const positions: Vec3[] = [
    [-s, -s, -s],
    [s, -s, -s],
    [s, s, -s],
    [-s, s, -s],
    [-s, -s, s],
    [s, -s, s],
    [s, s, s],
    [-s, s, s],
  ];
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
    7, 0, 7, 3,
  ];
  return meshObject({ positions, indices, style: { color } });
}

const ringPoints: Vec3[] = [
  [-1.7, 0, -1.7],
  [1.7, 0, -1.7],
  [1.7, 0, 1.7],
  [-1.7, 0, 1.7],
];

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#05070f" });
  const camera = ctx.createCamera3D(scene, { position: xyz(5, 4, 6), target: [0, 0, 0], fov: 45 });
  ctx.mount(scene, camera);
  scene.register(axes3D({ size: 2.5, style: { color: "#475569" } }));

  const pink = scene.register(cube(0.9, "#f472b6"), { position: xyz(1.3, 0, 0) });
  const blue = scene.register(cube(0.9, "#38bdf8"), { position: xyz(-1.3, 0, 0) });
  const green = scene.register(cube(0.9, "#34d399"), { position: xyz(0, 0, 1.3) });
  const ring = scene.register(
    polyline3D({ points: ringPoints, closed: true, style: { color: "#fbbf24", lineWidth: 0.02 } }),
  );

  const group = scene.group3D([pink, blue, green, ring]);

  await scene.play(
    pink.create({ duration: 1 }),
    blue.create({ duration: 1 }),
    green.create({ duration: 1 }),
    ring.create({ duration: 1 }),
  );
  scene.marker("spin-group");
  await scene.play(group.orientTo({ x: 0.4, y: Math.PI * 1.2, z: 0 }, { duration: 4 }));
});

export function Grouping3DDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas
        program={program}
        autoplay
        interactive={false}
        controls={{ timeline: true }}
        skipFonts
      />
    </div>
  );
}
