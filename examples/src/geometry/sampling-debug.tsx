import { useMemo, useState } from "react";
import { circle, polygon, rectangle, xy, type IMObject2D } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { samplingDebugProgram } from "../lib/geometryPreviewProgram";

/**
 * `examples/geometry/sampling-debug` (dev-roadmap.md M2).
 *
 * Visualizes arc-length sample points, the AABB, and the earcut triangulation
 * mesh through the real renderer, with a slider for the sample count.
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

const CANVAS_MIN_HEIGHT = 360;

export function SamplingDebugDemo() {
  const [shape, setShape] = useState<keyof typeof shapes>("circle");
  const [samples, setSamples] = useState(48);
  const object = shapes[shape]!;

  const program = useMemo(() => samplingDebugProgram(object, samples), [object, samples]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {Object.keys(shapes).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setShape(key as keyof typeof shapes)}
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
      <div
        style={{
          flex: 1,
          minHeight: CANVAS_MIN_HEIGHT,
          maxWidth: 480,
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <DemoCanvas program={program} skipFonts />
      </div>
    </div>
  );
}
