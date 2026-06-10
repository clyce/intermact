import { useEffect, useRef, useState } from "react";
import { createProgram, marchingCubes, meshObject, xyz } from "@intermact/core";
import {
  type ComputeClient,
  createLocalComputeClient,
  createWorkerComputeClient,
  runComputeJob,
} from "@intermact/render-three";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/perf/worker-sampling` (dev-roadmap.md M16, design.md §15.2 #6).
 *
 * The CPU-heavy isosurface polygonization (marching-cubes) is a pure core
 * function, so it can run either on the main thread or offloaded to a Worker via
 * the `@intermact/render-three` compute client. The canvas shows the surface;
 * the panel runs the same job both ways and reports timings — off-thread keeps
 * the render loop responsive on big fields. core stays DOM-free; all Worker glue
 * is in `render-three`.
 */
const BOX = {
  min: [-2, -2, -2] as [number, number, number],
  max: [2, 2, 2] as [number, number, number],
};

/** A two-blob metaball field; its `f = 0` level set is a smooth bridged surface. */
function metaball(x: number, y: number, z: number): number {
  const d1 = (x - 0.65) ** 2 + y * y + z * z;
  const d2 = (x + 0.65) ** 2 + y * y + z * z;
  return 1 / (d1 + 0.05) + 1 / (d2 + 0.05) - 3;
}

/** Sample the field on a regular grid into the serializable worker input. */
function buildField(resolution: number): {
  field: Float64Array;
  dims: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
} {
  const n = resolution + 1;
  const field = new Float64Array(n * n * n);
  const dx = (BOX.max[0] - BOX.min[0]) / resolution;
  const dy = (BOX.max[1] - BOX.min[1]) / resolution;
  const dz = (BOX.max[2] - BOX.min[2]) / resolution;
  const idx = (i: number, j: number, k: number) => (k * n + j) * n + i;
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        field[idx(i, j, k)] = metaball(
          BOX.min[0] + i * dx,
          BOX.min[1] + j * dy,
          BOX.min[2] + k * dz,
        );
  return { field, dims: [n, n, n], min: BOX.min, max: BOX.max };
}

// Canvas preview: a modest-resolution surface built synchronously at load.
const previewMesh = marchingCubes(metaball, { ...BOX, resolution: 40, level: 0 });
const surface = meshObject({
  positions: previewMesh.positions,
  indices: previewMesh.indices,
  normals: previewMesh.normals,
  style: { color: "#34d399", doubleSided: true },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene3D({ background: "#04060c" });
  const camera = ctx.createCamera3D(scene, { position: xyz(4, 3, 5), target: [0, 0, 0], fov: 45 });
  ctx.mount(scene, camera);
  const mesh = scene.register(surface);
  await scene.play(mesh.create({ duration: 2 }));
});

interface BenchResult {
  resolution: number;
  triangles: number;
  mainMs: number;
  workerMs: number;
  offloaded: boolean;
}

export function WorkerSamplingDemo() {
  const clientRef = useRef<ComputeClient | null>(null);
  const offloadedRef = useRef(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const worker = new Worker(new URL("./compute.worker.ts", import.meta.url), {
        type: "module",
      });
      clientRef.current = createWorkerComputeClient(worker);
      offloadedRef.current = true;
    } catch {
      // No Worker (SSR/old browser): fall back to in-process so the demo still runs.
      clientRef.current = createLocalComputeClient();
      offloadedRef.current = false;
    }
    return () => clientRef.current?.dispose();
  }, []);

  async function runBenchmark() {
    const client = clientRef.current;
    if (!client) return;
    setRunning(true);
    const resolution = 64;
    const input = buildField(resolution);

    const mainStart = performance.now();
    const mainRes = runComputeJob({ kind: "marching-cubes", level: 0, ...input });
    const mainMs = performance.now() - mainStart;

    const workerStart = performance.now();
    const workerRes = await client.run({
      kind: "marching-cubes",
      level: 0,
      ...buildField(resolution),
    });
    const workerMs = performance.now() - workerStart;

    const triangles =
      mainRes.kind === "marching-cubes"
        ? mainRes.indices.length / 3
        : workerRes.kind === "marching-cubes"
          ? workerRes.indices.length / 3
          : 0;
    setResult({ resolution, triangles, mainMs, workerMs, offloaded: offloadedRef.current });
    setRunning(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
      </div>
      <aside
        style={{
          width: 250,
          padding: 12,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          overflow: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>Worker sampling</h3>
        <p style={{ color: "#94a3b8", marginTop: 0 }}>
          Polygonize a 64³ metaball field on the main thread vs. an offloaded Worker.
        </p>
        <button
          type="button"
          onClick={runBenchmark}
          disabled={running}
          style={{
            padding: "6px 12px",
            background: running ? "#334155" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "Running…" : "Run benchmark"}
        </button>
        {result ? (
          <dl style={{ marginTop: 12, lineHeight: 1.5 }}>
            <div>
              Backend: <strong>{result.offloaded ? "Worker" : "in-process fallback"}</strong>
            </div>
            <div>
              Resolution: <strong>{result.resolution}³</strong>
            </div>
            <div>
              Triangles: <strong>{result.triangles.toLocaleString()}</strong>
            </div>
            <div>
              Main thread: <strong>{result.mainMs.toFixed(1)} ms</strong>
            </div>
            <div>
              Worker: <strong>{result.workerMs.toFixed(1)} ms</strong>
            </div>
          </dl>
        ) : null}
      </aside>
    </div>
  );
}
