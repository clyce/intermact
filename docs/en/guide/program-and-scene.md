# Program and Scene

## createProgram

`createProgram` wraps an async build callback and returns `IntermactProgram`. `IntermactCanvas` or `buildProgram` runs the build once, producing `Player` + `Storyboard`.

```ts
import { createProgram, xy } from "@intermact/core";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian", // or "polar"
    domain: { x: [-5, 5], y: [-4, 4] },
    fit: "contain",          // contain | cover | stretch
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // … register objects, scene.play(…)
});
```

### IntermactProgramContext

| Method | Description |
| --- | --- |
| `createScene2D(props)` | Create `Scene2D`, bound to `ReactiveEngine` |
| `createCamera2D(scene, props?)` | 2D orthographic camera description |
| `mount(scene, camera, rect?)` | Record viewport (v0.1 single main scene) |
| `rng` | Seeded RNG (`createRng`); same seed is reproducible |

`buildProgram(program, { seed })` can run headlessly in Node for tests and export pipelines.

## Scene2D

### register

Register an immutable `IMObject2D` into the scene:

```ts
const obj = scene.register(circle({ radius: 1, style: { stroke: "#fff" } }), {
  position: xy(1, 2),
  rotation: 0,
  scale: xy(1, 1),
  opacity: 1,
});
```

`register` returns `RegisteredObject2D` — the receiver for all animation APIs.

### play

```ts
await scene.play(
  obj.create({ duration: 1 }),
  other.fadeIn({ duration: 0.5 }),
);
```

Multiple `Animation` arguments play in parallel. Internally compiled into Storyboard tracks — no wall-clock wait.

### getAxes

Axes are **ordinary registered objects**, not special side-effect APIs on Scene:

```ts
const axes = scene.getAxes({
  x: [-4, 4],
  y: [-3, 3],
  style: { stroke: "#94a3b8", lineWidth: 0.03 },
  xLabel: "x",
  yLabel: "y",
  showTicks: true,
  showTickLabels: false,
});

await scene.play(axes.fadeIn({ duration: 0.6 }));
```

`axes.handle` provides `c2p` / `p2c` coordinate mapping (for math construct alignment).

## RegisteredObject2D animation shortcuts

| Method | Description |
| --- | --- |
| `create(opts?)` | Stroke reveal + optional fill strategy |
| `fadeIn` / `fadeOut` | Opacity tween |
| `moveTo` / `rotateTo` / `scaleTo` | Transform tweens |
| `fadeTo` | Opacity to target value |
| `tween(property, to, opts?)` | Generic property tween (including `reveal`) |
| `addUpdater(fn)` | Per-frame update callback (requires scene-bound ReactiveEngine) |

See [Animation](./animation.md).

## Coordinate helpers

```ts
import { xy, uv } from "@intermact/core";

xy(1, 2);   // Scene absolute coordinates (same units as domain)
uv(0.5, 0); // Relative UV (layout milestone extension)
```

`scene.coordinateTransform` provides `absToRel` / `relToAbs` / `toPolar` / `fromPolar` (see [Coordinates](./coordinates.md)).

## Related examples

- `timeline/seek-basics` — single tween seek
- `coords/cartesian-axes` — `getAxes` + fadeIn
- `l1/basic-2d` — §19.1 comprehensive narrative
