import { type SampledMesh3D } from "../object/geometry-provider";
import { computeVertexNormals } from "./provider3d";

/**
 * Isosurface extraction (design.md §6, deferred from M13). Given a scalar
 * sampler over an axis-aligned box and an iso `level`, produce a triangle mesh of
 * the level set. Deterministic: identical inputs ⇒ identical buffers.
 *
 * Implementation note (variant): each grid cube is split into six tetrahedra and
 * polygonised with the **marching-tetrahedra** method (Bourke, "Polygonising a
 * scalar field using tetrahedrons"). It is a member of the marching-cubes family
 * that is intrinsically watertight (no ambiguous-face holes) and needs no 256-row
 * lookup table, which makes it robust and easy to verify. Vertices on shared
 * edges are de-duplicated, so the resulting mesh is welded (indexed) and every
 * interior edge is shared by exactly two triangles.
 */

/** A scalar sampler `f(x,y,z) -> number`. */
export type ScalarSampler3D = (x: number, y: number, z: number) => number;

/** Axis-aligned sampling box with per-axis resolution (cells). */
export interface MarchingCubesOptions {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  /** Cells per axis (vertices = res+1). A scalar applies to all axes. */
  readonly resolution: number | readonly [number, number, number];
  readonly level?: number;
}

// Cube corner offsets.
const CORNERS: readonly [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

// Six tetrahedra tiling a cube, all sharing the main diagonal 0–6.
const TETRA: readonly [number, number, number, number][] = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

/**
 * A pre-sampled scalar field on a regular grid, the serializable input to
 * {@link marchingCubesField}. Splitting sampling (arbitrary code) from
 * polygonization (pure data) lets the heavy polygonization run in a Worker
 * (design.md §15.2 #6) — the field array transfers, no closures cross threads.
 */
export interface MarchingCubesField {
  /** Flat scalar values, layout `(k*ny + j)*nx + i`, length `nx*ny*nz`. */
  readonly field: ArrayLike<number>;
  /** Vertices per axis `[nx, ny, nz]` (= resolution + 1). */
  readonly dims: readonly [number, number, number];
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly level?: number;
}

/** Extract an isosurface mesh (marching-tetrahedra). */
export function marchingCubes(
  sampler: ScalarSampler3D,
  options: MarchingCubesOptions,
): SampledMesh3D {
  const res = options.resolution;
  const [rx, ry, rz] = typeof res === "number" ? [res, res, res] : res;
  const [minX, minY, minZ] = options.min;
  const [maxX, maxY, maxZ] = options.max;
  const dx = (maxX - minX) / rx;
  const dy = (maxY - minY) / ry;
  const dz = (maxZ - minZ) / rz;

  const nx = rx + 1;
  const ny = ry + 1;
  const nz = rz + 1;
  const field = new Float64Array(nx * ny * nz);
  const gridIndex = (i: number, j: number, k: number): number => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        field[gridIndex(i, j, k)] = sampler(minX + i * dx, minY + j * dy, minZ + k * dz);
      }
    }
  }

  return marchingCubesField({
    field,
    dims: [nx, ny, nz],
    min: options.min,
    max: options.max,
    level: options.level,
  });
}

/**
 * Polygonize a pre-sampled scalar field into a watertight, indexed isosurface
 * mesh (marching-tetrahedra). Pure and serializable-in/serializable-out, so it
 * can run on a Worker (design.md §15.2 #6); {@link marchingCubes} is a thin
 * sampler-driven wrapper.
 */
export function marchingCubesField(input: MarchingCubesField): SampledMesh3D {
  const level = input.level ?? 0;
  const [nx, ny, nz] = input.dims;
  const rx = nx - 1;
  const ry = ny - 1;
  const rz = nz - 1;
  const [minX, minY, minZ] = input.min;
  const [maxX, maxY, maxZ] = input.max;
  const dx = (maxX - minX) / rx;
  const dy = (maxY - minY) / ry;
  const dz = (maxZ - minZ) / rz;
  const field = input.field;
  const gridIndex = (i: number, j: number, k: number): number => (k * ny + j) * nx + i;

  const positions: number[] = [];
  const indices: number[] = [];
  const edgeCache = new Map<number, number>();
  const totalGrid = nx * ny * nz;

  // Scratch arrays for the four tetra corners.
  const ci = [0, 0, 0, 0];
  const cj = [0, 0, 0, 0];
  const ck = [0, 0, 0, 0];
  const cv = [0, 0, 0, 0];
  const cgid = [0, 0, 0, 0];

  /** Interpolated, de-duplicated vertex on the edge between tetra corners a,b. */
  const vert = (a: number, b: number): number => {
    const lo = Math.min(cgid[a]!, cgid[b]!);
    const hi = Math.max(cgid[a]!, cgid[b]!);
    const key = lo * totalGrid + hi;
    const cached = edgeCache.get(key);
    if (cached !== undefined) return cached;
    const av = cv[a]!;
    const bv = cv[b]!;
    const denom = bv - av;
    const t = Math.abs(denom) < 1e-12 ? 0.5 : (level - av) / denom;
    const px = minX + (ci[a]! + (ci[b]! - ci[a]!) * t) * dx;
    const py = minY + (cj[a]! + (cj[b]! - cj[a]!) * t) * dy;
    const pz = minZ + (ck[a]! + (ck[b]! - ck[a]!) * t) * dz;
    const vi = positions.length / 3;
    positions.push(px, py, pz);
    edgeCache.set(key, vi);
    return vi;
  };

  const emitTriangle = (p: number, q: number, r: number): void => {
    indices.push(p, q, r);
  };

  /** World position of tetra corner `corner` (0..3 in the current tetra). */
  const cornerWorld = (corner: number): [number, number, number] => [
    minX + ci[corner]! * dx,
    minY + cj[corner]! * dy,
    minZ + ck[corner]! * dz,
  ];

  /** Unit-ish vector from the inside corner set toward the outside corner set. */
  const outwardHint = (
    insideCorners: readonly number[],
    outsideCorners: readonly number[],
  ): [number, number, number] => {
    let ix = 0;
    let iy = 0;
    let iz = 0;
    for (const c of insideCorners) {
      const p = cornerWorld(c);
      ix += p[0];
      iy += p[1];
      iz += p[2];
    }
    ix /= insideCorners.length;
    iy /= insideCorners.length;
    iz /= insideCorners.length;
    let ox = 0;
    let oy = 0;
    let oz = 0;
    for (const c of outsideCorners) {
      const p = cornerWorld(c);
      ox += p[0];
      oy += p[1];
      oz += p[2];
    }
    ox /= outsideCorners.length;
    oy /= outsideCorners.length;
    oz /= outsideCorners.length;
    return [ox - ix, oy - iy, oz - iz];
  };

  /** Emit `(a,b,c)` with winding chosen so the normal aligns with `hint`. */
  const emitOrientedTriangle = (
    a: number,
    b: number,
    c: number,
    hint: [number, number, number],
  ): void => {
    const ax = positions[a * 3]!;
    const ay = positions[a * 3 + 1]!;
    const az = positions[a * 3 + 2]!;
    const bx = positions[b * 3]!;
    const by = positions[b * 3 + 1]!;
    const bz = positions[b * 3 + 2]!;
    const cx = positions[c * 3]!;
    const cy = positions[c * 3 + 1]!;
    const cz = positions[c * 3 + 2]!;
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) emitTriangle(a, c, b);
    else emitTriangle(a, b, c);
  };

  for (let k = 0; k < rz; k++) {
    for (let j = 0; j < ry; j++) {
      for (let i = 0; i < rx; i++) {
        for (const tetra of TETRA) {
          // Resolve the four corners of this tetra.
          for (let c = 0; c < 4; c++) {
            const off = CORNERS[tetra[c]!]!;
            const x = i + off[0];
            const y = j + off[1];
            const z = k + off[2];
            ci[c] = x;
            cj[c] = y;
            ck[c] = z;
            cgid[c] = gridIndex(x, y, z);
            cv[c] = field[cgid[c]!]!;
          }
          // Partition corners into inside (value < level) and outside.
          const inside: number[] = [];
          const outside: number[] = [];
          for (let c = 0; c < 4; c++) (cv[c]! < level ? inside : outside).push(c);

          if (inside.length === 1 || outside.length === 1) {
            // 1-vs-3: a single triangle on the three edges from the lone corner.
            const lone = inside.length === 1 ? inside[0]! : outside[0]!;
            const others = [0, 1, 2, 3].filter((c) => c !== lone).sort((x, y) => x - y);
            const hint = outwardHint(inside, outside);
            emitOrientedTriangle(
              vert(lone, others[0]!),
              vert(lone, others[1]!),
              vert(lone, others[2]!),
              hint,
            );
          } else if (inside.length === 2) {
            // 2-vs-2: quadrilateral on the four inside↔outside crossing edges.
            // Canonicalize corner labels — `inside`/`outside` push order is arbitrary.
            const a = Math.min(inside[0]!, inside[1]!);
            const b = Math.max(inside[0]!, inside[1]!);
            const c = Math.min(outside[0]!, outside[1]!);
            const d = Math.max(outside[0]!, outside[1]!);
            const ac = vert(a, c);
            const bc = vert(b, c);
            const bd = vert(b, d);
            const ad = vert(a, d);
            const hint = outwardHint(inside, outside);
            // Cut contour cycles ac → bc → bd → ad; split on the ac–bd diagonal.
            emitOrientedTriangle(ac, bc, bd, hint);
            emitOrientedTriangle(ac, bd, ad, hint);
          }
        }
      }
    }
  }

  const pos = new Float32Array(positions);
  const idx = new Uint32Array(indices);
  return { positions: pos, indices: idx, normals: computeVertexNormals(pos, idx) };
}
