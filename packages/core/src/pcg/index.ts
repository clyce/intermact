/**
 * Procedural content generation layer (design.md §6). Generators are pure
 * `(spec) => IMObject2D` functions; randomness flows exclusively through an
 * injected seeded {@link Rng} (design.md §6.7) so all output is reproducible.
 *
 * This layer stays headless and depends only on math / geometry / object /
 * constructs / random (enforced by `.dependency-cruiser.cjs`); it never touches
 * scene, animation, or the program runtime.
 */
export * from "./field";
export * from "./color-ramp";
export * from "./marching-squares";
export * from "./isosurface";
export * from "./field-objects";
export * from "./parametric";
export * from "./lsystem";
export * from "./fractal";
export * from "./graph";
export * from "./cellular-automaton";
export * from "./data";
export * from "./operators";
