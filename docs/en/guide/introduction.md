# Introduction

Intermact is an interactive math visualization platform built on **React Three Fiber**. Starting as an "interactive Manim alternative" (v0.1), it expanded through the v0.2 math toolbox into a full 2D interactive narrative system; v1.0 further delivers PCG, 3D, export/embed, and plugin extensibility. The same program can orchestrate narrative animation, support live parameter tuning, let viewers drag to explore, and embed into web pages and handouts.

Packages are on npm (`@intermact/core`, `@intermact/react` **v1.0.0**). To install in your app, see [Getting started · Use in your app (npm)](./getting-started.md#use-in-your-app-npm); to hack on this repo, see "Run from source" on the same page.

## What problem does it solve?

| Pain point | Intermact approach |
| --- | --- |
| Manim offline rendering is slow and costly to iterate | Real-time rendering in the browser — change code, see results immediately |
| Traditional animation libraries are hard to make interactive | Retained-mode seekable timeline + Signal/derived reactive layer |
| Experiment logic coupled to rendering | `core` has no framework dependency; headless evaluation and testing in Node/Worker |
| Output limited to video | Web-native serialization, snapshot/video export, Web Component embed (v1.0) |

## What can v0.1 do? (Phase-1)

- **Declarative 2D primitives**: circle, ellipse, rectangle, arc, polygon (with holes), Bézier, line segment, arrow
- **Create stroke/fill reveal**, Fade, Move, Rotate, Scale
- **Coordinate systems**: Cartesian domain, abs/rel/fit transforms, polar coordinates, `getAxes` to register axis objects
- **Reactive**: `signal` / `derived` / `valueTracker` / `tweenSignal`, bound to Leva
- **React entry**: `<IntermactCanvas program={...} />` + timeline overlay controls

## What can v0.2 do? (Phase-2 · math toolbox)

- **Scale**: linear / log / pow / time scales, axis ticks and formatting
- **Math constructs**: NumberPlane, FunctionGraph, Riemann sum, tangent, Matrix/Table/Brace, DecimalNumber
- **Morph**: `arc-length` / `anchor` / `matching` / `cross-fade`; `group2D` part keys and `transformMatchingTex`
- **Text and LaTeX**: OpenType outlines + MathJax SVG; stroke-by-stroke writing; vector multi-size glyphs
- **Interaction**: draggable control points/values, precise hit-test, explorable derivative exploration
- **Layout and Inspector**: `nextTo` / `arrange` / `fitTo`; React Inspector for scene tree and signal debugging

## Documentation structure

- **Guides**: concepts and code examples for users (this directory)
  - **Core capabilities (v0.1)**: program, timeline, geometry, rendering, animation, coordinates, reactive
  - **Math toolbox (v0.2)**: Scale, constructs, Morph, text/LaTeX, interaction, layout
- **API Reference**: TypeDoc-generated symbol docs ([overview](/reference/) with Phase-1/2 entry tables)
- **Packages**: `@intermact/*` layer responsibilities and dependency rules
- **Examples**: index aligned with the `examples/` demo gallery
- **Project**: milestone roadmap and v0.1 / v0.2 / v1.0 acceptance checklists

For the full interface contract and revision history, see [`dev-docs/design.md`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md) and [`dev-docs/dev-roadmap.md`](https://github.com/clyce/intermact/blob/main/dev-docs/dev-roadmap.md).
