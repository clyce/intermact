/**
 * Vertical drag handle between two horizontal panels (col-resize).
 */
export function ResizeHandle({
  onPointerDown,
  side,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Which panel the handle belongs to — affects hover accent edge. */
  side: "left" | "right";
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      onPointerDown={onPointerDown}
      style={{
        flexShrink: 0,
        width: 6,
        marginLeft: side === "right" ? -3 : 0,
        marginRight: side === "left" ? -3 : 0,
        cursor: "col-resize",
        position: "relative",
        zIndex: 2,
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          left: side === "left" ? "auto" : 2,
          right: side === "right" ? "auto" : 2,
          width: 2,
          background: "#334155",
          borderRadius: 1,
          transition: "background 0.15s",
        }}
        className="resize-handle-bar"
      />
    </div>
  );
}
