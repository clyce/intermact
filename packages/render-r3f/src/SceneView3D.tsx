import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type OrthographicCamera, type PerspectiveCamera, Vector3 } from "three";
import { type Player, type RegisteredCamera3D, type RenderSnapshot } from "@intermact/core";
import { ThreeSceneView } from "@intermact/render-three";

type R3FCamera = PerspectiveCamera | OrthographicCamera;

function isPerspective(cam: R3FCamera): cam is PerspectiveCamera {
  return (cam as PerspectiveCamera).isPerspectiveCamera === true;
}

/**
 * In-canvas R3F component for 3D scenes (design.md §10, §15). Hosts a
 * framework-free {@link ThreeSceneView}, advances the {@link Player} via
 * `useFrame`, and drives the camera. Both perspective and **orthographic**
 * (`camera.projection`) cameras are supported; orthographic honors `camera.zoom`
 * and the wheel adjusts zoom rather than distance. With `interactive` the user
 * can orbit/dolly the camera; otherwise the camera follows the scene's
 * registered camera node (timeline-driven `moveTo`/`lookAt`/`orbit`).
 */
export function SceneView3D({
  player,
  camera,
  autoplay = false,
  interactive = true,
  onFrame,
}: {
  player: Player;
  camera: RegisteredCamera3D;
  autoplay?: boolean;
  interactive?: boolean;
  onFrame?: (snapshot: RenderSnapshot) => void;
}) {
  const three = useThree((s) => s.camera) as R3FCamera;
  const gl = useThree((s) => s.gl);
  const view = useMemo(() => new ThreeSceneView(), []);
  const ortho = camera.projection === "orthographic";

  // Orbit state for interactive mode (spherical coords around the target).
  const orbit = useRef({
    target: new Vector3(camera.target[0], camera.target[1], camera.target[2]),
    distance: 1,
    theta: 0,
    phi: Math.PI / 3,
    initialized: false,
  });

  useEffect(() => {
    three.near = camera.near;
    three.far = camera.far;
    if (isPerspective(three)) {
      three.fov = camera.fov;
    } else {
      three.zoom = 100 * camera.zoom;
    }
    three.updateProjectionMatrix();
  }, [three, camera.fov, camera.near, camera.far, camera.zoom]);

  useEffect(() => {
    if (autoplay) player.play();
  }, [player, autoplay]);

  useEffect(() => () => view.dispose(), [view]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const o = orbit.current;
    // Seed spherical coords from the camera's authoring eye/target.
    const eye = camera.position;
    const t = orbit.current.target;
    const dx = eye[0] - t.x;
    const dy = eye[1] - t.y;
    const dz = eye[2] - t.z;
    o.distance = Math.hypot(dx, dy, dz) || 5;
    o.theta = Math.atan2(dx, dz);
    o.phi = Math.acos(Math.max(-1, Math.min(1, dy / o.distance)));
    o.initialized = true;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent): void => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      o.theta -= (e.clientX - lastX) * 0.005;
      o.phi = Math.max(0.05, Math.min(Math.PI - 0.05, o.phi - (e.clientY - lastY) * 0.005));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent): void => {
      dragging = false;
      el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent): void => {
      if (ortho && !isPerspective(three)) {
        three.zoom = Math.max(1, three.zoom * (1 - e.deltaY * 0.001));
        three.updateProjectionMatrix();
      } else {
        o.distance = Math.max(0.2, o.distance * (1 + e.deltaY * 0.001));
      }
      e.preventDefault();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [interactive, gl, camera, three, ortho]);

  useFrame((_, delta) => {
    player.update(Math.min(delta, 0.05));
    const snapshot = player.getSnapshot();
    view.update(snapshot, { worldPerPixel: 1 });

    if (interactive && orbit.current.initialized) {
      const o = orbit.current;
      const sinPhi = Math.sin(o.phi);
      three.position.set(
        o.target.x + o.distance * sinPhi * Math.sin(o.theta),
        o.target.y + o.distance * Math.cos(o.phi),
        o.target.z + o.distance * sinPhi * Math.cos(o.theta),
      );
      three.lookAt(o.target);
    } else {
      const cam = snapshot.objects.get(camera.id);
      if (cam && cam.state.dimension === "3d") {
        const p = cam.state.transform.position;
        const q = cam.state.transform.rotation;
        three.position.set(p[0], p[1], p[2]);
        three.quaternion.set(q[0], q[1], q[2], q[3]);
      }
    }
    onFrame?.(snapshot);
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 6]} intensity={1.1} />
      <directionalLight position={[-6, -3, -4]} intensity={0.35} />
      <primitive object={view.root} />
    </>
  );
}
