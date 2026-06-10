import { type PathSampleOptions } from "../object/geometry-provider";

/**
 * Sampling memoization (design.md §15.2 #1). Object definitions are immutable,
 * so a definition's sampled geometry depends only on `(object, geometryVersion,
 * sampleOptions)`. Each geometry provider owns one immutable definition; caching
 * its sampling by the `sampleOptions` key therefore realizes the full
 * `(object, geometryVersion, opts)` memo — a new definition (geometry change)
 * gets a new provider and a new cache. This avoids re-running arc-length
 * resampling/triangulation every frame when nothing changed.
 */

/** Cache hit/miss counters, exposed for perf tests and the inspector. */
export interface SamplingMemoStats {
  hits: number;
  misses: number;
}

/** A tiny keyed memo over a single immutable definition's sampling. */
export interface SamplingMemo<T> {
  /** Return the cached value for `key`, computing and storing it on a miss. */
  get(key: string, compute: () => T): T;
  /** Live hit/miss counters. */
  readonly stats: SamplingMemoStats;
  /** Drop all cached values (e.g. on memory pressure). */
  clear(): void;
}

/** Create an empty {@link SamplingMemo}. */
export function createSamplingMemo<T>(): SamplingMemo<T> {
  const cache = new Map<string, T>();
  const stats: SamplingMemoStats = { hits: 0, misses: 0 };
  return {
    stats,
    get(key, compute) {
      if (cache.has(key)) {
        stats.hits++;
        return cache.get(key)!;
      }
      stats.misses++;
      const value = compute();
      cache.set(key, value);
      return value;
    },
    clear() {
      cache.clear();
    },
  };
}

/** Stable cache key for a {@link PathSampleOptions} (the only per-call variable). */
export function sampleOptionsKey(opts?: PathSampleOptions): string {
  const samples = opts?.samples ?? "natural";
  const arc = opts?.arcLength === false ? "raw" : "arc";
  return `${samples}:${arc}`;
}
