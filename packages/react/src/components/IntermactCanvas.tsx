import { type CSSProperties, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { type IntermactProgram, type RenderSnapshot } from "@intermact/core";
import { SceneView } from "@intermact/render-r3f";
import { useIntermactPlayer } from "../hooks/useIntermactPlayer";
import { TimelineControls } from "./TimelineControls";

/** Controls overlay configuration. */
export interface CanvasControls {
  /** Show the timeline transport overlay. */
  readonly timeline?: boolean;
}

/** Props for {@link IntermactCanvas}. */
export interface IntermactCanvasProps {
  readonly program: IntermactProgram;
  readonly autoplay?: boolean;
  readonly controls?: CanvasControls;
  readonly seed?: number | string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Top-level React entry point (design.md §10, §15). Builds the program, hosts a
 * React Three Fiber `<Canvas>` with an orthographic camera fit to the scene
 * domain, drives the Player, and renders the scene with an optional timeline
 * overlay. HiDPI and resize are handled by R3F (`dpr` + ResizeObserver).
 */
export function IntermactCanvas({
  program,
  autoplay = true,
  controls,
  seed,
  className,
  style,
}: IntermactCanvasProps) {
  const built = useIntermactPlayer(program, seed !== undefined ? { seed } : undefined);
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null);

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    ...style,
  };

  if (!built) {
    return (
      <div className={className} style={{ ...wrapperStyle, color: "#64748b", padding: 16 }}>
        Building…
      </div>
    );
  }

  const { scene, player } = built;
  const background = scene.props.background ?? "#0b1020";

  return (
    <div className={className} style={wrapperStyle}>
      <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: [0, 0, 10] }}>
        <color attach="background" args={[background]} />
        <SceneView
          player={player}
          domain={scene.props.domain}
          fit={scene.props.fit ?? "contain"}
          autoplay={autoplay}
          onFrame={setSnapshot}
        />
      </Canvas>
      {controls?.timeline && <TimelineControls player={player} time={snapshot?.time ?? 0} />}
    </div>
  );
}
