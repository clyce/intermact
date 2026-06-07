import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type OrthographicCamera } from "three";
import { type Player, type RenderSnapshot, type Scene2DProps } from "@intermact/core";
import { ThreeSceneView } from "@intermact/render-three";
import { computeFit } from "./fit";

/**
 * In-canvas R3F component (design.md §15). Hosts a framework-free
 * {@link ThreeSceneView}, fits the orthographic camera to the scene domain on
 * resize, advances the {@link Player} via `useFrame`, and diffs each snapshot
 * onto the three.js scene graph — no per-frame React reconciliation.
 */
export function SceneView({
  player,
  domain,
  fit = "contain",
  autoplay = false,
  onFrame,
}: {
  player: Player;
  domain: Scene2DProps["domain"];
  fit?: NonNullable<Scene2DProps["fit"]>;
  autoplay?: boolean;
  onFrame?: (snapshot: RenderSnapshot) => void;
}) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const view = useMemo(() => new ThreeSceneView(), []);
  const worldPerPixel = useRef(1);

  const domainKey = `${domain.x[0]},${domain.x[1]},${domain.y[0]},${domain.y[1]}`;
  useEffect(() => {
    const { frustum, worldPerPixel: wpp } = computeFit(domain, fit, size.width, size.height);
    camera.left = frustum.left;
    camera.right = frustum.right;
    camera.top = frustum.top;
    camera.bottom = frustum.bottom;
    camera.position.set(0, 0, 10);
    camera.near = 0.1;
    camera.far = 100;
    camera.updateProjectionMatrix();
    worldPerPixel.current = wpp;
  }, [camera, size.width, size.height, domainKey, fit, domain]);

  useEffect(() => {
    if (autoplay) player.play();
  }, [player, autoplay]);

  useEffect(() => () => view.dispose(), [view]);

  useFrame((_, delta) => {
    // Clamp the frame delta so a backgrounded tab (which produces a huge delta
    // on resume) cannot jump the timeline; playback stays smooth and bounded.
    player.update(Math.min(delta, 0.05));
    const snapshot = player.getSnapshot();
    view.update(snapshot, { worldPerPixel: worldPerPixel.current });
    onFrame?.(snapshot);
  });

  return <primitive object={view.root} />;
}
