import {
  type Animation,
  type AnimationSpec,
  type PropertyPath,
  type TweenOptions,
  toAnimation,
} from "./spec";

/** Default tween/fade duration in seconds when none is supplied. */
export const DEFAULT_TWEEN_DURATION = 1;

/** Wrap a spec in a leading `wait` when a positive delay is requested (§3.2). */
function withDelay(spec: AnimationSpec, delay?: number): Animation {
  if (delay && delay > 0) {
    return toAnimation({
      kind: "sequence",
      children: [{ kind: "wait", duration: delay }, spec],
    });
  }
  return toAnimation(spec);
}

/**
 * Build a property `tween` toward `to`, honoring shared duration/easing/delay
 * options. Shared by the 2D and 3D registered-object tween families
 * (`moveTo`/`rotateTo`/`scaleTo`/`fadeTo`) so the spec-construction boilerplate
 * lives in one place (design.md §11, §13.6.1 DRY).
 */
export function buildTweenSpec(
  targetId: string,
  property: PropertyPath,
  to: unknown,
  options?: TweenOptions,
): Animation {
  const spec: AnimationSpec = {
    kind: "tween",
    targetId,
    property,
    to,
    duration: options?.duration ?? DEFAULT_TWEEN_DURATION,
    ...(options?.easing !== undefined ? { easing: options.easing } : {}),
  };
  return withDelay(spec, options?.delay);
}

/**
 * Build a `fade` (`from`→`to` opacity) honoring shared options. Used by
 * `fadeIn` (0→1 with baseline-hidden semantics) on both 2D and 3D objects.
 */
export function buildFadeSpec(
  targetId: string,
  from: number,
  to: number,
  options?: TweenOptions,
): Animation {
  const spec: AnimationSpec = {
    kind: "fade",
    targetId,
    from,
    to,
    duration: options?.duration ?? DEFAULT_TWEEN_DURATION,
    ...(options?.easing !== undefined ? { easing: options.easing } : {}),
  };
  return withDelay(spec, options?.delay);
}
