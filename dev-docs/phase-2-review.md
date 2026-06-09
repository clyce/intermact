## 12. Phase-2 代码评审（Code Review · 2026-06-09）

本节是对已落地的 Phase-2（v0.2，里程碑 **M7–M12**）实现的系统性代码评审。结论基于对 `packages/*/src` 全量源码、`*.test.ts`、`examples/`、文档（`dev-docs/intro.md`、`design.md`、`dev-roadmap.md`）与工具链配置的逐文件审阅，并配合实测命令验证。

> 约定：`[严重度]` 分为 **阻断**（破坏既有契约/数据正确性/CI 红）、**高**（功能缺陷或与设计稿冲突）、**中**（健壮性/性能/可维护性）、**低**（打磨项）。建议优先级见 §12.10。

### 12.0 实测验证状态

**初评**（2026-06-09）：`pnpm run ci` 非全绿（typecheck / lint 红，无 CI 工作流）。

**清偿后验证**（2026-06-09 后续）：`pnpm run ci` **全绿** — **26 文件 / 152 用例**（含 hierarchy、RTL、functionGraph 分段、label 降级等新测）；depcruise **134 模块 / 0 违规**。

| 门禁 | 命令 | 初评 | 清偿后 |
| --- | --- | --- | --- |
| 测试 | `pnpm run test` | ✅ 146 用例 | ✅ **152 用例** |
| 依赖分层 | `pnpm run depcruise` | ✅ 131 模块 | ✅ **134 模块** |
| 构建 | `pnpm run build` | ✅ | ✅ |
| 版本 | — | ✅ `0.2.0` | ✅ |
| 类型 | `pnpm run typecheck` | ❌ TS2300 | ✅ |
| Lint | `pnpm run lint` | ❌ VitePress `.temp` | ✅ |
| 聚合 | `pnpm run ci` | ❌ | ✅ |
| GitHub Actions | `.github/workflows/ci.yml` | ❌ 缺失 | ✅ 已新增 |

**核心结论（初评）**：M7–M12 功能性落地扎实，但门禁债阻塞 DoD。

**核心结论（清偿后）**：P0–P2 所列阻断/高/中项已清偿（见 §12.12）；`MorphAnchor`、布局语义、P3 打磨项仍开放。

### 12.1 总体评价（按里程碑）

- **M7 Scale**：`linearScale / powScale / logScale / timeScale` + `ticks / tickFormat` 形态完整，作为 M8 的数值底座可用；少量边界（log 负域、子刻度 base、time 分辨率）与设计表述有偏差（§12.3）。
- **M8 构件库**：`axesObject / numberLine / numberPlane / polarPlane / complexPlane / functionGraph / parametricGraph / areaUnderCurve / riemannRectangles / tangentLine / matrixObject / tableObject / brace / decimalNumber` 均已落地，几何正确、风格统一（单 stroke 对象）。主要问题是**对默认字体的强隐式耦合**与 `functionGraph` 的**非有限值健壮性**（§12.4）。
- **M9 Morph**：`arc-length / anchor / matching / cross-fade` 四策略 + `group2D` 部件匹配落地，`geometryVersion` 驱动渲染重建的机制清晰。`MorphAnchor` 声明但**全链路未实现**（§12.5）。
- **M10 Text/LaTeX**：`parseSvgPath → placeString → composeGlyphs → textObject/latexObject`、`transformMatchingTex`、`computeGlyphRevealSpans`、`AssetManager`、OpenType、MathJax 管线齐备且质量较高。存在一个**确定性书写方向 Bug（RTL 双重反转）**与 MathJax 变换提取的脆弱点（§12.6）。
- **M11 交互**：`hitProxy / hitTest / draggablePoint / draggableValue / unprojectOrtho` 闭环可用；命中测试**忽略旋转与缩放**（§12.7）。
- **M12 布局/Inspector**：`world-transform`、`LayoutHandle`（`alignTo/nextTo/fitTo/arrange`）、`Inspector` 成形。存在**父子环无检测（可崩溃）**、**seek 信号非确定**、**布局急切提交语义**三处需收口（§12.8）。

源码 TSDoc 普遍标注对应 `design.md` 章节，延续 Phase-1 的「完整文档」水准，符合用户规则。

### 12.2 CI / 工具链门禁现状（最关键）

#### 12.2.1 [阻断] `pnpm run typecheck` 失败：重复 import

`reactive.test.ts` 同时从 `../index`（已 re-export）和 `./tween-signal` 各导入一次 `tweenSignal`，触发 `TS2300: Duplicate identifier 'tweenSignal'`：

```2:6:packages/core/src/reactive/reactive.test.ts
import { circle, createProgram, polygon, tweenSignal, xy } from "../index";
import { buildProgram } from "../program/build";
import { derived } from "./derived";
import { signal, valueTracker } from "./signal";
import { tweenSignal } from "./tween-signal";
```

- **影响**：`tsc -p tsconfig.json --noEmit` 退出码 2 → `pnpm run ci` 第二关即红。Vitest 走 esbuild 不做类型检查，故 146 用例仍能全绿，**掩盖了类型门禁的失败**。
- **修复**（一行）：删除第 6 行（`tweenSignal` 已由 `../index` re-export，见 `reactive/tween-signal.ts:15`）。修复后 `tsc` 预期通过（实测仅此 1 处错误）。

#### 12.2.2 [高] 仓库缺少质量门禁 CI 工作流

`.github/workflows/` 下**只有 `site.yml`**（GitHub Pages 部署，仅执行 `pnpm run build:site`）。没有任何工作流运行 `pnpm run ci`（lint/typecheck/test/depcruise/build）。

- **后果**：§12.2.1 的 typecheck 红在远端**根本不会被拦截**；「CI 全绿」目前只是本地口径，缺少自动化兜底。
- **建议**：新增 `.github/workflows/ci.yml`，在 PR/push 上跑 `pnpm install --frozen-lockfile && pnpm run ci`，使 DoD 可被强制。

#### 12.2.3 [高] `pnpm run lint` 被生成产物淹没

`eslint .` 报 11148 errors，**全部来自 `docs/.vitepress/.temp/**` 下的 VitePress 生成 `.js`**（`no-irregular-whitespace`、未用 `$props/$setup` 等）。实测 `eslint "packages/**/*.{ts,tsx}"` 退出码 0 —— **业务源码与示例零 lint 错**。根因是 ESLint flat config 的 `ignores` 漏掉了 `.temp`（且 ESLint flat config 默认不读 `.gitignore`）：

```8:18:eslint.config.js
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/coverage/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
      "docs/public/demos/**",
      "docs/reference/**",
    ],
```

- 注意 `.prettierignore` 与 `.gitignore` **都**已忽略 `docs/.vitepress/.temp`，唯独此处遗漏 → 配置三者不一致。
- **修复**：在上方 `ignores` 增加 `"docs/.vitepress/.temp/**"`。clean checkout 下 `.temp` 不存在故纯净 CI 可能不复现，但任何「先 `build:site` 再 `lint`」链路（含本地 `pnpm run ci`）必红，应补齐。

### 12.3 M7 — Scale 与刻度（`math/scale.ts`）

- **[低] `logScale` 仅接受严格正域**：`d0 <= 0 || d1 <= 0` 即抛错，与设计稿中提及的「对数/负域支持」表述不一致；对称对数（symlog）类需求无法表达。建议要么实现 symlog，要么在 `design.md §7` 显式收窄为「仅正域」。
- **[低] `logScale` 子刻度细分仅 base 10 生效**：其他底数（如 `base 2`）只产出整数幂主刻度，视觉偏稀。可文档化或按底数生成 minor ticks。
- **[低] `timeScale.tickFormat` 分辨率取自总 span 而非实际 tick 间隔**：当 span 与所选 tick 粒度不一致时，标签格式可能与刻度步长错配。建议从相邻 tick 间隔推导格式分辨率。

### 12.4 M8 — 数理构件库（`constructs/*`、`layout/axes.ts`、`layout/function-graph.ts`）

- **[高] 对默认字体的强隐式耦合**：`axesObject`、`numberLine`、`decimalNumber`、`matrixObject`、`tableObject` 均经 `labelContours → requireDefaultFont()`。若构建期未注册默认字体（M10），这些 **M8 构件会直接抛 `asset-load-error` / `invalid-argument`**，「开箱即用」的轴/数轴不成立。建议：(a) 在 `design.md` 显式声明 M8 标签依赖 M10 默认字体为前置；或 (b) 提供无字体降级（仅刻度线、无文字标签）路径。
- **[中] `functionGraph` 不处理非有限值**：`layout/function-graph.ts` 对 `fn(x)` 结果不过滤 `NaN/Infinity`（如 `1/x` 于 `x=0`、`sqrt` 负值）→ 产出断裂或坏几何。建议跳过非有限采样点并按段分裂折线，与 manim 的 `discontinuities` 行为对齐。
- **[低/视觉] 标签为空心描边字**：`axesObject` / `numberLine` / `matrixObject` / `tableObject` 用 `strokeObject`（`fillable: false`）承载文字，标签呈**空心轮廓**而非实心字，与常见数学动画观感不同。`composeGlyphs` 已支持 per-glyph fill group，但这些构件未走 fill 路径。建议实心化或在设计稿注明此风格选择。
- 其余构件（`numberPlane / polarPlane / complexPlane / brace / parametricGraph / areaUnderCurve / riemannRectangles / tangentLine`）几何逻辑审阅未见正确性问题；`complexPlane` 复用 `numberPlane`、`riemann*` 采样一致，实现干净。

### 12.5 M9 — Morph（`animation/morph.ts`、`animation/track.ts`、`geometry/group.ts`）

- **[中] `MorphAnchor` / `morphAnchors` 声明但未实现**：接口存在于 `object/traits.ts` 与设计稿，但**全链路无产出也无消费**——既无构造 anchor 的 API，morph 编译也不读取。「强制对齐」能力实际缺位。建议要么实现，要么从 `traits.ts`/设计稿移除以免误导。
- **[中] `cross-fade` 复位 opacity 丢失原值**：中点切换 `geometryOverride` 后将 opacity 复位为 `1`，若源/目标对象原 `opacity ≠ 1`，原值被覆盖。建议保存并还原对象真实基线 opacity。
- **[中] `lerpContours` 假设两侧轮廓数一致**：`matching` 策略经 `group2D` 部件配对可缓解，但**裸 morph**（无 part key）在轮廓数不等时行为未定义。另：`MorphableTrait.normalizedContours` 实为 `provider.samplePath` 的**重采样 local 坐标**而非「单位归一」，命名与 design 语义有出入（见 `geometry/provider.ts` 的 `morphableTraitFrom`）。建议改名为 `resampledContours` 或补真正归一。
- `geometryVersion = MORPH_GEOMETRY_VERSION_BASE + round(eased * SPAN)` 驱动渲染层重建网格的机制清晰、可 seek，审阅无误。

### 12.6 M10 — Text / LaTeX 管线（`text/*`、`resource/*`）

- **[高] RTL 书写方向「双重反转」→ 退化为 LTR**：`track.ts` 既对 `order` 取反，又把 `direction:"rtl"` 透传给 `computeGlyphRevealSpans`，而后者内部再次 `reverse()`，两次抵消，**RTL 时序与 LTR 完全一致**。

```332:339:packages/core/src/animation/track.ts
        const direction = spec.stroke?.direction ?? "ltr";
        const order =
          direction === "rtl" ? [...layout.glyphOrder()].reverse() : layout.glyphOrder();
        const temporal = computeGlyphRevealSpans(
          order.length,
          spec.stroke?.glyphOverlap ?? 0,
          direction,
        );
```

```31:39:packages/core/src/text/write-spans.ts
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      spans.push({ start: Math.max(0, 1 - step), end: 1 });
    } else {
      const start = i * step * (1 - clamped);
      spans.push({ start, end: start + step });
    }
  }
  return direction === "rtl" ? [...spans].reverse() : spans;
```

  **推演**：RTL 下 `order = [n-1,…,0]`、`temporal = reverse(spans)`，则 `glyphWriteSpans[order[i]] = temporal[i]` 使**最左字形拿到最早窗口**——即 LTR 行为。**修复**：二者择一去反转（推荐 `computeGlyphRevealSpans` 始终按 `order` 顺序产出 → 传 `"ltr"`；或不反转 `order` 而依赖 spans 反转）。当前 `text.test.ts` **未覆盖 RTL**，请补确定性断言锁定时序。

- **[中] `extractMathJaxPaths` 的 `flipY` 不继承父级**：MathJax SVG 变换提取用启发式解析，`flipY` 累积未正确继承嵌套 `<g>` 的翻转状态。当前用法下可能「碰巧正确」（MathJax y-down 与字体 y-up 抵消），但对更深/更复杂的变换树脆弱。建议改为严格累积父变换矩阵。
- **[低] 死代码导出**：`text/index.ts` 仍导出 `seven-segment`（疑似无引用）。建议删除或标注用途。
- **[低/文档] 错误码缺漏**：`errors.ts` 定义了 `invalid-argument`，但 `design.md §16` 错误码表未收录。补进文档以保持「码表即契约」。

### 12.7 M11 — 交互系统（`interaction/*`、`render-r3f`、`render-three`）

- **[中] 命中测试忽略旋转与缩放**：`hitProxy` / `hitTest` 仅用 `offset`（平移）与 `zIndex`，不消费对象 transform 的 `rotation` / `scale`。被旋转或缩放的可交互对象命中区域不准。若 `design.md §11` 声称支持任意 transform 命中，则为实现偏差；建议在命中前将指针坐标反变换到对象 local 空间，或文档化「仅平移命中」的限制。
- `draggablePoint` / `draggableValue` 经 `InteractiveTrait` + `DragBinding` 绑定信号、对象以信号值居中，闭环正确；`unprojectOrtho` 与 R3F 事件接入审阅无误。

### 12.8 M12 — 布局 + Inspector（`runtime/world-transform.ts`、`scene/*`、`animation/player.ts`、`react/Inspector.tsx`）

- **[高] 父子环无检测 → 可栈溢出**：`Player.resolveWorldTransform` / `resolveWorldOpacity` 与 `Scene2D` 的父链解析均为**递归且无环检测**；`setParent` 亦无输入校验（自父、跨 scene、成环）。一旦误建环 → 无限递归崩溃。建议 `setParent` 增加环检测 + 同 scene 校验 + 禁止自父。
- **[中] seek 信号非确定**：`Player.applyAt` 重置对象到 `initialStates`，但**不重置 signal**。`SignalTrack` 仅当 `start <= time` 才写值，故向后 seek 到 `SignalTrack` 起点之前时，signal 保留上一次正向 seek 的陈旧值，破坏「seek 确定性」（Phase-1 的核心承诺）。建议为受 track 驱动的 signal 记录初值并在 seek 基线重置时回置。
- **[中] 布局急切提交语义张力**：`fitTo` / `alignTo` 在**构建期**急切调用 `setTransform`，使链式 `getBounds` 立即反映新值；但返回的动画仍从注册时捕获的 `initialStates` 插值。若该动画未被 `play`，运行期状态与构建期 transform 不一致；若被 play，则「已提交的新值」又与「从旧值动画」并存。需明确 `LayoutHandle` 是「立即提交布局」还是「返回可动画补间」二选一语义，并在 `design.md §9` 固化。
- `world-transform.ts` 的 `composeTransform2D` / `transformBounds`（含父旋转/缩放/平移）审阅正确；`Inspector` / `SceneView` / `IntermactCanvas` 接线无功能问题。

### 12.9 跨切面与文档一致性

| # | 事项 | 现状 | 建议 |
| --- | --- | --- | --- |
| 1 | `design.md §0.2` 写「141 测试」 | 实测 **146** | 更新数字，或改为「以 CI 实测为准」 |
| 2 | depcruise 模块数（文档历史值）| 实测 **131** | 同步或不再硬编码数字 |
| 3 | 包版本 `0.2.0` | ✅ 4 包一致 | 符合 DoD |
| 4 | `dev-roadmap.md §5.0`「`pnpm run ci` 全绿」 | ❌ 当前 typecheck/lint 红 | 先清偿 §12.2，再保留该 DoD |
| 5 | 示例覆盖 | ✅ scale/math/morph/text/latex/interaction/layout/devtools 均有 demo | 维持「示例即活文档」 |
| 6 | `MorphAnchor`、`invalid-argument` | 声明/实现/文档三者不齐 | 对齐（§12.5、§12.6） |

### 12.10 建议清偿优先级（进入 Phase-3 前）

| 优先级 | 事项 | 类型 | 参考 |
| --- | --- | --- | --- |
| **P0** | 删除 `reactive.test.ts` 重复 `tweenSignal` import，恢复 `typecheck` 绿 | 阻断/CI | §12.2.1 |
| **P0** | `eslint.config.js` 忽略 `docs/.vitepress/.temp/**`，恢复 `lint` 绿 | 阻断/CI | §12.2.3 |
| **P0** | 新增 `ci.yml` 工作流跑 `pnpm run ci`，强制门禁 | 治理 | §12.2.2 |
| **P1** | `setParent` 环检测 + 同 scene/自父校验（防崩溃）| 健壮性 | §12.8 |
| **P1** | RTL 书写双重反转修复 + 补 RTL 确定性测试 | 正确性 | §12.6 |
| **P1** | M8 默认字体耦合：声明前置或提供无字体降级 | 可用性 | §12.4 |
| **P1** | `functionGraph` 非有限值分段处理 | 健壮性 | §12.4 |
| **P2** | seek 时 signal 基线回置（确定性）| 正确性 | §12.8 |
| **P2** | 命中测试纳入 rotation/scale，或文档化限制 | 功能/文档 | §12.7 |
| **P2** | `MorphAnchor` 实现或移除；`cross-fade` opacity 还原 | 一致性 | §12.5 |
| **P2** | `LayoutHandle` 立即提交 vs 动画语义固化 | 设计 | §12.8 |
| **P3** | logScale 负域/子刻度、timeScale 分辨率、空心标签、`seven-segment` 死代码、MathJax flipY、文档数字/错误码 | 打磨/文档 | §12.3–§12.9 |

### 12.11 验证命令与关键触点

```bash
# 当前实测：test / depcruise / build 绿；typecheck / lint 红（详见 §12.0）
pnpm run test         # 23 文件 / 146 用例 ✅
pnpm run depcruise    # 131 模块 / 0 违规 ✅
pnpm run build        # 4 包 ESM+DTS ✅
pnpm run typecheck    # ❌ TS2300（reactive.test.ts 重复 import）
pnpm run lint         # ❌ 仅 docs/.vitepress/.temp 生成产物；源码零错
pnpm dev:examples     # 目视：scale/* math/* morph/* text/* latex/* interaction/* layout/* devtools/*
```

| 区域 | 文件 / 符号（便于定位）|
| --- | --- |
| CI 门禁 | `reactive.test.ts:6`、`eslint.config.js:8-18`、`.github/workflows/`（缺 `ci.yml`）|
| M7 Scale | `math/scale.ts`（`logScale` / `timeScale.tickFormat`）|
| M8 构件 | `constructs/*`、`layout/axes.ts`、`layout/function-graph.ts`、`text/text-layout.ts`（`labelContours`）、`text/font-registry.ts`（`requireDefaultFont`）|
| M9 Morph | `animation/morph.ts`、`animation/track.ts`、`geometry/group.ts`、`object/traits.ts`（`MorphAnchor`）、`geometry/provider.ts`（`morphableTraitFrom`）|
| M10 Text/LaTeX | `animation/track.ts:332`、`text/write-spans.ts:39`、`text/mathjax-latex.ts`（`extractMathJaxPaths`）、`text/index.ts`（`seven-segment`）|
| M11 交互 | `interaction/hit-test.ts`、`interaction/draggable.ts`、`render-r3f` 事件接线 |
| M12 布局/Inspector | `animation/player.ts`（`resolveWorldTransform` / `applyAt`）、`scene/scene.ts`（`setParent`）、`scene/layout.ts`（`fitTo` / `alignTo`）、`react/components/Inspector.tsx` |

### 12.12 清偿记录（2026-06-09 后续）

| 优先级 | 事项 | 状态 | 主要触点 |
| --- | --- | --- | --- |
| P0 | 重复 `tweenSignal` import | **✅** | `reactive.test.ts` |
| P0 | ESLint 忽略 `docs/.vitepress/.temp/**` | **✅** | `eslint.config.js` |
| P0 | 新增 `ci.yml` | **✅** | `.github/workflows/ci.yml` |
| P1 | `setParent` 环检测 + 自父/未注册校验 | **✅** | `scene/scene.ts`、`scene-hierarchy.test.ts` |
| P1 | RTL 双重反转 + 测试 | **✅** | `track.ts`（移除 order 反转）、`text.test.ts` |
| P1 | M8 无字体降级（空 label contours） | **✅** | `font-registry.ts`（`getDefaultFontId`）、`text-layout.ts`、`label-fallback.test.ts` |
| P1 | `functionGraph` 非有限值分段 | **✅** | `layout/function-graph.ts`、`function-graph.test.ts` |
| P2 | seek 时 signal 基线回置 | **✅** | `reactive/engine.ts`（`resetSignalsToInitial`）、`player.ts`、`reactive.test.ts` |
| P2 | 命中测试纳入 rotation/scale | **✅** | `world-transform.ts`（`worldPointToLocal`）、`hit-test.ts`、`render-r3f/interaction.ts` |
| P2 | `cross-fade` opacity 按源/目标基线插值 | **✅** | `track.ts`（`fromOpacity` / `toOpacity`） |
| P2 | `MorphAnchor` 实现或移除 | **⏳ 推迟 M9 增量** | 见 `dev-roadmap.md` §5.1 |
| P2 | `LayoutHandle` 立即提交 vs 动画语义 | **⏳ 待 §9 固化** | 见 `dev-roadmap.md` §5.1 |
| P3 | log 负域、time 分辨率、空心标签、MathJax flipY 等 | **部分 ✅** | 其余见 `dev-roadmap.md` §5.1 |

**Player 父链环检测（防御性）**：`resolveWorldTransform` / `resolveWorldOpacity` 在检测到环时返回安全默认值，与 `setParent` 校验形成双保险。
