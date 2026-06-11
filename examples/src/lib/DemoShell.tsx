import { type ReactNode } from "react";

/**
 * Expands to fill the demo stage so canvases using `height: 100%` get a definite
 * height. `position: relative` contains any `position: absolute` demo roots so
 * they cannot cover the gallery chrome (sidebar, toolbar).
 */
export function DemoShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
