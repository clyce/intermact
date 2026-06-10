import { useRef, useState } from "react";
import { circle, createProgram, xy, type Player } from "@intermact/core";
import { downloadBlob, recordCanvasVideo } from "@intermact/react";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/export/video-render` (dev-roadmap.md M15, §17).
 *
 * Renders a scene and records the live GL canvas to a downloadable WebM via the
 * browser `MediaRecorder` glue (`recordCanvasVideo`). The deterministic, headless
 * half (fixed-fps frame hashes / SVG snapshots) lives in `@intermact/core`; this
 * shows the in-browser encode path.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dots = Array.from({ length: 6 }, (_, i) =>
    scene.register(circle({ radius: 0.25, style: { fill: `hsl(${i * 60} 80% 60%)` } }), {
      position: xy(-4 + i * 1.6, -2),
    }),
  );
  for (let i = 0; i < dots.length; i++) {
    await scene.play(dots[i]!.moveTo(xy(-4 + i * 1.6, 2), { duration: 0.5, easing: "backOut" }));
  }
  await scene.play(...dots.map((d, i) => d.moveTo(xy(-4 + i * 1.6, 0), { duration: 1 })));
});

export function VideoRenderExportDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Press Record to capture a WebM clip.");

  const record = async (player: Player): Promise<void> => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) {
      setStatus("No canvas found.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setStatus("MediaRecorder is unavailable in this browser.");
      return;
    }
    setStatus("Recording…");
    try {
      const blob = await recordCanvasVideo(canvas, player, { fps: 30 });
      downloadBlob(blob, "intermact-scene.webm");
      setStatus(`Saved intermact-scene.webm (${Math.round(blob.size / 1024)} KB).`);
    } catch (err) {
      setStatus(`Recording failed: ${String(err)}`);
    }
  };

  return (
    <div ref={wrapRef} style={{ height: "100%", position: "relative" }}>
      <DemoCanvas
        program={program}
        controls={{ timeline: true }}
        chrome={(built) => (
          <div
            style={{ position: "absolute", top: 8, left: 8, zIndex: 10, display: "flex", gap: 8 }}
          >
            <button onClick={() => void record(built.player)} style={{ padding: "4px 12px" }}>
              ● Record
            </button>
            <span style={{ fontSize: 12, color: "#cbd5e1", alignSelf: "center" }}>{status}</span>
          </div>
        )}
      />
    </div>
  );
}
