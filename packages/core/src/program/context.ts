import { type RelUV } from "../math/vec";
import { type Rng } from "../random/rng";
import { type Signal } from "../reactive/signal";
import { type Registries } from "../extend/types";
import { type AssetManager } from "../resource/asset-manager";
import { type Camera2DProps, type RegisteredCamera2D } from "../scene/camera";
import { type Camera3DProps, type RegisteredCamera3D } from "../scene/camera3d";
import { type Scene2D } from "../scene/scene";
import { type Scene3D, type Scene3DProps } from "../scene/scene3d";
import { type Scene2DProps } from "../scene/types";

/** Any mountable scene (2D or 3D). */
export type AnyScene = Scene2D | Scene3D;
/** Any registered camera (2D or 3D). */
export type AnyCamera = RegisteredCamera2D | RegisteredCamera3D;

/**
 * Build-time program context (design.md §19.0). The user program is an (async)
 * function receiving this context, which provides 2D/3D scene + camera
 * factories, the mount entry point, a seeded RNG, and the build-time asset
 * resolver.
 */
export interface IntermactProgramContext {
  /** Create a 2D scene. */
  createScene2D(props: Scene2DProps): Scene2D;
  /** Create a 3D scene (design.md §10). */
  createScene3D(props?: Scene3DProps): Scene3D;
  /** Create a minimal 2D camera bound to a scene. */
  createCamera2D(scene: Scene2D, props?: Camera2DProps): RegisteredCamera2D;
  /** Create a 3D camera registered into a scene (design.md §10.1). */
  createCamera3D(scene: Scene3D, props?: Camera3DProps): RegisteredCamera3D;
  /** Mount a (scene, camera) pair into a canvas viewport region. */
  mount(scene: AnyScene, camera: AnyCamera, rect?: ViewportRect): void;
  /**
   * Create a signal registered with the program's reactive engine (§8). Use
   * instead of the standalone `signal()` helper during the build pass.
   */
  signal<T>(initial: T): Signal<T>;
  /** Numeric signal shorthand (ValueTracker equivalent). */
  valueTracker(initial: number): Signal<number>;
  /** Seeded, reproducible random source (§6.7). */
  readonly rng: Rng;
  /**
   * Build-time asset resolver (§14). `await ctx.assets.latex(...)` etc. during
   * the build pass so play-time stays deterministic and seekable.
   */
  readonly assets: AssetManager;
  /**
   * The extension registries this build resolves custom objects/animations/
   * generators/backends against (§18). Defaults to the process-global bundle;
   * override with `BuildOptions.registries` for isolated plugin sets.
   */
  readonly registries: Registries;
}

/** A normalized canvas-space region for a mounted viewport (design.md §10.4). */
export interface ViewportRect {
  readonly min: RelUV;
  readonly max: RelUV;
}

/** A user program: receives the build context, returns when the build is done. */
export type IntermactProgram = (ctx: IntermactProgramContext) => void | Promise<void>;

/** Identity helper to brand/author a program (mirrors design.md §19.0). */
export function createProgram(program: IntermactProgram): IntermactProgram {
  return program;
}
