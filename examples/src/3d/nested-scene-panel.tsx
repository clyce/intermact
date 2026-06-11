import { circle, createProgram, rectangle, render, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/3d/nested-scene-panel` (dev-roadmap.md M14, design.md §10.2, §19.5).
 *
 * The "scene-within-a-scene" composition built on the **core** `render()` API:
 * an independent 2D sub-scene is composed as a `RenderedScene` object
 * (`type: "rendered-scene"`) and registered into the host scene like any other
 * object — positioned, framed, and animated through the standard animation API.
 * The R3F layer (`SceneView`) auto-composites it into an offscreen render target
 * and maps the live texture onto its quad; the sub-scene animates independently.
 *
 * Layout: left = static host chrome; right = framed live panel (orange dot loop).
 */
const PANEL_DOMAIN = { x: [-3, 3] as const, y: [-2, 2] as const };

const program = createProgram(async (ctx) => {
  const host = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [0, 16], y: [0, 9] },
    background: "#05070f",
  });
  ctx.mount(host, ctx.createCamera2D(host));

  // Host chrome (left) — shows this is the outer scene, not an empty canvas.
  host.register(
    rectangle({ width: 0.08, height: 5.2, style: { fill: "#334155" } }),
    { position: xy(1.6, 4.5) },
  );
  host.register(
    circle({ radius: 0.22, style: { fill: "#475569", stroke: "#64748b", lineWidth: 0.03 } }),
    { position: xy(1.6, 7.1) },
  );
  host.register(
    circle({ radius: 0.22, style: { fill: "#475569", stroke: "#64748b", lineWidth: 0.03 } }),
    { position: xy(1.6, 1.9) },
  );

  const sub = ctx.createScene2D({
    coordinate: "cartesian",
    domain: PANEL_DOMAIN,
    fit: "stretch",
    background: "#0b1020",
  });
  const subCamera = ctx.createCamera2D(sub);
  sub.register(
    rectangle({ width: 5.6, height: 3.6, style: { stroke: "#334155", lineWidth: 0.04 } }),
  );
  const dot = sub.register(
    circle({ radius: 0.34, center: xy(-2, -1), style: { fill: "#f59e0b", stroke: "#fde68a" } }),
  );
  await sub.play(dot.moveTo(xy(2, 1.2), { duration: 1.2 }));
  await sub.play(dot.moveTo(xy(2, -1.2), { duration: 0.9 }));
  await sub.play(dot.moveTo(xy(-2, 1.2), { duration: 1.2 }));
  await sub.play(dot.moveTo(xy(-2, -1), { duration: 0.9 }));

  const panel = render(sub, subCamera, {
    size: [7, 5],
    resolution: [560, 400],
    textureMode: "live",
  });
  host.register(
    rectangle({
      width: 7.4,
      height: 5.4,
      style: { fill: "#0b1020", stroke: "#475569", lineWidth: 0.05 },
    }),
    { position: xy(8, 4.5) },
  );
  const panelObj = host.register(panel, { position: xy(8, 4.5) });
  await host.play(panelObj.fadeIn({ duration: 0.6 }));
  await host.wait(5);
});

export function NestedScenePanel3DDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay skipFonts controls={{ timeline: true }} />
    </div>
  );
}
