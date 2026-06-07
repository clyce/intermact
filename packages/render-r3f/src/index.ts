/**
 * `@intermact/render-r3f` public entry point.
 *
 * React Three Fiber renderer adapter: maps a `RenderSnapshot` onto an R3F scene
 * graph and fits the camera to the scene domain. Consumes `@intermact/core` and
 * `@intermact/render-three`.
 */

export const VERSION = "0.1.0";

export * from "./fit";
export * from "./SceneView";
