import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    include: ["packages/*/src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/**/*.{test,spec}.ts", "packages/*/src/index.ts"],
    },
  },
});
