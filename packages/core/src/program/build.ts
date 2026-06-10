import { Player } from "../animation/player";
import { type Storyboard } from "../animation/storyboard";
import { ReactiveEngine } from "../reactive/engine";
import { createSignal } from "../reactive/signal";
import { createRng } from "../random/rng";
import { globalRegistries } from "../extend/registries";
import { type Registries } from "../extend/types";
import { FontRegistry, getGlobalFontRegistry, setActiveFontRegistry } from "../text/font-registry";
import {
  createAssetManager,
  type AssetFetcher,
  type BinaryAssetFetcher,
} from "../resource/asset-manager";
import { createCamera2D, type Camera2DProps, type RegisteredCamera2D } from "../scene/camera";
import { type Camera3DProps, type RegisteredCamera3D } from "../scene/camera3d";
import { Scene2D } from "../scene/scene";
import { Scene3D, type Scene3DProps } from "../scene/scene3d";
import { finalizeRenderedScene } from "../scene/rendered-scene";
import { type Scene2DProps } from "../scene/types";
import { type IMObject2D } from "../object/types";
import {
  type AnyCamera,
  type AnyScene,
  type IntermactProgram,
  type IntermactProgramContext,
  type ViewportRect,
} from "./context";
import { uv } from "../math/vec";

/** Options for running the build pass. */
export interface BuildOptions {
  /** Seed for the program's RNG (default 0); same seed ⇒ same output. */
  readonly seed?: number | string;
  /** Resolve text assets (SVG, JSON) during the build pass. */
  readonly fetcher?: AssetFetcher;
  /** Resolve binary font assets during the build pass. */
  readonly fetchBinary?: BinaryAssetFetcher;
  /**
   * Extension registries to resolve custom objects/animations/generators/
   * backends against (design.md §18, §22.8). Defaults to {@link globalRegistries}.
   * Pass an explicit {@link createRegistries} bundle for isolated plugin sets
   * (multiple programs, parallel tests) instead of relying on process-global state.
   */
  readonly registries?: Registries;
}

/** A mounted (scene, camera, rect) tuple recorded during the build pass. */
export interface MountedViewport {
  readonly scene: AnyScene;
  readonly camera: AnyCamera;
  readonly rect: ViewportRect;
  /** Player driving this viewport (primary keeps reactive; others animation-only). */
  readonly player: Player;
  /** Dimension of this viewport's scene (renderer dispatch). */
  readonly dimension: "2d" | "3d";
}

/** The product of the build pass: a ready-to-play Player plus its scenes. */
export interface BuiltProgram {
  readonly player: Player;
  readonly storyboard: Storyboard;
  /** Primary mounted scene (2D or 3D). */
  readonly scene: AnyScene;
  /** Dimension of the primary scene (renderer dispatch). */
  readonly dimension: "2d" | "3d";
  readonly viewports: readonly MountedViewport[];
  readonly reactive: ReactiveEngine;
}

/** Assemble an animation-only Player for a secondary viewport / embedded scene. */
function assembleAnimationPlayer(scene: AnyScene): Player {
  return new Player(scene.buildStoryboard(), {
    initialStates: scene.getInitialStates(),
    objects: scene.getObjects(),
    parents: scene.getParents(),
  });
}

const FULL_RECT: ViewportRect = { min: uv(0, 0), max: uv(1, 1) };

/**
 * Run a program's build pass and assemble a {@link Player} (design.md §3.2).
 * The program runs once with a "logical clock that advances instantly": every
 * `scene.play` appends to the Storyboard. After it resolves, we have a complete
 * timeline that can be seeked deterministically.
 *
 * M1 supports a single primary scene; multi-viewport composition is §10.4 (M12/M15).
 */
export async function buildProgram(
  program: IntermactProgram,
  options: BuildOptions = {},
): Promise<BuiltProgram> {
  const scenes: AnyScene[] = [];
  const mounts: { scene: AnyScene; camera: AnyCamera; rect: ViewportRect }[] = [];
  const reactive = new ReactiveEngine();
  const registries = options.registries ?? globalRegistries;
  let sceneCounter = 0;
  let cameraCounter = 0;

  const ctx: IntermactProgramContext = {
    createScene2D(props: Scene2DProps): Scene2D {
      const scene = new Scene2D(`scene-${sceneCounter++}`, props, registries);
      scene.bindReactive(reactive);
      scenes.push(scene);
      return scene;
    },
    createScene3D(props: Scene3DProps = {}): Scene3D {
      const scene = new Scene3D(`scene-${sceneCounter++}`, props, registries);
      scenes.push(scene);
      return scene;
    },
    createCamera2D(_scene: Scene2D, props?: Camera2DProps): RegisteredCamera2D {
      return createCamera2D(`camera-${cameraCounter++}`, props);
    },
    createCamera3D(scene: Scene3D, props?: Camera3DProps): RegisteredCamera3D {
      cameraCounter++;
      return scene.registerCamera(props);
    },
    mount(scene: AnyScene, camera: AnyCamera, rect: ViewportRect = FULL_RECT): void {
      mounts.push({ scene, camera, rect });
    },
    signal<T>(initial: T) {
      const sig = createSignal(initial);
      reactive.registerSignal(sig);
      return sig;
    },
    valueTracker(initial: number) {
      return ctx.signal(initial);
    },
    rng: createRng(options.seed ?? 0),
    assets: createAssetManager({
      fetcher: options.fetcher,
      fetchBinary: options.fetchBinary,
    }),
    registries,
  };

  // Scope fonts to this build: a child of the global registry so globally
  // pre-loaded faces stay visible, while fonts loaded during this build do not
  // leak back out (design.md §22.8). Restored in `finally`.
  const fontRegistry = new FontRegistry(getGlobalFontRegistry());
  const previousFonts = setActiveFontRegistry(fontRegistry);
  try {
    await program(ctx);
  } finally {
    setActiveFontRegistry(previousFonts);
  }

  const primary = mounts[0]?.scene ?? scenes[0];
  if (!primary) {
    throw new Error("Program did not create a scene; nothing to build.");
  }

  // Assemble the embedded sub-player for every rendered-scene object now that
  // each source scene's timeline is final (design.md §10.2).
  for (const scene of scenes) {
    if (scene.kind !== "scene-2d") continue;
    for (const object of scene.getObjects().values()) {
      finalizeRenderedScene(object as IMObject2D);
    }
  }

  const storyboard = primary.buildStoryboard();
  const dimension: "2d" | "3d" = primary.kind === "scene-2d" ? "2d" : "3d";
  const player = new Player(storyboard, {
    initialStates: primary.getInitialStates(),
    objects: primary.getObjects(),
    reactive,
    // Reactive geometry/updater flush needs the 2D scene host; 3D scenes drive
    // signal tracks only (no derived-object rebuilds in M14).
    ...(primary.kind === "scene-2d" ? { scene: primary as Scene2D } : {}),
    parents: primary.getParents(),
    serialization: {
      seed: options.seed ?? 0,
      scene: { kind: primary.kind, props: primary.props },
      initialStates: primary.getInitialStatesPristine(),
      timeline: primary.getTimelineOps(),
      signals: reactive.serializeInitialSignals(),
      cameras: mounts
        .filter((v) => v.camera.kind === "camera-3d")
        .map((v) => {
          const cam = v.camera as RegisteredCamera3D;
          return {
            id: cam.id,
            position: [cam.position[0], cam.position[1], cam.position[2]] as const,
            target: [cam.target[0], cam.target[1], cam.target[2]] as const,
            fov: cam.fov,
            near: cam.near,
            far: cam.far,
            projection: cam.projection,
            zoom: cam.zoom,
          };
        }),
    },
  });

  // The primary viewport reuses the reactive primary player; secondary viewports
  // are animation-only (design.md §0.3.1 reactive scoping).
  const viewports: MountedViewport[] = mounts.map((m, i) => ({
    scene: m.scene,
    camera: m.camera,
    rect: m.rect,
    player: i === 0 ? player : assembleAnimationPlayer(m.scene),
    dimension: m.scene.kind === "scene-2d" ? "2d" : "3d",
  }));

  return { player, storyboard, scene: primary, dimension, viewports, reactive };
}

/** Release Player/ReactiveEngine resources held by a built program. */
export function disposeBuiltProgram(built: BuiltProgram): void {
  for (const v of built.viewports) v.player.dispose();
  built.player.dispose();
  built.reactive.dispose();
}
