# 架构概览

Intermact 采用 **保留模（retained-mode）可 seek 时间线** 作为核心执行模型（`design.md §3.2`）：作者用 `async/await` 书写叙事，但运行时得到的是完整 `Storyboard`，可在任意时刻 `seek` 并得到确定的 `RuntimeState`。

## 两阶段执行

```mermaid
flowchart LR
  subgraph build["构建期（一次）"]
    P["createProgram(ctx)"]
    SB["Storyboard 累积"]
    P --> SB
  end
  subgraph play["播放期（可重复 / 可 seek）"]
    PL["Player"]
    EV["Track.evaluate(t)"]
    RS["RuntimeState"]
    PL --> EV --> RS
  end
  SB --> PL
```

| 阶段 | 做什么 | 关键类型 |
| --- | --- | --- |
| 构建期 | 注册对象、`scene.play` 追加动画与 marker | `IntermactProgram`, `AnimationSpec`, `Storyboard` |
| 播放期 | `seek` / `update` 求值轨道，生成快照 | `Player`, `Track`, `RuntimeState2D`, `RenderSnapshot` |

`await scene.play(...)` 是构建期的语法糖：逻辑时钟瞬间推进，不会真的等待墙钟时间。

## 对象模型

- **`IMObject2D`**：不可变对象**定义**（几何 + trait：stroke / fill / morphable …）
- **`RegisteredObject2D`**：场景中的**实例**，提供 `create` / `fadeIn` / `moveTo` / `tween` 等，返回 `Animation` 句柄
- **`RuntimeState2D`**：播放期**运行时态**（位置、reveal、opacity、geometryOverride …），由 Track 纯函数 patch

动画方法只返回数据（`Animation` / `AnimationSpec`），在 `scene.play` 时才编译进 Storyboard。

## 包分层（§3.1）

```text
@intermact/react
  └── @intermact/render-r3f
        └── @intermact/render-three
              └── @intermact/core   ← 禁止 import React / three / DOM
```

`dependency-cruiser` 在 CI 中强制上述规则。`core` 可在 Node 中无头构建与快照测试（见 `timeline/headless-eval` 示例）。

## 响应式层（§8）

与 Manim 的 `ValueTracker` + `add_updater` 对齐：

- **`signal` / `computed`**：带依赖追踪的可观察值
- **`derived`**：几何工厂，依赖变化时最小重算
- **`tweenSignal`**：可 seek 的信号轨道
- **`ReactiveEngine`**：每帧 `Player.prepareFrame` 时 flush，在渲染快照前完成重算

构建期通过 `setSignalRegistrar` 自动注册 program 内创建的信号。

## Phase-1 & Phase-2 范围

| 阶段 | 指南章节 | 验收清单 |
| --- | --- | --- |
| v0.1 | [核心能力](/guide/program-and-scene)（程序 → 响应式） | [v0.1 清单](../project/v01-checklist.md) |
| v0.2 | [数理工具箱](/guide/scale)（Scale → Inspector） | [v0.2 清单](../project/v02-checklist.md) |

Phase-2 已交付：`arc-length` / `anchor` / `matching` / `cross-fade` Morph、`group2D` 部件 key、OpenType + MathJax 文本/LaTeX、拖拽与 hit-test、布局与 Inspector。

## 已知偏差（跨阶段）

- `decimalNumber` 部分示例用世界坐标定位，非 UV HUD
- `call` 效果不可 seek（拖拽预览时跳过并告警一次）
- 屏幕空间恒定线宽为 ribbon 近似；专用 shader 为后续优化项
- matching 的 remover/introducer 在单对象通道上用几何塌缩/生长实现（非逐部件 alpha）

架构细节与 API 契约以 [`dev-docs/design.md`](https://github.com/clyce/intermact/blob/main/dev-docs/design.md) 为准；实现进度见 §0.1（Phase-1）、§0.2（Phase-2）、§0.3（Phase-3）。
