import { Canvas } from "@react-three/fiber";

/**
 * `examples/_template/empty-canvas` (dev-roadmap.md M0).
 *
 * Minimal empty R3F canvas. Validates startup, HMR, and build output without
 * depending on the Intermact timeline/animation pipeline.
 */
export function EmptyCanvasDemo() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 80, position: [0, 0, 10] }}
      style={{ width: "100%", height: "100%", background: "#0b1020" }}
    >
      <ambientLight intensity={0.8} />
    </Canvas>
  );
}
