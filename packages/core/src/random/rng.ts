/**
 * Seeded, reproducible random source (design.md §6.7). PCG generators must take
 * randomness from here rather than `Math.random()` so results are replayable and
 * shareable. M13 builds the full PCG layer on top; this is the minimal core RNG.
 */

/** Deterministic random source with derivable sub-streams. */
export interface Rng {
  /** Uniform float in [0,1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick a uniformly random element. */
  pick<T>(items: readonly T[]): T;
  /** Normal-distributed value (Box–Muller). */
  gaussian(mean?: number, std?: number): number;
  /** Derive a labeled sub-stream, locally reproducible. */
  fork(label: string): Rng;
}

function hashStringToInt(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeSeed(seed: number | string): number {
  return typeof seed === "number" ? seed >>> 0 : hashStringToInt(seed);
}

/** Create a seeded RNG (mulberry32 core). Same seed ⇒ same sequence. */
export function createRng(seed: number | string): Rng {
  let state = normalizeSeed(seed) || 1;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("Rng.pick: empty array");
      return items[Math.floor(next() * items.length)]!;
    },
    gaussian(mean = 0, std = 1): number {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * std;
    },
    fork(label: string): Rng {
      return createRng((state >>> 0) ^ hashStringToInt(label));
    },
  };
}
