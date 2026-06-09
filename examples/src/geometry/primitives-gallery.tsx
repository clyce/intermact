import {
  arc,
  arrow,
  bezierCurve,
  circle,
  ellipse,
  type IMObject2D,
  line,
  polygon,
  rectangle,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { geometryPreviewProgram } from "../lib/geometryPreviewProgram";

/**
 * `examples/geometry/primitives-gallery` (dev-roadmap.md M2).
 *
 * Every 2D primitive at a glance, including a holed polygon and a compound
 * Bézier, rendered via the real R3F pipeline (`IntermactCanvas`).
 */
const items: { title: string; object: IMObject2D }[] = [
  {
    title: "circle",
    object: circle({ radius: 1, style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.25)" } }),
  },
  {
    title: "ellipse",
    object: ellipse({
      rx: 1.4,
      ry: 0.8,
      style: { stroke: "#22c55e", fill: "rgba(34,197,94,0.22)" },
    }),
  },
  {
    title: "rectangle (rounded)",
    object: rectangle({
      width: 2.4,
      height: 1.6,
      cornerRadius: 0.3,
      style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.22)" },
    }),
  },
  {
    title: "arc (open)",
    object: arc({
      radius: 1,
      startAngle: 0.2,
      endAngle: Math.PI * 1.5,
      style: { stroke: "#f97316" },
    }),
  },
  {
    title: "polygon + hole",
    object: polygon({
      points: [xy(-1.2, -1), xy(1.2, -1), xy(1.2, 1), xy(-1.2, 1)],
      holes: [[xy(-0.4, -0.4), xy(-0.4, 0.4), xy(0.4, 0.4), xy(0.4, -0.4)]],
      style: { stroke: "#e879f9", fill: "rgba(232,121,249,0.25)", fillRule: "evenodd" },
    }),
  },
  {
    title: "bezier (cubic chain)",
    object: bezierCurve({
      points: [
        xy(-1.5, 0),
        xy(-0.8, 1.4),
        xy(0, -1.4),
        xy(0.6, 0.6),
        xy(1, 1),
        xy(1.4, 0.2),
        xy(1.6, -0.6),
      ],
      style: { stroke: "#f59e0b" },
    }),
  },
  {
    title: "line",
    object: line({ from: xy(-1.2, -1), to: xy(1.2, 1), style: { stroke: "#94a3b8" } }),
  },
  {
    title: "arrow",
    object: arrow({
      from: xy(-1.2, 0),
      to: xy(1.2, 0.3),
      headLength: 0.4,
      headWidth: 0.35,
      style: { stroke: "#38bdf8", fill: "#38bdf8" },
    }),
  },
];

export function PrimitivesGalleryDemo() {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Primitives gallery</h2>
      <p style={{ color: "#94a3b8", maxWidth: 680 }}>
        All eight 2D primitives via <code>IntermactCanvas</code>. Holed polygon uses nonzero +
        ring/holes triangulation; the Bézier is a cubic chain.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {items.map((it) => (
          <figure key={it.title} style={{ margin: 0 }}>
            <div style={{ height: 220, borderRadius: 8, overflow: "hidden" }}>
              <DemoCanvas program={geometryPreviewProgram(it.object)} />
            </div>
            <figcaption style={{ color: "#cbd5e1", fontSize: 13, marginTop: 6 }}>
              {it.title}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
