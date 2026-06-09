import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/coverage/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
      "docs/public/demos/**",
      "docs/reference/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "core must not use DOM globals (design.md §3.1)." },
        { name: "document", message: "core must not use DOM globals (design.md §3.1)." },
      ],
    },
  },
  prettier,
);
