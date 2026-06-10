import {
  type PathSampleOptions,
  type SampledContour2D,
  type SampledPath2D,
} from "./geometry-provider";
import { type AbsXY } from "../math/vec";
import { type DragBinding, type PickProxy, type PointerEventBinding } from "../interaction/types";

/**
 * Trait / capability composition (design.md §4.2). To favor "atomic composition
 * over inheritance" (user rule), object behavior is a set of traits and the
 * animation/render layers query capabilities rather than testing concrete types.
 * A new object type = a new combination of existing traits.
 */

/** Object can be stroked: provides an ordered sampled path. */
export interface StrokeTrait {
  readonly kind: "stroke";
  samplePath(opts?: PathSampleOptions): SampledPath2D;
}

/** Object can be filled: provides closed contours + a fill rule. */
export interface FillTrait {
  readonly kind: "fill";
  readonly fillRule: "nonzero" | "evenodd";
  contours(opts?: PathSampleOptions): readonly SampledContour2D[];
  /** Per-glyph groups when present (preferred for text fill). */
  fillGroups?(opts?: PathSampleOptions): readonly (readonly SampledContour2D[])[] | undefined;
  contourGlyphIndex?(): readonly number[] | undefined;
  /** Per-fill-group colors (heatmap/colored cells, design.md §6.2). */
  fillGroupColors?(): readonly string[] | undefined;
}

/** A normalized contour used for morph point alignment. */
export interface NormalizedContour {
  readonly points: Float32Array;
  readonly closed: boolean;
}

/** Anchor used to force-align corresponding features during morph. */
export interface MorphAnchor {
  readonly source: AbsXY;
  readonly target: AbsXY;
}

/** Object can act as a morph source/target. */
export interface MorphableTrait {
  readonly kind: "morphable";
  normalizedContours(): readonly NormalizedContour[];
  morphAnchors?(): readonly MorphAnchor[];
}

/** Object is defined by parameter functions; geometry recomputes on change. */
export interface ParametricTrait {
  readonly kind: "parametric";
}

/** A laid-out text/LaTeX token mapped to a part key (design.md §13). */
export interface TextToken {
  /** Matching key (token/sub-expression id) used by `transformMatchingTex`. */
  readonly key: string;
  /** Source text/atom this token renders. */
  readonly text: string;
}

/** Object carries text/LaTeX glyph layout with token → part keys (design.md §13). */
export interface TextLayoutTrait {
  readonly kind: "text-layout";
  tokens(): readonly TextToken[];
  /** Flat contour index → glyph (token) index. */
  contourGlyphIndex(): readonly number[];
  /** Glyph indices in left-to-right writing order. */
  glyphOrder(): readonly number[];
}

/** Object exposes pick-proxy geometry and pointer/drag bindings (M11, §12). */
export interface InteractiveTrait {
  readonly kind: "interactive";
  /** Invisible hit-test geometry in local space. */
  readonly pick: PickProxy;
  /** Pointer/drag callbacks. */
  readonly binding?: PointerEventBinding;
  /** Signal-backed drag behavior the host wires (draggablePoint/Value). */
  readonly drag?: DragBinding;
  /** Optional CSS cursor hint for the renderer. */
  readonly cursor?: string;
}

/**
 * A per-instance 2D placement (translate/rotate/scale about the local origin),
 * used by {@link InstancedTrait}. Structurally compatible with the pcg
 * `ObjectTransform2D` operator input, but lives in the object layer so traits
 * stay pcg-free.
 */
export interface InstanceTransform2D {
  readonly position: AbsXY;
  /** Rotation in radians. */
  readonly rotation: number;
  /** Per-axis scale `[sx, sy]`. */
  readonly scale: readonly [number, number];
}

/**
 * Single base geometry instanced across many transforms (design.md §6.6,
 * §15.2). The object also bakes the aggregated geometry into its stroke/fill
 * traits (so headless sampling, SVG, hit-testing and bounds stay correct); a
 * GPU renderer reads this trait instead to draw one geometry N times via real
 * instancing (`InstancedMesh`) rather than a single giant buffer.
 */
export interface InstancedTrait {
  readonly kind: "instanced";
  /** Per-instance transforms applied by the renderer. */
  readonly instances: readonly InstanceTransform2D[];
  /** Base stroke path in local space (one geometry, drawn per instance). */
  readonly baseStroke?: SampledPath2D;
  /** Base fill contours in local space (when the base object is fillable). */
  readonly baseFill?: readonly SampledContour2D[];
}

/**
 * Contour grouping for axes `create({ stroke: { mode: "sequential" } })` reveal
 * (design.md §7.4, §9.1). Each group is one axis line or one tick+label cluster.
 */
export interface AxesLayoutTrait {
  readonly kind: "axes-layout";
  /** Flat contour index → sequential reveal group index. */
  contourGroupIndex(): readonly number[];
  /** Number of reveal groups (axes + tick clusters). */
  groupCount(): number;
}

/**
 * 3D renderable capability marker (design.md §4.2, §5.3). Mirrors the 2D
 * stroke/fill traits so the animation/render layers dispatch on capabilities
 * rather than concrete object types: `Create` reveal mode and grouping pick the
 * right strategy from `geometryKind` instead of testing `object.type`. The
 * actual buffers live on the {@link GeometryProvider3D}; this trait only states
 * which channel is active.
 */
export interface Geometry3DTrait {
  readonly kind: "geometry-3d";
  /** Which 3D primitive channel the object exposes (renderer/Create dispatch). */
  readonly geometryKind: "line" | "mesh" | "points";
}

/** World-domain extents `[min, max]` of an embedded 2D sub-scene. */
export interface RenderedSceneDomain {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
}

/**
 * Opaque handle to an embedded sub-scene that a renderer adapter draws into an
 * offscreen texture (design.md §10.2). Produced by the scene-layer `render()`
 * and consumed by the renderer. The object/trait layer stays free of
 * animation/scene types by exposing the per-frame snapshot as `unknown` — the
 * renderer casts it back to its `RenderSnapshot`. The sub-player is assembled
 * lazily during the build pass, so {@link ready} is false until then.
 */
export interface RenderedSceneSource {
  /** Dimension of the embedded scene (currently `"2d"`). */
  readonly dimension: "2d" | "3d";
  /** World domain used to fit the offscreen camera (2D scenes). */
  readonly domain?: RenderedSceneDomain;
  /** Aspect-ratio strategy for the offscreen camera (mirrors `Scene2DProps.fit`). */
  readonly fit?: "contain" | "cover" | "stretch";
  /** Background clear color for the offscreen pass. */
  readonly background?: string;
  /** Whether the sub-player has been assembled (build pass complete). */
  readonly ready: boolean;
  /** Total sub-timeline duration in seconds (0 until ready). */
  readonly duration: number;
  /** Advance the sub-timeline by `dt` seconds (live texture mode). */
  advance(dt: number): void;
  /** Seek the sub-timeline to an absolute `time` (snapshot mode / scrubbing). */
  seek(time: number): void;
  /** Latest sub-scene render snapshot; renderer casts to its `RenderSnapshot`. */
  snapshot(): unknown;
}

/**
 * Object is a sub-scene composited as an offscreen texture (design.md §10.2,
 * §19.5). The base object also carries stroke/fill traits for a headless quad
 * fallback (SVG / bounds / hit-testing); a GL renderer reads this trait to draw
 * the live sub-scene texture instead.
 */
export interface RenderedSceneTrait {
  readonly kind: "rendered-scene";
  /** `live` re-renders every host frame; `snapshot` renders the final frame once. */
  readonly textureMode: "live" | "snapshot";
  /** Offscreen render-target resolution `[w, h]` in pixels. */
  readonly resolution: readonly [number, number];
  /** Handle to the embedded sub-scene the renderer drives. */
  readonly source: RenderedSceneSource;
}

/** Discriminated union of all object traits. */
export type ObjectTrait =
  | StrokeTrait
  | FillTrait
  | MorphableTrait
  | ParametricTrait
  | TextLayoutTrait
  | InteractiveTrait
  | InstancedTrait
  | Geometry3DTrait
  | AxesLayoutTrait
  | RenderedSceneTrait;

/** Map a trait's `kind` to its concrete interface, for `findTrait` typing. */
export interface TraitByKind {
  stroke: StrokeTrait;
  fill: FillTrait;
  morphable: MorphableTrait;
  parametric: ParametricTrait;
  "text-layout": TextLayoutTrait;
  interactive: InteractiveTrait;
  instanced: InstancedTrait;
  "geometry-3d": Geometry3DTrait;
  "axes-layout": AxesLayoutTrait;
  "rendered-scene": RenderedSceneTrait;
}

/**
 * Capability query: find a trait by kind, typed to its concrete interface.
 * Returns `undefined` when the object lacks the capability.
 */
export function findTrait<K extends ObjectTrait["kind"]>(
  traits: readonly ObjectTrait[],
  kind: K,
): TraitByKind[K] | undefined {
  return traits.find((t): t is Extract<ObjectTrait, { kind: K }> => t.kind === kind) as
    | TraitByKind[K]
    | undefined;
}

/** Whether an object advertises a given trait. */
export function hasTrait(traits: readonly ObjectTrait[], kind: ObjectTrait["kind"]): boolean {
  return traits.some((t) => t.kind === kind);
}
