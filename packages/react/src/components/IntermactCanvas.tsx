import { type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import {
  type AssetFetcher,
  type BinaryAssetFetcher,
  type BuiltProgram,
  type IntermactProgram,
  type Player,
} from "@intermact/core";
import { SceneView } from "@intermact/render-r3f";
import { useIntermactPlayer } from "../hooks/useIntermactPlayer";
import { Inspector } from "./Inspector";
import { TimelineControls } from "./TimelineControls";

/** Controls overlay configuration. */
export interface CanvasControls {
  /** Show the timeline transport overlay. */
  readonly timeline?: boolean;
  /** Show the dev Inspector overlay (design.md §16). */
  readonly inspector?: boolean;
}

/** Props for {@link IntermactCanvas}. */
export interface IntermactCanvasProps {
  readonly program: IntermactProgram;
  readonly autoplay?: boolean;
  readonly controls?: CanvasControls;
  /** Enable pointer interaction (drag handles, pick) — default true. */
  readonly interactive?: boolean;
  /** Enable keyboard transport (space/arrows/Home/End) — default true. */
  readonly keyboard?: boolean;
  readonly seed?: number | string;
  /** Resolve text assets during the build pass. */
  readonly fetcher?: AssetFetcher;
  /** Resolve binary font assets during the build pass. */
  readonly fetchBinary?: BinaryAssetFetcher;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Optional DOM chrome rendered above the canvas once the program is built. */
  readonly chrome?: (built: BuiltProgram) => ReactNode;
}

const FRAME = 1 / 30;

/** Keyboard transport: space play/pause, arrows step/seek, Home/End jump (§12.4). */
function handleTransportKey(player: Player, e: KeyboardEvent<HTMLDivElement>): void {
  switch (e.key) {
    case " ":
      if (player.state === "playing") player.pause();
      else player.play();
      break;
    case "ArrowRight":
      player.pause();
      player.seek(player.time + (e.shiftKey ? 1 : FRAME));
      break;
    case "ArrowLeft":
      player.pause();
      player.seek(player.time - (e.shiftKey ? 1 : FRAME));
      break;
    case "Home":
      player.seek(0);
      break;
    case "End":
      player.seek(player.duration);
      break;
    default:
      return;
  }
  e.preventDefault();
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
  interactive = true,
  keyboard = true,
  seed,
  fetcher,
  fetchBinary,
  className,
  style,
  chrome,
}: IntermactCanvasProps) {
  const built = useIntermactPlayer(program, {
    ...(seed !== undefined ? { seed } : {}),
    fetcher,
    fetchBinary,
  });

  const wrapperStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    outline: "none",
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
    <div
      className={className}
      style={wrapperStyle}
      tabIndex={keyboard ? 0 : undefined}
      onKeyDown={keyboard ? (e) => handleTransportKey(player, e) : undefined}
    >
      {chrome?.(built)}
      <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: [0, 0, 10] }}>
        <color attach="background" args={[background]} />
        <SceneView
          player={player}
          domain={scene.props.domain}
          fit={scene.props.fit ?? "contain"}
          autoplay={autoplay}
          interactive={interactive}
        />
      </Canvas>
      {controls?.timeline && <TimelineControls player={player} />}
      {controls?.inspector && <Inspector built={built} fit={scene.props.fit ?? "contain"} />}
    </div>
  );
}
