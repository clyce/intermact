import { useEffect, useState } from "react";
import {
  buildProgram,
  disposeBuiltProgram,
  type BuiltProgram,
  type IntermactProgram,
  type Player,
  type RenderSnapshot,
  type Scene2D,
} from "@intermact/core";

/**
 * Build a program once and drive its Player with a RAF loop. Returns the live
 * player, its scene, and the latest frame snapshot. Used by headless timeline
 * tooling and legacy SVG demos.
 */
export function useTimelinePlayer(
  program: IntermactProgram,
  seed?: number | string,
): { player: Player | null; scene: Scene2D | null; snapshot: RenderSnapshot | null } {
  const [built, setBuilt] = useState<BuiltProgram | null>(null);
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null);

  useEffect(() => {
    let alive = true;
    let current: BuiltProgram | null = null;
    void buildProgram(program, seed !== undefined ? { seed } : {}).then((b) => {
      if (alive) {
        current = b;
        setBuilt(b);
      } else {
        disposeBuiltProgram(b);
      }
    });
    return () => {
      alive = false;
      if (current) disposeBuiltProgram(current);
    };
  }, [program, seed]);

  useEffect(() => {
    if (!built) return;
    const unsubscribe = built.player.subscribe(setSnapshot);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      built.player.update(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [built]);

  const scene = built && built.scene.kind === "scene-2d" ? built.scene : null;
  return { player: built?.player ?? null, scene, snapshot };
}
