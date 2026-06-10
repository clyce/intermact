import { createProgram, pointCloud3D, xyz, type Vec3 } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/perf/large-pointcloud` (dev-roadmap.md M16, design.md §15.2 #5).
 *
 * A 60,000-point spiral galaxy streamed through the `Float32Array` buffer channel
 * (positions are packed once, never per-point tuples). `Create` reveals the cloud
 * by trimming the draw range — no per-frame geometry churn. Points are placed
 * deterministically (hash-based jitter, no `Math.random`) so the cloud is
 * identical on every build.
 */
const COUNT = 60_000;
const ARMS = 4;

/** Deterministic pseudo-random in [0,1) from an index (reproducible). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

const points: Vec3[] = [];
for (let i = 0; i < COUNT; i++) {
  const t = i / COUNT;
  const arm = i % ARMS;
  const radius = t * 8 + 0.3;
  const angle = radius * 0.9 + (arm / ARMS) * Math.PI * 2;
  const jitterR = (hash(i) - 0.5) * (0.5 + t * 1.4);
  const jitterA = (hash(i + 1.7) - 0.5) * 0.25;
  const r = radius + jitterR;
  const x = Math.cos(angle + jitterA) * r;
  const z = Math.sin(angle + jitterA) * r;
  const y = (hash(i + 3.3) - 0.5) * 0.9 * (1 - t);
  points.push([x, y, z]);
}

const cloud = pointCloud3D({
  points,
  style: { color: "#a5b4fc", pointSize: 0.045 },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#03040a" });
  const camera = ctx.createCamera3D(scene, {
    position: xyz(0, 9, 13),
    target: [0, 0, 0],
    fov: 45,
  });
  ctx.mount(scene, camera);
  const handle = scene.register(cloud);
  await scene.play(handle.create({ duration: 3 }));
});

export function LargePointcloudDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
