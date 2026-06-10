import { axes3D, createProgram, curve3D, pointCloud3D, surface3D, xyz } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/training-trajectory` (dev-roadmap.md M14, design.md §19.3).
 *
 * A loss landscape (a paraboloid with two basins) drawn as a translucent
 * {@link surface3D}, with a gradient-descent path traced as a {@link curve3D}
 * and its sampled steps as a {@link pointCloud3D}. The path `Create` reveals in
 * descent order — the canonical "optimizer on a loss surface" picture.
 */
function loss(x: number, z: number): number {
  // Two-basin landscape so the trajectory has a visible saddle/curve.
  return 0.6 * (x * x + z * z) - 1.1 * Math.exp(-((x - 1) ** 2 + (z - 1) ** 2)) * 2;
}

const surface = surface3D({
  fn: (u, v) => {
    const x = (u - 0.5) * 4;
    const z = (v - 0.5) * 4;
    return [x, loss(x, z), z];
  },
  uSegments: 48,
  vSegments: 48,
  style: { color: "#6366f1", doubleSided: true },
});

// Deterministic gradient descent from a fixed start (no RNG needed).
function descentPath(): readonly [number, number, number][] {
  let x = -1.7;
  let z = 1.6;
  const lr = 0.08;
  const eps = 1e-3;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 80; i++) {
    pts.push([x, loss(x, z) + 0.05, z]);
    const gx = (loss(x + eps, z) - loss(x - eps, z)) / (2 * eps);
    const gz = (loss(x, z + eps) - loss(x, z - eps)) / (2 * eps);
    x -= lr * gx;
    z -= lr * gz;
  }
  return pts;
}

const path = descentPath();
const trajectory = curve3D({
  fn: (t) => {
    const i = Math.min(path.length - 1, Math.floor(t * (path.length - 1)));
    return path[i]!;
  },
  tRange: [0, 1],
  samples: path.length,
  style: { color: "#f59e0b", lineWidth: 0.03 },
});

const steps = pointCloud3D({
  points: path.filter((_, i) => i % 6 === 0),
  style: { color: "#fbbf24", pointSize: 0.09 },
});

const axes = axes3D({ size: 2.4, style: { color: "#475569" } });

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#060810" });
  const camera = ctx.createCamera3D(scene, {
    position: xyz(4.5, 3.5, 5),
    target: [0, -0.3, 0],
    fov: 45,
  });
  ctx.mount(scene, camera);
  scene.register(axes);
  scene.register(surface);
  const line = scene.register(trajectory);
  const dots = scene.register(steps);
  await scene.play(line.create({ duration: 3 }));
  await scene.play(dots.create({ duration: 1 }));
});

export function TrainingTrajectory3DDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
