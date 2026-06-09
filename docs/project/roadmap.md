# 路线图与里程碑

完整路线图见仓库 [`dev-docs/dev-roadmap.md`](https://github.com/intermact/intermact/blob/main/dev-docs/dev-roadmap.md)。本文档是在线文档中的摘要。

## 三阶段愿景

| 阶段 | 版本闸口 | 主题 |
| --- | --- | --- |
| Phase-1 | **v0.1 ◆ L1** | 可交互 Manim 替代品（2D + 时间线 + 调参） |
| Phase-2 | v0.2 ◆ L2 | 数理工具箱（Scale / LaTeX / Morph matching / 交互） |
| Phase-3 | v1.0 ◆ L3 | PCG 演示系统（3D / 导出 / 嵌入 / 插件） |

## Phase-1 状态：**已完成**（2026-06）

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

实现细节与偏差记录见 [`design.md §0.1`](https://github.com/intermact/intermact/blob/main/dev-docs/design.md)。

## Phase-2 下一步

关键路径从 **M7 Scale** 与 **M9 Morph matching** 展开，并与 M10 LaTeX、M11 交互并行。详见 dev-roadmap §5。

## 文档

- **v0.1**：VitePress 指南 + **TypeDoc API Reference**（`/reference/`，`pnpm run gen:reference`）+ 示例索引
- **v1.0 目标**：迁移/稳定性说明、更完整的 TSDoc 覆盖率
