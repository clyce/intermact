# v0.1 Acceptance Checklist

Corresponds to `dev-roadmap.md` §4 "◆ v0.1 acceptance (DoD)" and `design.md §19.1–19.2`.

## DoD items

| Requirement | Status | Evidence |
| --- | --- | --- |
| Basic 2D examples (Create / Move / Tween) | ✅ | `l1/basic-2d` |
| Interactive function curve (Leva tuning, live curve recompute) | ✅ | `l1/interactive-sine` (`reactive/leva-binding`) |
| Timeline seekable, deterministic results | ✅ | `IntermactCanvas` + `TimelineControls`; `timeline.test.ts` |
| Timeline deterministic numeric assertions in CI | ✅ | `pnpm run ci` |
| `design.md §19.1` runnable | ✅ | `l1/basic-2d` |
| `design.md §19.2` runnable | ✅ | `l1/interactive-sine` |
| CI green | ✅ | lint + typecheck + 67 tests + depcruise + build |

## Milestone exit criteria (summary)

### M0

- [x] monorepo + TS strict + tsup/Vite + Vitest + ESLint + depcruise
- [x] `empty-canvas`, `static-circle` examples

### M1

- [x] `IMObject` / trait / `RuntimeState` / `StatePatch`
- [x] `Storyboard` / `Track` / `Player` (seek determinism)
- [x] Headless evaluation + deterministic numeric assertion tests

### M2

- [x] 8 primitive types + arc-length sampling + earcut + bounds unit tests

### M3

- [x] stroke trim + fill + `IntermactCanvas` + DPI/resize
- [x] renderer smoke tests

### M4

- [x] Create / Fade / Move / orchestration / easing
- [x] arc-length morph fallback

### M5

- [x] `CoordinateTransform2D` + `getAxes` + fit strategies
- [x] `functionGraph` / `decimalNumber` (L1 minimal set)

### M6

- [x] signal / derived / tweenSignal / `useSignal`
- [x] Minimal recomputation dependency tests

## Known deviations (non-blocking for v0.1)

- Morph arc-length only; matching is M9
- `decimalNumber` examples use `xy` not `uv` HUD
- `call` not seekable
- px line width is ribbon approximation

See `design.md §0.1` implementation progress log.
