import { useMemo } from "react";
import {
  decodeShareUrl,
  degradeForReducedMotion,
  deserialize,
  type DeserializedProgram,
  type SerializedProject,
} from "@intermact/core";

/** A serialized project, either as data or an encoded share-url string. */
export type ProjectInput = SerializedProject | string;

/** Options for {@link useDeserializedProject}. */
export interface UseDeserializedProjectOptions {
  /** Collapse the timeline to its end-state (no motion). */
  readonly reducedMotion?: boolean;
}

function resolveProject(input: ProjectInput): SerializedProject {
  return typeof input === "string" ? decodeShareUrl(input) : input;
}

/**
 * Deserialize a {@link SerializedProject} (or share-url string) into a playable
 * {@link DeserializedProgram} (design.md §17). Memoized on the input + reduced
 * -motion flag, so a new Player is built only when the project changes. Pass
 * `reducedMotion` to mount the motion-free (end-state) variant.
 */
export function useDeserializedProject(
  input: ProjectInput,
  options: UseDeserializedProjectOptions = {},
): DeserializedProgram {
  const reduced = options.reducedMotion ?? false;
  return useMemo(() => {
    const project = resolveProject(input);
    return deserialize(reduced ? degradeForReducedMotion(project) : project);
  }, [input, reduced]);
}
