import { useEffect, useState } from "react";
import {
  buildProgram,
  serialize,
  type BuildOptions,
  type IntermactProgram,
  type SerializedProject,
} from "@intermact/core";

/**
 * Build a program once and serialize it to a {@link SerializedProject}
 * (design.md §17). Shared by the export/embed examples so they exercise the real
 * `buildProgram` → `serialize` path, then mount the result via `SerializedCanvas`
 * / `<intermact-embed>`. Returns `null` until the async build resolves.
 */
export function useSerializedDemo(
  program: IntermactProgram,
  options?: BuildOptions,
): SerializedProject | null {
  const [project, setProject] = useState<SerializedProject | null>(null);
  useEffect(() => {
    let alive = true;
    buildProgram(program, options).then(
      (built) => {
        if (alive) setProject(serialize(built.player));
      },
      (err) => console.error("[intermact] serialize demo build failed:", err),
    );
    return () => {
      alive = false;
    };
  }, [program]);
  return project;
}
