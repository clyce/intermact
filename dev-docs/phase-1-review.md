## 11. Phase-1 代码评审（Code Review · 2026-06-08）

本节是对当前已落地的 Phase-1（v0.1）实现的一次系统性代码评审，结论基于对 `packages/*/src` 全量源码、测试与 `examples/`、工具链配置的逐文件审阅。

**初评验证**（2026-06-08）：`pnpm run test` 实测 **13 文件 / 64 用例全绿**（耗时 ≈2.2s）。

**清偿后验证**（2026-06-08 后续）：`pnpm run ci` 全绿 — **14 文件 / 67 用例**（含 morph、cover-fit、`fadeIn` 基线等新测）。

评审采用「先肯定整体、再按严重度列问题、最后给文档一致性与改进建议」的结构；**§11.10** 记录进入 Phase-2 前的清偿结果与关键决策。

> 约定：`[严重度]` 分为 **阻断**（破坏既有契约/数据正确性）、**高**（功能缺陷或与设计稿冲突）、**中**（健壮性/性能/可维护性）、**低**（打磨项）。已清偿项在条目标题后标注 **✅**。

### 11.1 总体评价

Phase-1 的工程质量整体**高于一般 MVP 水准**，关键架构主张已被忠实落地：

- **双阶段执行 + 可 seek 时间线（§3.2）落地扎实**：`compileSpec` 把 spec 树编译为带绝对 `start` 的纯函数 `Track`，`Player.applyAt` 通过「重置基线 + 应用所有 `start<=t` 的 Track」实现确定性 seek；负速率反向、`call` 不可 seek 边界（scrub 跳过并告警、正向 `update` 才触发）均有实现与测试。这是全局基石，质量达标。
- **分层依赖规则（§3.1）被 CI 强制**：`dependency-cruiser` 实测可阻断 `core → react/three/render-*` 违规 import，核心可无头运行的承诺成立。
- **不可变数据流（§4.3）与组合优先（§4.2）贯彻到位**：`RuntimeStateStore` 结构共享、`findTrait` 能力查询而非类型判断、几何/trait 经 `*TraitFrom` 组合，符合用户「原子化组合代替继承」规则。
- **文档覆盖优秀**：源码 TSDoc 完整且普遍标注对应 `design.md` 章节，符合「始终保持代码有完整文档」要求。

初评所列问题**不影响「Phase-1 已完成」的结论**；其中 P0–P2 项已在 2026-06-08 清偿批次中处理或回写文档（见 §11.10），余下项记入 Phase-2 / M15 / M16。

### 11.2 正确性与契约问题

- **✅ [高] `fillRule: "evenodd"` 名实不符**（初评 §11.2 第一条）
  - **决策**：v0.1 **不实现**自相交 even-odd；`triangulate()` 保持「首轮廓=外环、其余=洞」的 earcut + **nonzero** 语义。
  - **文档**：`design.md §0.1`、`§5.2`、`docs/guide/geometry.md`、`docs/guide/rendering.md` 已改为「nonzero + 带洞」；自相交 even-odd **推迟至 M9/M16**。
  - **代码**：`triangulate.ts` 注释同步；类型字段 `fillRule: "evenodd"` 保留供前向兼容，示例中带洞多边形仍可使用该字段名但语义为 ring/holes。

- **✅ [高] Camera 未注册进 Scene**（初评 §11.2 第二条）
  - **决策**：2D MVP 由 `computeFit` 驱动正交视口，**不阻塞 v0.1**；Camera `scene.register` 化与可动画性 **推迟至 M14（3D 相机）**。
  - **文档**：`design.md §10.1`、`§22.7` 已加 v0.1 偏差注记；`program/context.ts` 注明 `createScene3D` / `assets` 归属 M14/M15。

- **✅ [高] `fadeIn()` / `create()` 工厂副作用**（初评 §11.2 第三条）
  - **实现**：移除 `RegisteredObject2D.applyInitial`；`CompileContext.applyBaselinePatch` 在 **`scene.play` 编译进 Storyboard 时**注入隐藏基线（`create`、`fade` 带 `from` 的 fade-in）。
  - **测试**：`animations.test.ts` 新增「未 play 则基线不变」；既有 Create / fadeIn seek 用例仍绿。

- **✅ [中] `setSignalRegistrar` 模块级全局竞态**（初评 §11.2 第四条）
  - **决策**：删除 `setSignalRegistrar`；构建期信号须经 **`ctx.signal` / `ctx.valueTracker`** 创建并绑定当前 `ReactiveEngine` 闭包。
  - **约束回写**：`design.md §3.2`、`§22.8` — 构建期不得依赖进程级全局可变状态。
  - **迁移**：`reactive/value-tracker` 示例、`reactive.test.ts` 已改用 `ctx` 工厂；独立 `signal()` 仍可用于测试，但不自动注册。

- **✅ [中] `build.ts` 多视口注释误导**（初评 §11.2 第五条）
  - **实现**：注释改为多视口属 **§10.4，计划 M12/M15**。

- **✅ [中] 动画期 `zIndex` / 样式颜色不刷新**（初评 §11.2 第六条）
  - **实现**：`object-view.ts` 每帧同步子网格 `renderOrder`；`material.color` / opacity 经统一 `parseColor` 在非重建路径更新。

### 11.3 生命周期与资源管理

- **✅ [中] `useIntermactPlayer` 不销毁旧 BuiltProgram**（初评 §11.3 第一条）
  - **实现**：`disposeBuiltProgram`、`Player.dispose`、`ReactiveEngine.dispose`；hook 在 `program`/`seed` 变化及卸载时调用。

- **✅ [中] `Scene2D.free/clear` 不清理 ReactiveEngine**（初评 §11.3 第二条）
  - **实现**：`ReactiveEngine.unregisterObject`；`free` / `clear` 联动注销 derived/updater。

- **✅ [低] `IntermactCanvas` 每帧 `setSnapshot` 触发 React 重渲染**（初评 §11.3 第三条）
  - **实现**：移除无 timeline 时的 `onFrame → setState`；`TimelineControls` 自行 `player.subscribe` 仅更新 transport 时间。

### 11.4 性能观察（非 Phase-1 阻断，记入 M16 输入）

以下**未在本次清偿**；仍作为 M16 性能里程碑输入：

- `Player.applyAt` 每帧重放全部 `start<=t` 的 Track — O(活跃+历史 Track)/帧；M16 可加区间裁剪 + 增量。
- Create 期间 `buildStrokeGeometry` 全量重建 — `design.md §15` shader `uTrimStart/uTrimEnd` 仍为欠账。
- **✅ 部分**：`stroke.ts` 已改为复用 `@intermact/core` 的 `pointAtDistance`（消除与 `sampling.ts` 的重复实现）；`cumulativeLengths` 在 trim 路径仍可能重算，留待 M16。

### 11.5 一致性与可维护性

- **✅ [中] `GeometryProvider3D.getBounds()` 返回 `Bounds2D`**（初评 §11.5 第一条）
  - **实现**：新增 `Bounds3D`；`GeometryProvider3D.getBounds(): Bounds3D`。

- **✅ [低] `SceneRendererAdapter` 仅有接口**（初评 §11.5 第二条）
  - **文档**：`design.md §15.1` 注明 R3F 以 `SceneView` 组件履约；独立 adapter 待 M16/M17。

- **✅ [低] `splitOpacity` 与 `parseColor` 重复**（初评 §11.5 第三条）
  - **实现**：`object-view.ts` 统一走 `parseColor`（含 `hsla` alpha）。

- **✅ [低] 反序列化阻力清单**（初评 §11.5 第四条）
  - **文档**：`dev-roadmap.md` M15 节已列 Phase-1 序列化债（`EasingFn`、`morph` 内嵌对象、`call`/`external`、`assets` 等）。

### 11.6 测试与示例缺口

- **✅ 测试数与措辞**（初评 §11.6 第一、二条）
  - 文档与清单已更新为 **67 项** Vitest；措辞统一为「**确定性数值断言**」（非 Vitest snapshot 文件）。

- **✅ 关键未覆盖面（部分）**（初评 §11.6 第三条）
  - 已补：`morph.test.ts`（arc-length morph seek）、`fit.test.ts`（`cover` 分支）、`fadeIn` 基线未 play 用例。
  - **仍缺**：easing 库单测、`@intermact/react` 全包、`render-r3f/SceneView`、reactive 最小重算精确断言、property-based morph。

- **⏳ `l1/interactive-sine` 占位**（初评 §11.6 第四条）
  - **未改**：`registry` 仍指向 `reactive/leva-binding`；`v01-checklist.md` 已注明合并关系。可选：补独立 demo 文件。

- **✅ 内联 SVG 示例迁移**（初评 §11.6 第五条）
  - **已迁移至 `IntermactCanvas`**：`timeline/seek-basics`、`timeline/markers-slides`、`geometry/primitives-gallery`、`geometry/sampling-debug`。
  - **决策**：geometry 调试叠加（采样点、bounds、三角网）经 `examples/src/lib/geometryPreviewProgram.ts` 在 scene 内注册辅助图元，仍走 R3F；`SvgGeometry.tsx` / `SvgScene.tsx` 已无引用，可删或留作历史参考。

- **⏳ 无视觉回归基础设施**（初评 §11.6 第六条）
  - **未实现**；`design.md §21.8` 仍为愿景，清单未声称已完成。

### 11.7 工具链与依赖治理

- **✅ [中] `dependency-cruiser` 未约束 react / render-r3f**（初评 §11.7 第一条）
  - **实现**：`.dependency-cruiser.cjs` 增加 `react-layered-deps`、`render-r3f-layered-deps`、`render-three-no-render-r3f`。

- **✅ [低] core 未禁 DOM 全局**（初评 §11.7 第三条）
  - **实现**：`eslint.config.js` 对 `packages/core/src` 启用 `no-restricted-globals`（`window` / `document`）。

- **⏳ 其余**（初评 §11.7 第二、四条）：`no-orphans` 仍为 warn；CI 无覆盖率门禁 — **未改**，接受为 v0.1 技术债。

### 11.8 设计稿/路线图自身的一致性、完备性与合理性建议

| # | 建议 | 状态 |
| --- | --- | --- |
| 1 | 文档↔实现偏差（even-odd、Camera、assets、测试数） | **✅ 已回写** `design.md`、`dev-roadmap.md`、`v01-checklist.md` |
| 2 | `design.md §0.1` 实现日志与架构契约分拆 | **⏳ 未做**；仍合并于 `design.md`，长期可迁至 roadmap §4.0 |
| 3 | 甘特图 M5 依赖 `m2 m4` | **✅ 已改** `dev-roadmap.md` §3 |
| 4 | §3.2/§22 构建期无全局可变状态 | **✅ 已加** `design.md §3.2`、`§22.8` |
| 5 | §11.5 可逆性 / 负速率校验 | **⏳ 未做**；v0.1 依赖 Track 纯函数，未加 strict 钩子 |
| 6 | §7.4 同步 `getAxes` 结论 | **⏳ 部分**；结论在 `design.md §0.1` v0.1.1，§7.4 正文可再补一句 |

### 11.9 建议的清偿优先级（进入 Phase-2 前）

| 优先级 | 事项 | 类型 | 状态 |
| --- | --- | --- | --- |
| P0 | even-odd 名实统一；Camera 注册化偏差回写；测试数修订 | 文档债/契约 | **✅** |
| P0 | `fadeIn/create` 工厂副作用改为编译期注入 | 正确性 | **✅** |
| P1 | 全局 `signalRegistrar` 去全局化 | 健壮性 | **✅** |
| P1 | `object-view` 每帧同步 `renderOrder`/`material.color` | 渲染正确性 | **✅** |
| P1 | 补 morph 与 cover-fit 测试；「数值断言」措辞 | 测试 DoD | **✅** |
| P2 | `useIntermactPlayer`/`Scene.free` 资源清理；depcruise 补规则 | 生命周期/治理 | **✅** |
| P2 | 去重 `pointAtDistance`/`splitOpacity`；`Bounds3D` | 可维护性 | **✅** |
| P3 | 时间线裁剪、stroke shader trim、序列化债清单 | M16/M15 输入 | **部分 ✅**（清单已入 M15；性能项未实现） |

### 11.10 清偿记录与决策摘要（2026-06-08）

本节汇总 Phase-1 评审后的**实际改动与未改动的显式决策**，便于 Phase-2 接力时不再重复争论。

#### 11.10.1 关键决策表

| 主题 | 决策 | 理由 |
| --- | --- | --- |
| even-odd 填充 | **文档对齐实现**；真 even-odd 推迟 M9/M16 | 避免契约与 earcut 路径两存；带洞多边形 v0.1 已可验收 |
| Camera 注册化 | **推迟 M14** | 2D 正交 fit 足够；相机动画随 3D 一并设计 |
| fadeIn/create 基线 | **Storyboard 编译期** `applyBaselinePatch` | 符合「动画是数据」；工厂零副作用 |
| 信号注册 | **`ctx.signal` 闭包**；删除全局 registrar | 多 Canvas / 并发 build 安全；API 面向 program 作者 |
| geometry 示例 | **`geometryPreviewProgram` + IntermactCanvas** | 示例即活文档；调试叠加用 scene 内辅助图元而非 SVG |
| timeline 示例 | **IntermactCanvas**；markers 用 `chrome` 插槽 | 与 M3+ 示例一致；保留 `jumpToMarker` 交互 |
| 测试策略 | **手写数值断言**，称「确定性数值断言」 | 与 §21.1 意图一致；不引入 snapshot 文件除非后续专门建基线 |
| SceneRendererAdapter | **R3F 组件路径为 v0.1 履约** | 减少重复抽象；无头 adapter 随 M16/M17 |

#### 11.10.2 主要代码触点（便于 code review 定位）

| 区域 | 文件 / 符号 |
| --- | --- |
| 编译期基线 | `CompileContext.applyBaselinePatch`、`track.ts`（`create` / `fade`）、`storyboard.ts` |
| 信号 | `program/context.ts`（`signal`/`valueTracker`）、`program/build.ts`、`reactive/signal.ts`（`createSignal`） |
| 生命周期 | `disposeBuiltProgram`、`Player.dispose`、`ReactiveEngine.dispose` / `unregisterObject` |
| 渲染 diff | `render-three/object-view.ts`、`render-three/stroke.ts`（`pointAtDistance` 导入） |
| 示例辅助 | `examples/src/lib/geometryPreviewProgram.ts` |
| 治理 | `.dependency-cruiser.cjs`、`eslint.config.js`（core `no-restricted-globals`） |

#### 11.10.3 仍开放 / 推迟项（Phase-2 入口参考）

1. **性能**：`Player.applyAt` 全量重放、Create stroke 几何每帧重建、`cumulativeLengths` 复用。
2. **测试**：easing、`@intermact/react`、`SceneView` smoke、reactive 最小重算精确断言、morph property-based。
3. **示例 / 产品**：`l1/interactive-sine` 独立文件；视觉回归（§21.8）。
4. **工具链**：depcruise `no-orphans` 提升为 error；CI coverage 门禁。
5. **设计稿结构**：`design.md §0.1` 日志外迁；§7.4 `getAxes` 正文同步；负速率 strict 校验或文档化「恒可逆」。
6. **死代码**：`examples/src/lib/SvgGeometry.tsx`、`SvgScene.tsx` 可删除（当前无引用）。

#### 11.10.4 验证命令

```bash
pnpm run ci   # lint + typecheck + 67 tests + depcruise + build
pnpm dev:examples   # 目视：geometry/*、timeline/*、render/*
```
