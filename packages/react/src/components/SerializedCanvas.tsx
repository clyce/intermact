import { type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { type Scene2DProps, semanticLayerFromPlayer } from "@intermact/core";
import { SceneView, SceneView3D } from "@intermact/render-r3f";
import { useDeserializedProject, type ProjectInput } from "../hooks/useDeserializedProject";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SemanticOverlay } from "./SemanticOverlay";
import { TimelineControls } from "./TimelineControls";

/** Props for {@link SerializedCanvas}. */
export interface SerializedCanvasProps {
  /** A {@link SerializedProject} or an encoded share-url string. */
  readonly project: ProjectInput;
  readonly autoplay?: boolean;
  readonly interactive?: boolean;
  /** Reduced-motion behavior: `"auto"` follows the OS setting (default). */
  readonly reducedMotion?: "auto" | "on" | "off";
  /** Show the transport overlay. */
  readonly timeline?: boolean;
  /** Render the semantic/a11y layer (`"sr-only"` by default; `false` disables). */
  readonly semantic?: "sr-only" | "visible" | false;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Render a serialized project (design.md §17). Deserializes a
 * {@link SerializedProject} (or share-url string) into a Player and mounts the
 * R3F canvas — the rendering half of share-url / embed. Honors
 * `prefers-reduced-motion` and overlays the accessible semantic layer.
 */
export function SerializedCanvas({
  project,
  autoplay = true,
  interactive = true,
  reducedMotion = "auto",
  timeline = false,
  semantic = "sr-only",
  className,
  style,
}: SerializedCanvasProps) {
  const prefersReduced = usePrefersReducedMotion();
  const reduced =
    reducedMotion === "on" || (reducedMotion === "auto" && prefersReduced) ? true : false;
  const program = useDeserializedProject(project, { reducedMotion: reduced });
  const { player, dimension, sceneProps, camera3d } = program;

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    ...style,
  };

  const entries = semantic === false ? [] : semanticLayerFromPlayer(player);

  if (dimension === "3d" && camera3d) {
    const background = (sceneProps as { background?: string }).background ?? "#0b1020";
    return (
      <div className={className} style={wrapperStyle}>
        <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: [4, 4, 6], fov: 50 }}>
          <color attach="background" args={[background]} />
          <SceneView3D
            player={player}
            camera={camera3d}
            autoplay={autoplay && !reduced}
            interactive={interactive}
          />
        </Canvas>
        {semantic !== false && <SemanticOverlay entries={entries} mode={semantic} />}
        {timeline && <TimelineControls player={player} />}
      </div>
    );
  }

  const props2d = sceneProps as Scene2DProps;
  const background = props2d.background ?? "#0b1020";
  return (
    <div className={className} style={wrapperStyle}>
      <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: [0, 0, 10] }}>
        <color attach="background" args={[background]} />
        <SceneView
          player={player}
          domain={props2d.domain}
          fit={props2d.fit ?? "contain"}
          autoplay={autoplay && !reduced}
          interactive={interactive}
        />
      </Canvas>
      {semantic !== false && <SemanticOverlay entries={entries} mode={semantic} />}
      {timeline && <TimelineControls player={player} />}
    </div>
  );
}
