import { type RelUV } from "../math/vec";
import { type Rng } from "../random/rng";
import { type Signal } from "../reactive/signal";
import { type AssetManager } from "../resource/asset-manager";
import { type Camera2DProps, type RegisteredCamera2D } from "../scene/camera";
import { type Scene2D } from "../scene/scene";
import { type Scene2DProps } from "../scene/types";

/**
 * Build-time program context (design.md §19.0). The user program is an (async)
 * function receiving this context, which provides scene/camera factories, the
 * mount entry point, and a seeded RNG. `createScene3D` / `createCamera3D` /
 * `assets` from design.md §19.0 land in M14/M15; v0.1 is the 2D subset below.
 */
export interface IntermactProgramContext {
  /** Create a 2D scene. */
  createScene2D(props: Scene2DProps): Scene2D;
  /** Create a minimal 2D camera bound to a scene. */
  createCamera2D(scene: Scene2D, props?: Camera2DProps): RegisteredCamera2D;
  /** Mount a (scene, camera) pair into a canvas viewport region. */
  mount(scene: Scene2D, camera: RegisteredCamera2D, rect?: ViewportRect): void;
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
