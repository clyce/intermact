import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "../geometry/provider";
import {
  createLineProvider3D,
  createMeshProvider3D,
  createPointsProvider3D,
  toSampledPolyline3D,
} from "../geometry/provider3d";
import { type RawContour } from "../geometry/sampling";
import { findTrait, type Geometry3DTrait, type ObjectTrait } from "../object/traits";
import { type ObjectMetadata, type ObjectStyle } from "../object/style";
import { type IMObject, type IMObject2D, type IMObject3D, isObject2D } from "../object/types";
import { createInitialState2D, type RuntimeState } from "../runtime/state";
import {
  type SerializedContour2D,
  type SerializedGeometry2D,
  type SerializedGeometry3D,
  type SerializedObject,
} from "./types";

/**
 * Object ↔ serialized "baked" geometry (design.md §17). Definitions hold
 * closures (geometry providers, trait callbacks), so we cannot JSON them
 * directly. Instead we **bake** an object by sampling its natural geometry into
 * flat number arrays, and **rebuild** it through the same provider factories the
 * authoring constructs use. Live capabilities that cannot survive a round-trip
 * (parametric recompute, interactivity, text-layout token order) degrade to
 * plain stroke/fill geometry — documented in `phase-3-review.md`.
 */

/** JSON-safe deep clone of a runtime state (baseline states carry no typed arrays). */
function cloneState(state: RuntimeState): RuntimeState {
  return JSON.parse(JSON.stringify(state)) as RuntimeState;
}

function bakeContour(points: Float32Array, closed: boolean): SerializedContour2D {
  return { points: Array.from(points), closed };
}

function rawFromSerialized(c: SerializedContour2D): RawContour {
  return { points: Float32Array.from(c.points), closed: c.closed };
}

/** Bake a 2D object's geometry by sampling its natural contours and fill data. */
export function bakeGeometry2D(object: IMObject2D): SerializedGeometry2D {
  const path = object.geometry.samplePath();
  const contours = path.contours.map((c) => bakeContour(c.points, c.closed));
  const fill = findTrait(object.traits, "fill");
  const morph = findTrait(object.traits, "morphable");
  const groups = object.geometry.sampleFillGroups?.();
  const glyphIndex = object.geometry.contourGlyphIndex?.() ?? undefined;
  const groupColors = object.geometry.fillGroupColors?.() ?? undefined;
  // Recover the morph sampling resolution from the source trait so rebuild keeps
  // the same per-contour point count (no hardcoded default, design.md §13.3.3).
  const morphSamples = morph
    ? (morph.normalizedContours()[0]?.points.length ?? 0) / 2 || undefined
    : undefined;
  return {
    kind: "2d",
    contours,
    fillable: Boolean(fill),
    ...(fill ? { fillRule: fill.fillRule } : {}),
    morphable: Boolean(morph),
    ...(morphSamples ? { morphSamples } : {}),
    ...(groups
      ? { fillGroups: groups.map((g) => g.map((c) => bakeContour(c.points, c.closed))) }
      : {}),
    ...(glyphIndex ? { contourGlyphIndex: [...glyphIndex] } : {}),
    ...(groupColors ? { fillGroupColors: [...groupColors] } : {}),
  };
}

/** Bake a 3D object's geometry from its active line / mesh / points channel. */
export function bakeGeometry3D(object: IMObject3D): SerializedGeometry3D {
  const geo = object.geometry;
  if (geo.kind === "line") {
    const lines = (geo.sampleLines?.() ?? []).map((l) => ({
      points: Array.from(l.points),
      closed: l.closed,
    }));
    return { kind: "3d-line", lines };
  }
  if (geo.kind === "mesh") {
    const mesh = geo.sampleMesh?.();
    return {
      kind: "3d-mesh",
      positions: mesh ? Array.from(mesh.positions) : [],
      indices: mesh ? Array.from(mesh.indices) : [],
      ...(mesh?.normals ? { normals: Array.from(mesh.normals) } : {}),
    };
  }
  const points = geo.samplePoints?.();
  return {
    kind: "3d-points",
    positions: points ? Array.from(points.positions) : [],
    ...(points?.scalars ? { scalars: Array.from(points.scalars) } : {}),
  };
}

function cloneStyle(style: ObjectStyle | undefined): Record<string, unknown> | undefined {
  return style ? ({ ...style } as Record<string, unknown>) : undefined;
}

function cloneMeta(meta: ObjectMetadata | undefined): Record<string, unknown> | undefined {
  return meta ? ({ ...meta } as Record<string, unknown>) : undefined;
}

/**
 * Bake an object definition (no id / state). Used for morph targets, which are
 * pure definitions embedded in a spec.
 */
export function bakeObjectDef(object: IMObject): Omit<SerializedObject, "id" | "initialState"> {
  if (isObject2D(object)) {
    return {
      type: object.type,
      dimension: "2d",
      geometry: bakeGeometry2D(object),
      ...(cloneStyle(object.style) ? { style: cloneStyle(object.style) } : {}),
      ...(cloneMeta(object.metadata) ? { metadata: cloneMeta(object.metadata) } : {}),
      ...(object.parts
        ? {
            parts: object.parts.map((p) => ({
              key: p.key,
              object: bakeObject(`${object.type}:${p.key}`, p.object, createInitialState2D()),
            })),
          }
        : {}),
    };
  }
  return {
    type: object.type,
    dimension: "3d",
    geometry: bakeGeometry3D(object),
    ...(cloneStyle(object.style) ? { style: cloneStyle(object.style) } : {}),
    ...(cloneMeta(object.metadata) ? { metadata: cloneMeta(object.metadata) } : {}),
  };
}

/** Bake a registered object (definition + id + baseline state + parent link). */
export function bakeObject(
  id: string,
  object: IMObject,
  initialState: RuntimeState,
  parentId?: string,
): SerializedObject {
  return {
    id,
    ...bakeObjectDef(object),
    initialState: cloneState(initialState),
    ...(parentId ? { parentId } : {}),
  };
}

function rebuildGeometry2DTraits(geo: SerializedGeometry2D): {
  object: IMObject2D;
} {
  const rawContours = geo.contours.map(rawFromSerialized);
  const fillRule = geo.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({
    rawContours,
    fillable: geo.fillable,
    ...(geo.fillable ? { fillRule } : {}),
    ...(geo.fillGroups ? { fillGroups: geo.fillGroups.map((g) => g.map(rawFromSerialized)) } : {}),
    ...(geo.contourGlyphIndex ? { contourGlyphIndex: [...geo.contourGlyphIndex] } : {}),
    ...(geo.fillGroupColors ? { fillGroupColors: [...geo.fillGroupColors] } : {}),
  });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (geo.fillable) traits.push(fillTraitFrom(provider, fillRule));
  if (geo.morphable) traits.push(morphableTraitFrom(provider, geo.morphSamples ?? 64));
  return {
    object: { type: "baked-2d", dimension: "2d", traits, geometry: provider },
  };
}

/** Rebuild an {@link IMObject} from its baked form (geometry + style + parts). */
export function rebuildObject(s: SerializedObject): IMObject {
  if (s.dimension === "2d") {
    const geo = s.geometry as SerializedGeometry2D;
    const { object } = rebuildGeometry2DTraits(geo);
    const parts = s.parts?.map((p) => ({
      key: p.key,
      object: rebuildObject(p.object) as IMObject2D,
    }));
    return {
      ...object,
      type: s.type,
      ...(s.style ? { style: s.style as ObjectStyle } : {}),
      ...(s.metadata ? { metadata: s.metadata as ObjectMetadata } : {}),
      ...(parts ? { parts } : {}),
    };
  }
  const geo = s.geometry as SerializedGeometry3D;
  let object: IMObject3D;
  if (geo.kind === "3d-line") {
    object = {
      type: s.type,
      dimension: "3d",
      // Restore the geometry channel trait so the rebuilt object still drives
      // Create arc-length reveal and group3D dispatch (design.md §13.3.3).
      traits: [{ kind: "geometry-3d", geometryKind: "line" } satisfies Geometry3DTrait],
      geometry: createLineProvider3D(
        geo.lines.map((l) => toSampledPolyline3D(Float32Array.from(l.points), l.closed)),
      ),
    };
  } else if (geo.kind === "3d-mesh") {
    object = {
      type: s.type,
      dimension: "3d",
      traits: [{ kind: "geometry-3d", geometryKind: "mesh" } satisfies Geometry3DTrait],
      geometry: createMeshProvider3D({
        positions: Float32Array.from(geo.positions),
        indices: Uint32Array.from(geo.indices),
        ...(geo.normals ? { normals: Float32Array.from(geo.normals) } : {}),
      }),
    };
  } else {
    object = {
      type: s.type,
      dimension: "3d",
      traits: [{ kind: "geometry-3d", geometryKind: "points" } satisfies Geometry3DTrait],
      geometry: createPointsProvider3D({
        positions: Float32Array.from(geo.positions),
        ...(geo.scalars ? { scalars: Float32Array.from(geo.scalars) } : {}),
      }),
    };
  }
  return {
    ...object,
    ...(s.style ? { style: s.style as ObjectStyle } : {}),
    ...(s.metadata ? { metadata: s.metadata as ObjectMetadata } : {}),
  };
}
