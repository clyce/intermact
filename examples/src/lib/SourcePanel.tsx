import { demoSourcePath, type DemoEntry } from "../registry";
import { ResizeHandle } from "./ResizeHandle";
import { usePointerResize } from "./usePointerResize";
import { useHighlightedSource } from "./useHighlightedSource";

const MIN_CODE_WIDTH = 280;

/**
 * Right-hand panel that shows a demo's primary `.tsx` source (loaded via
 * {@link loadDemoSource}, not copy-pasted into the gallery).
 */
export function SourcePanel({
  demo,
  source,
  loading: sourceLoading,
  error: sourceError,
  width,
  onWidthChange,
  maxWidth,
}: {
  demo: DemoEntry;
  source: string | null;
  loading: boolean;
  error: string | null;
  width: number;
  onWidthChange: (next: number) => void;
  maxWidth: number;
}) {
  const path = demoSourcePath(demo).replace("examples/src/", "");
  const {
    html,
    loading: highlightLoading,
    error: highlightError,
  } = useHighlightedSource(source);

  const loading = sourceLoading || highlightLoading;
  const error = sourceError ?? highlightError;

  const onResize = usePointerResize({
    width,
    onWidthChange,
    min: MIN_CODE_WIDTH,
    max: maxWidth,
    deltaSign: -1,
  });

  return (
    <>
      <ResizeHandle onPointerDown={onResize} side="left" />
      <aside
        style={{
          flex: `0 0 ${width}px`,
          width,
          minWidth: MIN_CODE_WIDTH,
          borderLeft: "1px solid #1f2937",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "#0f172a",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "10px 14px",
            borderBottom: "1px solid #1f2937",
            fontSize: 12,
            color: "#94a3b8",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          }}
        >
          {path}
        </header>
        <div className="demo-source-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {loading ? (
            <p style={{ padding: 14, margin: 0, fontSize: 13, color: "#64748b" }}>Loading source…</p>
          ) : error ? (
            <p style={{ padding: 14, margin: 0, fontSize: 13, color: "#f87171" }}>{error}</p>
          ) : html ? (
            <div
              className="demo-source-highlight"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}
