import { setDefaultFont, type IntermactProgramContext } from "@intermact/core";
import dejavuSansUrl from "@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff?url";
import dejavuSerifUrl from "@fontsource/dejavu-serif/files/dejavu-serif-latin-400-normal.woff?url";

/** Load DejaVu Sans + Serif and set Sans as the default sync font. */
export async function loadDemoFonts(ctx: IntermactProgramContext) {
  const sans = await ctx.assets.font(dejavuSansUrl);
  const serif = await ctx.assets.font(dejavuSerifUrl);
  setDefaultFont(sans.family);
  return { sans, serif };
}

export { dejavuSansUrl, dejavuSerifUrl };
