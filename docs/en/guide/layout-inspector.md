# Layout and Inspector

M12 delivers two things: **layout/hierarchy** (RectTransform + Manim-style `next_to` relative positioning, `design.md §9.3、§9.4`) and **Inspector** dev-time viewer (`design.md §16`).

## LayoutHandle

Each `RegisteredObject2D` exposes `obj.layout`; methods return **Animation handles** (`duration: 0` = instant; apply via `scene.commit(...)` or `scene.play(...)`). Layout uses **world-space bounds** (parent transforms composed) and immediately writes authorized transform back, so chained `getBounds`/layout within one build is deterministic.

```ts
interface LayoutHandle {
  getBounds(): Bounds2D;                                  // world AABB
  alignTo(point: AbsXY, opts?): Animation;                // align self anchor to point
  nextTo(target, direction: Vec2, opts?): Animation;      // beside another object ([1,0]=right…)
  fitTo(bounds: Bounds2D, opts?): Animation;              // uniform scale + center fit
  arrange(children, opts?): Animation;                    // row/column/grid (parallel)
}
```

```ts
// Title at top, subtitle below title, cards in a row
scene.commit(title.layout.alignTo(scene.coordinate.relToAbs(uv(0.5, 0.86)), { anchor: uv(0.5, 0.5) }));
await scene.play(
  subtitle.layout.nextTo(title, [0, -1], { gap: 0.3, duration: 0.4 }),
  subtitle.create({ duration: 0.4 }),
);
await scene.play(container.layout.arrange(cards, { direction: "row", gap: 0.4, duration: 0.7 }));
```

- `alignTo`'s `anchor` is a **normalized point on self bounds** (`uv(0,0)` bottom-left, `uv(0.5,0.5)` center, `uv(1,1)` top-right).
- `nextTo`'s `direction` takes sign per component; non-zero axis uses "half-width + half-width + gap" edge alignment, other axis aligns to target center.
- `fitTo` is **uniform** scale (preserve aspect) then center; `padding` insets target box first.
- `arrange` supports `row`/`column`/`grid` (`cols`), returns `parallel` animation.

## Transform hierarchy (§9.3)

```ts
const root = scene.registerEmpty({ position: xy(1, 0) });
const child = scene.register(circle({ radius: 0.2 }), { position: xy(2, 0) });
scene.setParent(child, root);
await scene.play(root.rotateTo(Math.PI / 2, { duration: 1 })); // child inherits world transform
```

Animations write **local** transform; Player composes **world** transform along parent chain (TRS, no shear) into `RuntimeState.transform` at **snapshot stage**; opacity multiplies along chain. `obj.layout.getBounds()` returns true world bounds; for parented objects, layout converts local offset in parent space.

## Inspector (§16)

DOM overlay inspector above canvas:

```tsx
<IntermactCanvas program={program} controls={{ timeline: true, inspector: true }} />
```

Shows:

- **registry + runtime state**: each object's id / world position / scale / opacity / zIndex / visibility;
- **active Tracks**: track count at current time;
- **reactive graph**: signals / derived (with signal deps) / updater counts;
- **bounds highlight**: check `bounds` to draw world AABB per object in SVG overlay; click row to highlight object.

Also usable standalone: `<Inspector built={built} />` (inside a relatively positioned container).

## Design deviations (concrete)

- LayoutHandle computes in world space and **immediately writes authorized transform** (enables chained layout), while returning playable/commit-able Animation — consistent with §9.4 "methods return animation handles".
- World transform composition at **Player snapshot stage** (not render layer), keeping renderer adapter consuming only `RenderSnapshot`; `anchor` field for `alignTo` semantics, render pivot remains object local origin.
- Inspector bounds projection defaults to `contain` fit (same as `IntermactCanvas`); custom fit via `fit` prop.

## Related examples

- `layout/next-to-arrange` — `alignTo`/`nextTo`/`arrange` combined layout.
- `layout/responsive-rect` — domain-relative UV anchor + `fitTo`.
- `devtools/inspector-tour` — Inspector full tour (registry/track/reactive graph/bounds).
