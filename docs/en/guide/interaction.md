# Interaction System

Connect pointer/keyboard interaction to the reactive layer (`design.md §12`): dragging control points writes signals; dependent geometry recomputes automatically (§8). Basic building blocks for audience-driven exploration.

## Hit testing (pick proxy)

Thin lines and hollow shapes are hard to raycast in WebGL. Intermact generates **pick proxy geometry** for interactive objects and performs **analytic hit testing in scene space** (pointer unprojected to world coordinates, intersect proxy) — precise for thin lines/points, no raycast precision issues.

```ts
type PickProxy =
  | { kind: "disc"; center: AbsXY; radius: number }   // point
  | { kind: "rect"; min: AbsXY; max: AbsXY }           // region
  | { kind: "band"; polylines: Float32Array[]; width: number }; // thin-line band

// Helpers: band proxy from stroke / rect proxy from bounds
pickBandFromObject(object, width);
pickRectFromObject(object, pad?);
```

`hitTest(entries, p)` returns topmost hit object id (by `zIndex`).

## Events and coordinate unprojection

Event objects provide three coordinate spaces (`design.md §12.2`); authors need not unproject manually:

```ts
interface IntermactPointerEvent {
  screen: Vec2;     // pixels
  sceneAbs: AbsXY;  // scene world (already unprojected)
  sceneRel: RelUV;  // normalized
  targetId?: string;
}
interface IntermactDragEvent extends IntermactPointerEvent {
  deltaAbs: AbsXY;
  startAbs: AbsXY;
}
```

Binding via `RegisteredObject2D.on(binding, pick?)` (static objects) or `interactive(object, { pick, binding })` (for `derived` builds):

```ts
scene.register(line({ from, to })).on(
  { onPointerDown: (e) => console.log("hit", e.sceneAbs) },
  pickBandFromObject(obj, 0.18),
);
```

## Draggable control points

```ts
import { draggablePointSource, draggableValueSource, signal, derived } from "@intermact/core";

const p0 = signal(xy(-2, 0));
scene.registerReactive(draggablePointSource(p0));
scene.registerReactive(derived([p0], () => bezierCurve({ points: [p0.get(), /* … */] })));
// Drag control point → write signal → curve recomputes live
```

- `draggablePoint(sig)` / `draggablePointSource(sig)` — 2D point; drag writes `Signal<AbsXY>`.
- `draggableValue(sig, axis)` / `draggableValueSource(...)` — scalar handle sliding along axis; supports `range` clamp, `toWorld`/`fromWorld` custom mapping (handle slides along curve).

> Handle geometry centers on current signal value — use `registerReactive` (or `*Source`) so it follows the signal.

## Keyboard

`IntermactCanvas` (keyboard on by default): Space play/pause, ← → step frame (`Shift`+←→ = ±1s), `Home`/`End` jump to start/end.

## Design deviations (concrete)

- Hit testing uses **scene-space analytic intersection** (pick proxy disc/rect/band), not invisible pick mesh + WebGL raycast — equivalent and more stable/deterministic under 2D orthographic.
- Unprojection via orthographic camera `unproject`; pure functions `unprojectOrtho`/`projectOrtho` for tests and headless use.

## Related examples

- `interaction/draggable-bezier` — Bézier curve with live recomputation on control-point drag.
- `interaction/hit-testing` — precise hit and highlight on thin lines/rings.
- `interaction/explorable-derivative` — drag `x` to explore tangent/derivative readout.
