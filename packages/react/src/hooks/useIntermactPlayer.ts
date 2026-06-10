import { useEffect, useRef, useState } from "react";
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
 * (player + scene + viewports), or `null` while the async build is in flight.
 * Disposes the previous built program when `program`/`seed` changes or on unmount.
 */
export function useIntermactPlayer(
  program: IntermactProgram,
  options?: UseIntermactPlayerOptions,
): BuiltProgram | null {
  const [built, setBuilt] = useState<BuiltProgram | null>(null);
  const builtRef = useRef<BuiltProgram | null>(null);
  const buildGen = useRef(0);
  const seed = options?.seed;
  const fetcher = options?.fetcher;
  const fetchBinary = options?.fetchBinary;

  useEffect(() => {
    let cancelled = false;
    setBuilt(null);

    const run = ++buildGen.current;
    buildProgram(program, { ...(seed !== undefined ? { seed } : {}), fetcher, fetchBinary })
      .then((b) => {
        if (cancelled || run !== buildGen.current) {
          disposeBuiltProgram(b);
          return;
        }
        if (builtRef.current) disposeBuiltProgram(builtRef.current);
        builtRef.current = b;
        setBuilt(b);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[intermact] program build failed:", err);
          setBuilt(null);
        }
      });

    return () => {
      cancelled = true;
      if (builtRef.current) {
        disposeBuiltProgram(builtRef.current);
        builtRef.current = null;
      }
    };
  }, [program, seed, fetcher, fetchBinary]);

  return built;
}
