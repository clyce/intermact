# Performance and Big Data

Intermact rendering optimizes for "many objects / large point clouds / heavy resampling" along three paths (`design.md §15.2`): GPU instancing, Float32Array buffer channels, Worker off-main-thread sampling. Core stays DOM/GL agnostic.

## GPU instancing

`instanceField(object, transforms)` expresses massive repetition with single base geometry + per-instance transforms. It both:

- Bakes aggregate geometry into stroke/fill traits — headless sampling, SVG, picking, bounds all correct;
- Carries `InstancedTrait`; GPU renderer draws base geometry once per instance via true `InstancedMesh` (not giant aggregate buffer).

Renderers without instancing path fall back to baked group geometry (pixel-identical, no GPU acceleration). Instanced views disable frustum culling (or extend bounds) to avoid incorrect culling, and handle morph `geometryOverride` and trait change redispatch.

```ts
import { circle, instanceField } from "@intermact/core";
const dots = instanceField(
  circle({ radius: 0.02 }),
  Array.from({ length: 10000 }, () => ({ position: [Math.random() * 8 - 4, Math.random() * 6 - 3] })),
);
```

## Large point clouds: Float32Array channel

`pointCloud3D` consumes `Float32Array` position buffers directly; renderer uploads via that channel, no per-frame geometry rebuild. `Create` reveals by clipping draw range, avoiding per-frame churn — 60k points seek smoothly.

## Worker sampling

Heavy polygonization (e.g. marching-cubes) can run off main thread: `@intermact/render-three` provides worker protocol/kernel/client glue; `core` stays pure. Main thread and Worker paths produce identical geometry.

## Geometry memoization and budgets

- Sampling/triangulation results memoized by content (`geometry/memoize`); same input reuses buffers.
- Timeline seek is pure function: seek on 2000-track interleaved timeline remains correct and fast (see `perf/perf-budget` tests).

## Related examples

- `perf/instanced-10k` — `instanceField` GPU instancing 10k objects
- `perf/large-pointcloud` — Float32Array channel large point cloud
- `perf/worker-sampling` — Worker off-main-thread marching-cubes sampling

Full list in [example index](/en/examples/).
