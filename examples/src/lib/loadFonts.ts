import {
  setDefaultFont,
  setMathTickFont,
  type IntermactProgram,
  type IntermactProgramContext,
} from "@intermact/core";
import dejavuSansUrl from "@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff?url";
import dejavuSerifUrl from "@fontsource/dejavu-serif/files/dejavu-serif-latin-400-normal.woff?url";

/** Load DejaVu Sans + Serif and set Sans as the default sync font. */
export async function loadDemoFonts(ctx: IntermactProgramContext) {
  const sans = await ctx.assets.font(dejavuSansUrl);
  const serif = await ctx.assets.font(dejavuSerifUrl);
  setDefaultFont(sans.family);
  setMathTickFont(serif.family);
  return { sans, serif };
}

const fontWrappedPrograms = new WeakMap<IntermactProgram, IntermactProgram>();

/**
 * Wrap a program so demo fonts are registered before user logic runs.
 * Required for sync text APIs (`labelContours`, `glyphText`, `textObject` without
 * explicit `font`) and axis tick labels (phase-2-review §12.2.2).
 *
 * Cached per `program` so {@link useIntermactPlayer} does not restart the build
 * pass when the gallery re-renders.
 */
export function withDemoFonts(program: IntermactProgram): IntermactProgram {
  const cached = fontWrappedPrograms.get(program);
  if (cached) return cached;

  const wrapped: IntermactProgram = async (ctx) => {
    await loadDemoFonts(ctx);
    return program(ctx);
  };
  fontWrappedPrograms.set(program, wrapped);
  return wrapped;
}

export { dejavuSansUrl, dejavuSerifUrl };
