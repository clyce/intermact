import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  type Mesh,
  OrthographicCamera,
  Scene,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import {
  findTrait,
  type IMObject2D,
  type Player,
  type RenderedSceneDomain,
  type RenderedSceneSource,
  type RenderSnapshot,
  type RuntimeState2D,
  type Scene2DProps,
} from "@intermact/core";
import { ThreeSceneView } from "@intermact/render-three";
import { computeFit } from "./fit";

/**
 * Offscreen render pass for an embedded sub-scene (design.md §10.2/§19.5). Owns
 * a {@link WebGLRenderTarget}, an isolated {@link Scene} + {@link ThreeSceneView}
 * and an orthographic camera fit to the sub-scene domain. `render()` draws one
 * frame into the target, restoring the host renderer's clear state so the host
 * frame is untouched.
 */
class OffscreenSceneRenderer {
  readonly target: WebGLRenderTarget;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();
  private readonly view = new ThreeSceneView();
  private readonly prevClear = new Color();

  constructor(
    resolution: readonly [number, number],
    domain?: RenderedSceneDomain,
    fitMode?: NonNullable<Scene2DProps["fit"]>,
  ) {
    this.target = new WebGLRenderTarget(resolution[0], resolution[1]);
    this.scene.add(this.view.root);
    if (domain) this.fit(domain, fitMode ?? "contain");
  }

  /** Fit the offscreen camera to a 2D domain (mirrors {@link SceneView}). */
  fit(domain: RenderedSceneDomain, fitMode: NonNullable<Scene2DProps["fit"]>): void {
    const { frustum } = computeFit(
      domain as Scene2DProps["domain"],
      fitMode,
      this.target.width,
      this.target.height,
    );
    this.camera.left = frustum.left;
    this.camera.right = frustum.right;
    this.camera.top = frustum.top;
    this.camera.bottom = frustum.bottom;
    this.camera.position.set(0, 0, 10);
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
  }

  /** Diff `snapshot` onto the offscreen graph and draw it into the target. */
  render(renderer: WebGLRenderer, snapshot: RenderSnapshot, background: string): void {
    this.view.update(snapshot, { worldPerPixel: 1 });
    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.prevClear);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(background, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(this.prevClear, prevAlpha);
  }

  dispose(): void {
    this.scene.remove(this.view.root);
    this.view.dispose();
    this.target.dispose();
  }
}

/** Drive a {@link RenderedSceneSource} for one host frame and return its snapshot. */
function tickSource(
  source: RenderedSceneSource,
  textureMode: "live" | "snapshot",
  delta: number,
  seeded: { value: boolean },
): RenderSnapshot {
  if (!source.ready) return { time: 0, objects: new Map(), viewports: [] };
  if (textureMode === "snapshot") {
    if (!seeded.value) {
      source.seek(source.duration);
      seeded.value = true;
    }
  } else {
    // Live panels own an independent sub-timeline (design.md §10.2) — advance every
    // frame so the embed keeps animating even when the host timeline is paused.
    source.advance(Math.min(delta, 0.05));
  }
  return source.snapshot() as RenderSnapshot;
}

/**
 * Composite a single {@link RenderedSceneSource} onto a plane. Lower-level
 * building block consumed by both the standalone {@link RenderedScene} and the
 * host-driven panels auto-rendered by {@link SceneView}.
 */
export function RenderedScenePanel({
  source,
  textureMode = "live",
  resolution = [512, 512],
  size = [2, 2],
  position = [0, 0, 0],
  background,
}: {
  source: RenderedSceneSource;
  textureMode?: "live" | "snapshot";
  resolution?: readonly [number, number];
  size?: readonly [number, number];
  position?: readonly [number, number, number];
  background?: string;
}) {
  const offscreen = useMemo(
    () => new OffscreenSceneRenderer(resolution, source.domain, source.fit ?? "contain"),
    [resolution, source.domain, source.fit],
  );
  const seeded = useRef({ value: false });

  useEffect(() => () => offscreen.dispose(), [offscreen]);

  useFrame(({ gl }, delta) => {
    const snapshot = tickSource(source, textureMode, delta, seeded.current);
    offscreen.render(gl, snapshot, background ?? source.background ?? "#0b1020");
  });

  return (
    <mesh position={[position[0], position[1], position[2]]}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshBasicMaterial map={offscreen.target.texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * Host-driven panel: reads a rendered-scene object's trait + transform from the
 * host {@link Player}'s snapshot each frame, so its placement follows the host
 * timeline (design.md §10.2). Used internally by {@link SceneView} to composite
 * every `rendered-scene` object registered in a 2D host.
 */
export function HostRenderedScenePanel({
  hostPlayer,
  objectId,
}: {
  hostPlayer: Player;
  objectId: string;
}) {
  const meshRef = useRef<Mesh>(null);
  const seeded = useRef({ value: false });

  const trait = useMemo(() => {
    const rs = hostPlayer.getSnapshot().objects.get(objectId);
    return rs ? findTrait((rs.object as IMObject2D).traits, "rendered-scene") : undefined;
  }, [hostPlayer, objectId]);

  const bounds = useMemo(() => {
    const rs = hostPlayer.getSnapshot().objects.get(objectId);
    return rs ? (rs.object as IMObject2D).geometry.getBounds().size : ([1, 1] as const);
  }, [hostPlayer, objectId]);

  const offscreen = useMemo(
    () =>
      trait
        ? new OffscreenSceneRenderer(
            trait.resolution,
            trait.source.domain,
            trait.source.fit ?? "contain",
          )
        : null,
    [trait],
  );

  useEffect(() => () => offscreen?.dispose(), [offscreen]);

  useFrame(({ gl }, delta) => {
    if (!offscreen || !trait) return;
    const rs = hostPlayer.getSnapshot().objects.get(objectId);
    if (!rs) return;
    const snapshot = tickSource(trait.source, trait.textureMode, delta, seeded.current);
    offscreen.render(gl, snapshot, trait.source.background ?? "#0b1020");

    const mesh = meshRef.current;
    if (mesh) {
      const state = rs.state as RuntimeState2D;
      const t = state.transform;
      mesh.visible = state.visible;
      mesh.position.set(t.position[0], t.position[1], 0);
      mesh.rotation.z = t.rotation;
      mesh.scale.set(t.scale[0], t.scale[1], 1);
      mesh.renderOrder = t.zIndex;
      const material = mesh.material as { opacity: number; transparent: boolean };
      material.transparent = true;
      material.opacity = state.opacity;
    }
  });

  if (!offscreen || !trait) return null;
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[bounds[0], bounds[1]]} />
      <meshBasicMaterial map={offscreen.target.texture} toneMapped={false} transparent />
    </mesh>
  );
}

/**
 * Render a secondary {@link Player}'s 2D scene into an offscreen texture and map
 * it onto a plane in the host scene (design.md §19.5). Convenience wrapper that
 * adapts a standalone {@link Player} into a {@link RenderedSceneSource}; prefer
 * the core `render(scene, camera)` API, which produces a registerable object
 * {@link SceneView} composites automatically.
 */
export function RenderedScene({
  player,
  domain,
  fit = "contain",
  resolution = [512, 512],
  size = [2, 2],
  position = [0, 0, 0],
  background = "#0b1020",
  autoplay = true,
}: {
  player: Player;
  domain: Scene2DProps["domain"];
  fit?: NonNullable<Scene2DProps["fit"]>;
  resolution?: readonly [number, number];
  size?: readonly [number, number];
  position?: readonly [number, number, number];
  background?: string;
  autoplay?: boolean;
}) {
  useEffect(() => {
    if (autoplay) player.play();
  }, [player, autoplay]);

  const source = useMemo<RenderedSceneSource>(
    () => ({
      dimension: "2d",
      domain: { x: domain.x, y: domain.y },
      fit,
      background,
      get ready() {
        return true;
      },
      get duration() {
        return player.duration;
      },
      advance: (dt) => {
        if (player.state !== "playing") player.play();
        player.update(dt);
      },
      seek: (t) => player.seek(t),
      snapshot: () => player.getSnapshot(),
    }),
    [player, domain.x, domain.y, fit, background],
  );

  return (
    <RenderedScenePanel
      source={source}
      textureMode="live"
      resolution={resolution}
      size={size}
      position={position}
      background={background}
    />
  );
}
