import { useEffect, useState } from "react";
import { type ReadonlySignal } from "@intermact/core";

/**
 * Subscribe a React component to a core {@link ReadonlySignal} (design.md §8.3).
 */
export function useSignal<T>(sig: ReadonlySignal<T>): T {
  const [value, setValue] = useState(sig.get());
  useEffect(() => sig.subscribe(setValue), [sig]);
  return value;
}
