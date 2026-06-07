import { useState } from "react";
import { circle, polygon, rectangle, xy, type IMObject2D } from "@intermact/core";
import { GeometryView } from "../lib/SvgGeometry";

/**
 * `examples/geometry/sampling-debug` (dev-roadmap.md M2).
 *
 * Visualizes arc-length sample points, the AABB, and the earcut triangulation
 * mesh, with a slider for the sample count — a debugging aid for geometry.
 */
const shapes: Record<string, IMObject2D> = {
  circle: circle({ radius: 1.2, style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.18)" } }),
  "rounded rect": rectangle({
    width: 2.6,
    height: 1.8,
    cornerRadius: 0.4,
    style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.18)" },
  }),
  "polygon + hole": polygon({
    points: [xy(-1.3, -1.1), xy(1.3, -1.1), xy(1.3, 1.1), xy(-1.3, 1.1)],
    holes: [[xy(-0.5, -0.5), xy(-0.5, 0.5), xy(0.5, 0.5), xy(0.5, -0.5)]],
    style: { stroke: "#e879f9", fill: "rgba(232,121,249,0.18)", fillRule: "evenodd" },
  }),
};

export function SamplingDebugDemo() {
  const [shape, setShape] = useState<keyof typeof shapes>("circle");
  const [samples, setSamples] = useState(48);
  const object = shapes[shape]!;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Sampling debug</h2>
      <p style={{ color: "#94a3b8", maxWidth: 680 }}>
        Red dots are arc-length sample points, the dashed box is the AABB, purple lines are the
        earcut triangulation.
      </p>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {Object.keys(shapes).map((key) => (
          <button
            key={key}
            onClick={() => setShape(key)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #334155",
              background: key === shape ? "#1e293b" : "transparent",
              color: "#e2e8f0",
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
            }}
          >
            {key}
          </button>
        ))}
        <label
          style={{ color: "#94a3b8", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}
        >
          samples: {samples}
          <input
            type="range"
            min={4}
            max={128}
            value={samples}
            onChange={(e) => setSamples(Number(e.target.value))}
          />
        </label>
      </div>
      <GeometryView
        object={object}
        width={420}
        height={420}
        samples={samples}
        showSamples
        showBounds
        showTriangulation
      />
    </div>
  );
}
