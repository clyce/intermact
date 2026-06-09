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
---

## 当前版本：v0.1（Phase-1 已完成）

Phase-1 交付了从空 Canvas 到「基础 2D 叙事 + 交互函数曲线」的完整闭环。在线文档覆盖 M0–L1 全部公开 API 与示例索引；完整架构契约见仓库内 [`dev-docs/design.md`](https://github.com/intermact/intermact/blob/main/dev-docs/design.md)。

```bash
pnpm install
pnpm run dev:examples   # 交互示例画廊（:5173）
pnpm run dev:docs       # 本文档站（:5174）
pnpm run ci             # lint + typecheck + test + depcruise + build
```
