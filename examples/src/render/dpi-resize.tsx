import { useState } from "react";
import { circle, createProgram, line, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * `examples/render/dpi-resize` (dev-roadmap.md M3).
 *
 * Resize the canvas with the slider (and try a HiDPI display): R3F drives the
 * device pixel ratio and a ResizeObserver, while the camera refits the scene
 * domain (`contain`), so shapes stay crisp and undistorted at any size.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3, 3], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // Concentric circles + crosshair to reveal any aliasing/distortion.
  for (let r = 0.5; r <= 2.5; r += 0.5) {
    scene.register(
      circle({
        radius: r,
        samples: 160,
        style: { stroke: "#38bdf8", lineWidth: { value: 1.5, unit: "px" } },
      }),
    );
  }
  scene.register(
    line({
      from: xy(-2.8, 0),
      to: xy(2.8, 0),
      style: { stroke: "#475569", lineWidth: { value: 1, unit: "px" } },
    }),
  );
  scene.register(
    line({
      from: xy(0, -2.8),
      to: xy(0, 2.8),
      style: { stroke: "#475569", lineWidth: { value: 1, unit: "px" } },
    }),
  );
});

export function DpiResizeDemo() {
  const [size, setSize] = useState(420);
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>DPI &amp; resize</h2>
      <p style={{ color: "#94a3b8", maxWidth: 680 }}>
        Px-unit strokes stay a constant on-screen thickness; the camera refits on resize so circles
        stay round (no stretching). Drag to resize.
      </p>
      <label
        style={{
          color: "#94a3b8",
          fontSize: 13,
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        size: {size}px
        <input
          type="range"
          min={200}
          max={720}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
      </label>
      <div
        style={{
          width: size,
          height: Math.round(size * 0.6),
          border: "1px solid #1f2937",
          borderRadius: 8,
          overflow: "hidden",
          resize: "both",
        }}
      >
        <IntermactCanvas program={program} autoplay={false} />
      </div>
    </div>
  );
}
