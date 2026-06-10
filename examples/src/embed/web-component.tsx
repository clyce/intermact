import { createElement, useEffect, useMemo, useState } from "react";
import { circle, createProgram, encodeShareUrl, polygon, xy } from "@intermact/core";
import { defineIntermactEmbed } from "@intermact/react";
import { useSerializedDemo } from "../lib/useSerializedDemo";

/**
 * `examples/embed/web-component` (dev-roadmap.md M15, §17).
 *
 * Registers the `<intermact-embed>` custom element and mounts a serialized scene
 * through it from a share-url string — the same tag a third-party page (or an
 * iframe) would drop in with no React on the host. The element owns its own React
 * root internally.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3, 3], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const ring = scene.register(circle({ radius: 2, style: { stroke: "#22d3ee", lineWidth: 0.03 } }));
  const tri = scene.register(
    polygon({
      points: [xy(0, 1.6), xy(-1.4, -0.9), xy(1.4, -0.9)],
      style: { stroke: "#a78bfa", fill: "#7c3aed" },
    }),
  );
  await scene.play(ring.create({ duration: 1 }));
  await scene.play(tri.create({ duration: 1 }));
  await scene.play(tri.rotateTo(Math.PI * 2, { duration: 2, easing: "cubicInOut" }));
});

export function WebComponentEmbedDemo() {
  const project = useSerializedDemo(program);
  const [tag, setTag] = useState<string | null>(null);
  const encoded = useMemo(() => (project ? encodeShareUrl(project) : ""), [project]);

  useEffect(() => {
    setTag(defineIntermactEmbed());
  }, []);

  if (!project || !tag) return <div style={{ padding: 16, color: "#94a3b8" }}>Building…</div>;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#cbd5e1", padding: "8px 8px 0" }}>
        Mounted via <code>&lt;{tag} project=&quot;…&quot; autoplay timeline&gt;</code> — a framework
        -agnostic custom element fed only the share-url payload.
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {createElement(tag, {
          project: encoded,
          autoplay: "true",
          interactive: "true",
          timeline: "true",
          style: { display: "block", width: "100%", height: "100%" },
        })}
      </div>
    </div>
  );
}
