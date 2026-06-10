# Procedural Generation (PCG)

PCG makes "data/rules → geometry" a set of **pure functions** `(spec) => IMObject2D` (`design.md §6`). Generators are side-effect free, touch no scene; randomness always goes through injected `rng`, so same `spec` + same seed always yields same result — serializable, seekable, testable.

## Generator families

| Category | Functions | Description |
| --- | --- | --- |
| Parametric / lattice | `parametricCurve2D` / `lattice` / `tiling` | Parametric curves, grids, periodic tilings (§6.3) |
| Fractal / rules | `fractal` / `recursiveTree` / `lSystem` / `cellularAutomaton` | IFS/Koch/Sierpinski, recursive trees, L-systems, cellular automata (§6.4) |
| Fields | `functionGraph` / `isoline` / `heatmap` / `streamlines` | Function graphs, isolines, heatmaps, streamlines (§6.2) |
| Graph / data | `graphObject` / `barChart` / `scatter` / `lineChart` / `mapData` | Force-directed graphs, data charts (§6.5) |

```ts
import { parametricCurve2D, recursiveTree, scatter, xy } from "@intermact/core";

const rose = parametricCurve2D({
  domain: [0, Math.PI * 2],
  fn: (t) => [Math.cos(3 * t) * Math.cos(t), Math.cos(3 * t) * Math.sin(t)],
  samples: 400,
  closed: true,
});

const tree = recursiveTree({ depth: 7, branchAngle: 26 });

const dots = scatter({ points: [xy(0, 1), xy(1, 2), xy(2, 1.5)], size: [4, 2] });
```

## Deterministic random: `spec.rng`

Generators needing randomness (`fractal` chaos game, `graphObject` force layout, `cellularAutomaton` random init) explicitly receive an `rng`. **Without injected `rng`, fail-fast throw** — no silent fallback to non-deterministic results.

```ts
import { createRng, graphObject } from "@intermact/core";

const graph = graphObject({
  nodes: ["a", "b", "c", "d"],
  edges: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"]],
  layout: "force",
  rng: createRng("my-seed"), // same seed ⇒ same layout
});
```

> Use `ctx.rng` as default random source at build time; generators remain pure for independent Node/test calls.

## Combinator operators

Operators are pure `IMObject2D → IMObject2D` transforms, chainable; transforms **bake into geometry**, producing new immutable definitions (`design.md §6.6`).

| Operator | Effect |
| --- | --- |
| `transformObject(obj, t)` | Bake translate/rotate/scale into geometry |
| `repeatObject(obj, n, step)` | Repeat `n` copies with compound step |
| `instanceField(obj, transforms)` | Single geometry + per-instance transforms (M16 GPU instancing) |
| `mapPoints(obj, f)` | Per-point map (e.g. conformal transform) |
| `along(obj, path, opts)` | Distribute evenly along path, optional tangent alignment |
| `booleanOp(a, b, op)` | Single-ring polygon union/intersect/subtract/xor |

```ts
import { booleanOp, circle, repeatObject, transformObject, xy } from "@intermact/core";

const crescent = booleanOp(circle({ radius: 1 }), circle({ radius: 1, center: xy(0.5, 0) }), "subtract");

const fan = transformObject(
  repeatObject(circle({ radius: 0.1 }), 8, { position: xy(0.2, 0), rotation: Math.PI / 8 }),
  { position: xy(-2, 0) },
);
```

`booleanOp` supports single-ring operands only; multi-contour objects throw `invalid-argument` (avoids silently dropping rings).

## Plugin generators

PCG is also a registry extension point: register a `GeneratorDescriptor`, dispatch by name with `runGenerator(name, params, rng)` (see [Extensibility guide](/en/guide/extensibility)).

## Related examples

- `pcg/operators-showcase` — `transformObject`/`repeatObject`/`booleanOp`/`mapPoints`/`along` combinators
- `pcg/data-charts` — `mapData` data binding + `scatter`/`lineChart`
- `pcg/generators-extra` — `tiling`/`lattice`/`recursiveTree`/`parametricCurve2D`
- `pcg/lsystem-plant` — L-system plant (deterministic `spec.rng`)
- `pcg/scalar-field-isolines` — `isoline`/`heatmap` scalar fields
- `pcg/vector-field-streamlines` — RK4 `streamlines` vector field
- `pcg/cellular-automaton` — Wolfram Rule 30 + 2D Life `cellularAutomatonFrames`
- `pcg/fractal-graph` — Sierpinski fractal + `graphObject`
- `pcg/data-driven-bars` — data-driven `barChart`

Full list in [example index](/en/examples/).
