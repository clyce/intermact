---
layout: home

hero:
  name: Intermact
  text: Interactive Manim-style math visualization
  tagline: Declare objects → seekable timeline → React Three Fiber live rendering → scrub the timeline / tune parameters to explore
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: Install from npm
      link: https://www.npmjs.com/package/@intermact/react
    - theme: alt
      text: API Reference
      link: /reference/
    - theme: alt
      text: Interactive Demos
      link: /demos/
    - theme: alt
      text: Example Index
      link: /en/examples/
    - theme: alt
      text: Architecture (design.md)
      link: /en/guide/architecture

features:
  - icon: ⏱️
    title: Seekable timeline
    details: Storyboard accumulated at build time, pure-function evaluation at playback; scrubbing the timeline yields deterministic results, with snapshot tests in CI.
  - icon: 📐
    title: 2D geometry + R3F rendering
    details: Arc-length sampling, earcut fill, stroke trim reveal, HiDPI/resize without distortion.
  - icon: 🎬
    title: Basic animation orchestration
    details: Create / Fade / Move / Morph / sequence / parallel / stagger — all compiled into seekable Tracks.
  - icon: 📡
    title: Minimal reactive layer
    details: Signal / derived / valueTracker / tweenSignal; Leva parameter tuning drives live geometry recomputation.
  - icon: 📊
    title: Math toolbox (v0.2)
    details: Scale, FunctionGraph/Riemann, Morph matching, OpenType/LaTeX writing, drag interaction, and Inspector.
---

## Documentation coverage: Phase-1 & Phase-2 (v0.1–v0.2)

**Phase-1 (v0.1)** delivers the full loop from an empty canvas to basic 2D narrative plus interactive function curves; **Phase-2 (v0.2)** extends Scale, math constructs, Morph matching, text/LaTeX, interaction, and layout. The guides, API Reference overview, and example index cover the M0–L2 public API. The repository is currently at **v1.0** (including Phase-3 PCG/3D/export/plugins); Phase-3 concepts are in [Extensibility](/en/guide/extensibility). See the full architecture contract in [`dev-docs/design.md`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md).

**Use in your app:**

```bash
npm install @intermact/core @intermact/react react react-dom three @react-three/fiber
```

**Develop from source (contributors):**

```bash
pnpm install
pnpm run dev:examples   # Interactive demo gallery (:5173)
pnpm run dev:docs       # This docs site (:5174)
pnpm run ci             # lint + typecheck + test + depcruise + build
```
