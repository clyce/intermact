import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createAssetManager } from "../resource/asset-manager";
import { clearFontRegistry, setDefaultFont } from "./font-registry";

const require = createRequire(import.meta.url);

/** Load DejaVu Sans for vitest (registers + sets default). */
export async function loadTestFont(): Promise<string> {
  clearFontRegistry();
  const fontPath = require.resolve(
    "@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff",
  );
  const assets = createAssetManager({
    fetchBinary: async (src) => {
      const b = readFileSync(src);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  });
  const face = await assets.font(fontPath);
  setDefaultFont(face.family);
  return face.family;
}
