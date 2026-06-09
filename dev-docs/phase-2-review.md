## 12. Phase-2 代码评审（Code Review · 2026-06-09）

本节是对已落地的 Phase-2（v0.2 数理工具箱，M7–M12）实现的一次系统性代码评审。结论基于对 `packages/*/src` 源码、测试、`examples/`、工具链配置的逐文件审阅，并对照 `intro.md` 第二层愿景、`design.md §0.2` 实现日志与 `dev-roadmap.md §5` 退出标准。

**评审验证**（2026-06-09）：

| 步骤 | 结果 |
| --- | --- |
| `pnpm run test` | **22 文件 / 141 用例全绿**（≈4.4s） |
| `pnpm run depcruise` | **130 模块 / 0 违规** |
| `pnpm run build` | 四包 `tsup` 构建成功 |
| `pnpm run lint` | **失败** — 3 项 ESLint error |
| `pnpm run typecheck` | **失败** — `@fontsource` woff `?url` 声明缺失 + `text-write.test.ts` 类型收窄 |

> **与 DoD 的偏差**：`dev-roadmap.md §5.0`、`v02-checklist.md` 声称「`pnpm run ci` 全绿（135 tests）」；当前工作区 **lint + typecheck 未通过**，测试数为 **141**（非 135），depcruise 为 **130 模块**（非文档中的 119）。**不影响「核心库能力已落地」的判断，但影响「闸口 CI 可复现全绿」的声明。**

评审采用「先肯定整体、再按里程碑与严重度列问题、最后给清偿优先级与 Phase-3 入口」的结构；已清偿项在条目标题后标注 **✅**（本次无清偿批次，均为新发现问题）。

### 12.1 总体评价

Phase-2 在架构层面**忠实兑现**了 `intro.md` 第二层愿景与 `design.md §20.2` 路线图：Scale、数理构件、Morph（含分部匹配）、Text/LaTeX、交互、布局与 Inspector 均已落地，且延续 Phase-1 的核心主张——**可 seek 时间线、trait 组合、core 无框架依赖、构建期/播放期分离**。

**突出优点**：

- **里程碑闭环完整**：M7–M12 各有工厂实现、确定性单测与 `examples/` 演示；`design.md §0.2` 对有意偏差（解析命中替代 raycast、单对象 morph 等价实现、`constructs/` 目录等）记录充分。
- **数理表达力达标**：`AxesHandle.c2p/p2c` + `Scale` 驱动的刻度/标签，使 FunctionGraph、Riemann、Tangent、Matrix/Table 等构件可组合编排；与 Manim 式「讲一节微积分」的目标对齐。
- **Morph + 文本管线可 seek**：四类 morph 策略 + `transformMatchingTex`；OpenType / MathJax 生产路径经 `AssetManager` 在构建期 resolve，播放期无异步（§14）。
- **交互与响应式打通**：`draggablePoint/Value(Source)` + `derived` + `hitTest` 形成可拖拽探索闭环；`vite.config.ts` alias 修复消除了 signal 双实例导致的静默构建失败。
- **测试质量**：`morph-strategies.test.ts` 含 40 组 property-based 随机形状；`constructs.test.ts`、`layout.test.ts` 覆盖 c2p 贴合、父链 world transform、Riemann 数值收敛等硬断言。

**当前最大落地风险**（按严重度）：

1. **示例层默认字体契约断裂** — M10 移除笔画骨架字体后，大量 math/layout/interaction 示例未 `loadDemoFonts`，构建期会抛 `No default font registered`。
2. **CI 闸口未全绿** — lint / 根 `typecheck` 回归，与 v0.2 DoD 声明不一致。
3. **Morph 渲染性能** — `geometryVersion` 修复正确，但动画期每帧全量 earcut + stroke 重建，长 morph 有帧时间风险。

**结论**：Phase-2 **核心库实现可判定为已完成**，能力与设计契约高度一致；**示例冷启动路径与 CI 卫生**需在进入 Phase-3 前优先清偿，否则影响演示可信度与回归基线。

---

### 12.2 里程碑逐项评审

#### 12.2.1 M7 · Scale 与刻度 ✅

**对齐**：`packages/core/src/math/scale.ts` 实现 `linearScale` / `powScale` / `logScale` / `timeScale`，接口与 `design.md §7.3` 一致；D3 nice-number 刻度、`numericTicks` / `timeTicks` 可供 M8 轴复用。`scale.test.ts` 12 项覆盖正反映射与格式化。

| 严重度 | 问题 |
| --- | --- |
| **中** | `tickFormat` 仅支持 `"%"` 与 `".<n>f"` 子集（已在 §0.2 记录）；轴标签国际化仍受限。 |
| **中** | 注释暗示 log 域可负，实现仅接受严格正域（`logScale` 抛 `invalid-argument`）。 |
| **低** | `powScale` 在 `exponent === 0` 时 `untransform` 无防护；`timeScale.tickFormat` 的 `spec` 被忽略。 |
| **低** | 退化域 `dSpan === 0` 静默返回端点，无 dev 告警。 |

**测试缺口**：log 小跨度 decade 细分、`timeTicks` 月/年分支、`powScale` 负域。

---

#### 12.2.2 M8 · 数理构件库 ✅

**对齐**：`packages/core/src/constructs/` 落地 NumberLine、Planes、Graphs（FunctionGraph/Parametric/Area/Riemann/Tangent）、Matrix/Table/Brace；`layout/axes.ts` 基于 M7 `Scale` 重写刻度；`constructs.test.ts` 14 项验证 c2p、Riemann 收敛、切线斜率。`brace` 接受 `Bounds2D | IMObject2D` 保持与 scene 层解耦（§0.2 具体化）。

| 严重度 | 问题 |
| --- | --- |
| **高** | **示例未加载默认字体**：`getAxes` 默认 `showTickLabels: true`，内部调用 `labelContours` → `requireDefaultFont()`。`math/*`、`interaction/explorable-derivative` 等**未**调用 `loadDemoFonts` / `setDefaultFont`，冷启动构建失败（卡在 "Building…" + `console.error`）。仅 `text/*`、`latex/*` 传入 `fetchBinary`。 |
| **中** | 轴/矩阵/表格标签经 `labelContours` 产出**填充轮廓**，却并入 `strokeObject`（`fillable: false`），标签只能走描边通道，与 `textObject` 的 fill+stroke 三态不一致。 |
| **中** | `numberPlane` / `polarPlane` 在数据域≈世界域假设下直接画线，不经 `AxesHandle.c2p`；scene `domain` 与 plane spec 不一致时需作者手动对齐。 |
| **低** | `complexPlane` 无 Re/Im 轴标签；`decimal-number.ts` 注释仍写「stroke-font」；`design.md §7.4` 的 `VectorField` 未实现。 |

**测试缺口**：无默认字体时的失败路径；不等同 scene domain 的 plane 对齐。

---

#### 12.2.3 M9 · Morph（含分部匹配）✅

**对齐**：`animation/morph.ts` 四类策略齐全；`group2D` + `ObjectPart2D` key；`transformMatching` / `morphTo` / `transformMatchingTo`；`morph-strategies.test.ts` 8 项 + 40 组 property-based。

| 严重度 | 问题 |
| --- | --- |
| **中** | **`geometryVersion` 性能代价**：`track.ts` 在 morph 进度上派生 `MORPH_GEOMETRY_VERSION_BASE + round(eased × SPAN)`，使 `ThreeObjectView` **每帧**判定 `geometryChanged` 并全量 `buildStrokeGeometry` + `buildFillGeometry`（含 earcut）。长 morph + 高 `sampleCount` 有帧时间风险。 |
| **中** | morph 结束不 `replaceObject`（§22.1 留待 M15）；seek 到结束后 `geometryOverride` 仍残留；链式 morph 的 `from` 仍取原定义。 |
| **中** | `group2D` 无顶层 `style` 时填充可能不渲染（`matching-shapes` 黑屏根因）；属 API 陷阱，示例已用 `Caption` 说明但 API 本身易踩坑。 |
| **低** | `cross-fade` 仅 2 个离散 `geometryVersion`，中点几何硬切换；matching remover/introducer 为几何塌缩/生长（单对象架构等价实现，§0.2 已记录）。 |

**测试缺口**：**无** `geometryVersion` ↔ `render-three` 联动回归测；链式 morph、结束后 override 清理未测。

**已修复（§0.2 打磨）**：此前 morph 只改 `geometryOverride` 不动 `geometryVersion` 导致渲染静止 — 已在 `track.ts` 修复。

---

#### 12.2.4 M10 · Text / LaTeX 管线 ✅

**对齐**：`parseSvgPath` → `composeGlyphs` / `textObject` / `latexObject`；`TextLayoutTrait` + per-glyph `ObjectPart2D` key；`write()` + `glyphWriteSpans`（ltr/rtl/simultaneous）；`AssetManager`（font/latex/svg/data/preload）；OpenType（`opentype-font.ts`）与 MathJax 3（`mathjax-latex.ts`）生产路径。`text.test.ts` 16 项 + `text-write.test.ts` 4 项。

| 严重度 | 问题 |
| --- | --- |
| **高** | 同 §12.2.2：**同步文本 API**（`labelContours`、`glyphText`、`textObject` 无显式 `font`）依赖 `setDefaultFont`；测试经 `loadTestFont()` 满足，**示例层大量未满足**。 |
| **中** | 内置 LaTeX 子集已移除；headless / CI 测试强依赖 `mathjax-full` 重量包（`text.test.ts` 中 MathJax 用例 ≈1.6s）。 |
| **中** | `AssetManager` 对 `latex`/`svg` 无去重缓存（字体有 registry）；重复 preload 会重复排版。 |
| **中** | `asset-manager.ts` 的 SVG 解析用正则提取 `d="..."`，复杂 SVG（transform、非 path 图元）易漏。 |
| **低** | `seven-segment.ts` 仍导出但主路径已 OpenType；troika MSDF 未实现（设计列为后续）。 |

**测试缺口**：`transformMatchingTex` 端到端时间线 seek；`write({ direction: "rtl" })` 渲染裁切；`AssetManager` URL 失败路径。

**演进记录**：笔画骨架字体已删除（§0.2 2026-06-08）；与 M10 初稿「builtin + MathJax 双引擎 headless」表述已不一致 — 现 headless 亦走 MathJax 或测试字体。

---

#### 12.2.5 M11 · 交互系统 ✅

**对齐**：`interaction/types.ts` 三套坐标事件；`hit-test.ts` 解析命中（disc/rect/band）；`draggablePoint/Value(Source)` + `interactive()`；`render-r3f/interaction.ts` 反投影 + `SceneView` 指针分发；`IntermactCanvas` 键盘传输（§12.4）。`interaction.test.ts` 6 项 + `render-r3f/interaction.test.ts` 3 项。

| 严重度 | 问题 |
| --- | --- |
| **中** | `hitProxy` 仅对 pick 代理做**平移** offset（`hit-test.ts:56–57`），**未**应用旋转/缩放；带 `rotateTo` 或父链旋转的交互对象命中错位。 |
| **中** | `draggablePoint` 静态 `register()` 时 pick 中心冻结在注册瞬间；信号外部变更后 pick 不跟随（design 要求 `registerReactive`/`*Source`）。 |
| **低** | `SceneView` 用 `camera.unproject`，`interaction.ts` 的 `unprojectOrtho` 未被 R3F 路径复用，两套反投影可能漂移。 |
| **低** | 无 `pointercancel` / 多指处理；`onPointerEnter`/`Leave` 未路由。 |

**测试缺口**：旋转父节点下命中；`on()` 与 `interactive()` 互覆盖；`explorable-derivative` 类 E2E 无自动化。

**已记录偏差**：解析命中替代 WebGL pick mesh（§0.2 M11 ①）— 2D 正交下等价，但旋转场景为隐含限制。

---

#### 12.2.6 M12 · 布局 + Inspector ✅

**对齐**：`runtime/world-transform.ts` 纯函数 TRS；`scene.setParent` + `Player.getSnapshot` 沿父链合成 world transform 与 opacity；`scene/layout.ts` 的 `LayoutHandle`（alignTo/nextTo/fitTo/arrange）；`react/Inspector.tsx`（registry、活跃 Track、`reactive.inspect()`、bounds SVG 叠层）。`layout.test.ts` 11 项。

| 严重度 | 问题 |
| --- | --- |
| **中** | `layout/next-to-arrange.tsx` 使用 `textObject` 但未加载字体（同 §12.2.2）。 |
| **低** | Inspector 对象表不显示 `rotation`；无 part/trait 展开。 |
| **低** | Inspector bounds 用定义几何 + 快照 transform，morph 中 `geometryOverride` 对象 bounds 不准确。 |
| **低** | `arrange` grid 的 y 轴 packing 方向与 y-up 直觉略反（`layout.ts` 从 origin 向左下递减）。 |

**测试缺口**：`duration > 0` 的布局动画 seek 中间态；`setParent` 循环引用防护；Inspector 无组件测。

---

### 12.3 验收后打磨复盘（2026-06-08）

`design.md §0.2` 记录的联调修复在本次评审中**经验证有效**：

| 项 | 根因 | 修复 | 评审结论 |
| --- | --- | --- | --- |
| Examples 卡 "Building…" | `@intermact/core` src/dist 双实例 → signal `WeakMap` 分裂 | `examples/vite.config.ts` alias + `useIntermactPlayer` `.catch` | **✅ 架构层已修**；但**字体未加载**是新的构建失败根因，需示例层清偿 |
| Morph 无动画 | 只改 `geometryOverride` 不改 `geometryVersion` | `track.ts` 派生版本号 | **✅ 行为正确**；代价是每帧 mesh 重建（§12.2.3） |
| Text 笔触不一 | 骨架字体 → OpenType 填充 + `triangulateGroups` + write 策略 | `stroke-outline` 删除、按字形 fill group | **✅ 渲染质量提升**；契约变为必须 `setDefaultFont` |

---

### 12.4 正确性与契约问题（跨里程碑）

- **[阻断] CI 闸口未全绿**
  - `lint`：`mathjax-latex.ts` 空 interface；`text.test.ts:68` 未使用变量 `v`；`write-spans.ts:46` 未使用参数 `spans`。
  - `typecheck`（根 `tsconfig.json`）：`loadFonts.ts` 缺少 `@fontsource/...woff?url` 模块声明；`text-write.test.ts` 多处 `IMObject` 未收窄为 `IMObject2D`。
  - **与 DoD 冲突**：`v02-checklist` / `dev-roadmap §5.0` 的「CI 全绿」在当前工作区不成立。

- **[高] 默认字体为同步文本 API 的硬前置条件**
  - `font-registry.ts:38–45`：`requireDefaultFont()` 在 unset 时抛 `invalid-argument`。
  - 受影响示例（非穷尽）：`math/*`（5）、`layout/next-to-arrange`、`interaction/explorable-derivative`、`math/riemann-sum`（`decimalNumber`）、`math/matrix-table-brace`、`math/tangent-derivative` 等。
  - `IntermactCanvas` 提供 `fetchBinary` 但**不**自动加载默认字体；作者须在 program 内 `await ctx.assets.font()` + `setDefaultFont()`，或示例基座统一 `loadDemoFonts`。

- **[中] constructs 标签渲染模式与 `textObject` 不一致**
  - `matrix.ts`、`axes.ts` 将 OpenType 填充轮廓并入 `strokeObject`；实心标签需 `shapeObject` 或独立 text 部件。

- **[中] Morph 期 `fillGroups` 禁用**
  - `object-view.ts:155–157`：有 `geometryOverride` 时 `fillGroups` 为 null；带洞 LaTeX/多字形 morph 填充可能退化。

- **[低] 文档数字漂移**
  - 测试数：文档 135 → 实测 **141**；depcruise：文档 119 → 实测 **130** 模块。

---

### 12.5 性能观察（记入 M16 输入）

以下**未阻断 v0.2**，与 Phase-1 §11.4 项叠加：

| 项 | 说明 |
| --- | --- |
| Morph 每帧全量重建 | `geometryVersion` 随 eased 变化 → `buildStrokeGeometry` + earcut 每帧；长期应分离「override 脏标记」与 version，或 GPU buffer 更新 |
| `Player.applyAt` 全量重放 | Phase-1 已记录；活跃 Track 多时 O(n)/帧 |
| MathJax 测试冷启动 | `text.test.ts` MathJax 用例 ~1.6s；可考虑 mock 或标记 `@slow` |
| Create stroke 几何重建 | Phase-1 欠账；shader `uTrim` 仍未落地 |

---

### 12.6 测试与示例缺口

**已补强（相对 Phase-1 §11.10.3）**：

- ✅ morph property-based（40 组随机形状）
- ✅ `render-r3f/interaction.test.ts`（反投影往返）
- ✅ `text-write.test.ts`（书写完成后填充不消失）
- ✅ constructs / layout / scale 专项测

**仍缺**：

| 类别 | 缺口 |
| --- | --- |
| 渲染联动 | morph 多帧 `ThreeObjectView.update`；`geometryVersion` 修复无 render-three 回归 |
| E2E / 示例 | 默认字体加载；各 math/layout demo 冷启动 smoke |
| 交互 | 旋转命中；拖拽 + derived 端到端 |
| 动画 | easing 库单测；`transformMatchingTex` 时间线 seek |
| 产品 | 视觉回归基础设施（§21.8）；`@intermact/react` 组件测 |
| Inspector | 无自动化 |

**示例与 DoD 对照**：

| DoD 示例 | 风险 |
| --- | --- |
| `math/riemann-sum`、`math/tangent-derivative` | 轴标签 + `decimalNumber` 需默认字体 |
| `interaction/explorable-derivative` | 轴 + `glyphText` 需默认字体 |
| `layout/next-to-arrange` | `textObject` 需默认字体 + `fetchBinary` |
| `text/*`、`latex/*` | **已**传入 `fetchBinary` — 参考实现 |

---

### 12.7 工具链与依赖治理

- **✅ depcruise**：130 模块 0 违规；`constructs/` 独立目录避免与 `geometry`/`math` 成环的策略有效。
- **✅ examples alias**：`vite.config.ts` 强制 `@intermact/*` → `src` 单一实例，注释清晰。
- **⏳ CI 卫生**：lint + 根 typecheck 回归 — **需在 Phase-3 入口前修复**。
- **⏳ Phase-1 遗留**：depcruise `no-orphans` 仍为 warn；无 coverage 门禁 — 接受为技术债。
- **低**：alias 仅覆盖 4 个 workspace 包；新增包需手动追加。

---

### 12.8 设计稿 / 路线图一致性

| # | 主题 | 状态 |
| --- | --- | --- |
| 1 | M7–M12 能力 vs `design.md §7.3–§7.4、§11.4、§12、§9.4、§16` | **✅ 高度一致**；有意偏差均在 §0.2 记录 |
| 2 | `intro.md` 第二层「数理可视化工具箱」 | **✅ 达成**：Scale、构件、Morph、LaTeX、交互探索 |
| 3 | `VectorField`、troika MSDF、KaTeX | **⏳ 未实现** — 属 Phase-3 / 后续增强 |
| 4 | Morph `replaceObject`（§22.1） | **⏳ 未实现** — 记入 M15 序列化债 |
| 5 | 测试数 / depcruise 模块数 | **⏳ 文档滞后** — 应更新为 141 tests、130 modules |
| 6 | v0.2 DoD「CI 全绿」 | **❌ 当前不成立** — lint + typecheck 失败 |

---

### 12.9 建议的清偿优先级（进入 Phase-3 前）

| 优先级 | 事项 | 类型 | 建议动作 |
| --- | --- | --- | --- |
| **P0** | CI lint + typecheck 回归 | 闸口 | 修 ESLint 三项；补 woff `?url` 声明或 `examples` 移出根 tsc；收窄 `text-write.test.ts` 类型 |
| **P0** | 示例默认字体 | 功能/演示 | `IntermactCanvas` 可选 `defaultFont`、或 `DemoShell`/示例基座统一 `loadDemoFonts`；math/layout/interaction 示例传入 `fetchBinary` |
| **P1** | morph ↔ render-three 回归测 | 测试 | 断言 `geometryVersion` 变化触发 mesh 重建；cross-fade 前后半切换 |
| **P1** | 文档数字同步 | 文档债 | `dev-roadmap`、`v02-checklist`、`design.md §0.2` 更新为 141 tests / 130 modules |
| **P2** | `hitProxy` 旋转/缩放 或文档化限制 | 交互 | 实现 world 变换下的 pick，或在 §12 明确「仅平移场景」 |
| **P2** | constructs 标签 fill 模式 | 视觉 | 轴/矩阵标签改用 `shapeObject` 或 fill trait |
| **P2** | `AssetManager` latex/svg 缓存 | 性能 | 构建期去重 |
| **P3** | Morph 性能（version 与 override 分离） | M16 | 避免每帧 earcut |
| **P3** | `VectorField`、视觉回归、Inspector 组件测 | Phase-3 | 按路线图排期 |

---

### 12.10 关键代码触点（便于接力定位）

| 区域 | 文件 / 符号 |
| --- | --- |
| Scale | `math/scale.ts`、`math/scale.test.ts` |
| 数理构件 | `constructs/*`、`layout/axes.ts`、`layout/function-graph.ts` |
| Morph | `animation/morph.ts`、`animation/track.ts`（`MORPH_GEOMETRY_VERSION_*`）、`geometry/group.ts` |
| 文本 / 字体 | `text/font-registry.ts`（`requireDefaultFont`）、`text/text-layout.ts`（`labelContours`）、`resource/asset-manager.ts` |
| 书写 | `text/write-spans.ts`、`animation/track.ts`（`glyphWriteSpans`）、`render-three/object-view.ts`（按字形裁切） |
| 交互 | `interaction/hit-test.ts`、`interaction/draggable.ts`、`render-r3f/interaction.ts`、`render-r3f/SceneView.tsx` |
| 布局 / 层级 | `runtime/world-transform.ts`、`scene/layout.ts`、`animation/player.ts`（快照合成） |
| Inspector | `react/Inspector.tsx`、`reactive/engine.ts`（`inspect()`） |
| 示例基座 | `examples/vite.config.ts`、`examples/src/lib/loadFonts.ts`、`react/useIntermactPlayer.ts` |

---

### 12.11 Phase-3 入口参考（继承 Phase-1 §11.10.3）

以下项在 Phase-2 基础上**仍开放**或**新增**：

1. **CI 全绿**：lint、typecheck、测试数文档一致。
2. **示例字体契约**：所有依赖 `labelContours`/`glyphText`/`textObject` 的 demo 可冷启动。
3. **性能**：Morph 每帧重建、Player 全量重放、Create stroke shader trim。
4. **测试**：morph 渲染联动、easing、`transformMatchingTex` E2E、旋转命中、视觉回归。
5. **序列化债**（M15）：`morph` 内嵌对象、`EasingFn`、`call`/`external`、构建期闭包信号、Morph `replaceObject`。
6. **PCG / 3D**（M13/M14）：Field/Sampler、`VectorField`、Camera 注册化、3D 全量。

#### 12.11.1 验证命令

```bash
pnpm run test        # 当前：141 passed
pnpm run depcruise   # 当前：130 modules, 0 violations
pnpm run lint        # 当前：3 errors（待修）
pnpm run typecheck   # 当前：失败（待修）
pnpm run ci          # 全链路闸口
pnpm dev:examples    # 目视：math/*、morph/*、interaction/*、layout/*、devtools/inspector-tour
```

#### 12.11.2 与 `intro.md` 愿景的对照

| `intro.md` 需求 | Phase-2 状态 |
| --- | --- |
| Morph 任意 IMObject2D → IMObject2D（含节点数不同） | ✅ 四策略 + matching |
| Text / LaTeX writing | ✅ OpenType + MathJax + `write()` 策略 |
| 参数拖拽、实时模拟 | ✅ draggable + derived + Leva 示例 |
| 相对定位（Manim `next_to` 式） | ✅ `LayoutHandle.nextTo/alignTo/arrange` |
| 实验与渲染解耦 | ⏳ 数据驱动 / PCG 属 Phase-3 M13 |
| 嵌入 Web | ⏳ 序列化/嵌入属 M15 |

---

*评审人：基于源码与 CI 实测的自动化审阅 + 设计文档对照。后续清偿请更新本节或并入 `design.md §0.2` 实现日志，勿为单项修复新建独立 md。*
