import { useMemo } from "react";
import {
  type AbsXY,
  createProgram,
  line,
  linearScale,
  logScale,
  polyline,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M7 / design.md §7.3: a log-scale plot. `y = 2^x` is exponential on a linear
 * axis but a straight line on a log y-axis. We map data through a `linearScale`
 * (x) and a `logScale` (y), draw both curves, and place y-axis tick marks at
 * powers of ten using `logScale.ticks()` + `tickFormat`.
 */
const X_RANGE: [number, number] = [0, 9];
const Y_RANGE: [number, number] = [-3, 3];

const xScale = linearScale([0, 10], X_RANGE);
const yLog = logScale([1, 1024], Y_RANGE);
const yLinear = linearScale([1, 1024], Y_RANGE);

function buildProgram() {
  return createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain: { x: [-0.6, 9.6], y: [-3.6, 3.6] },
      background: "#0b1020",
    });
    ctx.mount(scene, ctx.createCamera2D(scene));

    // Axes
    scene.register(
      line({
        from: xy(X_RANGE[0], Y_RANGE[0]),
        to: xy(X_RANGE[1], Y_RANGE[0]),
        style: { stroke: "#475569", lineWidth: 0.02 },
      }),
    );
    scene.register(
      line({
        from: xy(X_RANGE[0], Y_RANGE[0]),
        to: xy(X_RANGE[0], Y_RANGE[1]),
        style: { stroke: "#475569", lineWidth: 0.02 },
      }),
    );

    // y ticks at powers of ten (from the log scale).
    for (const t of yLog.ticks(6)) {
      const y = yLog(t);
      scene.register(
        line({
          from: xy(X_RANGE[0] - 0.12, y),
          to: xy(X_RANGE[0] + 0.12, y),
          style: { stroke: "#64748b", lineWidth: 0.02 },
        }),
      );
    }

    // Sample y = 2^x over the data domain.
    const logPts: AbsXY[] = [];
    const linPts: AbsXY[] = [];
    const samples = 64;
    for (let i = 0; i <= samples; i++) {
      const dx = (i / samples) * 10;
      const dy = 2 ** dx;
      const clamped = Math.min(dy, 1024);
      logPts.push(xy(xScale(dx), yLog(clamped)));
      linPts.push(xy(xScale(dx), yLinear(clamped)));
    }

    // On the log axis the exponential is a straight line; on the linear axis it
    // hugs the bottom then explodes.
    const onLog = scene.register(
      polyline({ points: logPts, style: { stroke: "#22c55e", lineWidth: 0.035 } }),
    );
    const onLinear = scene.register(
      polyline({ points: linPts, style: { stroke: "#f97316", lineWidth: 0.03 } }),
    );

    await scene.play(onLog.create({ duration: 1.2 }));
    await scene.play(onLinear.create({ duration: 1.2 }));
  });
}

export function LogPlotDemo() {
  const program = useMemo(buildProgram, []);
  const fmt = yLog.tickFormat(6);
  return (
    <div style={{ display: "flex", gap: 12, height: "100%" }}>
      <div style={{ flex: "0 0 180px", color: "#cbd5e1", fontSize: 12 }}>
        <div style={{ color: "#22c55e", fontWeight: 600 }}>green · 2^x on log y</div>
        <div style={{ color: "#f97316", fontWeight: 600, marginBottom: 8 }}>
          orange · 2^x on linear y
        </div>
        <div style={{ color: "#94a3b8" }}>log y ticks:</div>
        <div style={{ fontFamily: "monospace" }}>{yLog.ticks(6).map(fmt).join("  ")}</div>
      </div>
      <div style={{ flex: 1 }}>
        <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
      </div>
    </div>
  );
}
