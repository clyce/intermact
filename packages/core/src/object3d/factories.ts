import {
  computeVertexNormals,
  createLineProvider3D,
  createMeshProvider3D,
  createPointsProvider3D,
  packVec3,
  toSampledPolyline3D,
} from "../geometry/provider3d";
import { type Vec3 } from "../math/vec";
import { type SampledPolyline3D } from "../object/geometry-provider";
import { type ObjectMetadata, type ObjectStyle } from "../object/style";
import { type Geometry3DTrait } from "../object/traits";
import { type IMObject3D } from "../object/types";

/**
 * 3D object factories (design.md §5.3, §10). Mirror of the 2D primitives: each
 * returns an immutable {@link IMObject3D} whose geometry is sampled by a
 * {@link GeometryProvider3D}. Framework-free; rendered by `render-three`.
 *
 * Every factory tags its object with a {@link Geometry3DTrait} capability marker
 * so `Create` reveal and grouping dispatch on traits (design.md §4.2) instead of
 * testing concrete `object.type`.
 */

/** Build the 3D renderable capability marker for a given primitive channel. */
function geometry3DTrait(geometryKind: Geometry3DTrait["geometryKind"]): Geometry3DTrait {
  return { kind: "geometry-3d", geometryKind };
}

function styleMeta(props: { style?: ObjectStyle; metadata?: ObjectMetadata }): {
  style?: ObjectStyle;
  metadata?: ObjectMetadata;
} {
  return {
    ...(props.style ? { style: props.style } : {}),
    ...(props.metadata ? { metadata: props.metadata } : {}),
  };
}

/** A polyline through ordered 3D points. */
export interface Polyline3DProps {
  readonly points: readonly Vec3[];
  readonly closed?: boolean;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build an open/closed 3D polyline object. */
export function polyline3D(props: Polyline3DProps): IMObject3D {
  const closed = props.closed ?? false;
  const line = toSampledPolyline3D(packVec3(props.points), closed);
  return {
    type: "polyline-3d",
    dimension: "3d",
    traits: [geometry3DTrait("line")],
    geometry: createLineProvider3D([line]),
    ...styleMeta(props),
  };
}

/** A parametric 3D curve `t -> (x,y,z)`. */
export interface Curve3DProps {
  readonly fn: (t: number) => Vec3;
  readonly tRange?: readonly [number, number];
  readonly samples?: number;
  readonly closed?: boolean;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a parametric 3D curve object by uniform sampling of `t`. */
export function curve3D(props: Curve3DProps): IMObject3D {
  const [t0, t1] = props.tRange ?? [0, 1];
  const n = Math.max(2, props.samples ?? 128);
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * (i / (n - 1));
    pts.push(props.fn(t));
  }
  const closed = props.closed ?? false;
  const line = toSampledPolyline3D(packVec3(pts), closed);
  return {
    type: "curve-3d",
    dimension: "3d",
    traits: [geometry3DTrait("line")],
    geometry: createLineProvider3D([line]),
    ...styleMeta(props),
  };
}

/** An explicit triangle mesh. */
export interface MeshObjectProps {
  readonly positions: Float32Array | readonly Vec3[];
  readonly indices: Uint32Array | readonly number[];
  readonly normals?: Float32Array;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a mesh object from raw positions + triangle indices. */
export function meshObject(props: MeshObjectProps): IMObject3D {
  const positions =
    props.positions instanceof Float32Array ? props.positions : packVec3(props.positions);
  const indices =
    props.indices instanceof Uint32Array ? props.indices : Uint32Array.from(props.indices);
  const normals = props.normals ?? computeVertexNormals(positions, indices);
  return {
    type: "mesh-3d",
    dimension: "3d",
    traits: [geometry3DTrait("mesh")],
    geometry: createMeshProvider3D({ positions, indices, normals }),
    ...styleMeta(props),
  };
}

/** A parametric surface `(u,v) -> (x,y,z)`. */
export interface Surface3DProps {
  readonly fn: (u: number, v: number) => Vec3;
  readonly uRange?: readonly [number, number];
  readonly vRange?: readonly [number, number];
  readonly uSegments?: number;
  readonly vSegments?: number;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a parametric surface mesh by sweeping a `(u,v)` grid. */
export function surface3D(props: Surface3DProps): IMObject3D {
  const [u0, u1] = props.uRange ?? [0, 1];
  const [v0, v1] = props.vRange ?? [0, 1];
  const us = Math.max(1, props.uSegments ?? 32);
  const vs = Math.max(1, props.vSegments ?? 32);
  const nu = us + 1;
  const nv = vs + 1;
  const positions = new Float32Array(nu * nv * 3);
  for (let iu = 0; iu < nu; iu++) {
    const u = u0 + (u1 - u0) * (iu / us);
    for (let iv = 0; iv < nv; iv++) {
      const v = v0 + (v1 - v0) * (iv / vs);
      const p = props.fn(u, v);
      const base = (iu * nv + iv) * 3;
      positions[base] = p[0];
      positions[base + 1] = p[1];
      positions[base + 2] = p[2];
    }
  }
  const indices = new Uint32Array(us * vs * 6);
  let t = 0;
  for (let iu = 0; iu < us; iu++) {
    for (let iv = 0; iv < vs; iv++) {
      const a = iu * nv + iv;
      const b = (iu + 1) * nv + iv;
      const c = (iu + 1) * nv + (iv + 1);
      const d = iu * nv + (iv + 1);
      indices[t++] = a;
      indices[t++] = b;
      indices[t++] = c;
      indices[t++] = a;
      indices[t++] = c;
      indices[t++] = d;
    }
  }
  const style: ObjectStyle = { doubleSided: true, ...props.style };
  return {
    type: "surface-3d",
    dimension: "3d",
    traits: [geometry3DTrait("mesh")],
    geometry: createMeshProvider3D({
      positions,
      indices,
      normals: computeVertexNormals(positions, indices),
    }),
    style,
    ...(props.metadata ? { metadata: props.metadata } : {}),
  };
}

/** A point cloud, optionally with per-point scalars in [0,1] for coloring. */
export interface PointCloud3DProps {
  readonly points: readonly Vec3[];
  readonly scalars?: readonly number[];
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a 3D point-cloud object. */
export function pointCloud3D(props: PointCloud3DProps): IMObject3D {
  const positions = packVec3(props.points);
  const scalars = props.scalars ? Float32Array.from(props.scalars) : undefined;
  return {
    type: "point-cloud-3d",
    dimension: "3d",
    traits: [geometry3DTrait("points")],
    geometry: createPointsProvider3D(scalars ? { positions, scalars } : { positions }),
    ...styleMeta(props),
  };
}

/** 3D coordinate axes (three colored line segments meeting at the origin). */
export interface Axes3DProps {
  readonly size?: number;
  readonly origin?: Vec3;
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;
}

/** Build a 3D axes object (X/Y/Z lines from the origin). */
export function axes3D(props: Axes3DProps = {}): IMObject3D {
  const s = props.size ?? 1;
  const o = props.origin ?? ([0, 0, 0] as Vec3);
  const lines: SampledPolyline3D[] = [
    toSampledPolyline3D(packVec3([o, [o[0] + s, o[1], o[2]]]), false),
    toSampledPolyline3D(packVec3([o, [o[0], o[1] + s, o[2]]]), false),
    toSampledPolyline3D(packVec3([o, [o[0], o[1], o[2] + s]]), false),
  ];
  return {
    type: "axes-3d",
    dimension: "3d",
    traits: [geometry3DTrait("line")],
    geometry: createLineProvider3D(lines),
    ...styleMeta(props),
  };
}
