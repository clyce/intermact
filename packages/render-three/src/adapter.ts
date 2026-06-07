import { type RenderSnapshot } from "@intermact/core";

/**
 * Renderer adapter contract (design.md §15.1). The adapter consumes only a
 * {@link RenderSnapshot} and is unaware of animation/timeline, which keeps
 * backends swappable. In the R3F path this contract is fulfilled by
 * {@link ThreeSceneView} hosted inside a React Three Fiber `<Canvas>`; a
 * standalone WebGL adapter can implement the same interface for headless export.
 */
export interface SceneRendererAdapter {
  mount(container: HTMLElement): void;
  render(snapshot: RenderSnapshot): void;
  dispose(): void;
}
