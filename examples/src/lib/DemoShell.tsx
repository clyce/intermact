import { type ReactNode } from "react";
import { Caption } from "./Caption";

/**
 * Wraps a demo viewport with an optional overlay caption (like `text/writing`).
 * Captions are declared on {@link DemoEntry} in `registry.tsx` so every example
 * self-explains what it demonstrates.
 */
export function DemoShell({
  caption,
  captionPlacement = "top",
  children,
}: {
  caption?: ReactNode;
  captionPlacement?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      {caption ? <Caption placement={captionPlacement}>{caption}</Caption> : null}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>{children}</div>
    </div>
  );
}
