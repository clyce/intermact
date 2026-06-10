import { axes3D, createProgram, curve3D, meshObject, surface3D, xyz } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/camera-moves` (dev-roadmap.md M14, design.md §10.1).
 *
 * The registered {@link RegisteredCamera3D} is part of the seekable timeline:
 * `moveTo` / `lookAt` / `orbit` / `dollyTo` each append quaternion look-at
 * tweens. Interaction is disabled so the scripted camera path drives the view —
 * scrub the timeline to seek the camera deterministically.
 */
const ground = surface3D({
  fn: (u, v) => [(u - 0.5) * 6, -1, (v - 0.5) * 6],
  uSegments: 1,
  vSegments: 1,
  style: { color: "#1e293b", doubleSided: true },
});

// A unit cube (8 corners, 12 triangles) as the focus object.
const cube = meshObject({
  positions: [
    [-0.6, -0.6, -0.6],
    [0.6, -0.6, -0.6],
    [0.6, 0.6, -0.6],
    [-0.6, 0.6, -0.6],
    [-0.6, -0.6, 0.6],
    [0.6, -0.6, 0.6],
    [0.6, 0.6, 0.6],
    [-0.6, 0.6, 0.6],
  ],
  indices: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
    7, 0, 7, 3,
  ],
  style: { color: "#f472b6" },
});

const helix = curve3D({
  fn: (t) => {
    const a = t * Math.PI * 6;
    return [1.6 * Math.cos(a), t * 2 - 1, 1.6 * Math.sin(a)];
  },
  samples: 200,
  style: { color: "#34d399", lineWidth: 0.02 },
});

const axes = axes3D({ size: 2.5, style: { color: "#475569" } });

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#05070f" });
  const camera = ctx.createCamera3D(scene, {
    position: xyz(6, 4, 6),
    target: [0, 0, 0],
    fov: 45,
  });
  ctx.mount(scene, camera);
  scene.register(axes);
  scene.register(ground);
  scene.register(helix);
  scene.register(cube);

  scene.marker("start");
  await scene.play(camera.orbit(Math.PI, { duration: 3 }));
  scene.marker("close-up");
  await scene.play(camera.dollyTo(3, { duration: 1.5 }));
  await scene.play(camera.lookAt([1.5, 1, 0], { duration: 1.2 }));
  scene.marker("pull-back");
  await scene.play(camera.moveTo(xyz(-5, 5, 5), { duration: 2 }));
});

export function CameraMoves3DDemo() {
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
