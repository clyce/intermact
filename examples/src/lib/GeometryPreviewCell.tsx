import { useMemo, type ReactNode } from "react";
import { type IMObject2D } from "@intermact/core";
import { DemoCanvas } from "./DemoCanvas";
import { geometryPreviewProgram } from "./geometryPreviewProgram";

/**
 * One primitive preview tile for {@link PrimitivesGalleryDemo}.
 * Memoizes the program so {@link DemoCanvas} does not restart its build pass on
 * parent re-renders; skips fonts because geometry previews have no text.
 */
export function GeometryPreviewCell({
  object,
  title,
  height = 220,
}: {
  object: IMObject2D;
  title: ReactNode;
  height?: number;
}) {
  const program = useMemo(() => geometryPreviewProgram(object), [object]);

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ height, borderRadius: 8, overflow: "hidden" }}>
        <DemoCanvas program={program} skipFonts />
      </div>
      <figcaption style={{ color: "#cbd5e1", fontSize: 13, marginTop: 6 }}>{title}</figcaption>
    </figure>
  );
}
