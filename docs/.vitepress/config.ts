import { defineConfig } from "vitepress";
import typedocSidebar from "../reference/typedoc-sidebar.json";

export default defineConfig({
  title: "Intermact",
  description: "Interactive Manim-style math visualization on React Three Fiber.",
  lang: "zh-CN",
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ["meta", { name: "theme-color", content: "#0b1020" }],
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "指南", link: "/guide/introduction" },
      { text: "API Reference", link: "/reference/" },
      { text: "示例", link: "/examples/" },
      { text: "路线图", link: "/project/roadmap" },
      {
        text: "设计文档",
        link: "https://github.com/intermact/intermact/blob/main/dev-docs/design.md",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "开始",
          items: [
            { text: "简介", link: "/guide/introduction" },
            { text: "快速上手", link: "/guide/getting-started" },
            { text: "架构概览", link: "/guide/architecture" },
          ],
        },
        {
          text: "核心能力（v0.1）",
          items: [
            { text: "程序与场景", link: "/guide/program-and-scene" },
            { text: "时间线与 Player", link: "/guide/timeline-and-player" },
            { text: "2D 几何", link: "/guide/geometry" },
            { text: "渲染", link: "/guide/rendering" },
            { text: "动画", link: "/guide/animation" },
            { text: "坐标系与轴", link: "/guide/coordinates" },
            { text: "响应式", link: "/guide/reactive" },
          ],
        },
        {
          text: "数理工具箱（v0.2）",
          items: [
            { text: "Scale 与刻度", link: "/guide/scale" },
            { text: "数理构件库", link: "/guide/math-constructs" },
            { text: "Morph 与分部匹配", link: "/guide/morph" },
            { text: "文本与 LaTeX 管线", link: "/guide/text-latex" },
            { text: "交互系统", link: "/guide/interaction" },
            { text: "布局与 Inspector", link: "/guide/layout-inspector" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "API Reference",
          items: [{ text: "总览", link: "/reference/" }, ...typedocSidebar],
        },
      ],
      "/examples/": [
        {
          text: "示例库",
          items: [{ text: "演示目录", link: "/examples/" }],
        },
      ],
      "/project/": [
        {
          text: "项目",
          items: [
            { text: "路线图与里程碑", link: "/project/roadmap" },
            { text: "v0.1 验收清单", link: "/project/v01-checklist" },
            { text: "v0.2 验收清单", link: "/project/v02-checklist" },
          ],
        },
      ],
      "/packages/": [
        {
          text: "Monorepo",
          items: [{ text: "包分层说明", link: "/packages/" }],
        },
      ],
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/intermact/intermact",
      },
    ],
    footer: {
      message: "Intermact v0.1 — Phase-1 MVP",
      copyright: "MIT License",
    },
    search: {
      provider: "local",
    },
    editLink: {
      pattern: "https://github.com/intermact/intermact/edit/main/docs/:path",
      text: "在 GitHub 上编辑此页",
    },
  },
});
