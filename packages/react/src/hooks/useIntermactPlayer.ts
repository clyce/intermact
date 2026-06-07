import { useEffect, useState } from "react";
import { buildProgram, type BuiltProgram, type IntermactProgram } from "@intermact/core";

/** Options for {@link useIntermactPlayer}. */
export interface UseIntermactPlayerOptions {
  /** Seed for the program RNG (same seed ⇒ same output). */
  readonly seed?: number | string;
}

/**
 * Run a program's build pass and return the resulting {@link BuiltProgram}
 * (player + scene + viewports), or `null` until the async build completes.
 */
export function useIntermactPlayer(
  program: IntermactProgram,
  options?: UseIntermactPlayerOptions,
): BuiltProgram | null {
  const [built, setBuilt] = useState<BuiltProgram | null>(null);
  const seed = options?.seed;

  useEffect(() => {
    let alive = true;
    void buildProgram(program, seed !== undefined ? { seed } : {}).then((b) => {
      if (alive) setBuilt(b);
    });
    return () => {
      alive = false;
    };
  }, [program, seed]);

  return built;
}
