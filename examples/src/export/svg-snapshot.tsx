import { useEffect, useState } from "react";
import {
  buildProgram,
  circle,
  createProgram,
  rectangle,
  sampleFrameHashes,
  snapshotToSVG,
  xy,
} from "@intermact/core";

/**
 * `examples/export/svg-snapshot` (dev-roadmap.md M15, design.md §17).
 *
 * The deterministic, headless export path: `buildProgram` yields a `Player`
 * with no DOM/GL, we seek to fixed times, and `snapshotToSVG` emits a
 * standalone SVG string per frame (zero GL deps). `sampleFrameHashes` proves
 * the same fixed-fps timeline always hashes identically — the basis for golden
 * frame tests and reproducible exports.
 */
const DOMAIN = { x: [-4, 4] as const, y: [-3, 3] as const };

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: DOMAIN,
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const sun = scene.register(
    circle({ radius: 0.8, style: { stroke: "#fbbf24", fill: "#f59e0b", lineWidth: 0.04 } }),
    { position: xy(-2.2, 1.1) },
  );
  const box = scene.register(
    rectangle({ width: 1.6, height: 1.1, style: { stroke: "#38bdf8", fill: "#0ea5e9" } }),
    { position: xy(2.2, -1.1) },
  );
  await scene.play(sun.create({ duration: 1, easing: "cubicInOut" }));
  await scene.play(sun.moveTo(xy(0, 0), { duration: 1 }), box.fadeIn({ duration: 1 }));
  await scene.play(box.moveTo(xy(0, 0), { duration: 1 }), sun.scaleTo(1.3, { duration: 1 }));
});

interface Frame {
  readonly t: number;
  readonly svg: string;
}

function download(svg: string, name: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SvgSnapshotExportDemo() {
  const [frames, setFrames] = useState<readonly Frame[] | null>(null);
  const [hash, setHash] = useState("");

  useEffect(() => {
    let alive = true;
    buildProgram(program).then(
      ({ player }) => {
        if (!alive) return;
        const times = [0, 0.25, 0.5, 0.75, 1].map((f) => f * player.duration);
        const next = times.map((t) => {
          player.seek(t);
          return {
            t,
            svg: snapshotToSVG(player.getSnapshot(), {
              domain: DOMAIN,
              width: 220,
              height: 165,
              background: "#0b1020",
            }),
          };
        });
        const hashes = sampleFrameHashes(player, { fps: 6 });
        setFrames(next);
        setHash(hashes[Math.floor(hashes.length / 2)] ?? "");
      },
      (err) => console.error("[intermact] svg-snapshot build failed:", err),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!frames) return <div style={{ padding: 16, color: "#94a3b8" }}>Building…</div>;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        background: "#060a16",
        color: "#cbd5e1",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 13 }}>
        Five fixed-time frames rendered to standalone SVG — no GL canvas in the loop.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1, minHeight: 0 }}>
        {frames.map((f) => (
          <figure key={f.t} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{ border: "1px solid #1e293b", borderRadius: 6, overflow: "hidden" }}
              dangerouslySetInnerHTML={{ __html: f.svg }}
            />
            <figcaption style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span>t = {f.t.toFixed(2)}s</span>
              <button
                onClick={() => download(f.svg, `frame-${f.t.toFixed(2)}.svg`)}
                style={{ fontSize: 11, padding: "1px 6px" }}
              >
                .svg
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#7dd3fc", fontFamily: "monospace" }}>
        mid-frame hash: {hash}
      </div>
    </div>
  );
}
