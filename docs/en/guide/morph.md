# Morph and Part Matching

Morph smoothly transforms a registered object's geometry to another object definition (`design.md §11.4`). All strategies compile to **pure, seekable** Tracks: any time `t` evaluates deterministically; scrub the timeline back and forth.

## Strategy overview

```ts
type MorphStrategy = "arc-length" | "anchor" | "matching" | "cross-fade";

// Standalone function
morph(source, target, { strategy, duration, easing, sampleCount, matchBy, preserveStyle });
transformMatching(source, target, options); // = morph(..., { strategy: "matching" })

// RegisteredObject2D methods
obj.morphTo(target, options);
obj.transformMatchingTo(target, options);
```

| Strategy | Purpose |
| --- | --- |
| `arc-length` | Default. Resample both sides to same point count by arc length, interpolate point-wise |
| `anchor` | On `arc-length`, optimal alignment per contour (best cyclic rotation for closed, direction for open) to reduce twist |
| `matching` | Composite objects transform by **part key** (see below) |
| `cross-fade` | Fallback when topology differs too much: dissolve (source fade out → swap geometry → target fade in) |

## Different contour counts

`morph` first **pairs contours by descending length** (`design.md §11.4`: match by area/length); unequal counts pad with **zero-length contours collapsed to centroid**. Extra target contours grow from centroid; extra source contours collapse away.

```ts
// 1 circle → group of 2 circles: second ring grows from centroid
circleObj.morphTo(group2D([circle({ center: xy(-2, 0) }), circle({ center: xy(2, 0) })]));
```

## group2D and part keys

Composite objects use `group2D`, preserving each child's **key**:

```ts
import { group2D } from "@intermact/core";

const g = group2D([
  { key: "a", object: circle({ center: xy(-2, 0) }) },
  { key: "b", object: circle({ center: xy(2, 0) }) },
]);
// Or auto index keys: group2D([objA, objB])
// Or derived keys: group2D([objA, objB], { keyOf: (o, i) => o.type + i })
```

After aggregation, `group2D` renders as one object (merged child contours), but `parts` metadata serves matching.

## matching part matching

`transformMatching` classifies child parts by key into three categories (Manim `TransformMatchingTex` model):

- **transformer**: key on both sides → smooth transform;
- **remover**: key only on source → collapse to part centroid and vanish;
- **introducer**: key only on target → grow from centroid.

```ts
const source = group2D([
  { key: "a", object: circle(...) },
  { key: "b", object: circle(...) }, // source only: remover
]);
const target = group2D([
  { key: "a", object: rectangle(...) }, // shared: transformer
  { key: "c", object: triangle(...) }, // target only: introducer
]);
source.transformMatchingTo(target, { duration: 2 });
```

> **Implementation note**: current single-object rendering has no "per-part opacity" channel, so remover/introducer use **geometry collapse/growth** for fade semantics (not per-part alpha). `cross-fade` on a single registered object is **dissolve** (sequential fade out → fade in); for true stacked cross-fade, use two objects with separate `fadeOut`/`fadeIn`. These are equivalent implementations under single-object architecture, not downgrades; M10 formula pipeline reuses matching with tokens as part keys.

## Related examples

- `morph/shape-morph` — arc-length and anchor transforms across shapes with different point counts
- `morph/contour-mismatch` — contour count padding + cross-fade fallback
- `morph/matching-shapes` — `transformMatching` transformer/remover/introducer by key
