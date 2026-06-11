import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type OrthographicCamera, Vector3 } from "three";
import {
  type AbsXY,
  type IntermactDragEvent,
  type IntermactPointerEvent,
  type Player,
  type RelUV,
  type RenderSnapshot,
  type Scene2DProps,
  hitTest,
  uv,
  xy,
} from "@intermact/core";
import { ThreeSceneView } from "@intermact/render-three";
import { computeFit } from "./fit";
import { collectHitEntries, interactiveTraitOf } from "./interaction";
import { HostRenderedScenePanel } from "./RenderedScene";

/**
 * In-canvas R3F component (design.md §15). Hosts a framework-free
 * `ThreeSceneView` (`@intermact/render-three`), fits the orthographic camera to the scene domain on
 * resize, advances the {@link Player} via `useFrame`, and diffs each snapshot
 * onto the three.js scene graph — no per-frame React reconciliation.
 */
export function SceneView({
  player,
  domain,
  fit = "contain",
  autoplay = false,
  interactive = true,
  onFrame,
}: {
  player: Player;
  domain: Scene2DProps["domain"];
  fit?: NonNullable<Scene2DProps["fit"]>;
  autoplay?: boolean;
  interactive?: boolean;
  onFrame?: (snapshot: RenderSnapshot) => void;
}) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const view = useMemo(() => new ThreeSceneView(), []);
  const worldPerPixel = useRef(1);

  // Embedded sub-scenes composed via core `render()` are registered objects that
  // the snapshot diff skips; composite each as an offscreen panel (design.md §10.2).
  const renderedScenePanelIds: string[] = [];
  for (const [id, rs] of player.getSnapshot().objects) {
    if (rs.object.type === "rendered-scene") renderedScenePanelIds.push(id);
  }

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

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    let drag: { id: string; startAbs: AbsXY; moved: boolean } | null = null;

    const toScene = (clientX: number, clientY: number): { abs: AbsXY; rel: RelUV } => {
      const rect = el.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      const v = new Vector3(nx * 2 - 1, -(ny * 2 - 1), 0).unproject(camera);
      return { abs: xy(v.x, v.y), rel: uv(nx, ny) };
    };
    const baseEvent = (
      e: PointerEvent,
      abs: AbsXY,
      rel: RelUV,
      targetId?: string,
    ): IntermactPointerEvent => ({
      screen: [e.clientX, e.clientY],
      sceneAbs: abs,
      sceneRel: rel,
      ...(targetId !== undefined ? { targetId } : {}),
      originalEvent: e,
    });

    const onDown = (e: PointerEvent): void => {
      const { abs, rel } = toScene(e.clientX, e.clientY);
      const id = hitTest(collectHitEntries(player.getSnapshot()), abs);
      if (!id) return;
      const trait = interactiveTraitOf(player.getSnapshot(), id);
      drag = { id, startAbs: abs, moved: false };
      el.setPointerCapture(e.pointerId);
      if (trait?.cursor) el.style.cursor = trait.cursor;
      trait?.binding?.onPointerDown?.(baseEvent(e, abs, rel, id));
    };
    const onMove = (e: PointerEvent): void => {
      if (!drag) return;
      const { abs, rel } = toScene(e.clientX, e.clientY);
      drag.moved = true;
      const trait = interactiveTraitOf(player.getSnapshot(), drag.id);
      trait?.drag?.write(abs);
      const dragEvent: IntermactDragEvent = {
        ...baseEvent(e, abs, rel, drag.id),
        startAbs: drag.startAbs,
        deltaAbs: xy(abs[0] - drag.startAbs[0], abs[1] - drag.startAbs[1]),
      };
      trait?.binding?.onDrag?.(dragEvent);
    };
    const onUp = (e: PointerEvent): void => {
      if (!drag) return;
      const { abs, rel } = toScene(e.clientX, e.clientY);
      const trait = interactiveTraitOf(player.getSnapshot(), drag.id);
      if (!drag.moved) trait?.binding?.onClick?.(baseEvent(e, abs, rel, drag.id));
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "";
      drag = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, [interactive, gl, camera, player]);

  useFrame((_, delta) => {
    // Clamp the frame delta so a backgrounded tab (which produces a huge delta
    // on resume) cannot jump the timeline; playback stays smooth and bounded.
    player.update(Math.min(delta, 0.05));
    const snapshot = player.getSnapshot();
    view.update(snapshot, { worldPerPixel: worldPerPixel.current });
    onFrame?.(snapshot);
  });

  return (
    <>
      <primitive object={view.root} />
      {renderedScenePanelIds.map((id) => (
        <HostRenderedScenePanel key={id} hostPlayer={player} objectId={id} />
      ))}
    </>
  );
}
