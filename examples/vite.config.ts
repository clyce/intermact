import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const pkg = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

// Force every `@intermact/*` import (from example files AND from inside the
// workspace packages themselves) to resolve to a single source instance.
// Without this, examples get `core/src` via tsconfig paths while
// `@intermact/react` pulls in `core/dist`, producing two copies of the module.
// Module-scoped state (e.g. the signal-id WeakMap) then diverges, so reactive
// examples throw "Unknown signal instance".
const intermactAliases = {
  "@intermact/core": pkg("../packages/core/src/index.ts"),
  "@intermact/render-three": pkg("../packages/render-three/src/index.ts"),
  "@intermact/render-r3f": pkg("../packages/render-r3f/src/index.ts"),
  "@intermact/react": pkg("../packages/react/src/index.ts"),
};

/** Gallery base when embedded in the docs site (`/demos/` or `/repo/demos/`). */
const demosBase = process.env.DEMOS_BASE ?? "/";

export default defineConfig({
  base: demosBase,
  plugins: [react(), tsconfigPaths({ root: ".." })],
  resolve: {
    alias: intermactAliases,
    dedupe: Object.keys(intermactAliases),
  },
  server: { port: 5173, open: false },
});
