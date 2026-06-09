/**
 * Shared builders for math constructs (design.md §7.4). Constructs are plain
 * {@link IMObject2D}s composed of multiple stroke/fill contours (the same single
 * -object, multi-contour pattern used by `axesObject`), so they render through
 * the existing stroke/fill pipeline without new renderer support.
 */
import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "../geometry/provider";
import { type RawContour } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type ObjectTrait } from "../object/traits";
import { type IMObject2D } from "../object/types";

/** Build a stroke-only construct object from world-space contours. */
export function strokeObject(
  type: string,
  contours: readonly RawContour[],
  style: ObjectStyle,
): IMObject2D {
  const provider = createGeometryProvider2D({ rawContours: contours, fillable: false });
  return {
    type,
    dimension: "2d",
    traits: [strokeTraitFrom(provider)],
    geometry: provider,
    style,
  };
}

/** Build a fillable construct object (stroke + fill + morphable) from contours. */
export function shapeObject(
  type: string,
  contours: readonly RawContour[],
  style: ObjectStyle,
  options: { readonly morphable?: boolean; readonly defaultSamples?: number } = {},
): IMObject2D {
  const fillRule = style.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({ rawContours: contours, fillable: true, fillRule });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider), fillTraitFrom(provider, fillRule)];
  if (options.morphable) traits.push(morphableTraitFrom(provider, options.defaultSamples ?? 64));
  return {
    type,
    dimension: "2d",
    traits,
    geometry: provider,
    style,
  };
}
