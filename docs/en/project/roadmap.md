# Roadmap and Milestones

Full roadmap in repo [`dev-docs/dev-roadmap.md`](https://github.com/clyce/intermact/blob/main/dev-docs/dev-roadmap.md). This page is a summary in the online docs.

## Three-phase vision

| Phase | Version gate | Theme | Status |
| --- | --- | --- | --- |
| Phase-1 | **v0.1 ◆ L1** | Interactive Manim alternative (2D + timeline + tuning) | ✅ Complete |
| Phase-2 | **v0.2 ◆ L2** | Math toolbox (Scale / LaTeX / Morph matching / interaction) | ✅ Complete |
| Phase-3 | **v1.0 ◆ L3** | PCG demo system (3D / export / embed / plugins) | ✅ Complete |

## Phase-1 (v0.1)

| ID | Name | Status |
| --- | --- | --- |
| M0 | Engineering foundation | ✅ |
| M1 | Core model / timeline / Player | ✅ |
| M2 | 2D geometry and sampling | ✅ |
| M3 | R3F render adapter | ✅ |
| M4 | Basic animation | ✅ |
| M5 | Coordinate system and axes | ✅ |
| M6 | Minimal reactive layer | ✅ |
| L1 | v0.1 acceptance | ✅ |

Implementation details in [`design.md §0.1`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md). Online [v0.1 acceptance checklist](./v01-checklist.md).

## Phase-2 (v0.2)

| ID | Name | Status |
| --- | --- | --- |
| M7 | Scale and ticks | ✅ |
| M8 | Math construct library | ✅ |
| M9 | Morph matching | ✅ |
| M10 | Text and LaTeX | ✅ |
| M11 | Interaction system | ✅ |
| M12 | Layout and Inspector | ✅ |
| L2 | v0.2 acceptance | ✅ |

Implementation details in [`design.md §0.2`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md). Online [v0.2 acceptance checklist](./v02-checklist.md).

## Phase-3 (v1.0)

M13–M17 (PCG, 3D, serialization/export, performance, plugins) and L3 acceptance complete. See [v1.0 acceptance checklist](./v1-checklist.md) and [Extensibility guide](/en/guide/extensibility).

## Documentation

- **Guides**: Phase-1 core capabilities + Phase-2 math toolbox (sidebar groups)
- **API Reference**: TypeDoc symbol pages + [overview](/reference/) (P1–P2 architecture summary, `pnpm run gen:reference`)
- **Example index**: [`/en/examples/`](/en/examples/) grouped by milestone, linking to [`/demos/`](/demos/) interactive gallery
