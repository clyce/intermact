/**
 * `render(scene, camera)` — compose a sub-scene as a 2D object (design.md §10.2,
 * §19.5). The product implements the {@link IMObject2D} contract: its geometry
 * is a quad that fills its own bounds and its "material" is the texture the
 * sub-scene renders into. It can therefore be registered into another scene and
 * animated like any other object.
 *
 * The sub-scene's timeline is not final until the program's build pass
 * completes, so the embedded {@link Player} is assembled lazily by
 * {@link buildProgram} (which calls {@link finalizeRenderedScene}). Until then
 * the source reports `ready: false` and emits an empty snapshot.
 *
 * Reactive scoping: embedded sub-scenes are assembled **animation-only** (object
 * and camera timelines fully supported); signal-driven reactive geometry is
 * driven only for the primary mounted scene (design.md §8, §0.3.1).
 */
import { Player } from "../animation/player";
import { type RenderSnapshot } from "../animation/snapshot";
import { rectangle } from "../geometry/primitives";
import { type IMObject2D } from "../object/types";
import {
  findTrait,
  type RenderedSceneDomain,
  type RenderedSceneSource,
  type RenderedSceneTrait,
} from "../object/traits";
import { IntermactError } from "../errors";
import { type RegisteredCamera2D } from "./camera";
import { type Scene2D } from "./scene";
import { type Scene3D } from "./scene3d";

const EMPTY_SNAPSHOT: RenderSnapshot = { time: 0, objects: new Map(), viewports: [] };

/**
 * Concrete {@link RenderedSceneSource}. Holds the source scene and assembles its
 * sub-{@link Player} on {@link finalize}. The renderer adapter drives it via
 * {@link advance} (live) or {@link seek} (snapshot/scrub).
 */
export class RenderedSceneSourceImpl implements RenderedSceneSource {
  readonly dimension = "2d" as const;
  readonly domain?: RenderedSceneDomain;
  readonly fit?: "contain" | "cover" | "stretch";
  readonly background?: string;
  private player: Player | null = null;

  constructor(private readonly scene: Scene2D) {
    this.domain = scene.props.domain;
    if (scene.props.fit) this.fit = scene.props.fit;
    if (scene.props.background) this.background = scene.props.background;
  }

  get ready(): boolean {
    return this.player !== null;
  }

  get duration(): number {
    return this.player?.duration ?? 0;
  }

  /** Assemble the sub-player from the (now-final) source scene timeline. */
  finalize(): void {
    if (this.player) return;
    this.player = new Player(this.scene.buildStoryboard(), {
      initialStates: this.scene.getInitialStates(),
      objects: this.scene.getObjects(),
      parents: this.scene.getParents(),
    });
  }

  advance(dt: number): void {
    if (!this.player) return;
    if (this.player.state !== "playing") this.player.play();
    this.player.update(dt);
  }

  seek(time: number): void {
    this.player?.seek(time);
  }

  snapshot(): RenderSnapshot {
    return this.player?.getSnapshot() ?? EMPTY_SNAPSHOT;
  }
}

/** Options for {@link render}. */
export interface RenderOptions {
  /** Quad size `[w, h]` in the host scene's world units (default `[2, 2]`). */
  readonly size?: readonly [number, number];
  /** Offscreen render-target resolution `[w, h]` in pixels (default `[512, 512]`). */
  readonly resolution?: readonly [number, number];
  /** `live` re-renders each host frame; `snapshot` renders the last frame once. */
  readonly textureMode?: "live" | "snapshot";
  /** Background clear color for the offscreen pass (default: scene background). */
  readonly background?: string;
}

/**
 * Compose `source` (a 2D scene) as a {@link RenderedSceneTrait}-bearing
 * {@link IMObject2D} that other scenes can register and animate (design.md
 * §10.2). The returned object keeps stroke/fill traits for a headless quad
 * fallback (SVG / bounds / hit-testing); a GL renderer reads the rendered-scene
 * trait to draw the live sub-scene texture instead.
 *
 * @throws IntermactError `invalid-argument` if `source` is a 3D scene — only 2D
 * source scenes are supported as offscreen panels in v1.
 */
export function render(
  source: Scene2D | Scene3D,
  _camera: RegisteredCamera2D,
  options: RenderOptions = {},
): IMObject2D {
  if (source.kind !== "scene-2d") {
    throw new IntermactError(
      "invalid-argument",
      "render(): only 2D source scenes are supported as rendered-scene panels in v1.",
    );
  }
  const size = options.size ?? [2, 2];
  const resolution = options.resolution ?? [512, 512];
  const textureMode = options.textureMode ?? "live";
  const background = options.background ?? source.props.background ?? "#0b1020";

  const quad = rectangle({
    width: size[0],
    height: size[1],
    style: { fill: background, stroke: "#334155", lineWidth: 0.01 },
  });
  const trait: RenderedSceneTrait = {
    kind: "rendered-scene",
    textureMode,
    resolution,
    source: new RenderedSceneSourceImpl(source),
  };
  return { ...quad, type: "rendered-scene", traits: [...quad.traits, trait] };
}

/**
 * Assemble the embedded sub-player for a rendered-scene object (called by the
 * build pass once every source scene's timeline is final). No-op for objects
 * without a rendered-scene trait.
 */
export function finalizeRenderedScene(object: IMObject2D): void {
  const trait = findTrait(object.traits, "rendered-scene");
  if (trait && trait.source instanceof RenderedSceneSourceImpl) {
    trait.source.finalize();
  }
}
