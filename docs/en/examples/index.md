# Example Catalog

Source lives in `examples/src/`, registered by `registry.tsx`.

- **[Open interactive demo gallery →](/demos/)** (same site as docs; recommended `pnpm run dev:site`)
- Standalone gallery debugging: `pnpm run dev:examples` (`http://localhost:5173`)

Tables below grouped by **group**, aligned with `dev-roadmap.md` milestone Examples entries. Link to a demo: `/demos/#<id>` (e.g. [`/demos/#reactive/value-tracker`](/demos/#reactive/value-tracker)).

## Phase-1 (v0.1)

### Scaffold / smoke

| ID | Milestone | Description |
| --- | --- | --- |
| `_template/empty-canvas` | M0 | Minimal empty Canvas |
| `_smoke/static-circle` | M0 | Static circle smoke test |

### timeline

| ID | Milestone | Description |
| --- | --- | --- |
| `timeline/seek-basics` | M1 | seek / rate / reverse |
| `timeline/headless-eval` | M1 | Node headless evaluation |
| `timeline/markers-slides` | M1 | marker chapter jumps |

### geometry

| ID | Milestone | Description |
| --- | --- | --- |
| `geometry/primitives-gallery` | M2 | All primitives overview |
| `geometry/sampling-debug` | M2 | Sampling / bounds / triangulation |

### render

| ID | Milestone | Description |
| --- | --- | --- |
| `render/stroke-fill-showcase` | M3 | Three rows: static fill / stroke reveal / Create |
| `render/zorder-transparency` | M3 | z-order and transparency |
| `render/dpi-resize` | M3 | HiDPI + resize |

### anim

| ID | Milestone | Description |
| --- | --- | --- |
| `anim/create-fade-move` | M4 | Create / Fade / Move / Rotate / Scale |
| `anim/sequence-parallel-stagger` | M4 | Orchestration comparison |
| `anim/easing-gallery` | M4 | Easing curves |

### coords

| ID | Milestone | Description |
| --- | --- | --- |
| `coords/cartesian-axes` | M5 | `getAxes` + fade |
| `coords/fit-strategies` | M5 | contain / cover / stretch |
| `coords/polar-scene` | M5 | Polar coordinates |

### reactive

| ID | Milestone | Description |
| --- | --- | --- |
| `reactive/value-tracker` | M6 | §8.2 inscribed rectangle |
| `reactive/leva-binding` | M6 | Leva → Signal |

### L1 gate

| ID | Milestone | Description |
| --- | --- | --- |
| `l1/basic-2d` | L1 | §19.1 basic 2D narrative |
| `l1/interactive-sine` | L1 | §19.2 interactive function curve |

## Phase-2 (v0.2 · math toolbox)

### scale

| ID | Milestone | Description |
| --- | --- | --- |
| `scale/scale-playground` | M7 | linear/log/pow/time comparison + ticks/format |
| `scale/log-plot` | M7 | Log-scale plotting |

### math

| ID | Milestone | Description |
| --- | --- | --- |
| `math/axes-functiongraph` | M8 | Axes + FunctionGraph/Parametric, `c2p` alignment |
| `math/riemann-sum` | M8 | Riemann rectangles converge with `n` |
| `math/tangent-derivative` | M8 | Tangent at moving point, live slope |
| `math/matrix-table-brace` | M8 | Matrix/Table/Brace + DecimalNumber |
| `math/planes` | M8 | NumberPlane / PolarPlane / ComplexPlane |

### morph

| ID | Milestone | Description |
| --- | --- | --- |
| `morph/shape-morph` | M9 | arc-length / anchor transform |
| `morph/contour-mismatch` | M9 | contour padding + cross-fade fallback |
| `morph/matching-shapes` | M9 | `transformMatching` part matching |

### text / latex

| ID | Milestone | Description |
| --- | --- | --- |
| `text/writing` | M10 | Text stroke-by-stroke writing |
| `text/writing-strategies` | M10 | sequential / simultaneous / per-glyph writing strategies |
| `text/multi-font-writing` | M10 | Multi-font mixed writing |
| `text/font-scale` | M10 | Vector glyph multi-size |
| `latex/latex-writing` | M10 | LaTeX formula stroke-by-stroke writing |
| `latex/transform-matching-tex` | M10 | Formula part morph |

### interaction

| ID | Milestone | Description |
| --- | --- | --- |
| `interaction/draggable-bezier` | M11 | Drag control points, live Bézier recompute |
| `interaction/hit-testing` | M11 | Precise hit on thin lines/rings |
| `interaction/explorable-derivative` | M11 | Drag `x` to explore tangent/derivative |

### layout / devtools

| ID | Milestone | Description |
| --- | --- | --- |
| `layout/next-to-arrange` | M12 | `alignTo/nextTo/arrange` auto layout |
| `layout/responsive-rect` | M12 | Domain-relative UV anchor + `fitTo` |
| `devtools/inspector-tour` | M12 | Inspector full tour |

## Phase-3 (v1.0 · PCG / 3D / export embed / performance / extensibility)

### pcg (procedural generation)

| ID | Milestone | Description |
| --- | --- | --- |
| `pcg/lsystem-plant` | M13 | Bracket L-system plant, Create by growth order |
| `pcg/scalar-field-isolines` | M13 | Scalar field heatmap + marching-squares isolines |
| `pcg/vector-field-streamlines` | M13 | Vector field arrow grid + RK4 streamlines |
| `pcg/cellular-automaton` | M13 | Rule 30 space-time plot + 2D Life `cellularAutomatonFrames` evolution |
| `pcg/data-driven-bars` | M13 | Single array → bar chart + trend line (retains keyed parts) |
| `pcg/fractal-graph` | M13 | Sierpinski fractal + force-directed graph, `transformObject` positioning |
| `pcg/operators-showcase` | M13 | `repeatObject` / `booleanOp` / `mapPoints` / `along` operator composition |
| `pcg/data-charts` | M13 | `scatter` + `lineChart` shared data; `mapData` keyed bubbles |
| `pcg/generators-extra` | M13 | `tiling` / `lattice` / `recursiveTree` / `parametricCurve2D` |

### 3d

| ID | Milestone | Description |
| --- | --- | --- |
| `3d/surface-plot` | M14 | Parametric surface + 3D axes, Create reveals mesh |
| `3d/training-trajectory` | M14 | §19.3 loss surface + optimization trajectory 3D curve |
| `3d/isosurface` | M14 | marching-cubes watertight isosurface extraction |
| `3d/camera-moves` | M14 | §10.1 registered camera: seekable orbit/dolly/lookAt |
| `3d/nested-scene-panel` | M14 | §10.2 `render(scene, camera)` sub-scene as registrable object |
| `3d/grouping` | M14 | §9.3 `group3D` aggregate objects + `polyline3D` collective rotation |

### export / embed

| ID | Milestone | Description |
| --- | --- | --- |
| `export/share-url` | M15 | §17 serialize → URL → rebuild scene from string |
| `export/video-render` | M15 | §17 `MediaRecorder` records GL canvas as WebM |
| `export/semantic-handout` | M15 | §17 metadata semantic overlay + reduced-motion fallback |
| `export/svg-snapshot` | M15 | §17 headless `snapshotToSVG` frames + `sampleFrameHashes` determinism |
| `embed/web-component` | M15 | §17 `<intermact-embed>` custom element mounts share-url |

### perf

| ID | Milestone | Description |
| --- | --- | --- |
| `perf/instanced-10k` | M16 | §15.2 `instanceField` → single `InstancedMesh` 10k instances |
| `perf/large-pointcloud` | M16 | §15.2 60k-point Float32Array streaming point cloud |
| `perf/worker-sampling` | M16 | §15.2 marching-cubes main thread vs Worker |

### plugin (extensibility)

| ID | Milestone | Description |
| --- | --- | --- |
| `plugin/custom-object` | M17 | §18 register new object type + new animation type |
| `plugin/custom-generator` | M17 | §18 register PCG generator, `runGenerator` dispatch by name |
| `plugin/webgpu-backend` | M17 | §18 render backend as registered `RendererFactory` (PoC) |

## Adding a new example

1. Create `*.tsx` under `examples/src/<group>/`, export `*Demo` component
2. Append entry to `demos` array in `registry.tsx`
3. Update this page and corresponding milestone Examples in `dev-roadmap.md`
