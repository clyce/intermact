# Reactive

The reactive layer aligns with Manim's `ValueTracker` + `add_updater` + `always_redraw` (`design.md §8`).

## Signal and computed

```ts
import { signal, computed } from "@intermact/core";

const radius = signal(1);
const area = computed(() => Math.PI * radius.get() * radius.get());
```

Signals created inside `createProgram` are auto-registered to `ReactiveEngine` via `setSignalRegistrar`.

## derived

Geometry factory with minimal recomputation on signal change:

```ts
import { derived, circle } from "@intermact/core";

const disk = derived(
  () =>
    circle({
      radius: radius.get(),
      style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.2)" },
    }),
  [radius],
);

scene.register(disk, { position: xy(0, 0) });
```

## valueTracker and tweenSignal

```ts
import { valueTracker, tweenSignal } from "@intermact/core";

const t = valueTracker(0);
await scene.play(tweenSignal(t, 1, { duration: 2 }));
```

`tweenSignal` compiles to a seekable `SignalTrack`.

## bindSignal and useSignal

- **`bindSignal`**: bind external source (e.g. Leva) to a signal
- **`useSignal`** (`@intermact/react`): subscribe to signal in React components

```tsx
import { useSignal } from "@intermact/react";

function Panel({ freq }: { freq: Signal<number> }) {
  const f = useSignal(freq);
  return <span>f = {f.toFixed(2)}</span>;
}
```

## Frame loop

`Player.prepareFrame` → `ReactiveEngine.flush` → recompute derived / run `addUpdater` → then generate `RenderSnapshot`.

## Related examples

- `reactive/value-tracker` — §8.2 inscribed rectangle
- `reactive/leva-binding` — §19.2 interactive sine curve
- `l1/interactive-sine` — L1 gate demo
