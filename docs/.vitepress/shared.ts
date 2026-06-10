import type { DefaultTheme } from "vitepress";
import typedocSidebar from "../reference/typedoc-sidebar.json";

/** Prefix internal doc paths for a locale (`""` for root / zh-CN, `"en"` for English). */
export function localePrefix(locale: "" | "en"): string {
  return locale ? `/${locale}` : "";
}

function guideSidebar(locale: "" | "en"): DefaultTheme.SidebarItem[] {
  const p = localePrefix(locale);
  return [
    {
      text: locale === "en" ? "Getting started" : "开始",
      items: [
        { text: locale === "en" ? "Introduction" : "简介", link: `${p}/guide/introduction` },
        { text: locale === "en" ? "Quick start" : "快速上手", link: `${p}/guide/getting-started` },
        { text: locale === "en" ? "Architecture" : "架构概览", link: `${p}/guide/architecture` },
      ],
    },
    {
      text: locale === "en" ? "Core (v0.1)" : "核心能力（v0.1）",
      items: [
        {
          text: locale === "en" ? "Program & scene" : "程序与场景",
          link: `${p}/guide/program-and-scene`,
        },
        {
          text: locale === "en" ? "Timeline & player" : "时间线与 Player",
          link: `${p}/guide/timeline-and-player`,
        },
        { text: locale === "en" ? "2D geometry" : "2D 几何", link: `${p}/guide/geometry` },
        { text: locale === "en" ? "Rendering" : "渲染", link: `${p}/guide/rendering` },
        { text: locale === "en" ? "Animation" : "动画", link: `${p}/guide/animation` },
        {
          text: locale === "en" ? "Coordinates & axes" : "坐标系与轴",
          link: `${p}/guide/coordinates`,
        },
        { text: locale === "en" ? "Reactive" : "响应式", link: `${p}/guide/reactive` },
      ],
    },
    {
      text: locale === "en" ? "Math toolbox (v0.2)" : "数理工具箱（v0.2）",
      items: [
        { text: locale === "en" ? "Scale & ticks" : "Scale 与刻度", link: `${p}/guide/scale` },
        {
          text: locale === "en" ? "Math constructs" : "数理构件库",
          link: `${p}/guide/math-constructs`,
        },
        {
          text: locale === "en" ? "Morph & matching" : "Morph 与分部匹配",
          link: `${p}/guide/morph`,
        },
        {
          text: locale === "en" ? "Text & LaTeX" : "文本与 LaTeX 管线",
          link: `${p}/guide/text-latex`,
        },
        { text: locale === "en" ? "Interaction" : "交互系统", link: `${p}/guide/interaction` },
        {
          text: locale === "en" ? "Layout & Inspector" : "布局与 Inspector",
          link: `${p}/guide/layout-inspector`,
        },
      ],
    },
    {
      text: locale === "en" ? "PCG demos (v1.0)" : "PCG 演示系统（v1.0）",
      items: [
        { text: locale === "en" ? "Procedural generation" : "程序化生成（PCG）", link: `${p}/guide/pcg` },
        { text: locale === "en" ? "3D scenes & camera" : "3D 场景与相机", link: `${p}/guide/3d` },
        {
          text: locale === "en" ? "Export, share & embed" : "导出、分享与嵌入",
          link: `${p}/guide/export-embed`,
        },
        {
          text: locale === "en" ? "Performance & big data" : "性能与大数据",
          link: `${p}/guide/performance`,
        },
      ],
    },
    {
      text: locale === "en" ? "Extensibility (v0.7)" : "扩展系统（v0.7）",
      items: [
        {
          text: locale === "en" ? "Plugins & registries" : "插件与注册表",
          link: `${p}/guide/extensibility`,
        },
      ],
    },
  ];
}

function projectSidebar(locale: "" | "en"): DefaultTheme.SidebarItem[] {
  const p = localePrefix(locale);
  return [
    {
      text: locale === "en" ? "Project" : "项目",
      items: [
        {
          text: locale === "en" ? "Roadmap & milestones" : "路线图与里程碑",
          link: `${p}/project/roadmap`,
        },
        {
          text: locale === "en" ? "v0.1 checklist" : "v0.1 验收清单",
          link: `${p}/project/v01-checklist`,
        },
        {
          text: locale === "en" ? "v0.2 checklist" : "v0.2 验收清单",
          link: `${p}/project/v02-checklist`,
        },
        {
          text: locale === "en" ? "v1.0 checklist" : "v1.0 验收清单",
          link: `${p}/project/v1-checklist`,
        },
      ],
    },
  ];
}

/** Build locale-specific sidebar map for VitePress `themeConfig.sidebar`. */
export function buildSidebar(locale: "" | "en"): DefaultTheme.Sidebar {
  const p = localePrefix(locale);
  const refPrefix = locale === "en" ? `${p}/reference` : "/reference";
  return {
    [`${p}/guide/`]: guideSidebar(locale),
    [refPrefix + "/"]: [
      {
        text: "API Reference",
        items: [{ text: locale === "en" ? "Overview" : "总览", link: `${refPrefix}/` }, ...typedocSidebar],
      },
    ],
    [`${p}/examples/`]: [
      {
        text: locale === "en" ? "Examples" : "示例",
        items: [
          {
            text: locale === "en" ? "Interactive gallery" : "交互演示（画廊）",
            link: "/demos/",
          },
          {
            text: locale === "en" ? "Catalog index" : "目录索引",
            link: `${p}/examples/`,
          },
        ],
      },
    ],
    [`${p}/project/`]: projectSidebar(locale),
    [`${p}/packages/`]: [
      {
        text: "Monorepo",
        items: [
          {
            text: locale === "en" ? "Package layers" : "包分层说明",
            link: `${p}/packages/`,
          },
        ],
      },
    ],
  };
}

/** Top navigation for a locale. */
export function buildNav(locale: "" | "en"): DefaultTheme.NavItem[] {
  const p = localePrefix(locale);
  return [
    {
      text: locale === "en" ? "Guide" : "指南",
      link: `${p}/guide/introduction`,
      activeMatch: `${p}/guide/`,
    },
    { text: "API Reference", link: locale === "en" ? `${p}/reference/` : "/reference/" },
    { text: locale === "en" ? "Demos" : "交互示例", link: "/demos/" },
    {
      text: locale === "en" ? "Roadmap" : "路线图",
      link: `${p}/project/roadmap`,
      activeMatch: `${p}/project/`,
    },
    {
      text: locale === "en" ? "Design doc" : "设计文档",
      link: "https://github.com/clyce/intermact/blob/main/dev-docs/design.md",
    },
  ];
}

/** Local search UI strings per locale. */
export const searchLocaleOptions = {
  root: {
    translations: {
      button: {
        buttonText: "搜索",
        buttonAriaLabel: "搜索",
      },
      modal: {
        displayDetails: "显示详细列表",
        resetButtonTitle: "重置搜索",
        backButtonTitle: "关闭搜索",
        noResultsText: "没有结果",
        footer: {
          selectText: "选择",
          selectKeyAriaLabel: "输入",
          navigateText: "导航",
          navigateUpKeyAriaLabel: "上箭头",
          navigateDownKeyAriaLabel: "下箭头",
          closeText: "关闭",
          closeKeyAriaLabel: "esc",
        },
      },
    },
  },
  en: {
    translations: {
      button: {
        buttonText: "Search",
        buttonAriaLabel: "Search",
      },
      modal: {
        displayDetails: "Display detailed list",
        resetButtonTitle: "Reset search",
        backButtonTitle: "Close search",
        noResultsText: "No results",
        footer: {
          selectText: "Select",
          selectKeyAriaLabel: "Enter",
          navigateText: "Navigate",
          navigateUpKeyAriaLabel: "Up arrow",
          navigateDownKeyAriaLabel: "Down arrow",
          closeText: "Close",
          closeKeyAriaLabel: "Escape",
        },
      },
    },
  },
};
