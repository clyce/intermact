/**
 * `@intermact/react` public entry point.
 *
 * React bindings: `IntermactCanvas`, transport controls, and hooks. Re-exports
 * the R3F `SceneView` for advanced/manual composition.
 */

export const VERSION = "0.1.0";

export * from "./hooks/useIntermactPlayer";
export * from "./hooks/useSignal";
export * from "./components/TimelineControls";
export * from "./components/IntermactCanvas";
export { SceneView } from "@intermact/render-r3f";
