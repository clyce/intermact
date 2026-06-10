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

/** Axis-aligned bounding box in 3D world space (M14). */
export interface Bounds3D {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly center: readonly [number, number, number];
}

/** Options controlling path sampling density. */
export interface PathSampleOptions {
  /** Target number of samples per contour (provider may adapt). */
  readonly samples?: number;
  /** Resample uniformly by arc length (default true). */
  readonly arcLength?: boolean;
}

/** Capabilities a geometry provider advertises. */
export type GeometryCapability = "stroke" | "fill" | "buffer" | "line" | "mesh" | "points";

/** 2D geometry provider: how an object is sampled and bounded. */
export interface GeometryProvider2D {
  readonly capabilities: readonly GeometryCapability[];
  samplePath(opts?: PathSampleOptions): SampledPath2D;
  getBounds(): Bounds2D;
  /** Performance channel: interleaved buffer, avoiding per-point allocation. */
  sampleBuffer?(opts?: PathSampleOptions): Float32Array;
  /** Optional wider contour path rendered as {@link ObjectStyle.underlayFill}. */
  sampleUnderlayPath?(opts?: PathSampleOptions): SampledPath2D | null;
  /** Per-glyph fill groups (text/LaTeX); triangulated independently. */
  sampleFillGroups?(opts?: PathSampleOptions): SampledContour2D[][] | null;
  /** Flat contour index → glyph index for sequential write reveal. */
  contourGlyphIndex?(): readonly number[] | null;
  /**
   * Per-fill-group CSS colors (design.md §6.2 heatmap). When present, the
   * renderer fills each group with its own color instead of `style.fill`.
   */
  fillGroupColors?(): readonly string[] | null;
}

/** A single sampled 3D polyline (one connected curve / edge loop). */
export interface SampledPolyline3D {
  /** Interleaved coordinates `[x0,y0,z0,x1,y1,z1,...]`. */
  readonly points: Float32Array;
  readonly closed: boolean;
  /** Arc-length prefix sums, used for 3D Create stroke reveal/trim. */
  readonly cumulativeLength: Float32Array;
}

/** A sampled triangle mesh (positions + triangle indices, optional normals). */
export interface SampledMesh3D {
  /** Interleaved vertex positions `[x,y,z,...]`. */
  readonly positions: Float32Array;
  /** Triangle indices (three per face) into {@link positions}. */
  readonly indices: Uint32Array;
  /** Optional per-vertex normals `[nx,ny,nz,...]`; renderer computes if absent. */
  readonly normals?: Float32Array;
}

/** A sampled point cloud (positions, optional per-point scalar for coloring). */
export interface SampledPoints3D {
  /** Interleaved point positions `[x,y,z,...]`. */
  readonly positions: Float32Array;
  /** Optional per-point scalar in [0,1] for color-ramp mapping. */
  readonly scalars?: Float32Array;
}

/** What kind of primitive a 3D provider exposes (renderer dispatch). */
export type Geometry3DKind = "line" | "mesh" | "points";

/**
 * 3D geometry provider (design.md §5.3). Like {@link GeometryProvider2D}, it
 * answers "how is this sampled / bounded". A provider exposes exactly one of the
 * line / mesh / points channels (advertised via {@link kind}); the renderer
 * dispatches on `kind`.
 */
export interface GeometryProvider3D {
  readonly capabilities: readonly GeometryCapability[];
  /** Primary primitive kind for renderer dispatch. */
  readonly kind: Geometry3DKind;
  getBounds(): Bounds3D;
  /** Line channel: one or more polylines (curves, axes, edge loops). */
  sampleLines?(): readonly SampledPolyline3D[];
  /** Mesh channel: a single triangle mesh (surface, isosurface, meshObject). */
  sampleMesh?(): SampledMesh3D | null;
  /** Points channel: a point cloud. */
  samplePoints?(): SampledPoints3D | null;
  /** Total arc length across line contours (for Create reveal pacing). */
  totalLength?(): number;
}
