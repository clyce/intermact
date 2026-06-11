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
import { LSystemPlantDemo } from "./pcg/lsystem-plant";
import { ScalarFieldIsolinesDemo } from "./pcg/scalar-field-isolines";
import { VectorFieldStreamlinesDemo } from "./pcg/vector-field-streamlines";
import { CellularAutomatonDemo } from "./pcg/cellular-automaton";
import { DataDrivenBarsDemo } from "./pcg/data-driven-bars";
import { FractalGraphDemo } from "./pcg/fractal-graph";
import { OperatorsShowcaseDemo } from "./pcg/operators-showcase";
import { DataChartsDemo } from "./pcg/data-charts";
import { GeneratorsExtraDemo } from "./pcg/generators-extra";
import { SurfacePlot3DDemo } from "./3d/surface-plot";
import { TrainingTrajectory3DDemo } from "./3d/training-trajectory";
import { Isosurface3DDemo } from "./3d/isosurface";
import { CameraMoves3DDemo } from "./3d/camera-moves";
import { NestedScenePanel3DDemo } from "./3d/nested-scene-panel";
import { Grouping3DDemo } from "./3d/grouping";
import { ShareUrlExportDemo } from "./export/share-url";
import { VideoRenderExportDemo } from "./export/video-render";
import { WebComponentEmbedDemo } from "./embed/web-component";
import { SemanticHandoutExportDemo } from "./export/semantic-handout";
import { SvgSnapshotExportDemo } from "./export/svg-snapshot";
import { Instanced10kDemo } from "./perf/instanced-10k";
import { LargePointcloudDemo } from "./perf/large-pointcloud";
import { WorkerSamplingDemo } from "./perf/worker-sampling";
import { CustomObjectPluginDemo } from "./plugin/custom-object";
import { CustomGeneratorPluginDemo } from "./plugin/custom-generator";
import { WebGpuBackendPluginDemo } from "./plugin/webgpu-backend";

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
  /** Short description shown in the bar below the toolbar (required for every example). */
  readonly caption: ReactNode;
  /** @deprecated Captions are no longer overlaid on the canvas; kept for registry compatibility. */
  readonly captionPlacement?: "top" | "bottom";
  /**
   * Repo-relative source path for the "View source" link. Defaults to
   * `examples/src/<id>.tsx`; set explicitly when the file path diverges from the
   * routing id (e.g. an L1 gate reusing another demo's component).
   */
  readonly source?: string;
}

function entry(
  id: string,
  title: string,
  group: string,
  Component: ComponentType,
  caption: ReactNode,
  captionPlacement?: "top" | "bottom",
  source?: string,
): DemoEntry {
  return { id, title, group, Component, caption, captionPlacement, source };
}

/** Repo-relative source path for a demo's "View source" link. */
export function demoSourcePath(demo: DemoEntry): string {
  return demo.source ?? `examples/src/${demo.id}.tsx`;
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
    "pcg/lsystem-plant",
    "L-system plant",
    "pcg",
    LSystemPlantDemo,
    "M13 / §6.4: a bracketed L-system plant with seeded per-branch angle jitter. Create reveals branches in growth order; same seed ⇒ same plant.",
  ),
  entry(
    "pcg/scalar-field-isolines",
    "Scalar field iso-lines",
    "pcg",
    ScalarFieldIsolinesDemo,
    "M13 / §6.2: sin(x)·cos(y) as a color-mapped heatmap (per-cell fill) with marching-squares iso-lines layered on top.",
  ),
  entry(
    "pcg/vector-field-streamlines",
    "Vector field streamlines",
    "pcg",
    VectorFieldStreamlinesDemo,
    "M13 / §6.2: a swirl vector field shown as an arrow grid with RK4-integrated streamlines seeded on a ring.",
  ),
  entry(
    "pcg/cellular-automaton",
    "Cellular automaton (Rule 30 + Life)",
    "pcg",
    CellularAutomatonDemo,
    "M13 / §6.4: Wolfram Rule 30 as a static space-time diagram (left) plus a 2D Game of Life soup (right) driven by cellularAutomatonFrames — one object per generation, cross-faded along the timeline. Both fully deterministic.",
  ),
  entry(
    "pcg/data-driven-bars",
    "Data-driven bars",
    "pcg",
    DataDrivenBarsDemo,
    "M13 / §6.5: a bar chart + trend line from one data array. Bars keep one keyed part per datum for later data-update matching.",
  ),
  entry(
    "pcg/fractal-graph",
    "Fractal + force graph",
    "pcg",
    FractalGraphDemo,
    "M13 / §6.4, §6.6: a Sierpinski fractal and a seeded force-directed graph, both positioned via the transformObject operator.",
  ),
  entry(
    "pcg/operators-showcase",
    "Operators showcase",
    "pcg",
    OperatorsShowcaseDemo,
    "M13 / §6.6: the composition operators chained as pure IMObject2D → IMObject2D — repeatObject (compounding step), booleanOp (polygon subtract), mapPoints (per-point warp), and along (distribute + orient on a path), each placed with transformObject.",
  ),
  entry(
    "pcg/data-charts",
    "Data charts (scatter + mapData)",
    "pcg",
    DataChartsDemo,
    "M13 / §6.5: scatter markers and a lineChart trend share one data array (aligned via linearScale); mapData builds a bubble row of keyed group parts so a later data update could pair them with transformMatching.",
  ),
  entry(
    "pcg/generators-extra",
    "Generators extra (tiling / lattice / tree / rose)",
    "pcg",
    GeneratorsExtraDemo,
    "M13 / §6.3–§6.4: four more pure generators — hexagonal tiling, a lattice with node dots, a recursiveTree, and a closed parametricCurve2D rose — each positioned with transformObject.",
  ),
  entry(
    "3d/surface-plot",
    "3D surface plot",
    "3d",
    SurfacePlot3DDemo,
    "M14 / §5.3, §10: a parametric surface z = sin(x)·cos(y) meshed over a (u,v) grid with 3D axes. Drag to orbit, wheel to dolly; Create reveals the mesh.",
  ),
  entry(
    "3d/training-trajectory",
    "Training trajectory (§19.3)",
    "3d",
    TrainingTrajectory3DDemo,
    "M14 / §19.3: gradient descent on a two-basin loss landscape — a translucent surface with the optimizer path traced as a 3D curve and sampled step points.",
  ),
  entry(
    "3d/isosurface",
    "Isosurface (marching cubes)",
    "3d",
    Isosurface3DDemo,
    "M14 / §6: marching-cubes extraction of the f = 0 level set of a two-blob metaball field into a watertight mesh. Same field + resolution ⇒ same surface.",
  ),
  entry(
    "3d/camera-moves",
    "Camera moves (registered camera)",
    "3d",
    CameraMoves3DDemo,
    "M14 / §10.1: the camera is part of the timeline — orbit, dolly, lookAt, and moveTo are seekable quaternion tweens. Interaction off so the scripted path drives the view.",
  ),
  entry(
    "3d/nested-scene-panel",
    "Nested scene panel (§10.2)",
    "3d",
    NestedScenePanel3DDemo,
    "M14 / §10.2, §19.5: 2D host scene (left chrome) + a framed live panel (right) built with core render(scene, camera). The embedded sub-scene plays on its own timeline inside the offscreen texture — orange dot loops in the panel after fade-in.",
  ),
  entry(
    "3d/grouping",
    "3D grouping (group3D)",
    "3d",
    Grouping3DDemo,
    "M14 / §9.3, §10: Scene3D.group3D parents three cubes and a closed polyline3D ring under one empty node; rotating only the group handle orbits the whole assembly as the Player composes world transforms down the hierarchy.",
  ),
  entry(
    "export/share-url",
    "Share-URL round-trip",
    "export",
    ShareUrlExportDemo,
    "M15 / §17: the scene is serialized, encoded as a URL-safe string, then rebuilt and mounted from the decoded payload — a figure that travels as a link, no source needed.",
  ),
  entry(
    "export/video-render",
    "Video render (WebM)",
    "export",
    VideoRenderExportDemo,
    "M15 / §17: record the live GL canvas to a downloadable WebM via MediaRecorder. The deterministic, headless export (fixed-fps frame hashes / SVG) lives in core; this is the browser encode path.",
  ),
  entry(
    "embed/web-component",
    "Web component embed",
    "embed",
    WebComponentEmbedDemo,
    "M15 / §17: a framework-agnostic <intermact-embed> custom element mounts a serialized scene from a share-url string — the drop-in distribution surface for any page or iframe.",
  ),
  entry(
    "export/semantic-handout",
    "Semantic handout + reduced motion",
    "export",
    SemanticHandoutExportDemo,
    "M15 / §17: object metadata (label/href/a11yLabel) becomes a focusable, linkable semantic overlay and side handout. Toggle reduced motion to show the prefers-reduced-motion degrade (final frame, no animation).",
  ),
  entry(
    "export/svg-snapshot",
    "SVG snapshot + deterministic frames",
    "export",
    SvgSnapshotExportDemo,
    "M15 / §17: the headless export path — buildProgram yields a DOM/GL-free Player, snapshotToSVG emits a standalone SVG per fixed-time frame, and sampleFrameHashes proves the fixed-fps timeline hashes identically every run (the basis for golden-frame tests).",
  ),
  entry(
    "perf/instanced-10k",
    "Instanced 10k",
    "perf",
    Instanced10kDemo,
    "M16 / §15.2: 10,000 dots from instanceField drawn with one three.js InstancedMesh (one geometry, 10k instance matrices) — real GPU instancing replacing the baked-group fallback.",
  ),
  entry(
    "perf/large-pointcloud",
    "Large point cloud (60k)",
    "perf",
    LargePointcloudDemo,
    "M16 / §15.2: a 60,000-point spiral galaxy streamed through the Float32Array buffer channel; Create reveals it by trimming the draw range, with no per-frame geometry churn.",
  ),
  entry(
    "perf/worker-sampling",
    "Worker sampling",
    "perf",
    WorkerSamplingDemo,
    "M16 / §15.2: marching-cubes polygonization run on the main thread vs. an offloaded Worker. core stays DOM-free; the worker glue (protocol/kernel/client) lives in render-three.",
  ),
  entry(
    "plugin/custom-object",
    "Plugin: custom object + animation",
    "plugin",
    CustomObjectPluginDemo,
    "M17 / §18: a plugin registers a new object type (gear) and a new animation kind (spin) into the registries. installPlugin wires both through the build pass — no core edits. Two meshing gears Create on, then spin via the plugin animation.",
  ),
  entry(
    "plugin/custom-generator",
    "Plugin: custom generator",
    "plugin",
    CustomGeneratorPluginDemo,
    "M17 / §18: a plugin registers a PCG generator (golden-angle phyllotaxis). runGenerator dispatches by name through the registries; randomness flows through the seeded rng so the same seed reproduces the sunflower head.",
  ),
  entry(
    "plugin/webgpu-backend",
    "Plugin: WebGPU backend (PoC)",
    "plugin",
    WebGpuBackendPluginDemo,
    "M17 / §18: a render backend is just a registered RendererFactory. The plugin registers webgpu (feature-detected) + webgl; selectRenderer picks the first supported one. Overlay shows the selection; the scene draws via the default WebGL path.",
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
    undefined,
    "examples/src/reactive/leva-binding.tsx",
  ),
];
