import { useMemo, type ComponentProps } from "react";
import { IntermactCanvas } from "@intermact/react";
import { exampleAssetFetch, exampleAssetFetchBinary } from "./assetFetch";
import { withDemoFonts } from "./loadFonts";

/** Props for {@link DemoCanvas} — same as {@link IntermactCanvas} but fonts/fetch are automatic. */
export type DemoCanvasProps = Omit<
  ComponentProps<typeof IntermactCanvas>,
  "fetchBinary" | "fetcher"
> & {
  /** Skip automatic default font loading (rare; e.g. smoke demos without text). */
  readonly skipFonts?: boolean;
};

/**
 * Example-gallery canvas: wires `fetchBinary`/`fetcher` and preloads DejaVu as the
 * default sync font so math/layout/interaction demos cold-start without
 * `No default font registered` (phase-2-review P0).
 */
export function DemoCanvas({ program, skipFonts = false, ...rest }: DemoCanvasProps) {
  const wrappedProgram = useMemo(
    () => (skipFonts ? program : withDemoFonts(program)),
    [program, skipFonts],
  );
  return (
    <IntermactCanvas
      {...rest}
      program={wrappedProgram}
      fetchBinary={exampleAssetFetchBinary}
      fetcher={exampleAssetFetch}
    />
  );
}
