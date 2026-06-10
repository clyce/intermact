# Getting Started

## Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 10

## Install and run

```bash
git clone <repo-url> intermact
cd intermact
pnpm install
```

### Full site (docs + interactive demos — recommended)

```bash
pnpm run dev:site
```

Open **`http://localhost:5174`** in your browser: guides, API Reference, roadmap, and the **`/demos/`** interactive gallery on one site. During development, `/demos/` is proxied by VitePress to the examples dev server (`5173`).

Production build:

```bash
pnpm run build:site    # examples → docs/public/demos + VitePress static site
pnpm run preview:site  # Preview the full site locally
```

### Demo gallery only (standalone debugging)

```bash
pnpm run dev:examples
```

Open `http://localhost:5173` (root `/`, no docs navigation).

### Docs site only

```bash
pnpm run dev:docs
```

`http://localhost:5174`; **`/demos/` requires `dev:site` (live gallery) or `build:site` first (static embed)** — `dev:docs` alone does not start the `:5173` examples server.

### Quality gate

```bash
pnpm run ci
```

Equivalent to `lint` + `typecheck` + `test` (full Vitest) + `depcruise` + `build`.

## Minimal example

Below is a complete program with Create animation and a seekable timeline:

```tsx
import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const disk = scene.register(
    circle({
      radius: 1.2,
      style: {
        stroke: "#38bdf8",
        fill: "rgba(56,189,248,0.2)",
        lineWidth: 0.05,
      },
    }),
    { position: xy(0, 0) },
  );

  await scene.play(disk.create({ duration: 1.5, easing: "cubicInOut" }));
});

export function Demo() {
  return (
    <div style={{ width: "100%", height: 400 }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} autoplay />
    </div>
  );
}
```

Key points:

1. **`createProgram`**: build-time callback; `await scene.play(...)` only **appends** tracks to the Storyboard — it does not block real time.
2. **`scene.register`**: places an immutable `IMObject2D` in the scene and returns `RegisteredObject2D` (animation handles live here).
3. **`IntermactCanvas`**: builds the program, mounts the R3F Canvas, drives the Player, optional timeline overlay.

## Monorepo packages

| Package | Purpose |
| --- | --- |
| `@intermact/core` | Model, geometry, timeline, reactive (no React/three/DOM) |
| `@intermact/render-three` | three.js geometry/material build (no React) |
| `@intermact/render-r3f` | R3F `SceneView`, camera fit |
| `@intermact/react` | `IntermactCanvas`, hooks, timeline controls |
| `@intermact/examples` | Vite demo gallery (not published) |

Applications typically depend directly on `@intermact/core` and `@intermact/react` only.

## Next steps

**Phase-1 (v0.1)**

- [Architecture overview](./architecture.md) — build vs playback, package boundaries
- [Program and scene](./program-and-scene.md) — `createProgram` / `Scene2D` / `register`

**Phase-2 (v0.2)**

- [Scale and ticks](./scale.md) — linear / log scales and axis ticks
- [Morph and part matching](./morph.md) — matching / transformMatchingTex
- [Text and LaTeX pipeline](./text-latex.md) — OpenType + MathJax writing

**Reference and run**

- [API Reference](/reference/) — TypeDoc symbol docs (overview includes P1–P2 entry tables)
- [Interactive demos `/demos/`](/demos/) — runnable gallery (same site as docs)
- [Example catalog](../examples/) — milestone-grouped text index (links to `/demos/#<id>`)
