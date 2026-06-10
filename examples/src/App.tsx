import { useEffect, useMemo, useState } from "react";
import { DemoShell } from "./lib/DemoShell";
import { demos, demoSourcePath } from "./registry";

const REPO_BLOB = "https://github.com/clyce/intermact/blob/main/";

function useHashRoute(): [string, (id: string) => void] {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = (id: string) => {
    window.location.hash = id;
  };
  return [hash, navigate];
}

/** Demo gallery shell: a sidebar of registered demos plus the active demo. */
export function App() {
  const [route, navigate] = useHashRoute();
  const active = useMemo(() => demos.find((d) => d.id === route) ?? demos[0], [route]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof demos>();
    for (const demo of demos) {
      const list = map.get(demo.group) ?? [];
      map.set(demo.group, [...list, demo]);
    }
    return [...map.entries()];
  }, []);

  if (!active) return <div style={{ padding: 24 }}>No demos registered.</div>;
  const Active = active.Component;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #1f2937",
          overflowY: "auto",
          padding: "12px 0",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 16, padding: "0 16px", margin: "8px 0 4px" }}>Intermact Examples</h1>
        <a
          href={`${REPO_BLOB}${demoSourcePath(active)}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            padding: "0 16px 12px",
            fontSize: 12,
            color: "#7dd3fc",
            textDecoration: "none",
          }}
        >
          View source: {demoSourcePath(active).replace("examples/src/", "")} ↗
        </a>
        {groups.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#64748b",
                padding: "4px 16px",
              }}
            >
              {group}
            </div>
            {items.map((demo) => {
              const selected = demo.id === active.id;
              return (
                <button
                  key={demo.id}
                  onClick={() => navigate(demo.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 16px",
                    background: selected ? "#1e293b" : "transparent",
                    color: selected ? "#e2e8f0" : "#94a3b8",
                    border: "none",
                    borderLeft: selected ? "3px solid #38bdf8" : "3px solid transparent",
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 13,
                  }}
                >
                  {demo.title}
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <DemoShell caption={active.caption} captionPlacement={active.captionPlacement}>
          <Active />
        </DemoShell>
      </main>
    </div>
  );
}
