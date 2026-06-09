import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * `examples/timeline/markers-slides` (dev-roadmap.md M1).
 *
 * Uses `scene.marker(...)` to create slide-style chapters and `jumpToMarker` to
 * navigate between them.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-1, 5], y: [-2, 2] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dot = scene.register(circle({ radius: 0.2, style: { fill: "#f472b6" } }), {
    position: xy(0, -1),
  });
  scene.marker("Intro");
  await scene.play(dot.moveTo(xy(0, 1), { duration: 1 }));
  scene.marker("Rise");
  await scene.play(dot.moveTo(xy(4, 1), { duration: 1 }));
  scene.marker("Travel");
  await scene.play(dot.moveTo(xy(4, -1), { duration: 1 }));
  scene.marker("Settle");
});

export function MarkersSlidesDemo() {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Markers &amp; slides</h2>
      <p style={{ color: "#94a3b8", maxWidth: 640 }}>
        Each marker is a chapter bookmark. Click one to <code>jumpToMarker</code> â€?slide-style
        presentation navigation built on the same seekable timeline.
      </p>
      <div style={{ height: "100%" }}>
        <IntermactCanvas
          program={program}
          controls={{ timeline: true }}
          chrome={(built) => {
            const markers = built.player.storyboard.markers;
            return (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {markers.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => built.player.jumpToMarker(m.name)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #334155",
                      background: "#1e293b",
                      color: "#e2e8f0",
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: 13,
                    }}
                  >
                    {m.name} Â· {m.time.toFixed(1)}s
                  </button>
                ))}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
