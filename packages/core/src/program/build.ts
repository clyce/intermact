import { Player } from "../animation/player";
import { type Storyboard } from "../animation/storyboard";
import { ReactiveEngine } from "../reactive/engine";
import { setSignalRegistrar } from "../reactive/signal";
import { createRng } from "../random/rng";
import { createCamera2D, type Camera2DProps, type RegisteredCamera2D } from "../scene/camera";
import { Scene2D } from "../scene/scene";
import { type Scene2DProps } from "../scene/types";
import { type IntermactProgram, type IntermactProgramContext, type ViewportRect } from "./context";
import { uv } from "../math/vec";

/** Options for running the build pass. */
export interface BuildOptions {
  /** Seed for the program's RNG (default 0); same seed ⇒ same output. */
  readonly seed?: number | string;
}

/** A mounted (scene, camera, rect) tuple recorded during the build pass. */
export interface MountedViewport {
  readonly scene: Scene2D;
  readonly camera: RegisteredCamera2D;
  readonly rect: ViewportRect;
}

/** The product of the build pass: a ready-to-play Player plus its scenes. */
export interface BuiltProgram {
  readonly player: Player;
  readonly storyboard: Storyboard;
  readonly scene: Scene2D;
  readonly viewports: readonly MountedViewport[];
  readonly reactive: ReactiveEngine;
}

const FULL_RECT: ViewportRect = { min: uv(0, 0), max: uv(1, 1) };

/**
 * Run a program's build pass and assemble a {@link Player} (design.md §3.2).
 * The program runs once with a "logical clock that advances instantly": every
 * `scene.play` appends to the Storyboard. After it resolves, we have a complete
 * timeline that can be seeked deterministically.
 *
 * M1 supports a single primary scene; multi-viewport composition lands in M3.
 */
export async function buildProgram(
  program: IntermactProgram,
  options: BuildOptions = {},
): Promise<BuiltProgram> {
  const scenes: Scene2D[] = [];
  const viewports: MountedViewport[] = [];
  const reactive = new ReactiveEngine();
  let sceneCounter = 0;
  let cameraCounter = 0;

  const ctx: IntermactProgramContext = {
    createScene2D(props: Scene2DProps): Scene2D {
      const scene = new Scene2D(`scene-${sceneCounter++}`, props);
      scene.bindReactive(reactive);
      scenes.push(scene);
      return scene;
    },
    createCamera2D(_scene: Scene2D, props?: Camera2DProps): RegisteredCamera2D {
      return createCamera2D(`camera-${cameraCounter++}`, props);
    },
    mount(scene: Scene2D, camera: RegisteredCamera2D, rect: ViewportRect = FULL_RECT): void {
      viewports.push({ scene, camera, rect });
    },
    rng: createRng(options.seed ?? 0),
  };

  setSignalRegistrar((sig) => reactive.registerSignal(sig));
  try {
    await program(ctx);
  } finally {
    setSignalRegistrar(null);
  }

  const primary = viewports[0]?.scene ?? scenes[0];
  if (!primary) {
    throw new Error("Program did not create a scene; nothing to build.");
  }

  const storyboard = primary.buildStoryboard();
  const player = new Player(storyboard, {
    initialStates: primary.getInitialStates(),
    objects: primary.getObjects(),
    reactive,
    scene: primary,
  });

  return { player, storyboard, scene: primary, viewports, reactive };
}
