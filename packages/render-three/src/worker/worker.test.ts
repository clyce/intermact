import { describe, expect, it } from "vitest";
import {
  marchingCubesField,
  parseSvgPath,
  resampleByArcLength,
  toSampledContour,
  triangulate,
} from "@intermact/core";
import { runComputeJob } from "./kernel";
import { createLocalComputeClient, createWorkerComputeClient, type WorkerLike } from "./client";
import { type ComputeWorkerScope, handleComputeMessages } from "./entry";
import { type ComputeRequest, type ComputeResponse } from "./protocol";

const SQUARE = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

function sphereField(res: number): {
  field: Float64Array;
  dims: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
} {
  const n = res + 1;
  const min: [number, number, number] = [-1.5, -1.5, -1.5];
  const max: [number, number, number] = [1.5, 1.5, 1.5];
  const field = new Float64Array(n * n * n);
  const d = (max[0] - min[0]) / res;
  const idx = (i: number, j: number, k: number) => (k * n + j) * n + i;
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = min[0] + i * d;
        const y = min[1] + j * d;
        const z = min[2] + k * d;
        field[idx(i, j, k)] = Math.hypot(x, y, z) - 1;
      }
  return { field, dims: [n, n, n], min, max };
}

/** An in-memory Worker pair wiring the client to the entry handler (no real thread). */
function mockWorker(): WorkerLike {
  let clientListener: ((ev: { data: ComputeResponse }) => void) | null = null;
  const scope: ComputeWorkerScope = {
    onmessage: null,
    postMessage(message) {
      clientListener?.({ data: message as ComputeResponse });
    },
  };
  handleComputeMessages(scope);
  return {
    postMessage(message) {
      scope.onmessage?.({ data: message as ComputeRequest });
    },
    addEventListener(_type, listener) {
      clientListener = listener;
    },
    removeEventListener() {
      clientListener = null;
    },
  };
}

describe("compute worker kernel (M16, design.md §15.2 #6)", () => {
  it("resample matches the core function", () => {
    const res = runComputeJob({ kind: "resample", points: SQUARE, closed: true, count: 16 });
    expect(res.kind).toBe("resample");
    if (res.kind !== "resample") return;
    expect(Array.from(res.points)).toEqual(Array.from(resampleByArcLength(SQUARE, true, 16)));
  });

  it("triangulate matches the core function", () => {
    const res = runComputeJob({
      kind: "triangulate",
      contours: [{ points: SQUARE, closed: true }],
    });
    if (res.kind !== "triangulate") throw new Error("kind");
    const ref = triangulate([toSampledContour(SQUARE, true)]);
    expect(res.indices.length).toBe(ref.indices.length);
    expect(res.vertices.length).toBe(ref.vertices.length);
    expect(res.indices.length).toBeGreaterThan(0);
  });

  it("marching-cubes matches the field polygonizer", () => {
    const { field, dims, min, max } = sphereField(8);
    const res = runComputeJob({ kind: "marching-cubes", field, dims, min, max, level: 0 });
    if (res.kind !== "marching-cubes") throw new Error("kind");
    const ref = marchingCubesField({ field, dims, min, max, level: 0 });
    expect(res.positions.length).toBe(ref.positions.length);
    expect(res.indices.length).toBe(ref.indices.length);
    expect(res.indices.length).toBeGreaterThan(0);
  });

  it("parse-svg-path matches the core parser", () => {
    const d = "M0 0 L2 0 L2 2 Z";
    const res = runComputeJob({ kind: "parse-svg-path", d });
    if (res.kind !== "parse-svg-path") throw new Error("kind");
    const ref = parseSvgPath(d);
    expect(res.contours.length).toBe(ref.length);
    expect(Array.from(res.contours[0]!.points)).toEqual(Array.from(ref[0]!.points));
  });
});

describe("compute clients", () => {
  it("local client resolves with kernel results", async () => {
    const client = createLocalComputeClient();
    const res = await client.run({ kind: "resample", points: SQUARE, closed: true, count: 8 });
    expect(res.points.length).toBe(16);
    client.dispose();
  });

  it("worker client round-trips a job through the entry handler", async () => {
    const client = createWorkerComputeClient(mockWorker());
    const tri = await client.run({
      kind: "triangulate",
      contours: [{ points: SQUARE, closed: true }],
    });
    expect(tri.kind).toBe("triangulate");
    expect(tri.indices.length).toBeGreaterThan(0);

    const svg = await client.run({ kind: "parse-svg-path", d: "M0 0 L1 0 L0 1 Z" });
    expect(svg.contours.length).toBeGreaterThan(0);
    client.dispose();
  });

  it("worker client rejects pending jobs on dispose", async () => {
    // A worker that never replies, so the request stays pending until dispose.
    const silent: WorkerLike = {
      postMessage() {},
      addEventListener() {},
      removeEventListener() {},
    };
    const client = createWorkerComputeClient(silent);
    const pending = client.run({ kind: "resample", points: SQUARE, closed: true, count: 4 });
    client.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
  });
});
