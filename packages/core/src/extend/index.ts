/**
 * Extensibility layer (design.md §18): registries + plugins. New object types,
 * animation kinds, PCG generators, and renderer backends are added by
 * registering descriptors, never by editing core dispatch.
 */
export * from "./registry";
export * from "./types";
export * from "./registries";
export * from "./plugin";
