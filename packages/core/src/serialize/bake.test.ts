import { describe, expect, it } from "vitest";
import {
  createGeometryProvider2D,
  morphableTraitFrom,
  strokeTraitFrom,
} from "../geometry/provider";
import { rawContourFromPoints } from "../geometry/sampling";
import { findTrait, type ObjectTrait } from "../object/traits";
import { type IMObject2D, type IMObject3D } from "../object/types";
import { createLineProvider3D, toSampledPolyline3D, packVec3 } from "../geometry/provider3d";
import { xy } from "../math/vec";
import { bakeObjectDef, rebuildObject } from "./bake";
import { type SerializedGeometry2D, type SerializedObject } from "./types";

/**
 * Bake/rebuild unit tests (design.md §17, §13.3.3). Round-trip details that the
 * program-level frame-hash tests can't isolate: the morph sampling resolution
 * (no hardcoded 64) and the 3D geometry-channel trait restoration.
 */

/** A square morphable object whose morphable trait samples at `samples` points. */
function squareMorphable(samples: number): IMObject2D {
  const provider = createGeometryProvider2D({
    rawContours: [rawContourFromPoints([xy(-1, -1), xy(1, -1), xy(1, 1), xy(-1, 1)], true)],
    fillable: false,
  });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider), morphableTraitFrom(provider, samples)];
  return { type: "test-morphable", dimension: "2d", traits, geometry: provider };
}

describe("bake morphSamples round-trip (M15 / §13.3.3)", () => {
  it("captures a non-default sample count and restores it", () => {
    const object = squareMorphable(24);
    const baked = bakeObjectDef(object).geometry as SerializedGeometry2D;
    expect(baked.morphable).toBe(true);
    expect(baked.morphSamples).toBe(24);

    const rebuilt = rebuildObject({
      id: "x",
      ...bakeObjectDef(object),
      initialState: { dimension: "2d" } as never,
    } as SerializedObject) as IMObject2D;
    const morph = findTrait(rebuilt.traits, "morphable");
    expect(morph).toBeTruthy();
    expect(morph!.normalizedContours()[0]!.points.length / 2).toBe(24);
  });
});

describe("bake 3D geometry trait restoration (M14 / §13.3.3)", () => {
  it("restores the geometry-3d line trait on rebuild", () => {
    const line: IMObject3D = {
      type: "test-line-3d",
      dimension: "3d",
      traits: [{ kind: "geometry-3d", geometryKind: "line" }],
      geometry: createLineProvider3D([
        toSampledPolyline3D(
          packVec3([
            [0, 0, 0],
            [1, 1, 1],
          ]),
          false,
        ),
      ]),
    };
    const rebuilt = rebuildObject({
      id: "l",
      ...bakeObjectDef(line),
      initialState: { dimension: "3d" } as never,
    } as SerializedObject) as IMObject3D;
    const trait = findTrait(rebuilt.traits, "geometry-3d");
    expect(trait?.geometryKind).toBe("line");
  });
});
