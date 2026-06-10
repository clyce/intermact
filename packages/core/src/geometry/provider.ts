import {
  type Bounds2D,
  type GeometryCapability,
  type GeometryProvider2D,
  type PathSampleOptions,
  type SampledContour2D,
  type SampledPath2D,
} from "../object/geometry-provider";
import {
  type FillTrait,
  type MorphableTrait,
  type NormalizedContour,
  type StrokeTrait,
} from "../object/traits";
import { computeBounds } from "./bounds";
import { createSamplingMemo, sampleOptionsKey } from "./memoize";
import {
  cumulativeLengths,
  type RawContour,
  resampleByArcLength,
  toSampledContour,
} from "./sampling";

/** Configuration for a primitive's geometry provider. */
export interface GeometryProviderConfig {
  readonly rawContours: readonly RawContour[];
  readonly fillable: boolean;
  readonly fillRule?: "nonzero" | "evenodd";
  /** Independent fill groups (one per glyph) for correct hole handling. */
  readonly fillGroups?: readonly (readonly RawContour[])[];
  /** Flat contour index → fill group index. */
  readonly contourGlyphIndex?: readonly number[];
  /** Per-fill-group CSS colors (heatmap/colored cells, design.md §6.2). */
  readonly fillGroupColors?: readonly string[];
  /** Default resample count for `samplePath` when none is requested. */
  readonly defaultSamples?: number;
}

/**
 * Build a {@link GeometryProvider2D} from raw contours (design.md §5.1). When a
 * `samples` count is requested (or a `defaultSamples` is configured and
 * `arcLength !== false`), each contour is uniformly arc-length resampled;
 * otherwise the natural vertices are returned. Bounds are always computed from
 * the dense raw contours.
 */
export function createGeometryProvider2D(config: GeometryProviderConfig): GeometryProvider2D {
  const bounds = computeBounds(config.rawContours);
  const capabilities: GeometryCapability[] = ["stroke", "buffer"];
  if (config.fillable) capabilities.push("fill");

  const sampleContours = (opts?: PathSampleOptions): SampledContour2D[] => {
    const count = opts?.samples ?? config.defaultSamples;
    const useResample = count !== undefined && opts?.arcLength !== false;
    return config.rawContours.map((raw) => {
      const points = useResample ? resampleByArcLength(raw.points, raw.closed, count) : raw.points;
      return toSampledContour(points, raw.closed);
    });
  };

  const fillGroupsRaw = config.fillGroups;
  const sampleFillGroupsRaw = (opts?: PathSampleOptions): SampledContour2D[][] | null => {
    if (!fillGroupsRaw?.length) return null;
    const count = opts?.samples ?? config.defaultSamples;
    const useResample = count !== undefined && opts?.arcLength !== false;
    return fillGroupsRaw.map((group) =>
      group.map((raw) => {
        const points = useResample
          ? resampleByArcLength(raw.points, raw.closed, count)
          : raw.points;
        return toSampledContour(points, raw.closed);
      }),
    );
  };

  // Memoize the (immutable) definition's sampling by sampleOptions so repeated
  // per-frame sampling is O(1) after the first call (design.md §15.2 #1).
  const pathMemo = createSamplingMemo<SampledPath2D>();
  const fillGroupMemo = createSamplingMemo<SampledContour2D[][] | null>();
  const samplePath = (opts?: PathSampleOptions): SampledPath2D =>
    pathMemo.get(sampleOptionsKey(opts), () => {
      const contours = sampleContours(opts);
      const totalLength = contours.reduce(
        (sum, c) => sum + cumulativeLengths(c.points, c.closed).total,
        0,
      );
      return { contours, totalLength };
    });

  return {
    capabilities,
    samplePath,
    getBounds(): Bounds2D {
      return bounds;
    },
    sampleBuffer(opts?: PathSampleOptions): Float32Array {
      return samplePath(opts).contours[0]?.points ?? new Float32Array(0);
    },
    sampleFillGroups(opts?: PathSampleOptions): SampledContour2D[][] | null {
      return fillGroupMemo.get(sampleOptionsKey(opts), () => sampleFillGroupsRaw(opts));
    },
    contourGlyphIndex(): readonly number[] | null {
      return config.contourGlyphIndex ?? null;
    },
    fillGroupColors(): readonly string[] | null {
      return config.fillGroupColors ?? null;
    },
  };
}

/** Stroke trait backed by a geometry provider. */
export function strokeTraitFrom(provider: GeometryProvider2D): StrokeTrait {
  return { kind: "stroke", samplePath: (opts) => provider.samplePath(opts) };
}

/** Fill trait backed by a geometry provider. */
export function fillTraitFrom(
  provider: GeometryProvider2D,
  fillRule: "nonzero" | "evenodd",
): FillTrait {
  return {
    kind: "fill",
    fillRule,
    contours: (opts) => provider.samplePath(opts).contours.filter((c) => c.closed),
    fillGroups: (opts) => provider.sampleFillGroups?.(opts) ?? undefined,
    contourGlyphIndex: () => provider.contourGlyphIndex?.() ?? undefined,
    fillGroupColors: () => provider.fillGroupColors?.() ?? undefined,
  };
}

/** Morphable trait exposing normalized contours from a provider. */
export function morphableTraitFrom(
  provider: GeometryProvider2D,
  defaultSamples: number,
): MorphableTrait {
  return {
    kind: "morphable",
    normalizedContours(): readonly NormalizedContour[] {
      return provider
        .samplePath({ samples: defaultSamples })
        .contours.map((c) => ({ points: c.points, closed: c.closed }));
    },
  };
}
