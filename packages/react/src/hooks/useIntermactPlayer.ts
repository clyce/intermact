import { useEffect, useState } from "react";
import {
  buildProgram,
  disposeBuiltProgram,
  type AssetFetcher,
  type BinaryAssetFetcher,
  type BuiltProgram,
  type IntermactProgram,
} from "@intermact/core";

/** Options for {@link useIntermactPlayer}. */
export interface UseIntermactPlayerOptions {
  /** Seed for the program RNG (same seed ⇒ same output). */
  readonly seed?: number | string;
  /** Resolve text assets during the build pass (SVG, JSON). */
  readonly fetcher?: AssetFetcher;
  /** Resolve binary font assets during the build pass. */
  readonly fetchBinary?: BinaryAssetFetcher;
}

/**
 * Run a program's build pass and return the resulting {@link BuiltProgram}
 * (player + scene + viewports), or `null` until the async build completes.
 * Disposes the previous built program when `program`/`seed` changes or on unmount.
 */
export function useIntermactPlayer(
  program: IntermactProgram,
  options?: UseIntermactPlayerOptions,
): BuiltProgram | null {
  const [built, setBuilt] = useState<BuiltProgram | null>(null);
  const seed = options?.seed;
  const fetcher = options?.fetcher;
  const fetchBinary = options?.fetchBinary;

  useEffect(() => {
    let alive = true;
    let current: BuiltProgram | null = null;
    buildProgram(program, { ...(seed !== undefined ? { seed } : {}), fetcher, fetchBinary }).then(
      (b) => {
        if (alive) {
          current = b;
          setBuilt(b);
        } else {
          disposeBuiltProgram(b);
        }
      },
      (err) => {
        // A silent rejection here would leave the canvas stuck on "Building…".
        console.error("[intermact] program build failed:", err);
      },
    );
    return () => {
      alive = false;
      if (current) disposeBuiltProgram(current);
    };
  }, [program, seed, fetcher, fetchBinary]);

  return built;
}
