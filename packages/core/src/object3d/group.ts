/**
 * Composite 3D objects (design.md §5.3). `group3D` aggregates child objects into
 * a single renderable {@link IMObject3D} while preserving per-child **part keys**
 * (design.md §11.4), mirroring the 2D {@link group2D} factory. The aggregated
 * geometry renders as one object; the `parts` metadata is reserved for 3D
 * matching/morph.
 *
 * Because the 3D renderer dispatches on a single {@link GeometryProvider3D.kind}
 * (line / mesh / points), a group must be **homogeneous**: all children share one
 * primitive channel. Mixing channels throws `invalid-argument` — use
 * {@link Scene3D.group3D} (transform-only parenting) to combine heterogeneous
 * objects under one movable node instead.
 */
import { IntermactError } from "../errors";
import {
  computeVertexNormals,
  createLineProvider3D,
  createMeshProvider3D,
  createPointsProvider3D,
} from "../geometry/provider3d";
import {
  type SampledMesh3D,
  type SampledPoints3D,
  type SampledPolyline3D,
} from "../object/geometry-provider";
import { type ObjectStyle } from "../object/style";
import { type Geometry3DTrait, type ObjectTrait } from "../object/traits";
import { type IMObject3D, type ObjectPart3D } from "../object/types";

/** A child of {@link group3D}: a bare object (key = index) or an explicit key. */
export type GroupChild3D = IMObject3D | { readonly key: string; readonly object: IMObject3D };

/** Options for {@link group3D}. */
export interface Group3DProps {
  readonly style?: ObjectStyle;
  /** Derive a part key from a child object + index (default: the index). */
  readonly keyOf?: (child: IMObject3D, index: number) => string;
}

function normalizeChild(
  child: GroupChild3D,
  index: number,
  keyOf?: Group3DProps["keyOf"],
): ObjectPart3D {
  if ("key" in child && "object" in child) return { key: child.key, object: child.object };
  return { key: keyOf ? keyOf(child, index) : String(index), object: child };
}

/** Concatenate every child polyline into one line provider. */
function aggregateLines(parts: readonly ObjectPart3D[]): SampledPolyline3D[] {
  const lines: SampledPolyline3D[] = [];
  for (const part of parts) {
    const sampled = part.object.geometry.sampleLines?.() ?? [];
    lines.push(...sampled);
  }
  return lines;
}

/** Merge every child mesh into one buffer, offsetting indices per child. */
function aggregateMesh(parts: readonly ObjectPart3D[]): SampledMesh3D {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  for (const part of parts) {
    const mesh = part.object.geometry.sampleMesh?.();
    if (!mesh) continue;
    positions.push(...mesh.positions);
    const n = mesh.normals ?? computeVertexNormals(mesh.positions, mesh.indices);
    normals.push(...n);
    for (const i of mesh.indices) indices.push(i + vertexOffset);
    vertexOffset += mesh.positions.length / 3;
  }
  return {
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    normals: Float32Array.from(normals),
  };
}

/** Concatenate every child point cloud (scalars only when all children carry them). */
function aggregatePoints(parts: readonly ObjectPart3D[]): SampledPoints3D {
  const positions: number[] = [];
  const scalars: number[] = [];
  let allHaveScalars = true;
  for (const part of parts) {
    const pts = part.object.geometry.samplePoints?.();
    if (!pts) continue;
    positions.push(...pts.positions);
    if (pts.scalars) scalars.push(...pts.scalars);
    else allHaveScalars = false;
  }
  const base: SampledPoints3D = { positions: Float32Array.from(positions) };
  return allHaveScalars && scalars.length > 0
    ? { ...base, scalars: Float32Array.from(scalars) }
    : base;
}

/**
 * Aggregate homogeneous child objects into one composite 3D object that retains
 * keyed parts. All children must share the same primitive channel
 * (line / mesh / points); the combined geometry is rebuilt as a single provider.
 */
export function group3D(children: readonly GroupChild3D[], props: Group3DProps = {}): IMObject3D {
  if (children.length === 0) {
    throw new IntermactError("invalid-argument", "group3D requires at least one child object.");
  }
  const parts = children.map((c, i) => normalizeChild(c, i, props.keyOf));
  const kind = parts[0]!.object.geometry.kind;
  for (const part of parts) {
    if (part.object.geometry.kind !== kind) {
      throw new IntermactError(
        "invalid-argument",
        `group3D requires a single primitive channel; got "${kind}" and ` +
          `"${part.object.geometry.kind}". Use Scene3D.group3D for mixed-kind grouping.`,
      );
    }
  }

  const geometry =
    kind === "line"
      ? createLineProvider3D(aggregateLines(parts))
      : kind === "mesh"
        ? createMeshProvider3D(aggregateMesh(parts))
        : createPointsProvider3D(aggregatePoints(parts));

  const traits: ObjectTrait[] = [{ kind: "geometry-3d", geometryKind: kind } as Geometry3DTrait];
  return {
    type: "group-3d",
    dimension: "3d",
    traits,
    geometry,
    parts,
    ...(props.style ? { style: props.style } : {}),
  };
}
