/**
 * Merges the hand-written reference overview (architecture) with TypeDoc's
 * package list into docs/reference/index.md after `gen:reference`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = [
  {
    src: "reference-index.src.md",
    out: join(root, "reference", "index.md"),
    refPrefix: "",
  },
  {
    src: "reference-index.en.src.md",
    out: join(root, "en", "reference", "index.md"),
    refPrefix: "/en/reference",
  },
];

const PACKAGES = [
  { name: "@intermact/core", slug: "@intermact/core/index" },
  { name: "@intermact/react", slug: "@intermact/react/index" },
  { name: "@intermact/render-r3f", slug: "@intermact/render-r3f/index" },
  { name: "@intermact/render-three", slug: "@intermact/render-three/index" },
];

/** Package list links: relative for root locale, absolute for `/en/reference/` (rewritten TypeDoc pages). */
function packageList(refPrefix) {
  return PACKAGES.map((p) => {
    const href = refPrefix ? `${refPrefix}/${p.slug}` : `${p.slug}.md`;
    return `- [${p.name}](${href})`;
  }).join("\n");
}

for (const { src, out, refPrefix } of locales) {
  const srcPath = join(root, src);
  let body = readFileSync(srcPath, "utf8");
  if (!body.includes("<!-- PACKAGES -->")) {
    throw new Error(`${src} must contain <!-- PACKAGES --> placeholder`);
  }
  body = body.replace("<!-- PACKAGES -->", packageList(refPrefix));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body, "utf8");
  console.log(`[docs] merged reference index → ${out.replace(root + "/", "")}`);
}
