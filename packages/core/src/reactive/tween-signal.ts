import {
  type Animation,
  type AnimationSpec,
  type TweenOptions,
  toAnimation,
} from "../animation/spec";
import { getSignalId, type Signal } from "./signal";

const DEFAULT_DURATION = 1;

/**
 * Tween a numeric signal over time (design.md §8.4). Compiles to a seekable
 * signal track applied by the Player alongside runtime state tracks.
 */
export function tweenSignal(sig: Signal<number>, to: number, options?: TweenOptions): Animation {
  const spec: AnimationSpec = {
    kind: "tween-signal",
    signalId: getSignalId(sig),
    from: sig.get(),
    to,
    duration: options?.duration ?? DEFAULT_DURATION,
    ...(options?.easing !== undefined ? { easing: options.easing } : {}),
  };
  return toAnimation(spec);
}
