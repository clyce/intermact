import { useEffect, useMemo, useState } from "react";
import { DemoCaptionBar } from "./lib/DemoCaptionBar";
import { DemoShell } from "./lib/DemoShell";
import { SourcePanel } from "./lib/SourcePanel";
import { useDemoSource } from "./lib/useDemoSource";
import { siteHomeHref } from "./lib/siteLinks";
import { demos, demoSourcePath } from "./registry";

const REPO_BLOB = "https://github.com/clyce/intermact/blob/main/";
const SIDEBAR_WIDTH = 260;
const DEFAULT_CODE_WIDTH = 420;
const MIN_CODE_WIDTH = 280;

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

const toolbarBtnStyle = {
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#cbd5e1",
  cursor: "pointer",
  font: "inherit",
} as const;

/** Demo gallery shell: a sidebar of registered demos plus the active demo. */
export function App() {
  const [route, navigate] = useHashRoute();
  const [showCode, setShowCode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codeWidth, setCodeWidth] = useState(DEFAULT_CODE_WIDTH);
  const active = useMemo(() => demos.find((d) => d.id === route) ?? demos[0], [route]);
  const { source, loading, error } = useDemoSource(active, showCode);

  const groups = useMemo(() => {
    const map = new Map<string, typeof demos>();
    for (const demo of demos) {
      const list = map.get(demo.group) ?? [];
      map.set(demo.group, [...list, demo]);
    }
    return [...map.entries()];
  }, []);

  useEffect(() => {
    setShowCode(false);
  }, [active?.id]);

  useEffect(() => {
    const clampCodeWidth = () => {
      const max = Math.max(MIN_CODE_WIDTH, Math.floor(window.innerWidth * 0.75));
      setCodeWidth((w) => Math.min(w, max));
    };
    clampCodeWidth();
    window.addEventListener("resize", clampCodeWidth);
    return () => window.removeEventListener("resize", clampCodeWidth);
  }, [showCode]);

  if (!active) return <div style={{ padding: 24 }}>No demos registered.</div>;
  const Active = active.Component;

  const homeHref = siteHomeHref();
  const maxCodeWidth = Math.max(MIN_CODE_WIDTH, Math.floor(window.innerWidth * 0.75));

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <aside
        aria-hidden={!sidebarOpen}
        style={{
          width: sidebarOpen ? SIDEBAR_WIDTH : 0,
          height: "100%",
          borderRight: sidebarOpen ? "1px solid #1f2937" : "none",
          overflowY: sidebarOpen ? "auto" : "hidden",
          overflowX: "hidden",
          padding: sidebarOpen ? "12px 0" : 0,
          flexShrink: 0,
          transition: "width 0.2s ease",
        }}
      >
        <div
          style={{
            width: SIDEBAR_WIDTH,
            visibility: sidebarOpen ? "visible" : "hidden",
          }}
        >
          <div style={{ padding: "0 16px 10px" }}>
            <a
              href={homeHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#94a3b8",
                textDecoration: "none",
                marginBottom: 10,
              }}
            >
              ← Back to docs
            </a>
            <h1 style={{ fontSize: 16, margin: "0 0 4px" }}>Intermact Examples</h1>
          </div>
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
        </div>
      </aside>
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid #1f2937",
            background: "#0f172a",
          }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-pressed={sidebarOpen}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            style={toolbarBtnStyle}
          >
            {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          </button>
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            aria-pressed={showCode}
            style={{
              ...toolbarBtnStyle,
              borderColor: showCode ? "#38bdf8" : "#334155",
              background: showCode ? "#0c4a6e" : "#1e293b",
              color: showCode ? "#e0f2fe" : "#cbd5e1",
            }}
          >
            {showCode ? "Hide code" : "Show code"}
          </button>
          <a
            href={`${REPO_BLOB}${demoSourcePath(active)}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}
          >
            Open on GitHub ↗
          </a>
        </div>
        {active.caption ? <DemoCaptionBar>{active.caption}</DemoCaptionBar> : null}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  flex: "1 1 auto",
                  minHeight: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <DemoShell>
                  <Active />
                </DemoShell>
              </div>
            </div>
          </div>
          {showCode ? (
            <SourcePanel
              demo={active}
              source={source}
              loading={loading}
              error={error}
              width={codeWidth}
              onWidthChange={setCodeWidth}
              maxWidth={maxCodeWidth}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
