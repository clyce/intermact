import { useEffect, useState } from "react";
import { type Player } from "@intermact/core";

/**
 * HTML transport controls overlay bound to a {@link Player}: scrub slider,
 * play/pause/reset, rate (incl. reverse), and loop. Rendered as a DOM layer
 * over the WebGL canvas (design.md §10/§15).
 */
export function TimelineControls({ player }: { player: Player }) {
  const [time, setTime] = useState(player.time);

  useEffect(() => {
    return player.subscribe((snapshot) => setTime(snapshot.time));
  }, [player]);

  const rates = [-1, 0.5, 1, 2];
  const btn = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #334155",
    background: active ? "#334155" : "rgba(15,23,42,0.7)",
    color: "#e2e8f0",
    cursor: "pointer",
    font: "inherit",
    fontSize: 12,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        borderRadius: 10,
        background: "rgba(2,6,23,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <input
        type="range"
        min={0}
        max={player.duration || 0.0001}
        step={0.001}
        value={time}
        onChange={(e) => {
          player.pause();
          player.seek(Number(e.target.value));
        }}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(player.state === "playing")} onClick={() => player.play()}>
          ▶
        </button>
        <button style={btn(false)} onClick={() => player.pause()}>
          ⏸
        </button>
        <button style={btn(false)} onClick={() => player.seek(0)}>
          ⏮
        </button>
        {rates.map((r) => (
          <button
            key={r}
            style={btn(player.rate === r)}
            onClick={() => {
              player.setRate(r);
              player.play();
            }}
          >
            {r}×
          </button>
        ))}
        <label
          style={{ color: "#cbd5e1", fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={player.loop}
            onChange={(e) => player.setLoop(e.target.checked)}
          />
          loop
        </label>
        <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: "auto" }}>
          {time.toFixed(2)} / {player.duration.toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
