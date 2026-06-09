/**
 * Smoke-check the baked static site before deploy.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { siteDistDir } from "./site-config.mjs";

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

const required = [
  "index.html",
  "guide/getting-started.html",
  "demos/index.html",
];

export function verifySiteDist(distDir = siteDistDir) {
  const missing = required.filter((rel) => !existsSync(join(distDir, rel)));
  if (missing.length > 0) {
    throw new Error(
      `[site] dist incomplete (${distDir}): missing ${missing.join(", ")}`,
    );
  }
  console.log(`[site] dist verified (${distDir})`);
}

if (isMain) {
  verifySiteDist();
}
