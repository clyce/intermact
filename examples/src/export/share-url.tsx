import { useMemo, useState } from "react";
import { circle, createProgram, encodeShareUrl, rectangle, xy } from "@intermact/core";
import { SerializedCanvas } from "@intermact/react";
import { useSerializedDemo } from "../lib/useSerializedDemo";

/**
 * `examples/export/share-url` (dev-roadmap.md M15, §17).
 *
 * Builds a program, serializes it, encodes it as a URL-safe string, and mounts
 * the scene **from the decoded string** — proving a scene can travel as a link
 * with no source code. The canvas you see is reconstructed entirely from the
 * `?p=` payload.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const sun = scene.register(
    circle({ radius: 0.8, style: { stroke: "#fbbf24", fill: "#f59e0b", lineWidth: 0.04 } }),
    { position: xy(-2.4, 1.2) },
  );
  const box = scene.register(
    rectangle({ width: 1.4, height: 1, style: { stroke: "#38bdf8", fill: "#0ea5e9" } }),
    { position: xy(2.4, -1) },
  );
  await scene.play(sun.create({ duration: 1, easing: "cubicInOut" }));
  await scene.play(
    sun.moveTo(xy(0, 0), { duration: 1.2, easing: "quadInOut" }),
    box.fadeIn({ duration: 1.2 }),
  );
  await scene.play(box.moveTo(xy(0, 0), { duration: 1 }), sun.scaleTo(1.4, { duration: 1 }));
});

export function ShareUrlExportDemo() {
  const project = useSerializedDemo(program);
  const [copied, setCopied] = useState(false);
  const encoded = useMemo(() => (project ? encodeShareUrl(project) : ""), [project]);

  if (!project) return <div style={{ padding: 16, color: "#94a3b8" }}>Building…</div>;

  const shareLink = `${typeof location !== "undefined" ? location.origin + location.pathname : ""}?p=${encoded}`;
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SerializedCanvas project={encoded} autoplay timeline />
      </div>
      <div style={{ fontSize: 12, color: "#cbd5e1", padding: "0 8px 8px" }}>
        <div style={{ marginBottom: 4 }}>
          Scene reconstructed from a {encoded.length.toLocaleString()}-char share-url payload.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            readOnly
            value={shareLink}
            style={{
              flex: 1,
              background: "#0f172a",
              color: "#7dd3fc",
              border: "1px solid #1e293b",
              borderRadius: 4,
              padding: "4px 8px",
              fontFamily: "monospace",
              fontSize: 11,
            }}
          />
          <button onClick={copy} style={{ padding: "4px 10px" }}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
