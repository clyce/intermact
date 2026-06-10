/**
 * `@intermact/core` public entry point.
 *
 * This package is framework-free (no React/three/DOM imports, enforced by
 * dependency-cruiser per design.md §3.1) so it can run headless in Node/Worker
 * for testing, export, and SSR pre-rendering.
 *
 * Modules are added milestone by milestone (see dev-docs/dev-roadmap.md §4).
 */

/** Library version. Phase-3 complete — v1.0.0 (◆ L3 acceptance). */
export const VERSION = "1.0.0";

export * from "./errors";
export * from "./math";
export * from "./object";
export * from "./object3d";
export * from "./runtime";
export * from "./geometry";
export * from "./animation";
export * from "./scene";
export * from "./layout";
export * from "./text";
export * from "./resource";
export * from "./constructs";
export * from "./interaction";
export * from "./reactive";
export * from "./random";
export * from "./pcg";
export * from "./program";
export * from "./serialize";
export * from "./extend";
