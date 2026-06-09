/**
 * Shared paths and URL bases for the unified static site (VitePress + examples).
 *
 * - `SITE_BASE` — VitePress `base` (default `/`; GitHub Project Pages: `/Intermact/`)
 * - `DEMOS_BASE` — Vite gallery `base` (default `/demos/`; derived from `SITE_BASE` when unset)
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

/** Repository root (`intermact/`). */
export const repoRoot = join(scriptsDir, "..");

/** Vite build output from `@intermact/examples`. */
export const examplesDistDir = join(repoRoot, "examples", "dist");

/** Embedded gallery copied into VitePress `public/` before `vitepress build`. */
export const demosPublicDir = join(repoRoot, "docs", "public", "demos");

/** Final static site artifact (upload this folder to GitHub Pages). */
export const siteDistDir = join(repoRoot, "docs", ".vitepress", "dist");

/**
 * Normalize `SITE_BASE` to Vite/VitePress form: `/` or `/repo/`.
 * @returns {string}
 */
export function siteBase() {
  const raw = process.env.SITE_BASE ?? "/";
  if (!raw || raw === "/") return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Base path for the examples SPA. Defaults to `/demos/` at site root, or
 * `/repo/demos/` when `SITE_BASE` is set.
 * @returns {string}
 */
export function demosBase() {
  const base = siteBase();
  if (base === "/") return "/demos/";
  return `${base}demos/`;
}

/** Env vars to pass when building or serving the examples gallery. */
export function examplesBuildEnv() {
  return { ...process.env, DEMOS_BASE: process.env.DEMOS_BASE ?? demosBase() };
}

/**
 * Env vars to pass when building or serving VitePress.
 * @param {Record<string, string>} [overrides]
 */
export function docsEnv(overrides = {}) {
  return {
    ...process.env,
    SITE_BASE: siteBase(),
    ...overrides,
  };
}
