import { type GeometryProvider2D, type GeometryProvider3D } from "./geometry-provider";
import { type ObjectMetadata, type ObjectStyle } from "./style";
import { type ObjectTrait } from "./traits";

/**
 * Immutable object definitions (design.md §4.1). A definition only answers
 * "what is it / how is it sampled / how does it look by default". It is
 * immutable data: structurally shareable, cacheable, serializable. Animations
 * never mutate definitions; they write RuntimeState (§4.3).
 */

export type Dimension = "2d" | "3d";

/** Common shape of every object definition. */
export interface IMObjectBase<TDimension extends Dimension> {
  /** Registry key for render/serialize dispatch. */
  readonly type: string;
  readonly dimension: TDimension;
  /** Composed capabilities (§4.2). */
  readonly traits: readonly ObjectTrait[];
  readonly style?: ObjectStyle;
  /** Semantic layer metadata (§17). */
  readonly metadata?: ObjectMetadata;
}

/** A 2D object definition. */
export interface IMObject2D extends IMObjectBase<"2d"> {
  readonly geometry: GeometryProvider2D;
}

/** A 3D object definition (full set lands in M14). */
export interface IMObject3D extends IMObjectBase<"3d"> {
  readonly geometry: GeometryProvider3D;
}

/** Any object definition. */
export type IMObject = IMObject2D | IMObject3D;

/** Narrowing helper for 2D objects. */
export function isObject2D(object: IMObject): object is IMObject2D {
  return object.dimension === "2d";
}

/** Narrowing helper for 3D objects. */
export function isObject3D(object: IMObject): object is IMObject3D {
  return object.dimension === "3d";
}
