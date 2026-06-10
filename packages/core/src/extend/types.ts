/**
 * Extension descriptor contracts and the {@link Registries} bundle (design.md
 * §18). These are the shapes a plugin registers so that new object types,
 * animation kinds, PCG generators, and renderer backends can be added without
 * touching core dispatch code.
 *
 * Descriptors are generic over their parameter type `P` so plugin authors get
 * typed `create`/`generate` calls; the bundled {@link Registries} stores them at
 * the erased `unknown` parameter so heterogeneous descriptors can coexist.
 */
import { type AnimationCompiler } from "../animation/track";
import { type IMObject, type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { type Registry } from "./registry";

/**
 * Describes a custom object type: how to construct an immutable {@link IMObject}
 * from parameters. Because Intermact objects are trait-composed (design.md §4.2),
 * a plugin object that returns existing stroke/fill/instanced traits renders,
 * samples, and hit-tests through the standard pipeline with no renderer changes.
 */
export interface ObjectTypeDescriptor<P = unknown> {
  /** Registry key, also written onto the produced object's `type`. */
  readonly type: string;
  /** Optional human-readable summary for tooling/inspector. */
  readonly description?: string;
  /** Build an immutable object definition from `params`. */
  create(params: P): IMObject;
}

/**
 * Describes a PCG generator: a pure `(params, rng) => IMObject` function plus its
 * registry name. Randomness must flow through the injected {@link Rng}
 * (design.md §6.7) so output stays reproducible.
 */
export interface GeneratorDescriptor<P = unknown> {
  /** Registry key. */
  readonly name: string;
  /** Optional human-readable summary for tooling. */
  readonly description?: string;
  /** Generate an immutable object (2D by default) from `params` and `rng`. */
  generate(params: P, rng: Rng): IMObject2D | IMObject;
}

/**
 * Describes a renderer backend factory (e.g. a WebGPU backend). Kept abstract in
 * core (which is renderer-free): `create` returns a `TBackend` the host renderer
 * adapter understands. Selecting a backend = looking its factory up by name in
 * {@link Registries.renderers}.
 */
export interface RendererFactory<TBackend = unknown, TOptions = unknown> {
  /** Registry key, e.g. `"webgl"` or `"webgpu"`. */
  readonly name: string;
  /** Optional human-readable summary for tooling. */
  readonly description?: string;
  /**
   * Whether this backend can run in the current environment (e.g. feature-detect
   * `navigator.gpu`). Defaults to always-available when omitted.
   */
  isSupported?(): boolean;
  /** Construct the backend from host-supplied options. */
  create(options: TOptions): TBackend;
}

/**
 * The four extension points of the system (design.md §18). New primitives,
 * generators, animations, and render backends all plug in here.
 */
export interface Registries {
  /** `type -> ` object construction/sampling/serialize mapping. */
  readonly objects: Registry<string, ObjectTypeDescriptor>;
  /** custom `kind -> ` spec→Track compiler. */
  readonly animations: Registry<string, AnimationCompiler>;
  /** PCG generator library. */
  readonly generators: Registry<string, GeneratorDescriptor>;
  /** Render backends. */
  readonly renderers: Registry<string, RendererFactory>;
}

/**
 * A plugin bundles a name with an {@link IntermactPlugin.install} hook that
 * registers descriptors into a {@link Registries}. Authored with
 * {@link definePlugin} and applied with {@link installPlugin}.
 */
export interface IntermactPlugin {
  readonly name: string;
  /** Optional semver-ish version string for diagnostics. */
  readonly version?: string;
  /** Register this plugin's descriptors into `registries`. */
  install(registries: Registries): void;
}
