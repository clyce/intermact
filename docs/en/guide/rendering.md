# Rendering

v0.1 rendering stack: `core` produces `RenderSnapshot` → `render-three` builds three geometry → `render-r3f` diff-updates in R3F.

## Render pipeline

```text
Player.getSnapshot()
  → RenderSnapshot (object id → RuntimeState2D)
  → ThreeSceneView.diff(snapshot)
  → Line/ Mesh geometry + basic material
  → R3F Canvas (orthographic camera + fit)
```

### Stroke

- World-unit **ribbon** geometry
- **`revealEnd` / `revealStart`**: arc-length trim, supports Create animation
- Closed contour arc length **includes** the closing segment (v0.1.1 fix)

### Fill

- earcut triangulation (nonzero + holes); `evenodd` self-intersecting fill deferred to M9/M16
- Unlit + transparent material, `depthWrite: false` (2D painter's algorithm)

### Line width

- World units: directly at scene scale
- Pixel units: ribbon width from `worldPerPixel` (constant screen width approximation)

## IntermactCanvas

```tsx
<IntermactCanvas
  program={program}
  autoplay={true}
  seed={42}
  controls={{ timeline: true }}
  style={{ width: "100%", height: 480 }}
/>
```

- **`fit`**: inherited from `Scene2DProps` (`contain` / `cover` / `stretch`)
- **HiDPI**: `dpr={[1, 2]}`
- **resize**: R3F + `computeFit` recomputes orthographic camera

## SceneRendererAdapter

`render-three` exports the `SceneRendererAdapter` interface; default implementation is `render-r3f`'s `SceneView`. Advanced usage: manually compose `useIntermactPlayer` + `<Canvas>` + `<SceneView>`.

## Related examples

| Example | Validates |
| --- | --- |
| `render/stroke-fill-showcase` | Three rows: static fill / stroke-only reveal / Create (stroke + fill) |
| `render/zorder-transparency` | z-order and transparency |
| `render/dpi-resize` | Container resize + HiDPI |
