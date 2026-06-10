/**
 * Composition operators (design.md §6.6). Operators take {@link IMObject2D}s and
 * return new ones, so they chain. Transforms are baked into geometry (producing
 * a new immutable definition). Transform specs use a local structural shape so
 * pcg stays scene-free; a `Transform2D` literal is assignable to it.
 *
 * 3D operator variants land with M14; M13 operators are 2D.
 */
import { type AbsXY, type Vec2, xy } from "../math/vec";
import { type BooleanOp, polygonBoolean } from "../geometry/boolean";
import { objectRawContours } from "../geometry/group";
import {
  contourTotalLength,
  cumulativeLengths,
  pointAtDistance,
  type RawContour,
  rawContourFromPoints,
} from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { IntermactError } from "../errors";
import {
  findTrait,
  type InstancedTrait,
  type InstanceTransform2D,
  type ObjectTrait,
} from "../object/traits";
import { type IMObject2D } from "../object/types";
import {
  createGeometryProvider2D,
  fillTraitFrom,
  morphableTraitFrom,
  strokeTraitFrom,
} from "../geometry/provider";
import { shapeObject, strokeObject } from "../constructs/shared";

/** A baked 2D transform (translate/rotate/scale about the origin). */
export interface ObjectTransform2D {
  readonly position?: AbsXY;
  /** Rotation in radians. */
  readonly rotation?: number;
  readonly scale?: Vec2 | number;
}

function normalizeScale(scale: Vec2 | number | undefined): Vec2 {
  if (scale === undefined) return [1, 1];
  return typeof scale === "number" ? [scale, scale] : scale;
}

/** Apply a transform to a flat interleaved point buffer (scale → rotate → translate). */
function transformPoints(points: Float32Array, t: ObjectTransform2D): Float32Array {
  const [sx, sy] = normalizeScale(t.scale);
  const rot = t.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const [tx, ty] = t.position ?? xy(0, 0);
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]! * sx;
    const y = points[i + 1]! * sy;
    out[i] = cos * x - sin * y + tx;
    out[i + 1] = sin * x + cos * y + ty;
  }
  return out;
}

function transformContour(c: RawContour, t: ObjectTransform2D): RawContour {
  return { points: transformPoints(c.points, t), closed: c.closed };
}

function isFillable(object: IMObject2D): boolean {
  return findTrait(object.traits, "fill") !== undefined;
}

function isMorphable(object: IMObject2D): boolean {
  return findTrait(object.traits, "morphable") !== undefined;
}

function rebuild(
  type: string,
  contours: readonly RawContour[],
  source: IMObject2D,
  extraTraits: readonly ObjectTrait[] = [],
): IMObject2D {
  const fillable = isFillable(source);
  const fillRule = source.style?.fillRule ?? "nonzero";
  const provider = createGeometryProvider2D({ rawContours: contours, fillable, fillRule });
  const traits: ObjectTrait[] = [strokeTraitFrom(provider)];
  if (fillable) traits.push(fillTraitFrom(provider, fillRule));
  if (isMorphable(source)) traits.push(morphableTraitFrom(provider, 64));
  traits.push(...extraTraits);
  return {
    type,
    dimension: "2d",
    traits,
    geometry: provider,
    ...(source.style ? { style: source.style } : {}),
  };
}

/** Bake a transform into an object's geometry (design.md §6.6). */
export function transformObject(object: IMObject2D, t: ObjectTransform2D): IMObject2D {
  const contours = objectRawContours(object).map((c) => transformContour(c, t));
  return rebuild(object.type, contours, object);
}

/** Compose `step` applied `i` times (translate scales linearly, rotate/scale compound). */
function nthTransform(step: ObjectTransform2D, i: number): ObjectTransform2D {
  const [sx, sy] = normalizeScale(step.scale);
  const [px, py] = step.position ?? xy(0, 0);
  return {
    position: xy(px * i, py * i),
    rotation: (step.rotation ?? 0) * i,
    scale: [Math.pow(sx, i), Math.pow(sy, i)] as Vec2,
  };
}

/**
 * Repeat an object `count` times, each offset by a cumulative `step` (design.md
 * §6.6). Named `repeatObject` to avoid colliding with the animation `repeat`
 * wrapper in the flat `@intermact/core` namespace.
 */
export function repeatObject(
  object: IMObject2D,
  count: number,
  step: ObjectTransform2D,
): IMObject2D {
  const base = objectRawContours(object);
  const contours: RawContour[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    const t = nthTransform(step, i);
    for (const c of base) contours.push(transformContour(c, t));
  }
  return rebuild(`${object.type}-repeat`, contours, object);
}

/**
 * Instance a single geometry across many transforms (design.md §6.6, §15.2).
 * The returned object both (a) bakes the aggregated geometry into its
 * stroke/fill traits — so headless sampling, SVG, hit-testing and bounds stay
 * correct — and (b) carries an {@link InstancedTrait} holding the base geometry
 * plus per-instance transforms. A GPU renderer draws the base geometry once per
 * instance via real `InstancedMesh` instancing (M16) instead of the giant
 * aggregated buffer; renderers without an instanced path fall back to the baked
 * group geometry (identical pixels, no GPU acceleration).
 */
export function instanceField(
  object: IMObject2D,
  transforms: readonly ObjectTransform2D[],
): IMObject2D {
  const base = objectRawContours(object);
  const contours: RawContour[] = [];
  for (const t of transforms) {
    for (const c of base) contours.push(transformContour(c, t));
  }
  const instances: InstanceTransform2D[] = transforms.map((t) => {
    const [sx, sy] = normalizeScale(t.scale);
    return { position: t.position ?? xy(0, 0), rotation: t.rotation ?? 0, scale: [sx, sy] };
  });
  const fill = findTrait(object.traits, "fill");
  const instanced: InstancedTrait = {
    kind: "instanced",
    instances,
    baseStroke: object.geometry.samplePath(),
    ...(fill ? { baseFill: fill.contours() } : {}),
  };
  return rebuild(`${object.type}-instanced`, contours, object, [instanced]);
}

/** Map every geometry point through `f` (e.g. conformal maps) (design.md §6.6). */
export function mapPoints(object: IMObject2D, f: (p: AbsXY) => AbsXY): IMObject2D {
  const contours = objectRawContours(object).map((c) => {
    const out = new Float32Array(c.points.length);
    for (let i = 0; i < c.points.length; i += 2) {
      const [x, y] = f(xy(c.points[i]!, c.points[i + 1]!));
      out[i] = x;
      out[i + 1] = y;
    }
    return { points: out, closed: c.closed };
  });
  return rebuild(`${object.type}-mapped`, contours, object);
}

/** Options for {@link along}. */
export interface AlongOptions {
  /** Number of copies distributed along the path (default 8). */
  readonly count?: number;
  /** Orient each copy to the path tangent (default true). */
  readonly orient?: boolean;
}

/**
 * Distribute copies of `object` evenly along `path`, optionally oriented to the
 * path tangent (design.md §6.6). The path's first contour drives placement.
 */
export function along(
  object: IMObject2D,
  path: IMObject2D,
  options: AlongOptions = {},
): IMObject2D {
  const count = Math.max(1, options.count ?? 8);
  const orient = options.orient ?? true;
  const pathContour = path.geometry.samplePath().contours[0];
  if (!pathContour) return object;
  const pts = pathContour.points;
  const closed = pathContour.closed;
  const { cumulative } = cumulativeLengths(pts, closed);
  const total = contourTotalLength(pathContour);
  const base = objectRawContours(object);
  const contours: RawContour[] = [];

  for (let i = 0; i < count; i++) {
    const s = count === 1 ? 0 : (total * i) / (count - 1);
    const [x, y] = pointAtDistance(pts, cumulative, total, closed, s);
    const eps = Math.max(1e-4, total * 1e-3);
    const [x2, y2] = pointAtDistance(pts, cumulative, total, closed, Math.min(total, s + eps));
    const rotation = orient ? Math.atan2(y2 - y, x2 - x) : 0;
    const t: ObjectTransform2D = { position: xy(x, y), rotation };
    for (const c of base) contours.push(transformContour(c, t));
  }
  return rebuild(`${object.type}-along`, contours, object);
}

/**
 * Boolean combination of two filled polygons (design.md §6.6). Uses the single
 * contour of each object's geometry as the operand ring; best suited to simple,
 * transversally overlapping polygons (see `geometry/boolean.ts`).
 *
 * @throws IntermactError `invalid-argument` if either operand exposes more than
 * one contour. The underlying single-ring algorithm would silently drop the
 * extra rings and return a geometrically wrong result, so multi-contour inputs
 * are rejected rather than mis-combined.
 */
export function booleanOp(
  a: IMObject2D,
  b: IMObject2D,
  op: BooleanOp,
  style?: ObjectStyle,
): IMObject2D {
  const ringOf = (obj: IMObject2D, label: string): AbsXY[] => {
    const path = obj.geometry.samplePath();
    if (path.contours.length > 1) {
      throw new IntermactError(
        "invalid-argument",
        `booleanOp: operand "${label}" has ${path.contours.length} contours; only single-ring polygons are supported.`,
      );
    }
    const c = path.contours[0];
    if (!c) return [];
    const out: AbsXY[] = [];
    for (let i = 0; i < c.points.length; i += 2) out.push(xy(c.points[i]!, c.points[i + 1]!));
    return out;
  };
  const result = polygonBoolean(ringOf(a, "a"), ringOf(b, "b"), op);
  const mergedStyle: ObjectStyle = {
    fill: "rgba(96,165,250,0.5)",
    stroke: "#60a5fa",
    lineWidth: 0.02,
    ...a.style,
    ...style,
  };
  if (result.length === 0) {
    return strokeObject(
      `boolean-${op}`,
      [rawContourFromPoints([xy(0, 0), xy(0, 0)], false)],
      mergedStyle,
    );
  }
  const contours = result.map((ring) => rawContourFromPoints(ring, true));
  return shapeObject(`boolean-${op}`, contours, mergedStyle);
}
