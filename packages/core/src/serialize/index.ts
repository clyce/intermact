/**
 * Serialization / export / embed layer (design.md §17). Turns a built program
 * into portable data (and back), and provides the headless export primitives the
 * renderer/embed layers build on:
 *
 * - {@link serialize} / {@link deserialize} — project ↔ playable Player.
 * - {@link encodeShareUrl} / {@link decodeShareUrl} — URL-safe project codec.
 * - {@link sampleFrameHashes} / {@link snapshotToSVG} — deterministic export.
 * - {@link degradeForReducedMotion} / semantic layer — accessibility.
 */
export * from "./types";
export * from "./bake";
export * from "./timeline";
export * from "./serialize";
export * from "./share-url";
export * from "./frame-hash";
export * from "./svg";
export * from "./reduced-motion";
export * from "./semantic";
