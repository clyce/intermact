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

type BuildDeps = {
  program: IntermactProgram;
  seed: number | string | undefined;
  fetcher: AssetFetcher | undefined;
  fetchBinary: BinaryAssetFetcher | undefined;
};

/**
 * Run a program's build pass and return the resulting {@link BuiltProgram}
 * (player + scene + viewports), or `null` while the async build is in flight.
 * Disposes the previous built program when `program` changes or on unmount.
 *
 * React StrictMode runs effects twice in dev; we avoid clearing `built` or
 * disposing the player on the first effect's cleanup so slow builds (LaTeX,
 * fonts) are not stuck on "Building…".
 */
export function useIntermactPlayer(
  program: IntermactProgram,
  options?: UseIntermactPlayerOptions,
): BuiltProgram | null {
  const [built, setBuilt] = useState<BuiltProgram | null>(null);
  const builtRef = useRef<BuiltProgram | null>(null);
  const buildGen = useRef(0);
  const depsRef = useRef<BuildDeps | null>(null);
  const seed = options?.seed;
  const fetcher = options?.fetcher;
  const fetchBinary = options?.fetchBinary;

  useEffect(() => {
    let cancelled = false;
    const prev = depsRef.current;
    const programChanged = prev !== null && prev.program !== program;
    depsRef.current = { program, seed, fetcher, fetchBinary };

    if (programChanged) {
      setBuilt(null);
    }

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
        if (!cancelled && run === buildGen.current) {
          console.error("[intermact] program build failed:", err);
          setBuilt(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [program, seed, fetcher, fetchBinary]);

  useEffect(() => {
    return () => {
      if (builtRef.current) {
        disposeBuiltProgram(builtRef.current);
        builtRef.current = null;
      }
    };
  }, []);

  return built;
}
