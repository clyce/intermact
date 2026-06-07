import { type Animation, type AnimationSpec, toAnimation } from "./spec";

/**
 * Composition helpers (design.md §11.2). `scene.play(a, b, c)` is parallel by
 * default; use `sequence(...)` for serial. These return Animation handles
 * (data), nothing executes until the Storyboard is played.
 */

/** Run animations one after another. */
export function sequence(...animations: Animation[]): Animation {
  return toAnimation({ kind: "sequence", children: animations.map((a) => a.spec) });
}

/** Run animations simultaneously. */
export function parallel(...animations: Animation[]): Animation {
  return toAnimation({ kind: "parallel", children: animations.map((a) => a.spec) });
}

/** Start each animation offset by `lag` seconds (LaggedStart). */
export function stagger(animations: Animation[], lag: number): Animation {
  return toAnimation({ kind: "stagger", children: animations.map((a) => a.spec), lag });
}

/** Repeat an animation a fixed number of times or infinitely. */
export function repeat(animation: Animation, times: number | "infinite"): Animation {
  return toAnimation({ kind: "repeat", child: animation.spec, times });
}

/** Hold for a duration (advances the build cursor). */
export function wait(duration: number): Animation {
  return toAnimation({ kind: "wait", duration });
}

/**
 * Escape hatch for imperative side effects (design.md §11.5). Marked as a
 * non-seekable boundary: only fired during forward real-time playback, skipped
 * (with a warning) during scrub preview.
 */
export function call(effect: () => void | Promise<void>): Animation {
  const spec: AnimationSpec = { kind: "call", effect };
  return toAnimation(spec);
}
