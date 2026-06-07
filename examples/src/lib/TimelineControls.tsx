import { type Player } from "@intermact/core";

/**
 * Reusable transport controls bound to a core {@link Player}: play/pause,
 * a seek slider (deterministic scrub), rate selection including reverse, and
 * loop toggle. Demonstrates M1 exit criteria "进度条可拖动 seek".
 */
export function TimelineControls({ player, time }: { player: Player | null; time: number }) {
  if (!player) return <div style={{ color: "#64748b" }}>Building…</div>;
  const rates = [-1, 0.5, 1, 2];
  const btn = (active: boolean) =>
    ({
      padding: "4px 10px",
      borderRadius: 6,
      border: "1px solid #334155",
      background: active ? "#1e293b" : "transparent",
      color: "#e2e8f0",
      cursor: "pointer",
      font: "inherit",
      fontSize: 13,
    }) as const;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxWidth: 640 }}
    >
      <input
        type="range"
        min={0}
        max={player.duration}
        step={0.001}
        value={time}
        onChange={(e) => {
          player.pause();
          player.seek(Number(e.target.value));
        }}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(player.state === "playing")} onClick={() => player.play()}>
          ▶ Play
        </button>
        <button style={btn(false)} onClick={() => player.pause()}>
          ⏸ Pause
        </button>
        <button style={btn(false)} onClick={() => player.seek(0)}>
          ⏮ Reset
        </button>
        <span style={{ color: "#64748b", fontSize: 13 }}>rate</span>
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
        <label style={{ color: "#94a3b8", fontSize: 13, display: "flex", gap: 4 }}>
          <input
            type="checkbox"
            checked={player.loop}
            onChange={(e) => player.setLoop(e.target.checked)}
          />
          loop
        </label>
        <span style={{ color: "#94a3b8", fontSize: 13, marginLeft: "auto" }}>
          t = {time.toFixed(2)}s / {player.duration.toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
