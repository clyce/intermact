# v1.0 Acceptance Checklist

Corresponds to `dev-roadmap.md` §6 "◆ v1.0 release (DoD)" and `design.md §0.3` Phase-3 implementation progress log. Phase-3 (M13–M17) = PCG core / full 3D / serialization·export·embed / performance & big data / extensibility plugins, gate ◆ L3.

## DoD items

| Requirement | Status | Evidence |
| --- | --- | --- |
| PCG core (fields/sampling, parametric/lattice, recursion/grammar, data-driven, operators) | ✅ | `pcg/*` (6 examples); `pcg.test.ts` (27) |
| Full 3D (Transform3D/RuntimeState3D, Scene3D, registered camera, 3D factories, marching-cubes) | ✅ | `3d/*` (5 examples); 3D factory/camera/marching-cubes cases |
| Serialization / export / embed (serialize·deserialize, share-url, frame export, web-component, semantic layer, reduced-motion) | ✅ | `export/*`, `embed/*` (4 examples); `serialize.test.ts` (11) |
| Performance & big data (GPU instancing, sampling memoize, track pruning, Worker, perf budget) | ✅ | `perf/*` (3 examples); `memoize`/`instanced`/`worker`/`perf-budget` cases |
| Extensibility / plugins (registries, definePlugin/install, four extension points via dispatch) | ✅ | `plugin/*` (3 examples); `extend.test.ts` (10) |
| All P3 examples runnable | ✅ | `pnpm --filter @intermact/examples run build` (925 modules, includes worker chunk) |
| Performance budget met | ✅ | `core/perf/perf-budget.test.ts` in `vitest run`; `pnpm run bench` |
| Plugin mechanism works (new object type + generator without core changes) | ✅ | `extend.test.ts` end-to-end + `plugin/custom-object`·`plugin/custom-generator` |
| Four library packages `VERSION` bumped to `1.0.0` | ✅ | `packages/{core,react,render-three,render-r3f}/src/index.ts`, `package.json` |
| CI green | ✅ | lint + typecheck + vitest (**296**, per CI) + depcruise (**210** modules 0 violations) + build |
| API Reference regenerated | ✅ | `pnpm run gen:reference` (TypeDoc + `typedoc-vitepress-theme`) |

## Milestone exit criteria (summary)

### M13 · PCG core (v0.3.0)

- [x] `pcg/` layer: fields/sampling (isoline marching squares, heatmap, vectorField, streamlines), parametric/lattice/tiling, lSystem/fractal/recursiveTree/graphObject/cellularAutomaton, mapData/barChart/scatter/lineChart, operators (transformObject/repeatObject/instanceField/booleanOp/mapPoints/along)
- [x] Determinism via injected `ctx.rng`; depcruise `pcg-headless-deps` rule
- [x] 6 examples + `pcg.test.ts` (same seed reproducibility, marching squares, CA stepping, operator composition)

### M14 · Full 3D (v0.4.0)

- [x] `Transform3D`/`RuntimeState3D` + 2D|3D snapshot/Player generalization; quaternions
- [x] `Scene3D` + registered `Camera3D` (orbit/dolly/zoom/lookAt/quaternion)
- [x] 3D factories (curve3D/polyline3D/meshObject/surface3D/pointCloud3D/axes3D/group3D) + 3D Create + marching-cubes
- [x] `render-three`/`render-r3f` 3D views + perspective/orbit + `RenderedScene`
- [x] 5 examples + 3D bounds/transform/camera/sampling/marching-cubes cases

### M15 · Serialization / export / embed (v0.5.0)

- [x] `serialize/`: op-log + baked geometry + pristine initial values + signals + seed; golden frame hash per-frame equality
- [x] Phase-1 serialization debt resolved (easing/morph/call/reactive); share-url; SVG/frame hash; web-component; semantic layer + reduced-motion
- [x] 4 examples + `serialize.test.ts` (round-trip equality, golden frame hash, reduced-motion fallback)

### M16 · Performance & big data (v0.6.0)

- [x] True GPU instancing (`InstancedTrait`→`InstancedMesh`); sampling memoize (provider layer)
- [x] Player track interval pruning (binary active window); Worker pure tasks (`render-three/worker/`, core stays DOM-free)
- [x] Performance budget benchmarks in CI (`perf-budget.test.ts`) + `pnpm run bench`
- [x] 3 examples (instanced-10k/large-pointcloud/worker-sampling)

### M17 · Extensibility / plugins (v0.7.0)

- [x] `extend/`: generic `Registry<K,V>` + four descriptor types + `Registries` + `globalRegistries`
- [x] `definePlugin`/`installPlugin` + dispatch helpers (`createRegisteredObject`/`runGenerator`/`selectRenderer`)
- [x] Custom animations via global registry + injected resolver wiring (`custom` spec/`compileSpec`/`StoryboardBuilder`/`customAnimation()`), serialization covers `custom`
- [x] 3 examples (custom-object/custom-generator/webgpu-backend PoC) + `extend.test.ts` (10)

## Known deviations / open items (non-blocking for v1.0)

- **Derived objects / external bindings** not in serialization round-trip (by design; live logic needs host re-wiring); baked objects lose interactive/parametric liveness (static geometry equivalent).
- **GPU instancing** per-instance reveal/picking not done (group opacity/fillProgress for whole fade); point cloud per-point coloring not done (monochrome glow).
- **Worker** subset is pure functions (resample/triangulate/marching-cubes/parse-svg-path); MathJax DOM steps stay on main thread; Worker construction is host responsibility (bundler-related).
- **WebGPU backend** is registry placeholder PoC (feature probe + `selectRenderer` selection + overlay display); real `WebGPURenderer` device wiring (via R3F `<Canvas gl>`) is next PoC step; scene still uses default WebGL.
- **Object type registry** currently serializes geometry via generic bake path (custom serialization hooks not done); complements trait model; descriptor mainly handles construction by name + tool discovery.

See `design.md §0.3` implementation progress log, `phase-3-review.md §13.1–§13.5` milestone reviews.
