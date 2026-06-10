---
layout: home

hero:
  name: Intermact
  text: 可交互的 Manim 式数理可视化
  tagline: 声明对象 → 可 seek 时间线 → React Three Fiber 实时渲染 → 拖进度条 / 调参探索
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /reference/
    - theme: alt
      text: 交互示例
      link: /demos/
    - theme: alt
      text: 示例索引
      link: /examples/
    - theme: alt
      text: 架构设计（design.md）
      link: /guide/architecture

features:
  - icon: ⏱️
    title: 可 seek 时间线
    details: 构建期累积 Storyboard，播放期纯函数求值；拖动进度条结果确定，快照测试纳入 CI。
  - icon: 📐
    title: 2D 几何 + R3F 渲染
    details: 弧长采样、earcut 填充、stroke trim reveal、HiDPI/resize 不失真。
  - icon: 🎬
    title: 基础动画编排
    details: Create / Fade / Move / Morph / sequence / parallel / stagger，全部编译为可 seek 的 Track。
  - icon: 📡
    title: 响应式最小集
    details: Signal / derived / valueTracker / tweenSignal，Leva 调参驱动几何实时重算。
  - icon: 📊
    title: 数理工具箱（v0.2）
    details: Scale、FunctionGraph/Riemann、Morph matching、OpenType/LaTeX writing、拖拽交互与 Inspector。
---

## 文档覆盖：Phase-1 & Phase-2（v0.1–v0.2）

**Phase-1（v0.1）** 交付从空 Canvas 到「基础 2D 叙事 + 交互函数曲线」的完整闭环；**Phase-2（v0.2）** 扩展 Scale、数理构件、Morph matching、文本/LaTeX、交互与布局。指南、API Reference 总览与示例索引均已覆盖 M0–L2 公开 API。仓库当前版本为 **v1.0**（含 Phase-3 PCG/3D/导出/插件）；Phase-3 概念见 [扩展系统](/guide/extensibility)。完整架构契约见 [`dev-docs/design.md`](https://github.com/intermact/intermact/blob/main/dev-docs/design.md)。

```bash
pnpm install
pnpm run dev:examples   # 交互示例画廊（:5173）
pnpm run dev:docs       # 本文档站（:5174）
pnpm run ci             # lint + typecheck + test + depcruise + build
```
