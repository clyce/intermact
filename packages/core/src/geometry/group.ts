/**
 * Composite 2D objects (design.md §5.3). `group2D` aggregates child objects into
 * a single renderable {@link IMObject2D} while preserving per-child **part keys**
 * (`design.md §11.4`). The aggregated geometry renders as one object; the
 * `parts` metadata drives `transformMatching` (M9) and formula matching (M10).
 */
import { type ObjectStyle } from "../object/style";
import { type ObjectTrait } from "../object/traits";
import { type IMObject2D, type ObjectPart2D } from "../object/types";
import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "./provider";
import { type RawContour } from "./sampling";

const DEFAULT_SAMPLES = 64;

/** A child of {@link group2D}: a bare object (key = index) or an explicit key. */
export type GroupChild = IMObject2D | { readonly key: string; readonly object: IMObject2D };

/** Options for {@link group2D}. */
export interface GroupProps {
  readonly style?: ObjectStyle;
  /** Derive a part key from a child object + index (default: the index). */
  readonly keyOf?: (child: IMObject2D, index: number) => string;
  readonly metadata?: never;
}

function normalizeChild(
  child: GroupChild,
  index: number,
  keyOf?: GroupProps["keyOf"],
): ObjectPart2D {
  if ("key" in child && "object" in child) return { key: child.key, object: child.object };
  const object = child;
  return { key: keyOf ? keyOf(object, index) : String(index), object };
}

/** Collect a child object's contours as raw contours for aggregation. */
export function objectRawContours(object: IMObject2D): RawContour[] {
  return object.geometry.samplePath().contours.map((c) => ({ points: c.points, closed: c.closed }));
}

/**
 * Aggregate child objects into one composite object that retains keyed parts.
 * Fillable when any child is fillable; always strokeable + morphable.
 */
export function group2D(children: readonly GroupChild[], props: GroupProps = {}): IMObject2D {
  const parts = children.map((c, i) => normalizeChild(c, i, props.keyOf));

  const rawContours: RawContour[] = [];
  let fillable = false;
  for (const part of parts) {
    rawContours.push(...objectRawContours(part.object));
    if (part.object.traits.some((t) => t.kind === "fill")) fillable = true;
  }

  const fillRule = props.style?.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({ rawContours, fillable, fillRule });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (fillable) traits.push(fillTraitFrom(provider, fillRule));
  traits.push(morphableTraitFrom(provider, DEFAULT_SAMPLES));

  return {
    type: "group-2d",
    dimension: "2d",
    traits,
    geometry: provider,
    parts,
    ...(props.style ? { style: props.style } : {}),
  };
}
