import { Canvas } from "@react-three/fiber";

/**
 * `examples/_smoke/static-circle` (dev-roadmap.md M0).
 *
 * Renders a single static circle directly via three.js geometry as a CI smoke
 * test. It deliberately does NOT use the timeline/animation pipeline (those
 * arrive in M1+); the point is to prove the toolchain + R3F render path works.
 */
export function StaticCircleDemo() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 80, position: [0, 0, 10] }}
      style={{ width: "100%", height: "100%", background: "#0b1020" }}
    >
      <ambientLight intensity={0.9} />
      <mesh>
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </Canvas>
  );
}
