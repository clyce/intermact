import { useCallback, useEffect, useRef } from "react";

/** Clamp `value` to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Drag a vertical resize handle to change a panel width (pixels).
 * `deltaX` is added to the starting width (positive = wider when handle is on the left edge).
 */
export function usePointerResize({
  width,
  onWidthChange,
  min,
  max,
  deltaSign = 1,
}: {
  width: number;
  onWidthChange: (next: number) => void;
  min: number;
  max: number;
  /** Multiply pointer delta; use `-1` when the handle sits on the panel's left edge. */
  deltaSign?: 1 | -1;
}) {
  const widthRef = useRef(width);
  widthRef.current = width;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startWidth = widthRef.current;

      const onMove = (ev: PointerEvent) => {
        const delta = (ev.clientX - startX) * deltaSign;
        onWidthChange(clamp(startWidth + delta, min, max));
      };

      const onUp = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId);
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onUp);
    },
    [deltaSign, max, min, onWidthChange],
  );

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return onPointerDown;
}
