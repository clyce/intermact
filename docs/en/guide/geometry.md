# 2D Geometry

The `geometry` module in `@intermact/core` provides immutable primitive factories and sampling kernels (`design.md §5`).

## Primitive factories

| Factory | Description |
| --- | --- |
| `circle` | Circle, `radius` + `samples` |
| `ellipse` | Ellipse, `rx` / `ry` |
| `rectangle` | Rectangle, supports `cornerRadius` |
| `arc` | Circular arc |
| `polygon` | Polygon, supports `holes` |
| `bezierCurve` | Quadratic/cubic Bézier chain |
| `line` | Polyline |
| `arrow` | Line segment + solid triangular arrowhead (base perpendicular to axis) |
| `polyline` | Function/data polyline (M5+) |

```ts
import { circle, polygon, xy } from "@intermact/core";

const star = polygon({
  points: [xy(0, 1), xy(0.3, 0.1) /* … */],
  style: {
    stroke: "#f59e0b",
    fill: "rgba(245,158,11,0.2)",
    fillRule: "evenodd",
    lineWidth: 0.05,
  },
});
```

## Style2D

```ts
style: {
  stroke: "#38bdf8",           // color string
  fill: "rgba(56,189,248,0.2)",
  lineWidth: 0.06,             // world units
  lineWidth: { value: 3, unit: "px" }, // screen pixel approximation
  fillRule: "nonzero" | "evenodd", // v0.1: only nonzero + holes; even-odd deferred
}
```

## Sampling and triangulation

- **`resampleByArcLength`**: uniform arc-length resampling
- **`SampledPath2D`**: `Float32Array` high-performance channel
- **`triangulate`**: earcut, outer contour + holes
- **`computeBounds`**: axis-aligned bounding box

`GeometryProvider2D` unifies `samplePath` / `getBounds` / `sampleBuffer`.

## Trait composition

Objects declare capabilities via traits: `stroke`, `fill` (closed shapes), `morphable` (morphable). Use `findTrait` to query capabilities — no inheritance tree.

## Related examples

- `geometry/primitives-gallery` — all primitives
- `geometry/sampling-debug` — sampling points, bounds, triangulation visualization
