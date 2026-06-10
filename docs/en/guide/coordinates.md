# Coordinates and Axes

## Scene2D domain

```ts
const scene = ctx.createScene2D({
  coordinate: "cartesian", // or "polar"
  domain: { x: [-6, 6], y: [-4, 4] },
  fit: "contain",
});
```

`domain` defines the scene logical coordinate range; `fit` controls camera adaptation to viewport aspect ratio.

## CoordinateTransform2D

| Method | Description |
| --- | --- |
| `absToRel` / `relToAbs` | Absolute ↔ relative UV |
| `toPolar` / `fromPolar` | Cartesian ↔ polar |

Round-trip consistency covered by unit tests (`coordinate-transform.test.ts`).

## getAxes

Axis objects register via `scene.getAxes(props)`; visibility uses standard animations:

```ts
const axes = scene.getAxes({
  x: [-4, 4],
  y: [-3, 3],
  style: { stroke: "#64748b" },
  showTicks: true,
});

await scene.play(axes.fadeIn({ duration: 0.5 }));
// axes.handle.c2p(x, y) — data coordinates → scene coordinates
```

> **API revision (v0.1.1)**: Removed `showAxes` / `hideAxes` Scene-level helpers; axes behave like ordinary `RegisteredObject`s.

## Minimal math constructs (L1)

| Factory | Purpose |
| --- | --- |
| `functionGraph` | `fn(x)` curve, aligned via `c2p` |
| `decimalNumber` | Seven-segment display number, can `registerReactive` |
| `axesObject` | Low-level axis geometry (usually use `getAxes`) |

Full `Scale` / tick formatting in M7; `NumberPlane` / `Riemann` etc. in M8.

## Related examples

- `coords/cartesian-axes`
- `coords/fit-strategies`
- `coords/polar-scene`
- `l1/interactive-sine` — function graph + Leva tuning
