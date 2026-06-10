/**
 * Generic, type-safe extension registry (design.md §18). A {@link Registry} maps
 * a string key to a value (an object/animation/generator/renderer descriptor).
 * Plugins {@link Registry.register} into it during {@link IntermactPlugin.install};
 * core dispatch sites look values up by key, so new capabilities are added
 * without editing core call sites.
 *
 * The registry is intentionally tiny and free of any framework/DOM dependency so
 * it can live in `@intermact/core` and be shared by every renderer adapter.
 */
import { IntermactError } from "../errors";

/** Options accepted by {@link Registry.register}. */
export interface RegisterOptions {
  /**
   * Replace an existing entry instead of throwing. Defaults to `false` so that
   * accidental duplicate registrations (e.g. installing a plugin twice) fail
   * loudly rather than silently clobbering a built-in.
   */
  readonly override?: boolean;
}

/**
 * A keyed collection of extension descriptors. Generic over the key type `K`
 * (almost always `string`) and the value type `V`.
 */
export class Registry<K, V> {
  private readonly entries = new Map<K, V>();

  /**
   * Register `value` under `key`. Throws `plugin-error` if the key already
   * exists unless `{ override: true }` is passed.
   */
  register(key: K, value: V, options: RegisterOptions = {}): this {
    if (!options.override && this.entries.has(key)) {
      throw new IntermactError(
        "plugin-error",
        `Registry already has an entry for "${String(key)}". Pass { override: true } to replace it.`,
        { key },
      );
    }
    this.entries.set(key, value);
    return this;
  }

  /** Look up an entry; returns `undefined` when absent. */
  get(key: K): V | undefined {
    return this.entries.get(key);
  }

  /**
   * Look up an entry, throwing `plugin-error` when absent. Use at dispatch sites
   * that require the entry to exist.
   */
  require(key: K): V {
    const value = this.entries.get(key);
    if (value === undefined) {
      throw new IntermactError(
        "plugin-error",
        `No registry entry for "${String(key)}". Install a plugin that registers it (design.md §18).`,
        { key },
      );
    }
    return value;
  }

  /** Whether an entry exists for `key`. */
  has(key: K): boolean {
    return this.entries.has(key);
  }

  /** Remove an entry; returns whether one was present. */
  unregister(key: K): boolean {
    return this.entries.delete(key);
  }

  /** All registered keys (insertion order). */
  keys(): K[] {
    return [...this.entries.keys()];
  }

  /** All registered values (insertion order). */
  values(): V[] {
    return [...this.entries.values()];
  }

  /** All `[key, value]` pairs (insertion order). */
  entriesList(): [K, V][] {
    return [...this.entries.entries()];
  }

  /** Number of registered entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Drop every entry (mainly for test isolation). */
  clear(): void {
    this.entries.clear();
  }
}
