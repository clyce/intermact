# v0.2 Acceptance Checklist

Corresponds to `dev-roadmap.md` §5 "◆ v0.2 acceptance (DoD)" and `design.md §0.2` implementation progress log.

## DoD items

| Requirement | Status | Evidence |
| --- | --- | --- |
| Scale (linear/log/pow/time + ticks/format/invert) | ✅ | `scale/scale-playground`, `scale/log-plot`; `scale.test.ts` |
| Math construct library (NumberLine/Axes/Planes/Graph/Riemann/Tangent/Matrix/Table/Brace/DecimalNumber) | ✅ | `math/*` (5); `constructs.test.ts` |
| Morph (arc-length/anchor/cross-fade + matching part matching) | ✅ | `morph/*` (3); `morph-strategies.test.ts` |
| Text / LaTeX pipeline (parse→layout→writing→matching + AssetManager) | ✅ | `text/*`, `latex/*`; `text.test.ts` |
| Interaction system (pick proxy hit, unprojection, draggable, keyboard) | ✅ | `interaction/*` (3); `interaction.test.ts` |
| Layout + Inspector (alignTo/nextTo/fitTo/arrange, hierarchy, inspector) | ✅ | `layout/*`, `devtools/inspector-tour`; `layout.test.ts` |
| Interactive calculus demos (Riemann convergence, tangent at moving point, drag exploration) | ✅ | `math/riemann-sum`, `math/tangent-derivative`, `interaction/explorable-derivative` |
| Formula part morph available | ✅ | `latex/transform-matching-tex`, `morph/matching-shapes` |
| All packages `VERSION` bumped to `0.2.0` | ✅ | `packages/*/src/index.ts`, `packages/*/package.json` |
| CI green | ✅ | lint + typecheck + vitest + depcruise (119 modules 0 violations) + build |

## Milestone exit criteria (summary)

### M7 · Scale

- [x] `linearScale`/`logScale`/`powScale`/`timeScale` + `ticks`/`tickFormat`/`invert`
- [x] D3 nice-number ticks; log boundary, time span cases

### M8 · Math construct library

- [x] Construct factories (`constructs/`) + `axesObject` rewritten on `Scale` (`xScale/yScale`)
- [x] Attached constructs positioned via `c2p`; Riemann convergence, tangent slope, planes round-trip

### M9 · Morph

- [x] arc-length / anchor / cross-fade / matching four strategies
- [x] `group2D` + part keys; contour padding; property-based random shape stability

### M10 · Text / LaTeX

- [x] `parseSvgPath` + built-in stroke font + LaTeX subset; `textObject`/`latexObject`
- [x] `write()` stroke reveal; `transformMatchingTex`; `AssetManager` build-time prepare
- [x] M8 labels upgraded to stroke font

### M11 · Interaction system

- [x] `PickProxy` (disc/rect/band) + `hitTest`; three-coordinate events
- [x] `draggablePoint/Value(Source)`; `on()`/`interactive()`
- [x] R3F unprojection + pointer dispatch + cursor; `IntermactCanvas` keyboard forwarding

### M12 · Layout + Inspector

- [x] `LayoutHandle` (`getBounds/alignTo/nextTo/fitTo/arrange`)
- [x] Transform hierarchy (`setParent` + Player snapshot world transform composition)
- [x] Inspector (registry/runtime state/active Track/reactive graph/bounds highlight)

## Known deviations (non-blocking for v0.2)

- Text/LaTeX uses **built-in stroke vector font + LaTeX subset** (not KaTeX/MathJax + troika MSDF); trait/part-key contract unchanged, real engine drop-in ready.
- Lowercase rendered as small-caps; font covers uppercase+digits+common symbols.
- Interaction hit uses **scene-space analytic intersection** (pick proxy) instead of WebGL raycast threshold; equivalent under 2D orthographic.
- LayoutHandle immediately writes authorized transform for chained layout; `fitTo` is uniform scale.
- Inspector bounds projection defaults to `contain` fit.
- Morph does not `replaceObject` on completion (geometryOverride model); chained morph awaits serialization/player enhancement (§22.1).

See `design.md §0.2` implementation progress log.
