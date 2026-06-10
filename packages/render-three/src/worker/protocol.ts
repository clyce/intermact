import { type SvgPathParseOptions } from "@intermact/core";

/**
 * Compute-worker protocol (design.md §15.2 #6). The CPU-heavy steps that the
 * renderer drives — arc-length resampling, triangulation, isosurface
 * polygonization, and SVG/LaTeX glyph-path parsing — are all *pure* functions in
 * `@intermact/core`. This protocol carries their fully serializable inputs and
 * outputs (flat typed arrays / strings, no closures) so the same job can run
 * either in-process or off the main thread in a Worker. core stays DOM-free; all
 * Worker glue lives here in `render-three` (the plan: "worker glue in render-*").
 */

/** A flat 2D contour (interleaved xy + closed flag). */
export interface FlatContour {
  readonly points: Float32Array;
  readonly closed: boolean;
}

/** A unit of offloadable work. */
export type ComputeJob =
  | {
      readonly kind: "resample";
      readonly points: Float32Array;
      readonly closed: boolean;
      readonly count: number;
    }
  | { readonly kind: "triangulate"; readonly contours: readonly FlatContour[] }
  | {
      readonly kind: "marching-cubes";
      readonly field: Float64Array;
      readonly dims: readonly [number, number, number];
      readonly min: readonly [number, number, number];
      readonly max: readonly [number, number, number];
      readonly level?: number;
    }
  | { readonly kind: "parse-svg-path"; readonly d: string; readonly options?: SvgPathParseOptions };

/** The result of a {@link ComputeJob}, discriminated by the same `kind`. */
export type ComputeResult =
  | { readonly kind: "resample"; readonly points: Float32Array }
  | { readonly kind: "triangulate"; readonly vertices: Float32Array; readonly indices: Uint32Array }
  | {
      readonly kind: "marching-cubes";
      readonly positions: Float32Array;
      readonly indices: Uint32Array;
      readonly normals?: Float32Array;
    }
  | { readonly kind: "parse-svg-path"; readonly contours: readonly FlatContour[] };

/** Narrow a {@link ComputeResult} to the variant produced by job kind `K`. */
export type ResultFor<K extends ComputeJob["kind"]> = Extract<ComputeResult, { kind: K }>;

/** A request envelope (id correlates the response). */
export interface ComputeRequest {
  readonly id: number;
  readonly job: ComputeJob;
}

/** A response envelope: success carries the result, failure carries a message. */
export type ComputeResponse =
  | { readonly id: number; readonly ok: true; readonly result: ComputeResult }
  | { readonly id: number; readonly ok: false; readonly error: string };
