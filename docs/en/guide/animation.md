# Animation

v0.1 animations all compile to `AnimationSpec` → `Track`, seekable at any moment (`call` excepted).

## Create

Stroke draws along arc length; fill strategy optional:

```ts
await scene.play(
  obj.create({
    duration: 2,
    easing: "cubicInOut",
    fill: { mode: "after-stroke-fade", overlap: 0.2 },
  }),
);
```

| `fill.mode` | Behavior |
| --- | --- |
| `none` | Stroke only |
| `with-stroke` | Fill with stroke |
| `after-stroke` | Instant fill after stroke completes |
| `after-stroke-fade` | Fade in fill after stroke completes |

**Object is invisible before play** (reveal starts at 0).

## Fade / Move / Rotate / Scale

```ts
await scene.play(
  obj.fadeIn({ duration: 0.6 }),
  obj.moveTo(xy(2, 0), { duration: 1, easing: "quadOut" }),
  obj.rotateTo(Math.PI / 4, { duration: 0.8 }),
  obj.scaleTo(xy(1.5, 1.5), { duration: 0.5 }),
);
```

## Morph

Default **arc-length** normalized interpolation; v0.2 also provides `anchor`, `matching` (part-key matching), and `cross-fade` fallback. See [Morph and part matching](/en/guide/morph).

```ts
import { morph, rectangle } from "@intermact/core";

await scene.play(
  morph(disk, rectangle({ width: 2, height: 1, style: { … } }), {
    duration: 1.2,
    strategy: "arc-length", // or "anchor" | "matching" | "cross-fade"
  }),
);

// Or RegisteredObject2D instance method
await scene.play(disk.morphTo(rectangle({ … }), { duration: 1.2 }));
```

At runtime, sampled contours are interpolated via `geometryOverride`; renderer prefers override.

## Generic tween

```ts
obj.tween({ type: "reveal" }, 1, { duration: 2.5, easing: "cubicInOut" });
```

## Related examples

- `anim/create-fade-move`
- `anim/sequence-parallel-stagger`
- `anim/easing-gallery`
- `l1/basic-2d` — Create + morph + seek
