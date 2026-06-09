import { useMemo } from "react";
import { useControls } from "leva";
import {
  createProgram,
  line,
  linearScale,
  logScale,
  powScale,
  type Scale,
  timeScale,
  xy,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** A labelled row in the playground: a scale plus where to draw it. */
interface ScaleRow {
  readonly label: string;
  readonly scale: Scale<number, number> | Scale<Date, number>;
  readonly ticks: number[] | Date[];
  readonly labels: string[];
  readonly y: number;
  /** World x position of each tick (already mapped through the scale). */
  readonly positions: number[];
}

const RANGE: [number, number] = [0, 10];

/**
 * M7 / design.md §7.3: compare linear / pow / log / time scales. Each scale maps
 * its data domain onto the same world range `[0,10]`; we draw a baseline and a
 * tick mark at every `scale.ticks()` position, so the visual clustering shows
 * how each scale distributes values. The HTML legend exercises `tickFormat`.
 */
export function ScalePlaygroundDemo() {
  const { tickCount, exponent } = useControls({
    tickCount: { value: 10, min: 3, max: 12, step: 1 },
    exponent: { value: 0.5, min: 0.2, max: 3, step: 0.1 },
  });

  const { program, rows } = useMemo(() => {
    const linear = linearScale([0, 100], RANGE);
    const pow = powScale([0, 100], RANGE, exponent);
    const log = logScale([1, 1000], RANGE);
    const time = timeScale(
      [new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2020, 0, 11))],
      RANGE,
    );

    const rows: ScaleRow[] = [
      mkNumberRow("linear [0,100]", linear, tickCount, 3.5),
      mkNumberRow(`pow ^${exponent.toFixed(1)} [0,100]`, pow, tickCount, 2),
      mkNumberRow("log [1,1000]", log, tickCount, 0.5),
      mkTimeRow("time (10 days)", time, tickCount, -1),
    ];

    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-0.6, 10.6], y: [-1.8, 4.4] },
        background: "#0b1020",
      });
      ctx.mount(scene, ctx.createCamera2D(scene));

      for (const row of rows) {
        scene.register(
          line({
            from: xy(0, row.y),
            to: xy(10, row.y),
            style: { stroke: "#475569", lineWidth: 0.02 },
          }),
        );
        for (const pos of row.positions) {
          scene.register(
            line({
              from: xy(pos, row.y - 0.16),
              to: xy(pos, row.y + 0.16),
              style: { stroke: "#38bdf8", lineWidth: 0.025 },
            }),
          );
        }
      }
    });

    return { program, rows };
  }, [tickCount, exponent]);

  return (
    <div style={{ display: "flex", gap: 12, height: "100%" }}>
      <div style={{ flex: "0 0 240px", overflow: "auto", color: "#cbd5e1", fontSize: 12 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ marginBottom: 12 }}>
            <div style={{ color: "#7dd3fc", fontWeight: 600 }}>{row.label}</div>
            <div style={{ fontFamily: "monospace", color: "#94a3b8" }}>{row.labels.join("  ")}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <IntermactCanvas program={program} autoplay />
      </div>
    </div>
  );
}

function mkNumberRow(
  label: string,
  scale: Scale<number, number>,
  count: number,
  y: number,
): ScaleRow {
  const ticks = scale.ticks(count);
  const fmt = scale.tickFormat(count);
  return {
    label,
    scale,
    ticks,
    labels: ticks.map(fmt),
    y,
    positions: ticks.map((t) => scale(t)),
  };
}

function mkTimeRow(label: string, scale: Scale<Date, number>, count: number, y: number): ScaleRow {
  const ticks = scale.ticks(count);
  const fmt = scale.tickFormat(count);
  return {
    label,
    scale,
    ticks,
    labels: ticks.map(fmt),
    y,
    positions: ticks.map((t) => scale(t)),
  };
}
