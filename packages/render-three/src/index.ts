/**
 * `@intermact/render-three` public entry point.
 *
 * React-free three.js helpers that translate an Intermact `RenderSnapshot` into
 * three.js objects. Depends on three but never on React/R3F (design.md §3.1).
 */

export const VERSION = "0.2.0";

export * from "./color";
export * from "./stroke";
export * from "./fill";
export * from "./material";
export * from "./object-view";
export * from "./scene-view";
export * from "./adapter";
