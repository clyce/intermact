import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import {
  buildNav,
  buildSidebar,
  searchLocaleOptions,
} from "./shared";

/** Live examples proxy — only when `pnpm run dev:site` sets this env var. */
const proxyExamples = process.env.INTERMACT_DEV_SITE === "1";

/** Root path for GitHub Project Pages (`/Intermact/`) or `/` locally. */
const siteBase = process.env.SITE_BASE || "/";

const sharedHead = [
  ["meta", { name: "theme-color", content: "#0b1020" }],
  ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
];

const sharedVite = {
  server: {
    port: 5174,
    strictPort: true,
    ...(proxyExamples
      ? {
          proxy: {
            // Gallery SPA + assets — skip VitePress markdown module resolution.
            "^/demos/": {
              target: "http://127.0.0.1:5173",
              changeOrigin: true,
              bypass(req: { url?: string }) {
                const url = req.url ?? "";
                if (url.includes(".md")) return url;
              },
            },
            "^/demos$": {
              target: "http://127.0.0.1:5173",
              changeOrigin: true,
              rewrite: () => "/demos/",
            },
          },
        }
      : {}),
  },
};

export default withMermaid(
  defineConfig({
    base: siteBase,
    cleanUrls: true,
    lastUpdated: true,
    /** TypeDoc symbol pages are shared via `rewrites` from `en/reference/@intermact/*`. */
    ignoreDeadLinks: [/^\/en\/reference\/@intermact\//],
    head: sharedHead,
    /**
     * English locale reuses TypeDoc-generated symbol pages under `reference/`.
     * Only `en/reference/index.md` is locale-specific (hand-written overview).
     */
    rewrites: {
      "en/reference/@intermact/:rest*": "reference/@intermact/:rest*",
    },
    locales: {
      root: {
        label: "简体中文",
        lang: "zh-CN",
        title: "Intermact",
        description: "基于 React Three Fiber 的可交互 Manim 式数理可视化。",
        themeConfig: {
          logo: "/logo.svg",
          nav: buildNav(""),
          sidebar: buildSidebar(""),
          socialLinks: [
            {
              icon: "github",
              link: "https://github.com/clyce/intermact",
            },
          ],
          footer: {
            message:
              "Intermact v1.0 — 文档覆盖 Phase-1 / Phase-2 / Phase-3（全阶段）",
            copyright: "MIT License",
          },
          search: {
            provider: "local",
            options: {
              locales: {
                root: searchLocaleOptions.root,
              },
            },
          },
          editLink: {
            pattern:
              "https://github.com/clyce/intermact/edit/main/docs/:path",
            text: "在 GitHub 上编辑此页",
          },
        },
      },
      en: {
        label: "English",
        lang: "en-US",
        link: "/en/",
        title: "Intermact",
        description:
          "Interactive Manim-style math visualization on React Three Fiber.",
        themeConfig: {
          logo: "/logo.svg",
          nav: buildNav("en"),
          sidebar: buildSidebar("en"),
          socialLinks: [
            {
              icon: "github",
              link: "https://github.com/clyce/intermact",
            },
          ],
          footer: {
            message:
              "Intermact v1.0 — docs cover Phase-1 / Phase-2 / Phase-3 (all stages)",
            copyright: "MIT License",
          },
          search: {
            provider: "local",
            options: {
              locales: {
                en: searchLocaleOptions.en,
              },
            },
          },
          editLink: {
            pattern:
              "https://github.com/clyce/intermact/edit/main/docs/:path",
            text: "Edit this page on GitHub",
          },
        },
      },
    },
    mermaid: {
      theme: "neutral",
    },
    vite: sharedVite,
  }),
);
