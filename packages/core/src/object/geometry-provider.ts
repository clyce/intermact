import { type AbsXY, type Vec2 } from "../math/vec";

/**
 * Geometry sampling contracts (design.md §5.1). The concrete providers are
 * implemented in milestone M2; M1 only depends on these interfaces so the
 * object model and renderer snapshot can be typed.
 *
 * Two channels are provided: an ergonomic tuple channel for authoring and a
 * `Float32Array` buffer channel for performance / large data.
 */

/** A single sampled contour (one connected stroke / one fill ring). */
export interface SampledContour2D {
  /** Interleaved coordinates `[x0,y0,x1,y1,...]`. */
  readonly points: Float32Array;
  /** Whether the contour is closed (last point connects to first). */
  readonly closed: boolean;
  /** Arc-length prefix sums, used for stroke reveal / trim and morph alignment. */
  readonly cumulativeLength: Float32Array;
}

/** A sampled path: one or more contours plus total arc length. */
export interface SampledPath2D {
  readonly contours: readonly SampledContour2D[];
  readonly totalLength: number;
}

/** Axis-aligned bounding box in world space. */
export interface Bounds2D {
  readonly min: AbsXY;
  readonly max: AbsXY;
  readonly size: Vec2;
  readonly center: AbsXY;
}

/** Options controlling path sampling density. */
export interface PathSampleOptions {
  /** Target number of samples per contour (provider may adapt). */
  readonly samples?: number;
  /** Resample uniformly by arc length (default true). */
  readonly arcLength?: boolean;
}

/** Capabilities a geometry provider advertises. */
export type GeometryCapability = "stroke" | "fill" | "buffer";

/** 2D geometry provider: how an object is sampled and bounded. */
export interface GeometryProvider2D {
  readonly capabilities: readonly GeometryCapability[];
  samplePath(opts?: PathSampleOptions): SampledPath2D;
  getBounds(): Bounds2D;
  /** Performance channel: interleaved buffer, avoiding per-point allocation. */
  sampleBuffer?(opts?: PathSampleOptions): Float32Array;
}

/** 3D geometry provider (mesh / surface / point cloud). Implemented in M14. */
export interface GeometryProvider3D {
  readonly capabilities: readonly GeometryCapability[];
  getBounds(): Bounds2D;
}
