/**
 * `@intermact/core` public entry point.
 *
 * This package is framework-free (no React/three/DOM imports, enforced by
 * dependency-cruiser per design.md §3.1) so it can run headless in Node/Worker
 * for testing, export, and SSR pre-rendering.
 *
 * Modules are added milestone by milestone (see dev-docs/dev-roadmap.md §4).
 */

/** Library version, mirrors the v0.1 (Phase-1 MVP) milestone gate. */
export const VERSION = "0.1.0";

export * from "./errors";
export * from "./math";
export * from "./object";
export * from "./runtime";
export * from "./geometry";
export * from "./animation";
export * from "./scene";
export * from "./layout";
export * from "./reactive";
export * from "./random";
export * from "./program";
