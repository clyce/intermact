import { circle, createProgram } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";
import { useMemo, useState } from "react";

/** M5: compare contain / cover / stretch fit strategies. */
export function FitStrategiesDemo() {
  const [fit, setFit] = useState<"contain" | "cover" | "stretch">("contain");
  const program = useMemo(
    () =>
      createProgram(async (ctx) => {
        const scene = ctx.createScene2D({
          coordinate: "cartesian",
          domain: { x: [-6, 6], y: [-2, 2] },
          fit,
          background: "#0b1020",
        });
        ctx.mount(scene, ctx.createCamera2D(scene));
        scene.register(
          circle({
            radius: 1.8,
            style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.15)", lineWidth: 0.03 },
          }),
        );
        const axes = scene.getAxes({
          x: [-6, 6],
          y: [-2, 2],
          style: { stroke: "#475569", lineWidth: 0.025 },
        });
        await scene.play(axes.fadeIn({ duration: 0.5 }));
      }),
    [fit],
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(["contain", "cover", "stretch"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFit(f)} style={{ padding: "4px 10px" }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ height: 320, resize: "both", overflow: "hidden", border: "1px solid #334155" }}>
        <DemoCanvas program={program} autoplay style={{ height: "100%" }} />
      </div>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>
        Resize the box — the circle stays a true circle under <code>contain</code> (default).
      </p>
    </div>
  );
}
