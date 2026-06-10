# Timeline and Player

## Storyboard and Track

Each `scene.play` at build time appends to `StoryboardBuilder`:

- **Tracks**: tweens / reveal / morph etc. for `(targetId, property)`
- **Effects**: `call` side effects (**not seekable**)
- **Markers**: named time points for `jumpToMarker` chapter jumps

At playback, `Track.evaluate(localProgress)` is a pure function returning `StatePatch` for a given progress.

## Player API

`IntermactCanvas` creates `Player` internally; also available via `useIntermactPlayer` or `buildProgram`:

| Method | Description |
| --- | --- |
| `play()` / `pause()` | Play / pause |
| `seek(t)` | Jump to time `t` (seconds); **deterministic** state recompute |
| `setRate(rate)` | Playback rate (negative = reverse) |
| `setLoop(loop)` | Loop on/off |
| `jumpToMarker(name)` | Jump to marker |
| `subscribe(fn)` | State change notification |
| `update(deltaSeconds)` | External clock step (called from R3F `useFrame`) |
| `getSnapshot()` | Current `RenderSnapshot` |

In the browser, continuous playback is driven by `@intermact/render-r3f`'s `SceneView` calling `player.update` in `useFrame`; timeline UI calls `seek` directly.

## Orchestration primitives

```ts
import { sequence, parallel, stagger, wait, call } from "@intermact/core";

await scene.play(
  sequence(
    obj.create({ duration: 1 }),
    wait(0.3),
    obj.moveTo(xy(2, 0), { duration: 0.8 }),
  ),
);

await scene.play(
  parallel(
    a.fadeIn({ duration: 0.5 }),
    b.fadeIn({ duration: 0.5 }),
  ),
);

await scene.play(
  stagger(
    [a, b, c].map((o) => o.create({ duration: 1 })),
    { lag: 0.2 },
  ),
);

await scene.play(
  call(() => console.log("Only fires on forward playback; skipped on seek")),
);
```

### Non-seekable boundary

`call` does **not** run on `seek` / drag preview, and logs a one-time console warning (`design.md §11.5`). For replayable logic, use tweens or data-driven state — do not rely on `call` to mutate runtime data.

## Deterministic testing

`packages/core/src/animation/timeline.test.ts` snapshot-asserts Storyboard at multiple `t` samples; `timeline/headless-eval` demonstrates Node headless evaluation.

Same `seed`, same build program, same `seek(t)` must yield the same `RuntimeState`.

## Easing

The `easing` module exports curve names like `linear`, `cubicInOut`, `elasticOut` for `AnimationSpec` and `RegisteredObject` animation options.

Full gallery in example `anim/easing-gallery`.

## Related examples

- `timeline/seek-basics`
- `timeline/markers-slides`
- `timeline/headless-eval`
- `anim/sequence-parallel-stagger`
