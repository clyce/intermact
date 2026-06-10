import { type Vec3 } from "../math/vec";
import {
  type Bounds3D,
  type GeometryCapability,
  type GeometryProvider3D,
  type SampledMesh3D,
  type SampledPoints3D,
  type SampledPolyline3D,
} from "../object/geometry-provider";

/**
 * 3D geometry providers (design.md §5.3). Mirror of the 2D
 * {@link createGeometryProvider2D} factory: each provider answers how an object
 * is sampled (line / mesh / points) and bounded. Framework-free; the renderer
 * dispatches on {@link GeometryProvider3D.kind}.
 */

/** Number of points in a flat `[x,y,z,...]` buffer. */
export function pointCount3(points: Float32Array): number {
  return Math.floor(points.length / 3);
}

/** Prefix-sum arc lengths and the total length of a 3D polyline. */
export function cumulativeLengths3(
  points: Float32Array,
  closed: boolean,
): { cumulative: Float32Array; total: number } {
  const n = pointCount3(points);
  const cumulative = new Float32Array(n);
  if (n === 0) return { cumulative, total: 0 };
  for (let i = 1; i < n; i++) {
    const dx = points[i * 3]! - points[(i - 1) * 3]!;
    const dy = points[i * 3 + 1]! - points[(i - 1) * 3 + 1]!;
    const dz = points[i * 3 + 2]! - points[(i - 1) * 3 + 2]!;
    cumulative[i] = cumulative[i - 1]! + Math.hypot(dx, dy, dz);
  }
  let total = cumulative[n - 1]!;
  if (closed && n > 1) {
    const dx = points[0]! - points[(n - 1) * 3]!;
    const dy = points[1]! - points[(n - 1) * 3 + 1]!;
    const dz = points[2]! - points[(n - 1) * 3 + 2]!;
    total += Math.hypot(dx, dy, dz);
  }
  return { cumulative, total };
}

/** Build a {@link SampledPolyline3D} (with cumulative lengths) from a buffer. */
export function toSampledPolyline3D(points: Float32Array, closed: boolean): SampledPolyline3D {
  const { cumulative } = cumulativeLengths3(points, closed);
  return { points, closed, cumulativeLength: cumulative };
}

/** Compute an axis-aligned 3D bounding box from one or more position buffers. */
export function computeBounds3D(buffers: readonly Float32Array[]): Bounds3D {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const buf of buffers) {
    for (let i = 0; i + 2 < buf.length; i += 3) {
      const x = buf[i]!;
      const y = buf[i + 1]!;
      const z = buf[i + 2]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }
  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
  }
  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
  };
}

/** Pack an array of Vec3 into a flat interleaved `Float32Array`. */
export function packVec3(points: readonly Vec3[]): Float32Array {
  const out = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  });
  return out;
}

/** Build a line ({@link GeometryProvider3D}) from one or more polylines. */
export function createLineProvider3D(polylines: readonly SampledPolyline3D[]): GeometryProvider3D {
  const bounds = computeBounds3D(polylines.map((p) => p.points));
  const capabilities: GeometryCapability[] = ["line", "buffer"];
  const total = polylines.reduce((sum, p) => sum + cumulativeLengths3(p.points, p.closed).total, 0);
  return {
    capabilities,
    kind: "line",
    getBounds: () => bounds,
    sampleLines: () => polylines,
    totalLength: () => total,
  };
}

/** Compute flat per-vertex normals (area-weighted) for a triangle mesh. */
export function computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const ia = indices[t]! * 3;
    const ib = indices[t + 1]! * 3;
    const ic = indices[t + 2]! * 3;
    const ax = positions[ia]!;
    const ay = positions[ia + 1]!;
    const az = positions[ia + 2]!;
    const bx = positions[ib]!;
    const by = positions[ib + 1]!;
    const bz = positions[ib + 2]!;
    const cx = positions[ic]!;
    const cy = positions[ic + 1]!;
    const cz = positions[ic + 2]!;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const base of [ia, ib, ic]) {
      normals[base] = normals[base]! + nx;
      normals[base + 1] = normals[base + 1]! + ny;
      normals[base + 2] = normals[base + 2]! + nz;
    }
  }
  for (let i = 0; i + 2 < normals.length; i += 3) {
    const len = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!);
    if (len > 0) {
      normals[i] = normals[i]! / len;
      normals[i + 1] = normals[i + 1]! / len;
      normals[i + 2] = normals[i + 2]! / len;
    }
  }
  return normals;
}

/** Build a mesh ({@link GeometryProvider3D}) from positions + indices. */
export function createMeshProvider3D(mesh: SampledMesh3D): GeometryProvider3D {
  const bounds = computeBounds3D([mesh.positions]);
  const normals = mesh.normals ?? computeVertexNormals(mesh.positions, mesh.indices);
  const withNormals: SampledMesh3D = {
    positions: mesh.positions,
    indices: mesh.indices,
    normals,
  };
  return {
    capabilities: ["mesh", "buffer"],
    kind: "mesh",
    getBounds: () => bounds,
    sampleMesh: () => withNormals,
  };
}

/** Build a point cloud ({@link GeometryProvider3D}) from positions (+ scalars). */
export function createPointsProvider3D(points: SampledPoints3D): GeometryProvider3D {
  const bounds = computeBounds3D([points.positions]);
  return {
    capabilities: ["points", "buffer"],
    kind: "points",
    getBounds: () => bounds,
    samplePoints: () => points,
  };
}
