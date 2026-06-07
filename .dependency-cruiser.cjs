/**
 * Dependency-cruiser configuration encoding the layered dependency rules from
 * design.md §3.1. The goal is to keep `@intermact/core` framework-free so it can
 * run headless in Node/Worker, and to keep renderer adapters isolated.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "core-no-react",
      comment: "core/* must not depend on React (design.md §3.1: core has no framework deps).",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: {
        path: "^(react|react-dom|@react-three)(/|$)|(^|/)node_modules/(react|react-dom|@react-three)(/|$)",
      },
    },
    {
      name: "core-no-three",
      comment: "core/* must not depend on three (design.md §3.1).",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: { path: "^three(/|$)|(^|/)node_modules/three(/|$)" },
    },
    {
      name: "core-no-cross-package",
      comment: "core/* must not depend on any other @intermact package.",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/(render-three|render-r3f|react)/src" },
    },
    {
      name: "render-three-no-react",
      comment: "render-three depends on three but NOT React/R3F (design.md §3.1).",
      severity: "error",
      from: { path: "^packages/render-three/src" },
      to: { path: "(^|/)node_modules/(react|react-dom|@react-three)" },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "Modules should be reachable (warn only).",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: ["\\.d\\.ts$", "(^|/)index\\.ts$", "\\.config\\.(ts|js|cjs)$"],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|node_modules|coverage)(/|$)" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
