/**
 * `@intermact/react` public entry point.
 *
 * React bindings: `IntermactCanvas`, transport controls, and hooks. Re-exports
 * the R3F `SceneView` for advanced/manual composition.
 */

export const VERSION = "1.0.0";

export * from "./hooks/useIntermactPlayer";
export * from "./hooks/useSignal";
export * from "./hooks/usePrefersReducedMotion";
export * from "./hooks/useDeserializedProject";
export * from "./components/TimelineControls";
export * from "./components/Inspector";
export * from "./components/IntermactCanvas";
export * from "./components/SemanticOverlay";
export * from "./components/SerializedCanvas";
export * from "./export/recordCanvas";
export * from "./export/gif";
export * from "./embed/web-component";
export { SceneView } from "@intermact/render-r3f";
