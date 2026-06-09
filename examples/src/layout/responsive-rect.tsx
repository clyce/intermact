import {
  createProgram,
  rectangle,
  textObject,
  uv,
  xy,
  type AbsXY,
  type RelUV,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M12 / design.md §9.4: RectTransform-style responsive anchoring. Labels are
 * pinned to domain-relative UV anchors via `coordinate.relToAbs` + `alignTo`, so
 * they stay glued to their corners as the viewport resizes. `fitTo` centers a
 * square within the domain (uniform scale).
 */
const PINS: { p: RelUV; a: RelUV; t: string }[] = [
  { p: uv(0.03, 0.95), a: uv(0, 1), t: "TOP-LEFT" },
  { p: uv(0.97, 0.95), a: uv(1, 1), t: "TOP-RIGHT" },
  { p: uv(0.03, 0.05), a: uv(0, 0), t: "BOT-LEFT" },
  { p: uv(0.97, 0.05), a: uv(1, 0), t: "BOT-RIGHT" },
  { p: uv(0.5, 0.5), a: uv(0.5, 0.5), t: "CENTER" },
];

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const frame = scene.register(
    rectangle({ width: 1, height: 1, style: { stroke: "#334155", lineWidth: 0.05 } }),
  );
  const domainBounds = {
    min: xy(-6, -4) as AbsXY,
    max: xy(6, 4) as AbsXY,
    size: [12, 8] as const,
    center: xy(0, 0) as AbsXY,
  };
  scene.commit(frame.layout.fitTo(domainBounds, { padding: 0.6 }));

  for (const { p, a, t } of PINS) {
    const label = scene.register(
      textObject({ text: t, size: 0.3, style: { stroke: "#38bdf8", lineWidth: 0.03 } }),
    );
    scene.commit(label.layout.alignTo(scene.coordinate.relToAbs(p), { anchor: a }));
  }
});

export function ResponsiveRectDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} />
    </div>
  );
}
