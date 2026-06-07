/**
 * Reactive signals (design.md §8.1). Framework-free pub/sub cells used by
 * derived objects, tweenSignal, and external store binding.
 */

type SignalRegistrar = (sig: Signal<unknown>) => void;
let signalRegistrar: SignalRegistrar | null = null;

/** Hook used by the program build pass to auto-register created signals. */
export function setSignalRegistrar(registrar: SignalRegistrar | null): void {
  signalRegistrar = registrar;
}

/** Read-only signal interface. */
export interface ReadonlySignal<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

/** Writable signal. */
export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}

/** Internal stable id for timeline signal tracks. */
export type SignalId = number & { readonly __brand: "signal-id" };

let nextSignalId = 1;
const signalIds = new WeakMap<object, SignalId>();

/** Read the internal id assigned to a signal instance. */
export function getSignalId(sig: ReadonlySignal<unknown>): SignalId {
  const id = signalIds.get(sig as object);
  if (!id)
    throw new Error("Unknown signal instance (not created via signal/valueTracker/computed).");
  return id;
}

/** Dependency collection stack for {@link computed}. */
let activeCollector: Set<Signal<unknown>> | null = null;

function trackDependency(sig: Signal<unknown>): void {
  activeCollector?.add(sig);
}

/**
 * Create a writable signal with the given initial value.
 */
export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<(v: T) => void>();
  const id = nextSignalId++ as SignalId;

  const sig: Signal<T> = {
    get(): T {
      trackDependency(sig as Signal<unknown>);
      return value;
    },
    set(v: T): void {
      if (Object.is(value, v)) return;
      value = v;
      for (const fn of listeners) fn(value);
    },
    update(fn: (prev: T) => T): void {
      sig.set(fn(value));
    },
    subscribe(fn: (v: T) => void): () => void {
      const wrapped = () => fn(value);
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
  };

  signalIds.set(sig, id);
  signalRegistrar?.(sig as Signal<unknown>);
  return sig;
}

/** Shorthand for a numeric signal (Manim ValueTracker equivalent). */
export function valueTracker(initial: number): Signal<number> {
  return signal(initial);
}

/**
 * Derived read-only signal with automatic dependency tracking during `fn()`.
 * Any `signal.get()` invoked while `fn` runs becomes a dependency.
 */
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  let value: T;
  let deps = new Set<Signal<unknown>>();
  const recompute = (): void => {
    const collector = new Set<Signal<unknown>>();
    const prev = activeCollector;
    activeCollector = collector;
    try {
      value = fn();
    } finally {
      activeCollector = prev;
    }
    deps = collector;
  };

  recompute();

  const listeners = new Set<() => void>();
  const unsubscribers: (() => void)[] = [];

  const resubscribe = (): void => {
    unsubscribers.forEach((u) => u());
    unsubscribers.length = 0;
    for (const dep of deps) {
      unsubscribers.push(
        dep.subscribe(() => {
          recompute();
          for (const l of listeners) l();
        }),
      );
    }
  };
  resubscribe();

  const sig: ReadonlySignal<T> = {
    get(): T {
      trackDependency(sig as Signal<unknown>);
      return value;
    },
    subscribe(fn: (v: T) => void): () => void {
      const wrapped = () => fn(value);
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
  };

  signalIds.set(sig, nextSignalId++ as SignalId);
  return sig;
}
