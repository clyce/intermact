/**
 * Plugin authoring/installation and registry-driven dispatch helpers (design.md
 * §18). {@link definePlugin} is an identity helper that pins the
 * {@link IntermactPlugin} type at the call site; {@link installPlugin} runs a
 * plugin's `install` hook against a {@link Registries} (the {@link globalRegistries}
 * by default). The `create*`/`run*`/`select*` helpers are the lookup-by-key
 * dispatch entry points users call after installing plugins.
 */
import { IntermactError } from "../errors";
import { type IMObject, type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { globalRegistries } from "./registries";
import {
  type GeneratorDescriptor,
  type IntermactPlugin,
  type ObjectTypeDescriptor,
  type Registries,
} from "./types";

/**
 * Identity helper that types a plugin definition (design.md §18). Use it so the
 * `install` hook's `registries` parameter is inferred and the object shape is
 * checked at the definition site.
 */
export function definePlugin(plugin: IntermactPlugin): IntermactPlugin {
  return plugin;
}

/**
 * Identity helper that pins a custom {@link ObjectTypeDescriptor}'s parameter
 * type `P` at the definition site (design.md §18), so `create(params)` is typed
 * for plugin authors. The registry erases `P` to `unknown` when stored, but the
 * descriptor object you keep a reference to stays fully typed.
 */
export function defineObjectType<P>(descriptor: ObjectTypeDescriptor<P>): ObjectTypeDescriptor<P> {
  return descriptor;
}

/**
 * Identity helper that pins a {@link GeneratorDescriptor}'s parameter type `P`
 * at the definition site (design.md §18), mirroring {@link defineObjectType}.
 */
export function defineGenerator<P>(descriptor: GeneratorDescriptor<P>): GeneratorDescriptor<P> {
  return descriptor;
}

/**
 * Install a plugin by running its {@link IntermactPlugin.install} hook against
 * `registries` (defaults to {@link globalRegistries}). Returns the plugin so
 * calls can be chained/collected.
 */
export function installPlugin(
  plugin: IntermactPlugin,
  registries: Registries = globalRegistries,
): IntermactPlugin {
  plugin.install(registries);
  return plugin;
}

/** Install several plugins in order. */
export function installPlugins(
  plugins: readonly IntermactPlugin[],
  registries: Registries = globalRegistries,
): void {
  for (const plugin of plugins) installPlugin(plugin, registries);
}

/**
 * Construct an object from a registered {@link ObjectTypeDescriptor} by `type`
 * (design.md §18). Throws `plugin-error` if no descriptor is registered.
 */
export function createRegisteredObject<P = unknown>(
  type: string,
  params: P,
  registries: Registries = globalRegistries,
): IMObject {
  const descriptor = registries.objects.require(type);
  return descriptor.create(params);
}

/**
 * Run a registered {@link GeneratorDescriptor} by `name` (design.md §18). Throws
 * `plugin-error` if no generator is registered.
 */
export function runGenerator<P = unknown>(
  name: string,
  params: P,
  rng: Rng,
  registries: Registries = globalRegistries,
): IMObject2D | IMObject {
  const descriptor = registries.generators.require(name);
  return descriptor.generate(params, rng);
}

/**
 * Select a renderer backend factory by `name`, falling back to the first
 * supported entry in `preferred` order. Returns `undefined` when none are
 * registered/supported so the caller can use its built-in default.
 */
export function selectRenderer(
  preferred: readonly string[],
  registries: Registries = globalRegistries,
): string | undefined {
  for (const name of preferred) {
    const factory = registries.renderers.get(name);
    if (factory && (factory.isSupported?.() ?? true)) return name;
  }
  return undefined;
}

/** Assert a renderer backend exists and is supported (throws `plugin-error`). */
export function requireRenderer(name: string, registries: Registries = globalRegistries): void {
  const factory = registries.renderers.require(name);
  if (factory.isSupported && !factory.isSupported()) {
    throw new IntermactError(
      "plugin-error",
      `Renderer backend "${name}" is registered but not supported in this environment.`,
      { name },
    );
  }
}
