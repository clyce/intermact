import { type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import {
  type AssetFetcher,
  type BinaryAssetFetcher,
  type BuiltProgram,
  type IntermactProgram,
  type MountedViewport,
  type Player,
  type RegisteredCamera3D,
  type Scene2D,
  uv,
} from "@intermact/core";
import { SceneView, SceneView3D } from "@intermact/render-r3f";
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

/** Render a single mounted viewport's `<Canvas>` (2D or 3D), design.md §10.4. */
function ViewportCanvas({
  viewport,
  autoplay,
  interactive,
}: {
  viewport: MountedViewport;
  autoplay: boolean;
  interactive: boolean;
}) {
  const { scene, player, dimension } = viewport;
  const background = scene.props.background ?? "#0b1020";
  if (dimension === "3d" && scene.kind === "scene-3d") {
    const cam3d = viewport.camera as RegisteredCamera3D;
    const ortho = cam3d.projection === "orthographic";
    const position = cam3d.position as unknown as [number, number, number];
    return (
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        orthographic={ortho}
        camera={
          ortho
            ? { position, zoom: 100 * cam3d.zoom, near: cam3d.near, far: cam3d.far }
            : { position, fov: cam3d.fov, near: cam3d.near, far: cam3d.far }
        }
      >
        <color attach="background" args={[background]} />
        <SceneView3D player={player} camera={cam3d} autoplay={autoplay} interactive={interactive} />
      </Canvas>
    );
  }
  const scene2d = scene as Scene2D;
  return (
    <Canvas orthographic dpr={[1, 2]} gl={{ antialias: true }} camera={{ position: [0, 0, 10] }}>
      <color attach="background" args={[background]} />
      <SceneView
        player={player}
        domain={scene2d.props.domain}
        fit={scene2d.props.fit ?? "contain"}
        autoplay={autoplay}
        interactive={interactive}
      />
    </Canvas>
  );
}

/** Absolute CSS box for a normalized viewport rect (UV, top-left origin). */
function rectStyle(rect: MountedViewport["rect"]): CSSProperties {
  return {
    position: "absolute",
    left: `${rect.min[0] * 100}%`,
    top: `${rect.min[1] * 100}%`,
    width: `${(rect.max[0] - rect.min[0]) * 100}%`,
    height: `${(rect.max[1] - rect.min[1]) * 100}%`,
  };
}

/**
 * Top-level React entry point (design.md §10, §15). Builds the program, hosts a
 * React Three Fiber `<Canvas>` with an orthographic camera fit to the scene
 * domain, drives the Player, and renders the scene with an optional timeline
 * overlay. Multiple mounted viewports (design.md §10.4) are laid out by their
 * normalized rects. HiDPI and resize are handled by R3F (`dpr` + ResizeObserver).
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

  const { scene, player, dimension } = built;
  const is3D = dimension === "3d" && scene.kind === "scene-3d";
  // Programs always mount at least the primary scene; fall back to a synthetic
  // full-rect viewport if not (e.g. a bare 2D scene) so nothing renders blank.
  const viewports: readonly MountedViewport[] =
    built.viewports.length > 0
      ? built.viewports
      : [
          {
            scene,
            camera: undefined as never,
            rect: { min: uv(0, 0), max: uv(1, 1) },
            player,
            dimension,
          },
        ];
  const multiViewport = viewports.length > 1;

  return (
    <div
      className={className}
      style={wrapperStyle}
      tabIndex={keyboard ? 0 : undefined}
      onKeyDown={keyboard ? (e) => handleTransportKey(player, e) : undefined}
    >
      {chrome?.(built)}
      {multiViewport ? (
        viewports.map((viewport, i) => (
          <div key={i} style={rectStyle(viewport.rect)}>
            <ViewportCanvas viewport={viewport} autoplay={autoplay} interactive={interactive} />
          </div>
        ))
      ) : viewports[0] ? (
        <ViewportCanvas viewport={viewports[0]} autoplay={autoplay} interactive={interactive} />
      ) : null}
      {controls?.timeline && <TimelineControls player={player} />}
      {controls?.inspector && !is3D && (
        <Inspector built={built} fit={(scene as Scene2D).props.fit ?? "contain"} />
      )}
    </div>
  );
}
