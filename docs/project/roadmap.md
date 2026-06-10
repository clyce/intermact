# 路线图与里程碑

完整路线图见仓库 [`dev-docs/dev-roadmap.md`](https://github.com/clyce/intermact/blob/main/dev-docs/dev-roadmap.md)。本文档是在线文档中的摘要。

## 三阶段愿景

| 阶段 | 版本闸口 | 主题 | 状态 |
| --- | --- | --- | --- |
| Phase-1 | **v0.1 ◆ L1** | 可交互 Manim 替代品（2D + 时间线 + 调参） | ✅ 已完成 |
| Phase-2 | **v0.2 ◆ L2** | 数理工具箱（Scale / LaTeX / Morph matching / 交互） | ✅ 已完成 |
| Phase-3 | **v1.0 ◆ L3** | PCG 演示系统（3D / 导出 / 嵌入 / 插件） | ✅ 已完成 |

## Phase-1（v0.1）

| ID | 名称 | 状态 |
| --- | --- | --- |
| M0 | 工程基座 | ✅ |
| M1 | 核心模型 / 时间线 / Player | ✅ |
| M2 | 2D 几何与采样 | ✅ |
| M3 | R3F 渲染适配 | ✅ |
| M4 | 基础动画 | ✅ |
| M5 | 坐标系与轴 | ✅ |
| M6 | 响应式最小集 | ✅ |
| L1 | v0.1 验收 | ✅ |

实现细节见 [`design.md §0.1`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md)。在线 [v0.1 验收清单](./v01-checklist.md)。

## Phase-2（v0.2）

| ID | 名称 | 状态 |
| --- | --- | --- |
| M7 | Scale 与刻度 | ✅ |
| M8 | 数理构件库 | ✅ |
| M9 | Morph matching | ✅ |
| M10 | 文本与 LaTeX | ✅ |
| M11 | 交互系统 | ✅ |
| M12 | 布局与 Inspector | ✅ |
| L2 | v0.2 验收 | ✅ |

实现细节见 [`design.md §0.2`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md)。在线 [v0.2 验收清单](./v02-checklist.md)。

## Phase-3（v1.0）

M13–M17（PCG、3D、序列化/导出、性能、插件）与 L3 验收已完成。见 [v1.0 验收清单](./v1-checklist.md) 与 [扩展系统指南](/guide/extensibility)。

## 文档

- **指南**：Phase-1 核心能力 + Phase-2 数理工具箱（侧边栏分组）
- **API Reference**：TypeDoc 符号页 + [总览](/reference/)（P1–P2 架构归纳，`pnpm run gen:reference`）
- **示例索引**：[`/examples/`](/examples/) 按里程碑分组，链到 [`/demos/`](/demos/) 交互画廊
