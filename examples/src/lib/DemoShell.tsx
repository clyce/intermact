import { type ReactNode } from "react";

/**
 * Expands to fill the demo stage so canvases using `height: 100%` get a definite
 * height. Tall demos grow the scroll parent instead of collapsing to a strip.
 */
export function DemoShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
