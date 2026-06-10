import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  type BuiltProgram,
  type IMObject2D,
  type RenderSnapshot,
  type Scene2DProps,
  transformBounds,
} from "@intermact/core";

/**
 * Dev-time Inspector overlay (design.md §16). A DOM panel over the WebGL canvas
 * that surfaces the scene registry, each object's live runtime state, the
 * currently active timeline tracks, and the reactive dependency graph. Selecting
 * a row highlights that object's world-space bounds via an SVG overlay.
 *
 * Bounds projection assumes the default `contain` fit; pass `fit` to match a
 * custom viewport fit.
 */
export function Inspector({
  built,
  fit = "contain",
}: {
  built: BuiltProgram;
  fit?: NonNullable<Scene2DProps["fit"]>;
}) {
  const { player, storyboard, reactive, scene } = built;
  const [snapshot, setSnapshot] = useState<RenderSnapshot>(() => player.getSnapshot());
  const [selected, setSelected] = useState<string | null>(null);
  const [showBounds, setShowBounds] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });

  useEffect(() => player.subscribe(setSnapshot), [player]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const domain: { x: readonly [number, number]; y: readonly [number, number] } =
    scene.kind === "scene-2d" ? scene.props.domain : { x: [-1, 1], y: [-1, 1] };
  const project = useMemo(() => {
    const dw = domain.x[1] - domain.x[0];
    const dh = domain.y[1] - domain.y[0];
    const dataAspect = dw / dh;
    const viewAspect = size.w / size.h;
    let halfW: number;
    let halfH: number;
    const cover = fit === "cover";
    if (viewAspect > dataAspect !== cover) {
      halfH = dh / 2;
      halfW = halfH * viewAspect;
    } else {
      halfW = dw / 2;
      halfH = halfW / viewAspect;
    }
    const cx = (domain.x[0] + domain.x[1]) / 2;
    const cy = (domain.y[0] + domain.y[1]) / 2;
    const f = { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH };
    return (wx: number, wy: number): [number, number] => [
      ((wx - f.left) / (f.right - f.left)) * size.w,
      ((f.top - wy) / (f.top - f.bottom)) * size.h,
    ];
  }, [domain, size, fit]);

  const rows = [...snapshot.objects.values()];
  const activeTracks = storyboard.tracks.filter(
    (t) => t.start <= snapshot.time + 1e-6 && snapshot.time <= t.start + t.duration + 1e-6,
  );
  const graph = reactive.inspect();

  const boundsOverlay = showBounds
    ? rows.flatMap((r) => {
        if (r.object.dimension !== "2d" || r.state.dimension !== "2d") return [];
        const obj = r.object as IMObject2D;
        const wb = transformBounds(obj.geometry.getBounds(), r.state.transform);
        const [x0, y0] = project(wb.min[0], wb.max[1]);
        const [x1, y1] = project(wb.max[0], wb.min[1]);
        const on = r.id === selected;
        return [
          <rect
            key={r.id}
            x={Math.min(x0, x1)}
            y={Math.min(y0, y1)}
            width={Math.abs(x1 - x0)}
            height={Math.abs(y1 - y0)}
            fill="none"
            stroke={on ? "#f472b6" : "rgba(56,189,248,0.35)"}
            strokeWidth={on ? 2 : 1}
            strokeDasharray={on ? undefined : "3 3"}
          />,
        ];
      })
    : null;

  const mono: CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 11,
  };
  const cell: CSSProperties = {
    padding: "2px 6px",
    borderBottom: "1px solid #1e293b",
    whiteSpace: "nowrap",
  };
  const fmt = (n: number): string => (Math.abs(n) < 1e-4 ? "0" : n.toFixed(2));

  return (
    <>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {showBounds && size.w > 1 && (
          <svg width={size.w} height={size.h} style={{ position: "absolute", inset: 0 }}>
            {boundsOverlay}
          </svg>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 320,
          maxHeight: "calc(100% - 24px)",
          overflow: "auto",
          padding: 10,
          borderRadius: 10,
          background: "rgba(2,6,23,0.78)",
          backdropFilter: "blur(6px)",
          color: "#e2e8f0",
          ...mono,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong style={{ fontSize: 12 }}>Inspector</strong>
          <span style={{ color: "#94a3b8" }}>
            {snapshot.time.toFixed(2)} / {player.duration.toFixed(2)}s · {player.state}
          </span>
          <label style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showBounds}
              onChange={(e) => setShowBounds(e.target.checked)}
            />
            bounds
          </label>
        </div>

        <div style={{ color: "#94a3b8", marginBottom: 4 }}>
          objects ({rows.length}) · active tracks ({activeTracks.length})
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ color: "#64748b" }}>
              <td style={cell}>id</td>
              <td style={cell}>pos</td>
              <td style={cell}>scale</td>
              <td style={cell}>α</td>
              <td style={cell}>z</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = r.state.transform;
              const on = r.id === selected;
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(on ? null : r.id)}
                  style={{ cursor: "pointer", background: on ? "#334155" : undefined }}
                >
                  <td style={cell} title={r.id}>
                    {r.id.split(":").pop()}
                    {!r.state.visible ? " ·hidden" : ""}
                  </td>
                  <td style={cell}>
                    {fmt(t.position[0])},{fmt(t.position[1])}
                  </td>
                  <td style={cell}>
                    {fmt(t.scale[0])},{fmt(t.scale[1])}
                  </td>
                  <td style={cell}>{fmt(r.state.opacity)}</td>
                  <td style={cell}>
                    {r.state.dimension === "2d"
                      ? r.state.transform.zIndex
                      : r.state.transform.renderOrder}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ color: "#94a3b8", margin: "8px 0 4px" }}>
          signals ({graph.signals.length}) · derived ({graph.derived.length}) · updaters (
          {graph.updaters.length})
        </div>
        {graph.derived.map((d) => (
          <div key={d.id} style={{ color: "#cbd5e1" }}>
            {d.id.split(":").pop()} ← [{d.deps.join(", ")}]
          </div>
        ))}
      </div>
    </>
  );
}
