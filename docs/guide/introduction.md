# 简介

Intermact 是一个基于 **React Three Fiber** 的交互式数理可视化平台。它以「可交互的 Manim 替代品」为起点（v0.1），最终目标是成为面向数理可视化的 **PCG 演示与交互系统**：同一份程序既能编排叙事动画，又能实时调参、被观众拖拽探索，并嵌入网页与讲义。

## 解决什么问题？

| 痛点 | Intermact 的做法 |
| --- | --- |
| Manim 离线渲染慢、迭代成本高 | 浏览器内实时渲染，改代码即见效果 |
| 传统动画库难以交互 | 保留模可 seek 时间线 + Signal/derived 响应式层 |
| 实验逻辑与渲染耦合 | `core` 无框架依赖，可在 Node/Worker 无头求值与测试 |
| 输出仅限视频 | Web 原生；序列化/导出/嵌入在后续里程碑（M15） |

## v0.1 能做什么？

- **声明式 2D 图元**：圆、椭圆、矩形、弧、多边形（含洞）、贝塞尔、线段、箭头
- **Create 描边/填充 reveal**、Fade、Move、Rotate、Scale、arc-length Morph
- **坐标系**：笛卡尔域、abs/rel/fit 转换、极坐标、`getAxes` 注册轴对象
- **响应式**：`signal` / `derived` / `valueTracker` / `tweenSignal`，与 Leva 绑定
- **React 入口**：`<IntermactCanvas program={...} />` + 时间线叠层控件

## 文档结构

- **指南**：面向使用者的概念与代码示例（本目录）
- **包**：`@intermact/*` 分层职责与依赖规则
- **示例**：与 `examples/` 演示画廊一一对应的索引
- **项目**：里程碑路线图与 v0.1 验收清单

更完整的接口契约与修订记录见仓库 [`dev-docs/design.md`](https://github.com/intermact/intermact/blob/main/dev-docs/design.md) 与 [`dev-docs/dev-roadmap.md`](https://github.com/intermact/intermact/blob/main/dev-docs/dev-roadmap.md)。
