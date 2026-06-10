# Math Construct Library

The math construct layer (`design.md §7.4`) builds on [Scale](/en/guide/scale) and coordinate systems, providing Manim-style but interactive math objects. All constructs are pure functions producing a single `IMObject2D` (all contours internal), runnable headlessly, with standard animation APIs (`create`/`fadeIn`/…) on `RegisteredObject2D`.

> **Numbers and labels**: axis ticks, matrix/table entries, and `decimalNumber` use OpenType outline glyphs (same font stack as [Text and LaTeX pipeline](/en/guide/text-latex)). Use `textObject` / `layoutMathJaxLatex` for formulas and long text.

## Coordinate constructs

| Factory | Description |
| --- | --- |
| `scene.getAxes(props)` | Register axes, returns `RegisteredAxes2D` (with `handle`); ticks/labels from `Scale` |
| `numberLine(spec)` | 1D number line: maps data domain to world segment with ticks and numbers |
| `numberPlane(spec)` | Cartesian grid plane |
| `polarPlane(spec)` | Polar grid (concentric circles + radial spokes) |
| `complexPlane(spec)` | Complex plane (isomorphic to `numberPlane`, Re/Im semantics) |

```ts
import { numberLine, numberPlane, polarPlane } from "@intermact/core";

const line = numberLine({ domain: [0, 10], center: xy(0, 0), length: 10, tickCount: 6 });
const grid = numberPlane({ x: [-5, 5], y: [-3, 3], tickCount: 8 });
const polar = polarPlane({ center: xy(0, 0), maxRadius: 4, radiusStep: 1, spokes: 12 });
```

## Axis-attached constructs

These accept `ax.handle` (`AxesHandle`), positioning via `c2p` (data → world point) to stay aligned with axes. `AxesHandle` also exposes `xScale`/`yScale` (M7); constructs share the same scale as axes.

| Factory | Description |
| --- | --- |
| `functionGraph(handle, fn, opts?)` | `y = f(x)` polyline |
| `parametricGraph(handle, fn, opts?)` | Parametric curve `t → [x, y]` |
| `areaUnderCurve(handle, fn, range, opts?)` | Fill between curve and baseline |
| `riemannRectangles(handle, fn, opts?)` | Riemann sum rectangles, converges with `n` |
| `tangentLine(handle, fn, at, opts?)` | Tangent (slope via central difference) |

```ts
import { functionGraph, riemannRectangles, tangentLine } from "@intermact/core";

const ax = scene.getAxes({ x: [0, 3], y: [0, 9], tickCount: 6 });
scene.register(functionGraph(ax.handle, (x) => x * x));
scene.register(riemannRectangles(ax.handle, (x) => x * x, { domain: [0, 3], n: 12 }));
scene.register(tangentLine(ax.handle, (x) => x * x, 1.5, { length: 1 }));
```

Helpers `riemannSum(fn, domain, n, sample?)` and `slopeAt(fn, at, dx?)` return numeric values for readouts or test assertions. Sample positions `"left" | "midpoint" | "right"` determine rectangle height sampling.

## Expression and annotation

| Factory | Description |
| --- | --- |
| `matrixObject(spec)` | Bracketed matrix; internal column/row sizing |
| `tableObject(spec)` | Grid-lined table |
| `brace(target, direction, opts?)` | Brace along a target edge |
| `decimalNumber(tracker, opts?)` | Number refreshed live from `tracker` (M6 reactive) |

`brace` accepts `Bounds2D` or any `IMObject2D` (reads geometry bounds); `direction` points outward (e.g. `[0, -1]` = below). Keeps `constructs` layer independent of scene/`RegisteredObject`.

```ts
import { matrixObject, brace } from "@intermact/core";

const m = matrixObject({ values: [[2, -1], [0, 3]], center: xy(-3, 1) });
scene.register(m);
scene.register(brace(m, [0, -1], { depth: 0.35 }));
```

## c2p alignment and reactive

`functionGraph`/`riemann`/`tangent` etc. call `handle.c2p` on each rebuild, so when wrapped in `derived([...])` driven by `signal`/`valueTracker`, they recompute live (`riemann` converges with `n`, `tangent` updates slope at moving point). Consistent with M6 reactive chain.

## Related examples

- `math/axes-functiongraph` — Axes + FunctionGraph/Parametric, `c2p` alignment
- `math/riemann-sum` — Riemann sum converges to ∫₀³x²dx = 9
- `math/tangent-derivative` — Explorable derivative: moving-point tangent + slope readout
- `math/matrix-table-brace` — Matrix/Table/Brace + DecimalNumber updated by tween
- `math/planes` — NumberPlane / PolarPlane / ComplexPlane
