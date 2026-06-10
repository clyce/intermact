/**
 * Bake the unified static site: examples gallery + VitePress docs → `docs/.vitepress/dist`.
 *
 * Steps:
 * 1. `vite build` examples (base = DEMOS_BASE, default `/demos/`)
 * 2. Copy `examples/dist` → `docs/public/demos`
 * 3. `vitepress build` docs (runs gen:reference via prebuild)
 * 4. Verify dist contains guide + demos
 */
import { demosBase, docsEnv, examplesBuildEnv, repoRoot, siteBase } from "./site-config.mjs";
import { embedExamples } from "./embed-examples.mjs";
import { runPnpmOrExit } from "./run-pnpm.mjs";
import { verifySiteDist } from "./verify-site-dist.mjs";

console.log(`[site] build SITE_BASE=${siteBase()} DEMOS_BASE=${demosBase()}`);

// TypeDoc + examples resolve workspace packages via package.json `exports` → `dist/`.
// On a clean checkout (CI) those artifacts do not exist until packages are built.
console.log("[site] building workspace packages (for TypeDoc + examples)…");
runPnpmOrExit(["run", "build"], { cwd: repoRoot });

runPnpmOrExit(["--filter", "@intermact/examples", "run", "build:embed"], {
  cwd: repoRoot,
  env: examplesBuildEnv(),
});

embedExamples();

runPnpmOrExit(["--filter", "@intermact/docs", "run", "build"], {
  cwd: repoRoot,
  env: docsEnv(),
});

verifySiteDist();

console.log("[site] build complete → docs/.vitepress/dist");
