> (Dis)Claimer
> This project is 30% manual and 70% vibe coded.
>
> The 30% includes carefully designed abstraction models, interfaces and architecture, and detailed code specs that leads to a healthy code (hopefully). These work is done by me, a senior software engineer with 10+ years of experience.
>
> Further implementation, testing and code review is done vibely.

# Intermact

[![npm @intermact/core](https://img.shields.io/npm/v/@intermact/core?label=%40intermact%2Fcore)](https://www.npmjs.com/package/@intermact/core)
[![npm @intermact/react](https://img.shields.io/npm/v/@intermact/react?label=%40intermact%2Freact)](https://www.npmjs.com/package/@intermact/react)

Intermact is an interactive, React Three Fiber based reimagining of Manim: a
platform for math/data visualization where the same program can author narrative
animation, be re-parameterized live, dragged by viewers, and embedded into web
pages — with experiments decoupled from rendering.

See [`dev-docs/intro.md`](dev-docs/intro.md) for motivation,
[`dev-docs/design.md`](dev-docs/design.md) for architecture, and
[`dev-docs/dev-roadmap.md`](dev-docs/dev-roadmap.md) for the milestone roadmap.

## Install (npm)

Published on the [public npm registry](https://www.npmjs.com/) (`publishConfig.registry` in each package targets `registry.npmjs.org` even if your user `registry` is a mirror):

```bash
npm install @intermact/core @intermact/react \
  react react-dom three @react-three/fiber
```

- Docs: [https://clyce.github.io/intermact/](https://clyce.github.io/intermact/)
- Packages: [@intermact/core](https://www.npmjs.com/package/@intermact/core) · [@intermact/react](https://www.npmjs.com/package/@intermact/react)

## Contribute / run from source

**Site (VitePress + TypeDoc + examples):** `pnpm run dev:site` → `http://localhost:5174`
(guides in **简体中文** at `/` and **English** at `/en/`, API reference, and the interactive gallery at `/demos/`). Production:
`pnpm run build:site` then `pnpm run preview:site`. Standalone gallery only:
`pnpm run dev:examples` on port 5173. **API Reference** is generated via
`pnpm run gen:reference`.

## Monorepo layout

```text
packages/
  core/           @intermact/core         framework-free model/timeline/geometry/reactive
  render-three/   @intermact/render-three  React-free three.js helpers
  render-r3f/     @intermact/render-r3f    React Three Fiber renderer adapter
  react/          @intermact/react         IntermactCanvas + hooks
examples/         @intermact/examples      runnable demo gallery
```

The dependency rules from `design.md §3.1` (core must not import React/three/DOM)
are enforced by `dependency-cruiser`.

## Requirements

- Node.js >= 20 (developed on 25.x)
- pnpm >= 10

## Getting started

```bash
pnpm install
pnpm run dev:site       # docs + interactive examples (recommended)
pnpm run dev:examples   # gallery only (Vite, port 5173)
pnpm run dev:docs       # VitePress only (port 5174; /demos/ needs dev:site or build:site)
pnpm run build:site     # static site with embedded /demos/
```

## Quality gate (local CI)

The `ci` script is the gate that every milestone must keep green (dev-roadmap.md §7):

```bash
pnpm run ci   # lint + typecheck + test + depcruise + build
```

Individual steps:

```bash
pnpm run lint        # eslint + prettier --check
pnpm run typecheck   # tsc --noEmit across the workspace
pnpm run test        # vitest (deterministic timeline snapshots, geometry units, ...)
pnpm run depcruise   # layered dependency rules (design.md §3.1)
pnpm run build       # tsup build of all packages
```

## Publish packages (maintainers)

Publishes to `registry.npmjs.org` (see `publishConfig.registry` in each package — independent of a user-level npmmirror setting).

```bash
pnpm run publish:packages:dry-run   # inspect tarballs
pnpm run publish:packages           # after npm auth (token or OTP below)
```

Auth for `registry.npmjs.org` (independent of a user-level npmmirror `registry`):

```powershell
# Granular Access Token (recommended for CLI)
npm config set //registry.npmjs.org/:_authToken "npm_xxx" --location=user

# Or authenticator-app OTP (if configured on npm)
$env:NPM_OTP="123456"; pnpm run publish:packages
```

## Status

**v1.0** (Phase-1 / Phase-2 / Phase-3) is shipped; npm packages are at `1.0.0`.
See [`docs/project/v1-checklist.md`](docs/project/v1-checklist.md) and the [roadmap](https://clyce.github.io/intermact/project/roadmap).
