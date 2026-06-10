/**
 * Registry bundle construction and the ambient global registries (design.md
 * §18). {@link createRegistries} builds an isolated set (handy for tests);
 * {@link globalRegistries} is the process-wide default that core dispatch sites
 * consult, so a plugin installed once is visible everywhere without threading a
 * registries object through every call site.
 */
import { Registry } from "./registry";
import {
  type GeneratorDescriptor,
  type ObjectTypeDescriptor,
  type Registries,
  type RendererFactory,
} from "./types";
import { type AnimationCompiler } from "../animation/track";

/** Create a fresh, empty {@link Registries} bundle. */
export function createRegistries(): Registries {
  return {
    objects: new Registry<string, ObjectTypeDescriptor>(),
    animations: new Registry<string, AnimationCompiler>(),
    generators: new Registry<string, GeneratorDescriptor>(),
    renderers: new Registry<string, RendererFactory>(),
  };
}

/**
 * Cross-realm key so a duplicated module instance (the classic `src` + `dist`
 * double-load, see `examples/vite.config.ts`) shares one registry instead of a
 * split-brain pair where a plugin installed via one instance is invisible to the
 * other.
 */
const GLOBAL_KEY = Symbol.for("@intermact/core/globalRegistries");

interface RegistryHostScope {
  [GLOBAL_KEY]?: Registries;
}

function resolveGlobalRegistries(): Registries {
  const scope = globalThis as unknown as RegistryHostScope;
  const existing = scope[GLOBAL_KEY];
  if (existing) {
    // A second @intermact/core instance is loading. Share the first's registry
    // and warn — for true isolation pass `BuildOptions.registries` (design.md §22.8).
    if (typeof console !== "undefined") {
      console.warn(
        "[intermact] Multiple @intermact/core instances detected; sharing one global " +
          "registry. Dedupe the dependency, or pass an explicit `registries` bundle to " +
          "buildProgram/deserialize for isolation.",
      );
    }
    return existing;
  }
  const created = createRegistries();
  scope[GLOBAL_KEY] = created;
  return created;
}

/**
 * The ambient registries consulted by built-in dispatch (custom-animation
 * compilation, generator/object/backend lookup helpers). Plugins installed via
 * {@link installPlugin} without an explicit target land here. Stored on
 * `globalThis` (keyed by a shared {@link Symbol.for}) so duplicate module
 * instances converge on one bundle rather than silently diverging.
 *
 * For isolated builds (multiple programs, distinct plugin sets, parallel tests)
 * prefer an explicit {@link createRegistries} bundle threaded via
 * `BuildOptions.registries` / `DeserializeOptions.registries`.
 */
export const globalRegistries: Registries = resolveGlobalRegistries();
