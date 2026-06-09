/**
 * Merges the hand-written reference overview (architecture) with TypeDoc's
 * package list into docs/reference/index.md after `gen:reference`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "reference-index.src.md");
const outPath = join(root, "reference", "index.md");

const PACKAGES = [
  { name: "@intermact/core", href: "@intermact/core/index.md" },
  { name: "@intermact/react", href: "@intermact/react/index.md" },
  { name: "@intermact/render-r3f", href: "@intermact/render-r3f/index.md" },
  { name: "@intermact/render-three", href: "@intermact/render-three/index.md" },
];

const packageList = PACKAGES.map((p) => `- [${p.name}](${p.href})`).join("\n");

let body = readFileSync(srcPath, "utf8");
if (!body.includes("<!-- PACKAGES -->")) {
  throw new Error("reference-index.src.md must contain <!-- PACKAGES --> placeholder");
}
body = body.replace("<!-- PACKAGES -->", packageList);

writeFileSync(outPath, body, "utf8");
console.log("[docs] merged reference index → reference/index.md");
