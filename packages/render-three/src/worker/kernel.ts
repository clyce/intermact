import {
  marchingCubesField,
  parseSvgPath,
  resampleByArcLength,
  type SampledContour2D,
  toSampledContour,
  triangulate,
} from "@intermact/core";
import { type ComputeJob, type ComputeResult, type FlatContour } from "./protocol";

/**
 * Pure dispatch of a {@link ComputeJob} to its core implementation (design.md
 * §15.2 #6). Shared by the in-process fallback ({@link createLocalComputeClient})
 * and the Worker entry ({@link handleComputeMessages}), so both paths produce
 * byte-identical results. No DOM, no three.js — only `@intermact/core`.
 */
export function runComputeJob(job: ComputeJob): ComputeResult {
  switch (job.kind) {
    case "resample":
      return {
        kind: "resample",
        points: resampleByArcLength(job.points, job.closed, job.count),
      };
    case "triangulate": {
      const contours: SampledContour2D[] = job.contours.map((c) =>
        toSampledContour(c.points, c.closed),
      );
      const tri = triangulate(contours);
      return { kind: "triangulate", vertices: tri.vertices, indices: tri.indices };
    }
    case "marching-cubes": {
      const mesh = marchingCubesField({
        field: job.field,
        dims: job.dims,
        min: job.min,
        max: job.max,
        level: job.level,
      });
      return {
        kind: "marching-cubes",
        positions: mesh.positions,
        indices: mesh.indices,
        ...(mesh.normals ? { normals: mesh.normals } : {}),
      };
    }
    case "parse-svg-path": {
      const contours: FlatContour[] = parseSvgPath(job.d, job.options).map((c) => ({
        points: c.points,
        closed: c.closed,
      }));
      return { kind: "parse-svg-path", contours };
    }
  }
}

/** Typed-array buffers in a result, for zero-copy `postMessage` transfer. */
export function resultTransferables(result: ComputeResult): Transferable[] {
  const buf = (a: { buffer: ArrayBufferLike }): ArrayBuffer => a.buffer as ArrayBuffer;
  switch (result.kind) {
    case "resample":
      return [buf(result.points)];
    case "triangulate":
      return [buf(result.vertices), buf(result.indices)];
    case "marching-cubes":
      return result.normals
        ? [buf(result.positions), buf(result.indices), buf(result.normals)]
        : [buf(result.positions), buf(result.indices)];
    case "parse-svg-path":
      return result.contours.map((c) => buf(c.points));
  }
}
