/**
 * Copy `examples/dist` → `docs/public/demos` so VitePress bakes the gallery into
 * the static site at `/demos/`.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { demosPublicDir, examplesDistDir } from "./site-config.mjs";

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

/**
 * Embed the examples production build into the docs public folder.
 * @param {{ source?: string, target?: string }} [opts]
 */
export function embedExamples(opts = {}) {
  const source = opts.source ?? examplesDistDir;
  const target = opts.target ?? demosPublicDir;

  if (!existsSync(join(source, "index.html"))) {
    throw new Error(
      `[site] missing ${join(source, "index.html")} — run the examples Vite build first (build:site step 1).`,
    );
  }

  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });

  if (!existsSync(join(target, "index.html"))) {
    throw new Error(`[site] embed failed: ${target}/index.html not found after copy.`);
  }

  console.log(`[site] embedded examples → docs/public/demos/ (from ${source})`);
}

if (isMain) {
  embedExamples();
}
