import { type CSSProperties } from "react";
import { type SemanticEntry } from "@intermact/core";

/** Props for {@link SemanticOverlay}. */
export interface SemanticOverlayProps {
  readonly entries: readonly SemanticEntry[];
  /**
   * `"visible"` renders a small labelled chip list over the canvas;
   * `"sr-only"` (default) renders a visually-hidden but screen-reader-navigable
   * list (the accessible semantic layer of design.md §17).
   */
  readonly mode?: "visible" | "sr-only";
  readonly title?: string;
}

const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const VISIBLE: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: "40%",
  fontSize: 12,
  color: "#e2e8f0",
};

/**
 * Accessibility / semantic layer overlay (design.md §17). Surfaces each object's
 * {@link SemanticEntry} (label / link / a11y description) as real DOM, so an
 * animated figure is navigable by keyboard and screen reader and exportable as a
 * linked "handout" — not just pixels.
 */
export function SemanticOverlay({
  entries,
  mode = "sr-only",
  title = "Scene contents",
}: SemanticOverlayProps) {
  if (entries.length === 0) return null;
  return (
    <nav aria-label={title} style={mode === "sr-only" ? SR_ONLY : VISIBLE}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {entries.map((e) => {
          const text = e.label ?? e.a11yLabel ?? e.id;
          const aria = e.a11yLabel ?? e.label ?? e.id;
          return (
            <li key={e.id}>
              {e.href ? (
                <a
                  href={e.href}
                  aria-label={aria}
                  style={{ color: "#38bdf8" }}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text}
                </a>
              ) : (
                <span aria-label={aria}>{text}</span>
              )}
              {e.note ? <span> — {e.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
