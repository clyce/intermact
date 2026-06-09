/**
 * Draggable interactive objects (design.md §12.3). These bake an
 * {@link InteractiveTrait} (pick proxy + signal-backed {@link DragBinding}) into a
 * handle object. Dragging writes the bound signal, so any derived geometry
 * recomputes through the reactive engine (§8) — the basic block of "explorable"
 * interaction. The host (`scene.register`) auto-wires an updater so the handle
 * follows its signal.
 */
import { circle, rectangle } from "../geometry/primitives";
import { type AbsXY, clamp, xy } from "../math/vec";
import { type ObjectStyle } from "../object/style";
import { type InteractiveTrait } from "../object/traits";
import { type IMObject2D } from "../object/types";
import { derived, type ReactiveObjectSource } from "../reactive/derived";
import { type ReadonlySignal, type Signal } from "../reactive/signal";
import { pickRectFromObject } from "./hit-test";
import { type DragBinding, type PickProxy, type PointerEventBinding } from "./types";

/** Append an interactive trait to a base object (immutably). */
function withInteractive(base: IMObject2D, trait: InteractiveTrait): IMObject2D {
  return { ...base, traits: [...base.traits, trait] };
}

/** Options for {@link interactive}. */
export interface InteractiveOptions {
  /** Pick proxy (default: the object's bounds rect). */
  readonly pick?: PickProxy;
  readonly binding?: PointerEventBinding;
  readonly cursor?: string;
}

/**
 * Attach pointer interaction to any object functionally (design.md §12.2). Unlike
 * `RegisteredObject2D.on`, this returns a new definition, so it composes inside
 * reactive `derived(...)` builders that rebuild the object each frame.
 */
export function interactive(base: IMObject2D, opts: InteractiveOptions = {}): IMObject2D {
  const trait: InteractiveTrait = {
    kind: "interactive",
    pick: opts.pick ?? pickRectFromObject(base),
    ...(opts.binding ? { binding: opts.binding } : {}),
    ...(opts.cursor ? { cursor: opts.cursor } : {}),
  };
  return withInteractive(base, trait);
}

/** Options for {@link draggablePoint}. */
export interface DraggablePointOptions {
  readonly radius?: number;
  /** Pick radius as a multiple of `radius` (default 1.6 for easier grabbing). */
  readonly hitScale?: number;
  readonly style?: ObjectStyle;
  readonly binding?: PointerEventBinding;
}

/**
 * A draggable 2D point handle bound to an `AbsXY` signal (design.md §12.3). The
 * handle geometry is centered at the signal's current value, so registering it
 * reactively (see {@link draggablePointSource}) makes it follow the signal.
 */
export function draggablePoint(sig: Signal<AbsXY>, opts: DraggablePointOptions = {}): IMObject2D {
  const radius = opts.radius ?? 0.12;
  const center = sig.get();
  const base = circle({
    radius,
    center,
    style: opts.style ?? { fill: "#fbbf24", stroke: "#ffffff", lineWidth: 0.02 },
  });
  const drag: DragBinding = {
    kind: "point",
    read: () => sig.get(),
    write: (p) => sig.set(p),
  };
  const pick: PickProxy = { kind: "disc", center, radius: radius * (opts.hitScale ?? 1.6) };
  const trait: InteractiveTrait = {
    kind: "interactive",
    pick,
    drag,
    cursor: "grab",
    ...(opts.binding ? { binding: opts.binding } : {}),
  };
  return withInteractive(base, trait);
}

/** Reactive source for a draggable point that follows its signal (design.md §8, §12.3). */
export function draggablePointSource(
  sig: Signal<AbsXY>,
  opts: DraggablePointOptions = {},
): ReactiveObjectSource {
  return derived([sig as ReadonlySignal<unknown>], () => draggablePoint(sig, opts));
}

/** Options for {@link draggableValue}. */
export interface DraggableValueOptions {
  /** Fixed coordinate on the non-dragged axis (default 0). */
  readonly baseline?: number;
  /** Clamp the dragged scalar to `[min,max]`. */
  readonly range?: readonly [number, number];
  readonly size?: number;
  readonly style?: ObjectStyle;
  /** Map a scalar value → world handle position (default uses `axis`/`baseline`). */
  readonly toWorld?: (value: number) => AbsXY;
  /** Map a world position → scalar value (default reads the dragged axis). */
  readonly fromWorld?: (world: AbsXY) => number;
  readonly binding?: PointerEventBinding;
}

/** A draggable scalar handle that slides along one axis (design.md §12.3). */
export function draggableValue(
  sig: Signal<number>,
  axis: "x" | "y",
  opts: DraggableValueOptions = {},
): IMObject2D {
  const baseline = opts.baseline ?? 0;
  const size = opts.size ?? 0.18;
  const toWorld =
    opts.toWorld ?? ((v: number) => (axis === "x" ? xy(v, baseline) : xy(baseline, v)));
  const fromWorld = opts.fromWorld ?? ((p: AbsXY) => (axis === "x" ? p[0] : p[1]));
  const center = toWorld(sig.get());
  const base = rectangle({
    width: size,
    height: size,
    center,
    style: opts.style ?? { fill: "#38bdf8", stroke: "#ffffff", lineWidth: 0.02 },
  });
  const drag: DragBinding = {
    kind: "value",
    read: () => toWorld(sig.get()),
    write: (p) => {
      let v = fromWorld(p);
      if (opts.range) v = clamp(v, opts.range[0], opts.range[1]);
      sig.set(v);
    },
  };
  const pick: PickProxy = { kind: "disc", center, radius: size * 1.4 };
  const trait: InteractiveTrait = {
    kind: "interactive",
    pick,
    drag,
    cursor: axis === "x" ? "ew-resize" : "ns-resize",
    ...(opts.binding ? { binding: opts.binding } : {}),
  };
  return withInteractive(base, trait);
}

/** Reactive source for a draggable scalar handle that follows its signal. */
export function draggableValueSource(
  sig: Signal<number>,
  axis: "x" | "y",
  opts: DraggableValueOptions = {},
): ReactiveObjectSource {
  return derived([sig as ReadonlySignal<unknown>], () => draggableValue(sig, axis, opts));
}
