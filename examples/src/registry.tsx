import { type ComponentType, type ReactNode } from "react";
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
import { ScalePlaygroundDemo } from "./scale/scale-playground";
import { LogPlotDemo } from "./scale/log-plot";
import { AxesFunctionGraphDemo } from "./math/axes-functiongraph";
import { RiemannSumDemo } from "./math/riemann-sum";
import { TangentDerivativeDemo } from "./math/tangent-derivative";
import { MatrixTableBraceDemo } from "./math/matrix-table-brace";
import { PlanesDemo } from "./math/planes";
import { ShapeMorphDemo } from "./morph/shape-morph";
import { ContourMismatchDemo } from "./morph/contour-mismatch";
import { MatchingShapesDemo } from "./morph/matching-shapes";
import { TextWritingDemo } from "./text/writing";
import { WritingStrategiesDemo } from "./text/writing-strategies";
import { FontScaleDemo } from "./text/font-scale";
import { MultiFontWritingDemo } from "./text/multi-font-writing";
import { TransformMatchingTexDemo } from "./latex/transform-matching-tex";
import { LatexWritingDemo } from "./latex/latex-writing";
import { DraggableBezierDemo } from "./interaction/draggable-bezier";
import { HitTestingDemo } from "./interaction/hit-testing";
import { ExplorableDerivativeDemo } from "./interaction/explorable-derivative";
import { NextToArrangeDemo } from "./layout/next-to-arrange";
import { ResponsiveRectDemo } from "./layout/responsive-rect";
import { InspectorTourDemo } from "./devtools/inspector-tour";

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
  /** Overlay caption explaining what the demo shows (required for every example). */
  readonly caption: ReactNode;
  /** Where to place the caption when it would cover content. */
  readonly captionPlacement?: "top" | "bottom";
}

function entry(
  id: string,
  title: string,
  group: string,
  Component: ComponentType,
  caption: ReactNode,
  captionPlacement?: "top" | "bottom",
): DemoEntry {
  return { id, title, group, Component, caption, captionPlacement };
}

/**
 * Registry of all example demos. Each milestone appends its target examples
 * here (dev-roadmap.md §7); ordering is by milestone then by group.
 */
export const demos: readonly DemoEntry[] = [
  entry(
    "_template/empty-canvas",
    "Empty Canvas (M0 template)",
    "_template",
    EmptyCanvasDemo,
    "M0 smoke template: a bare React Three Fiber canvas with no Intermact timeline — validates dev-server startup and HMR.",
  ),
  entry(
    "_smoke/static-circle",
    "Static Circle (M0 smoke)",
    "_smoke",
    StaticCircleDemo,
    "M0 CI smoke test: one static Three.js circle rendered without the Intermact program/player pipeline.",
  ),
  entry(
    "timeline/seek-basics",
    "Seek basics",
    "timeline",
    SeekBasicsDemo,
    "M1: one eased move + scale tween. Drag the timeline to seek, change rate, or reverse — the same t always yields the same state.",
  ),
  entry(
    "timeline/markers-slides",
    "Markers & slides",
    "timeline",
    MarkersSlidesDemo,
    "M1: storyboard markers act as slide chapters. Use the marker buttons (or jumpToMarker) to snap between sections.",
  ),
  entry(
    "timeline/headless-eval",
    "Headless evaluation",
    "timeline",
    HeadlessEvalDemo,
    "M1: buildProgram runs with no renderer/DOM. We seek to fixed times and print RuntimeState — the same path Node tests and export use.",
  ),
  entry(
    "geometry/primitives-gallery",
    "Primitives gallery",
    "geometry",
    PrimitivesGalleryDemo,
    "M2: every 2D primitive (circle, rectangle, polygon with holes, Bézier, arrow, …) in one scene. Scrub to see Create animations.",
  ),
  entry(
    "geometry/sampling-debug",
    "Sampling debug",
    "geometry",
    SamplingDebugDemo,
    "M2: visualize arc-length resampling points, bounding boxes, and triangulation mesh on a shape — a geometry debugger.",
  ),
  entry(
    "render/stroke-fill-showcase",
    "Stroke & fill showcase",
    "render",
    StrokeFillShowcaseDemo,
    "M3: stroke trim reveal, nonzero/evenodd fill rules, and world-unit vs pixel line widths side by side.",
  ),
  entry(
    "render/zorder-transparency",
    "Z-order & transparency",
    "render",
    ZOrderTransparencyDemo,
    "M3: overlapping semi-transparent shapes — z-index ordering and alpha compositing without depth fighting.",
  ),
  entry(
    "render/dpi-resize",
    "DPI & resize",
    "render",
    DpiResizeDemo,
    "M3: resize the browser window or use a HiDPI display — the scene refits (contain) so circles stay round and strokes stay crisp.",
  ),
  entry(
    "anim/create-fade-move",
    "Create / Fade / Move",
    "anim",
    CreateFadeMoveDemo,
    "M4: Create (stroke then fill), FadeIn, Move, Rotate, and Scale on three circles — the core tween vocabulary.",
  ),
  entry(
    "anim/sequence-parallel-stagger",
    "Sequence / parallel / stagger",
    "anim",
    SequenceParallelStaggerDemo,
    "M4: sequence (one after another), parallel (simultaneous), and stagger (cascading start times) orchestration.",
  ),
  entry(
    "anim/easing-gallery",
    "Easing gallery",
    "anim",
    EasingGalleryDemo,
    "M4: the same horizontal tween with different easing curves — compare linear, quad, cubic, sine, back, etc.",
  ),
  entry(
    "coords/cartesian-axes",
    "Cartesian axes",
    "coords",
    CartesianAxesDemo,
    "M5: Scene.getAxes() registers axes as a normal object — fadeIn/fadeOut via the standard animation API.",
  ),
  entry(
    "coords/fit-strategies",
    "Fit strategies",
    "coords",
    FitStrategiesDemo,
    "M5: contain / cover / stretch camera fit inside a non-square viewport. Toggle strategies to see how the domain maps.",
  ),
  entry(
    "coords/polar-scene",
    "Polar scene",
    "coords",
    PolarSceneDemo,
    "M5: polar coordinate scene — points placed with fromPolar and connected into a rose-like pattern.",
  ),
  entry(
    "reactive/value-tracker",
    "Value tracker + derived",
    "reactive",
    ValueTrackerDemo,
    "M6 / §8.2: tweenSignal drives a ValueTracker; a derived polygon recomputes each frame as the tracker moves along a hyperbola.",
  ),
  entry(
    "reactive/leva-binding",
    "Leva signal binding",
    "reactive",
    LevaBindingDemo,
    "M6 / §19.2: Leva sliders write into Signals — the program builds once; only geometry recomputes when parameters change.",
  ),
  entry(
    "scale/scale-playground",
    "Scale playground",
    "scale",
    ScalePlaygroundDemo,
    "M7: linear / pow / log / time scales map different domains onto the same world range — tick clustering shows each scale's behavior.",
  ),
  entry(
    "scale/log-plot",
    "Log plot",
    "scale",
    LogPlotDemo,
    "M7: plot 2ˣ on a logarithmic x-axis — an exponential appears as a straight line when the axis uses logScale.",
  ),
  entry(
    "math/axes-functiongraph",
    "Axes & function graph",
    "math",
    AxesFunctionGraphDemo,
    "M8: Axes + FunctionGraph and ParametricCurve — curves are sampled in data space then mapped with c2p so they hug the axes.",
  ),
  entry(
    "math/riemann-sum",
    "Riemann sum",
    "math",
    RiemannSumDemo,
    "M8: Riemann rectangles under x² on [0,3]. Drag n (Leva) to watch the sum converge toward ∫₀³x²dx = 9.",
  ),
  entry(
    "math/tangent-derivative",
    "Tangent & derivative",
    "math",
    TangentDerivativeDemo,
    "M8: a tangent line follows a point on a curve; the slope readout (decimalNumber) updates as the tracker moves.",
  ),
  entry(
    "math/matrix-table-brace",
    "Matrix / table / brace",
    "math",
    MatrixTableBraceDemo,
    "M8: Matrix, Table, and Brace layout constructs plus a DecimalNumber driven by a tweening signal.",
  ),
  entry(
    "math/planes",
    "Number / polar / complex planes",
    "math",
    PlanesDemo,
    "M8: NumberPlane, PolarPlane, and ComplexPlane coordinate backgrounds — including a polar rose curve.",
  ),
  entry(
    "morph/shape-morph",
    "Shape morph",
    "morph",
    ShapeMorphDemo,
    <>
      Single-object morph between shapes with different point counts. Left: circle → 5-point star
      (arc-length). Middle: triangle → circle (anchor). Right: square → 6-point star (anchor). Press
      play or scrub.
    </>,
  ),
  entry(
    "morph/contour-mismatch",
    "Contour mismatch",
    "morph",
    ContourMismatchDemo,
    <>
      Morphing when contour <em>counts</em> differ. Left: one ring → two rings (zero-length padding,{" "}
      <code>arc-length</code>). Right: square → star uses <code>cross-fade</code> when topology
      cannot be tracked. Scrub to compare.
    </>,
  ),
  entry(
    "morph/matching-shapes",
    "Matching shapes",
    "morph",
    MatchingShapesDemo,
    <>
      <strong>transformMatching</strong> on composite groups. Parts pair by key: <code>a</code>{" "}
      morphs circle → square, <code>keep</code> holds, source-only <code>b</code> collapses,
      target-only <code>c</code> grows in.
    </>,
  ),
  entry(
    "text/writing",
    "Writing (glyph stroke reveal)",
    "text",
    TextWritingDemo,
    <>
      <strong>write()</strong> draws each glyph&apos;s outline on (like Manim Write /
      DrawBorderThenFill), then flows the fill in. Scrub to draw/undraw.
    </>,
  ),
  entry(
    "text/writing-strategies",
    "Writing strategies (LTR vs simultaneous)",
    "text",
    WritingStrategiesDemo,
    <>
      Top: <strong>direction: &quot;simultaneous&quot;</strong> — all glyphs share one reveal
      window. Bottom: <strong>direction: &quot;ltr&quot;</strong> with{" "}
      <strong>glyphOverlap: 0.25</strong> — each glyph starts before the previous finishes. Scrub to
      compare.
    </>,
  ),
  entry(
    "text/font-scale",
    "Font scale (vector glyphs)",
    "text",
    FontScaleDemo,
    <>
      Glyphs are constant-width <strong>outline</strong> contours: solid fill, hollow stroke, or
      both with separate colors. Vector geometry stays crisp at any scale.
    </>,
    "bottom",
  ),
  entry(
    "text/multi-font-writing",
    "Multi-font writing",
    "text",
    MultiFontWritingDemo,
    <>
      Built-in stroke skeleton vs custom <strong>OpenType</strong> outlines (DejaVu Sans / Serif).
      Outline fonts use filled paths — no V-tip spikes — with the same <strong>write()</strong>{" "}
      reveal.
    </>,
  ),
  entry(
    "latex/latex-writing",
    "LaTeX writing (MathJax serif)",
    "text",
    LatexWritingDemo,
    <>
      <strong>MathJax 3</strong> SVG → filled serif math glyphs (standard for formulas).{" "}
      <strong>write()</strong> reveals <code>E=mc²</code> and an integral with outline-then-fill.
    </>,
  ),
  entry(
    "latex/transform-matching-tex",
    "TransformMatchingTex",
    "text",
    TransformMatchingTexDemo,
    <>
      <strong>transformMatchingTex</strong>: the Pythagorean identity is <strong>written on</strong>{" "}
      (outline reveal, then fill), then morphs into <code>c²</code> by matching token keys.
    </>,
  ),
  entry(
    "interaction/draggable-bezier",
    "Draggable Bézier",
    "interaction",
    DraggableBezierDemo,
    "M11 / §12.3: drag the yellow control points — each handle writes a Signal and the Bézier curve recomputes live.",
  ),
  entry(
    "interaction/hit-testing",
    "Hit-testing thin strokes",
    "interaction",
    HitTestingDemo,
    "M11 / §12.1: thin spokes and a ring use band pick proxies — clicks register on the 1px geometry, not just its bounding box.",
  ),
  entry(
    "interaction/explorable-derivative",
    "Explorable derivative",
    "interaction",
    ExplorableDerivativeDemo,
    "M11: drag along the x-axis to explore a function — tangent line and derivative readout update interactively.",
  ),
  entry(
    "layout/next-to-arrange",
    "nextTo + arrange",
    "layout",
    NextToArrangeDemo,
    "M12 / §9.4: alignTo, nextTo, and arrange lay out labeled tiles in a row with consistent gaps.",
  ),
  entry(
    "layout/responsive-rect",
    "Responsive anchoring",
    "layout",
    ResponsiveRectDemo,
    "M12: a rectangle anchored in domain-relative UV space and fitTo — stays pinned when the viewport aspect changes.",
  ),
  entry(
    "devtools/inspector-tour",
    "Inspector tour",
    "devtools",
    InspectorTourDemo,
    "M12 / §16: Inspector shows registry objects, runtime transforms, active tracks, reactive signals/derived, and SVG bounds overlay.",
  ),
  entry(
    "l1/basic-2d",
    "L1 · Basic 2D (§19.1)",
    "l1",
    Basic2DDemo,
    "L1 acceptance (§19.1): Create, axes, arc-length morph, and a fully seekable timeline — the Phase-1 Manim-style baseline.",
  ),
  entry(
    "l1/interactive-sine",
    "L1 · Interactive sine (§19.2)",
    "l1",
    LevaBindingDemo,
    "L1 acceptance (§19.2): Leva amplitude/frequency sliders drive Signals; the sine curve and label recompute without rebuilding the program.",
  ),
];
