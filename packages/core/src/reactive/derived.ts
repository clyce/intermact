import { type IMObject2D } from "../object/types";
import { type ReadonlySignal } from "./signal";

/**
 * A reactive geometry source: rebuilds an {@link IMObject2D} when explicit
 * dependencies change (design.md §8.2, `always_redraw` equivalent).
 */
export interface ReactiveObjectSource {
  readonly kind: "reactive-object";
  readonly deps: readonly ReadonlySignal<unknown>[];
  readonly build: () => IMObject2D;
}

/**
 * Declare a derived object from explicit signal dependencies and a build function.
 */
export function derived(
  deps: readonly ReadonlySignal<unknown>[],
  build: () => IMObject2D,
): ReactiveObjectSource {
  return { kind: "reactive-object", deps, build };
}
