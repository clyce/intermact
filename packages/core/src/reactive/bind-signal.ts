import { type ReactiveEngine } from "./engine";
import { type Signal } from "./signal";

/** Minimal external store shape for two-way binding (design.md §8.3). */
export interface ExternalStore<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
  set(v: T): void;
}

/**
 * Bind a signal to an external store (Leva, jotai, etc.). Returns an unsubscribe
 * that tears down both directions.
 */
export function bindSignal<T>(
  sig: Signal<T>,
  external: ExternalStore<T>,
  engine?: ReactiveEngine,
): () => void {
  sig.set(external.get());
  engine?.notifySignal(sig);

  const unsubExternal = external.subscribe(() => {
    sig.set(external.get());
    engine?.notifySignal(sig);
  });

  const unsubSignal = sig.subscribe((v) => {
    if (!Object.is(external.get(), v)) external.set(v);
  });

  return () => {
    unsubExternal();
    unsubSignal();
  };
}
