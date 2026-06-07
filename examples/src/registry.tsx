import { type ComponentType } from "react";
import { EmptyCanvasDemo } from "./_template/empty-canvas";
import { StaticCircleDemo } from "./_smoke/static-circle";
import { SeekBasicsDemo } from "./timeline/seek-basics";
import { HeadlessEvalDemo } from "./timeline/headless-eval";
import { MarkersSlidesDemo } from "./timeline/markers-slides";
import { PrimitivesGalleryDemo } from "./geometry/primitives-gallery";
import { SamplingDebugDemo } from "./geometry/sampling-debug";
import { StrokeFillShowcaseDemo } from "./render/stroke-fill-showcase";
import { ZOrderTransparencyDemo } from "./render/zorder-transparency";
import { DpiResizeDemo } from "./render/dpi-resize";
import { CreateFadeMoveDemo } from "./anim/create-fade-move";
import { SequenceParallelStaggerDemo } from "./anim/sequence-parallel-stagger";
import { EasingGalleryDemo } from "./anim/easing-gallery";
import { CartesianAxesDemo } from "./coords/cartesian-axes";
import { FitStrategiesDemo } from "./coords/fit-strategies";
import { PolarSceneDemo } from "./coords/polar-scene";
import { ValueTrackerDemo } from "./reactive/value-tracker";
import { LevaBindingDemo } from "./reactive/leva-binding";
import { Basic2DDemo } from "./l1/basic-2d";

/** A single runnable demo entry shown in the gallery sidebar. */
export interface DemoEntry {
  /** Stable id used for hash routing, e.g. `timeline/seek-basics`. */
  readonly id: string;
  /** Human-readable title. */
  readonly title: string;
  /** Capability group (matches dev-roadmap.md example folders). */
  readonly group: string;
  /** The demo component. */
  readonly Component: ComponentType;
}

/**
 * Registry of all example demos. Each milestone appends its target examples
 * here (dev-roadmap.md §7); ordering is by milestone then by group.
 */
export const demos: readonly DemoEntry[] = [
  {
    id: "_template/empty-canvas",
    title: "Empty Canvas (M0 template)",
    group: "_template",
    Component: EmptyCanvasDemo,
  },
  {
    id: "_smoke/static-circle",
    title: "Static Circle (M0 smoke)",
    group: "_smoke",
    Component: StaticCircleDemo,
  },
  {
    id: "timeline/seek-basics",
    title: "Seek basics",
    group: "timeline",
    Component: SeekBasicsDemo,
  },
  {
    id: "timeline/markers-slides",
    title: "Markers & slides",
    group: "timeline",
    Component: MarkersSlidesDemo,
  },
  {
    id: "timeline/headless-eval",
    title: "Headless evaluation",
    group: "timeline",
    Component: HeadlessEvalDemo,
  },
  {
    id: "geometry/primitives-gallery",
    title: "Primitives gallery",
    group: "geometry",
    Component: PrimitivesGalleryDemo,
  },
  {
    id: "geometry/sampling-debug",
    title: "Sampling debug",
    group: "geometry",
    Component: SamplingDebugDemo,
  },
  {
    id: "render/stroke-fill-showcase",
    title: "Stroke & fill showcase",
    group: "render",
    Component: StrokeFillShowcaseDemo,
  },
  {
    id: "render/zorder-transparency",
    title: "Z-order & transparency",
    group: "render",
    Component: ZOrderTransparencyDemo,
  },
  {
    id: "render/dpi-resize",
    title: "DPI & resize",
    group: "render",
    Component: DpiResizeDemo,
  },
  {
    id: "anim/create-fade-move",
    title: "Create / Fade / Move",
    group: "anim",
    Component: CreateFadeMoveDemo,
  },
  {
    id: "anim/sequence-parallel-stagger",
    title: "Sequence / parallel / stagger",
    group: "anim",
    Component: SequenceParallelStaggerDemo,
  },
  {
    id: "anim/easing-gallery",
    title: "Easing gallery",
    group: "anim",
    Component: EasingGalleryDemo,
  },
  {
    id: "coords/cartesian-axes",
    title: "Cartesian axes",
    group: "coords",
    Component: CartesianAxesDemo,
  },
  {
    id: "coords/fit-strategies",
    title: "Fit strategies",
    group: "coords",
    Component: FitStrategiesDemo,
  },
  {
    id: "coords/polar-scene",
    title: "Polar scene",
    group: "coords",
    Component: PolarSceneDemo,
  },
  {
    id: "reactive/value-tracker",
    title: "Value tracker + derived",
    group: "reactive",
    Component: ValueTrackerDemo,
  },
  {
    id: "reactive/leva-binding",
    title: "Leva signal binding",
    group: "reactive",
    Component: LevaBindingDemo,
  },
  {
    id: "l1/basic-2d",
    title: "L1 · Basic 2D (§19.1)",
    group: "l1",
    Component: Basic2DDemo,
  },
  {
    id: "l1/interactive-sine",
    title: "L1 · Interactive sine (§19.2)",
    group: "l1",
    Component: LevaBindingDemo,
  },
];
