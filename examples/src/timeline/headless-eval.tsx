import { useEffect, useState } from "react";
import { buildProgram, createProgram, xy } from "@intermact/core";

/**
 * `examples/timeline/headless-eval` (dev-roadmap.md M1).
 *
 * Builds a Storyboard with NO renderer/DOM and samples RuntimeState at fixed t,
 * mirroring `buildProgram` running headless in Node. This is the deterministic
 * snapshot baseline the timeline tests assert against (design.md §21.1).
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const a = scene.registerEmpty({ position: xy(-3, 0) });
  const b = scene.registerEmpty({ position: xy(0, 0) });
  await scene.play(
    a.moveTo(xy(3, 0), { duration: 2, easing: "linear" }),
    b.moveTo(xy(0, 2), { duration: 4, easing: "quadInOut" }),
  );
});

interface Row {
  readonly t: number;
  readonly positions: { readonly id: string; readonly x: number; readonly y: number }[];
}

export function HeadlessEvalDemo() {
  const [rows, setRows] = useState<Row[]>([]);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let alive = true;
    void buildProgram(program).then(({ player }) => {
      if (!alive) return;
      const samples = [0, 0.5, 1, 1.5, 2, 3, 4];
      const out: Row[] = samples.map((t) => {
        player.seek(t);
        const snapshot = player.getSnapshot();
        return {
          t,
          positions: [...snapshot.objects.values()].map((o) => ({
            id: o.id,
            x: o.state.transform.position[0],
            y: o.state.transform.position[1],
          })),
        };
      });
      setDuration(player.duration);
      setRows(out);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Headless evaluation</h2>
      <p style={{ color: "#94a3b8", maxWidth: 680 }}>
        The same <code>buildProgram</code> runs without any renderer. We seek to fixed times and
        print RuntimeState — exactly what a Node test / export pipeline does. Total duration{" "}
        {duration.toFixed(2)}s.
      </p>
      <table
        style={{ borderCollapse: "collapse", fontFamily: "ui-monospace, monospace", fontSize: 13 }}
      >
        <thead>
          <tr style={{ color: "#94a3b8" }}>
            <th style={cell}>t (s)</th>
            {rows[0]?.positions.map((p) => (
              <th key={p.id} style={cell}>
                {p.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.t}>
              <td style={cell}>{row.t.toFixed(2)}</td>
              {row.positions.map((p) => (
                <td key={p.id} style={cell}>
                  ({p.x.toFixed(3)}, {p.y.toFixed(3)})
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cell = {
  border: "1px solid #1f2937",
  padding: "6px 12px",
  textAlign: "left",
} as const;
