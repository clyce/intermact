# 简介

Intermact 是一个基于 **React Three Fiber** 的交互式数理可视化平台。它以「可交互的 Manim 替代品」为起点（v0.1），通过 v0.2 数理工具箱扩展为完整的 2D 交互叙事系统；v1.0 进一步交付 PCG、3D、导出/嵌入与插件扩展。同一份程序既能编排叙事动画，又能实时调参、被观众拖拽探索，并嵌入网页与讲义。

## 解决什么问题？

| 痛点 | Intermact 的做法 |
| --- | --- |
| Manim 离线渲染慢、迭代成本高 | 浏览器内实时渲染，改代码即见效果 |
| 传统动画库难以交互 | 保留模可 seek 时间线 + Signal/derived 响应式层 |
| 实验逻辑与渲染耦合 | `core` 无框架依赖，可在 Node/Worker 无头求值与测试 |
| 输出仅限视频 | Web 原生序列化、快照/视频导出、Web Component 嵌入（v1.0） |

## v0.1 能做什么？（Phase-1）

- **声明式 2D 图元**：圆、椭圆、矩形、弧、多边形（含洞）、贝塞尔、线段、箭头
- **Create 描边/填充 reveal**、Fade、Move、Rotate、Scale
- **坐标系**：笛卡尔域、abs/rel/fit 转换、极坐标、`getAxes` 注册轴对象
- **响应式**：`signal` / `derived` / `valueTracker` / `tweenSignal`，与 Leva 绑定
- **React 入口**：`<IntermactCanvas program={...} />` + 时间线叠层控件

## v0.2 能做什么？（Phase-2 · 数理工具箱）

- **Scale**：linear / log / pow / time 标度，轴刻度与格式化
- **数理构件**：NumberPlane、FunctionGraph、Riemann 和、切线、Matrix/Table/Brace、DecimalNumber
- **Morph**：`arc-length` / `anchor` / `matching` / `cross-fade`；`group2D` 部件 key 与 `transformMatchingTex`
- **文本与 LaTeX**：OpenType 轮廓 + MathJax SVG；逐笔 writing；矢量多字号
- **交互**：可拖拽控制点/数值、精确 hit-test、explorable 导数探索
- **布局与 Inspector**：`nextTo` / `arrange` / `fitTo`；React Inspector 调试场景树与信号

## 文档结构

- **指南**：面向使用者的概念与代码示例（本目录）
  - **核心能力（v0.1）**：程序、时间线、几何、渲染、动画、坐标、响应式
  - **数理工具箱（v0.2）**：Scale、构件、Morph、文本/LaTeX、交互、布局
- **API Reference**：TypeDoc 自动生成的符号文档（[总览](/reference/) 按 Phase-1/2 归纳入口）
- **包**：`@intermact/*` 分层职责与依赖规则
- **示例**：与 `examples/` 演示画廊一一对应的索引
- **项目**：里程碑路线图与 v0.1 / v0.2 / v1.0 验收清单

更完整的接口契约与修订记录见仓库 [`dev-docs/design.md`](https://github.com/intermact/intermact/blob/main/dev-docs/design.md) 与 [`dev-docs/dev-roadmap.md`](https://github.com/intermact/intermact/blob/main/dev-docs/dev-roadmap.md)。
