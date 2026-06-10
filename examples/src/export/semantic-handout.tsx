import { useState } from "react";
import { circle, createProgram, rectangle, semanticLayerFromProject, xy } from "@intermact/core";
import { SerializedCanvas } from "@intermact/react";
import { useSerializedDemo } from "../lib/useSerializedDemo";

/**
 * `examples/export/semantic-handout` (dev-roadmap.md M15, §17).
 *
 * Objects carry semantic {@link ObjectMetadata} (label / href / a11yLabel). The
 * semantic layer surfaces them as real, focusable DOM next to the canvas — an
 * accessible, linkable "handout" of the figure. The reduced-motion toggle shows
 * the `prefers-reduced-motion` degrade (final frame, no animation).
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const earth = scene.register(
    circle({
      radius: 0.9,
      style: { stroke: "#38bdf8", fill: "#0ea5e9" },
      metadata: {
        label: "Earth",
        href: "https://en.wikipedia.org/wiki/Earth",
        a11yLabel: "Earth, the third planet",
      },
    }),
    { position: xy(-2, 0) },
  );
  const moon = scene.register(
    circle({
      radius: 0.4,
      style: { stroke: "#cbd5e1", fill: "#94a3b8" },
      metadata: {
        label: "Moon",
        href: "https://en.wikipedia.org/wiki/Moon",
        a11yLabel: "The Moon",
      },
    }),
    { position: xy(0.4, 0.8) },
  );
  const panel = scene.register(
    rectangle({
      width: 2,
      height: 1.2,
      style: { stroke: "#f59e0b" },
      metadata: { label: "Legend", note: "A reference panel", a11yLabel: "Legend panel" },
    }),
    { position: xy(2.4, -1) },
  );
  await scene.play(earth.create({ duration: 1 }));
  await scene.play(moon.fadeIn({ duration: 1 }), panel.create({ duration: 1 }));
  await scene.play(moon.moveTo(xy(-0.4, -0.9), { duration: 1.5, easing: "sineInOut" }));
});

export function SemanticHandoutExportDemo() {
  const project = useSerializedDemo(program);
  const [reduced, setReduced] = useState(false);

  if (!project) return <div style={{ padding: 16, color: "#94a3b8" }}>Building…</div>;
  const entries = semanticLayerFromProject(project);

  return (
    <div style={{ height: "100%", display: "flex", gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <SerializedCanvas
          project={project}
          autoplay
          timeline
          semantic="visible"
          reducedMotion={reduced ? "on" : "off"}
        />
      </div>
      <aside
        style={{
          width: 220,
          padding: 12,
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          overflow: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>Handout</h3>
        <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
          Reduced motion
        </label>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {entries.map((e) => (
            <li key={e.id} style={{ marginBottom: 6 }}>
              {e.href ? (
                <a href={e.href} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc" }}>
                  {e.label ?? e.id}
                </a>
              ) : (
                <strong>{e.label ?? e.id}</strong>
              )}
              {e.note ? <div style={{ color: "#94a3b8" }}>{e.note}</div> : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
