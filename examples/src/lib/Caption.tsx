import { type ReactNode } from "react";

/**
 * A small explanatory caption overlaid on a demo canvas. Examples use it to say
 * what an animation is meant to show (so a still frame is not ambiguous).
 * `placement` moves it to the bottom for demos whose top area holds content.
 */
export function Caption({
  children,
  placement = "top",
}: {
  children: ReactNode;
  placement?: "top" | "bottom";
}) {
  return (
    <div
      style={{
        position: "absolute",
        ...(placement === "bottom" ? { bottom: 12 } : { top: 12 }),
        left: 12,
        right: 12,
        zIndex: 5,
        pointerEvents: "none",
        maxWidth: 560,
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(15,23,42,0.72)",
        border: "1px solid #1f2937",
        color: "#cbd5e1",
        font: "13px/1.5 ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
