import { type ReactNode } from "react";

/**
 * Inline description for the active demo, rendered below the toolbar (not over
 * the canvas). Text comes from {@link DemoEntry.caption} in `registry.tsx`.
 */
export function DemoCaptionBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 14px",
        borderBottom: "1px solid #1f2937",
        background: "rgba(15, 23, 42, 0.95)",
        color: "#cbd5e1",
        font: "13px/1.55 ui-sans-serif, system-ui, sans-serif",
        maxHeight: 140,
        overflowY: "auto",
      }}
    >
      {children}
    </div>
  );
}
