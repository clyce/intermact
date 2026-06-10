# Intermact 架构设计

Intermact 是一个基于 React Three Fiber 的交互式数理可视化平台。它以"可交互的 Manim 替代品"为起点，最终目标是成为一套**面向数理可视化的 PCG（程序化内容生成）演示与交互系统**：同一份程序既能像 Manim 那样编排叙事动画，又能实时调参、被观众拖拽探索、嵌入网页与讲义，并把训练/仿真等实验过程与渲染彻底解耦。

本文档描述推荐的架构、接口与示例。所有接口均为设计稿，命名与包路径可在实现阶段调整。

## 0. 修订记录

- **v0.1**：基于 `intro.md` 的初稿。建立对象系统、Scene/Camera/Canvas 解耦、动画（Create/Morph/Tween）、R3F 适配与示例的雏形。
- **v0.2（本次评审）**：在 v0.1 基础上完成系统性架构与方法论评审，主要变更：
  1. 引入**保留模（retained-mode）可 seek 时间线**作为核心执行模型，把"声明式描述"与"实时播放"分离（先例：Motion Canvas `PlaybackManager.seek`、Remotion 的确定性帧模型）。`await scene.play(...)` 降级为构建期的人体工学外壳。
  2. 新增**响应式依赖层**（Signal / Tracker / derived / updater），对齐 Manim 的 `ValueTracker` + `add_updater` + `always_redraw`，作为"交互态"几何重算的统一机制。
  3. 新增**程序化与生成式内容（PCG）核心层**：场/采样器、参数化生成器、递归/语法生成（L-system、fractal、graph、CA）、数据驱动生成、组合算子、可重放的种子化随机。
  4. 新增**数理可视化构件层**：Scale（linear/log/pow/time）、NumberLine/Axes/NumberPlane/PolarPlane/ComplexPlane、FunctionGraph/ParametricCurve/VectorField/Riemann、Matrix/Table/Brace/DecimalNumber。
  5. 深化**渲染管线**（线宽单位策略、stroke trim、三角化、z-order/透明、DPI）、**文本/LaTeX 管线**（KaTeX→SVG→mesh/SDF、writing、`TransformMatchingTex` 分部匹配 Morph）、**资源与异步生命周期**（asset manager + prepare 阶段）。
  6. 深化**交互系统**（细线命中测试、场景坐标反投影拖拽、可拖拽控制点）与**导出/嵌入/可访问性**（storyboard 序列化与分享、响应式布局、语义层、reduced-motion）。
  7. 方法论升级：动画"数据即效果 + 解释器"、不可变 patch 数据流、trait 组合、typed-array 性能通道、注册表式插件化、契约式类型与校验、确定性快照测试。

> 后续新增功能/改动请直接并入本文件与"修订记录"，不要为单个功能新建独立 md。

### 0.1 实现进度日志（Phase-1 / v0.1）

记录各里程碑落地时的实际实现与本设计的对齐情况及微小决策（`dev-roadmap.md §7` 要求"每里程碑同步 design.md"）。仅记录与设计稿的偏差/具体化选择，架构契约仍以上文各章为准。

- **M0 · 工程基座**（已完成）：
  - 包边界落地为 `packages/{core,render-three,render-r3f,react}` + `examples`（对齐 §3.4）；`serialize/` 推迟到 M15 再建包。
  - 工具链：库用 `tsup`（ESM-only + dts），示例用单个 Vite 应用 + demo registry（`examples/src/registry.tsx`），而非每示例独立包；跨包类型走 `tsconfig` `paths` 指向源码，构建按 pnpm 拓扑序产出 `dist`。
  - 质量闸口：`pnpm run ci` = `lint`(eslint+prettier) + `typecheck`(tsc) + `test`(vitest) + `depcruise` + `build`。项目未初始化 git，以本地 `ci` 充当 CI 闸口。
  - §3.1 依赖规则由 `dependency-cruiser` 强制（`.dependency-cruiser.cjs`），并已验证可阻断 `core → react/three` 的违规 import。
  - M0 示例：`_template/empty-canvas`、`_smoke/static-circle`（直接用 three 几何渲染，不依赖时间线，作为冒烟）。
- **M1 · 核心模型 / 时间线 / Player**（已完成）：
  - 对象模型按 §4 落地：`IMObject2D`、trait 联合（`Stroke/Fill/Morphable/...`）+ `findTrait` 能力查询（组合优先）、`RuntimeState2D` + 不可变 `applyPatch2D` + `RuntimeStateStore`（结构共享）。
  - 时间线按 §3.2/§11 落地：`AnimationSpec` 联合、`StoryboardBuilder`（构建期累积 + 按 (target, property) 投影解析 tween `from`，使每条 Track 自包含）、纯函数 `Track.evaluate(localProgress)`、`Storyboard`（tracks/effects/markers）。`compileSpec` 处理 tween/fade/wait/sequence/parallel/stagger/repeat(有限)/call；`create/morph` 抛 `unsupported-animation`（留待 M4/M9）。
  - `Player` 提供 `play/pause/seek/setRate/setLoop/jumpToMarker/subscribe`，确定性 seek（重置基线 + 按 start 序应用所有 `start<=t` 的 Track）；负速率反向天然可用（Track 为进度纯函数）。
  - **与 §3.2 接口的偏差**：为保持 core 无框架依赖，Player 新增 `update(deltaSeconds)` 作为外部时钟驱动钩子（浏览器侧由 R3F 的 RAF 循环调用），并暴露 `getSnapshot()`；连续播放不在 core 内使用 `requestAnimationFrame`。
  - **里程碑边界微调**：`moveTo/rotateTo/scaleTo/fadeTo`（纯 tween 包装）在 M1 先行落地以支撑时间线示例；`Create`（描边/填充 reveal、play 前不显示）、`stagger/call` 语义细化、easing 画廊与 `fadeIn/fadeOut` 仍按计划在 M4 完善。
  - `call` 为不可 seek 边界（§11.5）：拖拽 seek 不触发，仅正向 `update` 播放触发；已有测试覆盖。
  - 种子化 RNG（§6.7）最小实现 `createRng`（mulberry32 + `fork`），完整 PCG 在 M13。
  - M1 示例：`timeline/seek-basics`、`timeline/markers-slides`（`IntermactCanvas`）、`timeline/headless-eval`（无头 Node 求值）。确定性数值断言测试已纳入 `pnpm run test`/`ci`。
- **M2 · 2D 几何与采样**（已完成）：
  - 按 §5 落地 8 类图元工厂：`circle/ellipse/rectangle(含圆角)/arc/polygon(含洞)/bezierCurve(二次/三次链)/line/arrow`，均产出不可变 `IMObject2D` + 组合 trait（`stroke`，闭合形加 `fill`/`morphable`）。
  - 几何内核：`resampleByArcLength`（弧长均匀重采样）、`cumulativeLengths`（前缀和，含闭合段）、`SampledPath2D`/`SampledContour2D`（`Float32Array` 缓冲通道）、`pointsToTuples`（作者层元组通道）、`earcut` 三角化（`triangulate`，首轮廓为外环、其余为洞）、`computeBounds`（AABB）。
  - `GeometryProvider2D` 由 `createGeometryProvider2D` 统一构建：`samplePath(opts)` 支持按 `samples` 弧长重采样、`getBounds`、`sampleBuffer` 缓冲通道；trait 经 `strokeTraitFrom/fillTraitFrom/morphableTraitFrom` 组合。
  - 单测覆盖：采样点数、弧长（圆周长≈2πr）、bounds、带洞三角化面积（外−洞）、缓冲/元组通道一致性。
  - M2 示例：`geometry/primitives-gallery`、`geometry/sampling-debug`（`IntermactCanvas` + `geometryPreviewProgram` 辅助；采样/bounds/三角网叠加亦走 R3F）。
- **M3 · R3F 渲染适配**（已完成）：
  - `render-three`（无 React）：`buildStrokeGeometry`（世界单位 ribbon + 按弧长 trim 实现描边 reveal）、`buildFillGeometry`（earcut→索引几何）、`makeBasicMaterial`（unlit + transparent + `depthWrite=false`，2D 画家算法）、`parseColor`（解析 rgba/hsla alpha）、`ThreeObjectView`/`ThreeSceneView`（按 id 增量 diff 快照 → three 场景图，仅变化项重建几何）、`SceneRendererAdapter` 接口（§15.1，R3F 路径由 SceneView 履行）。
  - `render-r3f`：`computeFit`（contain/cover/stretch 正交相机适配 + worldPerPixel）、`SceneView`（R3F 内组件：托管 `ThreeSceneView`，`useFrame` 驱动 Player 并 diff 更新，resize/DPI 由 R3F 处理，相机随域重拟合）。
  - `react`：`IntermactCanvas`（构建程序 + R3F `<Canvas orthographic>` + 背景色 + 时间线控件叠层）、`useIntermactPlayer` hook、`TimelineControls`（DOM 叠层：scrub/播放/速率/反向/loop）。
  - **px 线宽**：以视口 `worldPerPixel` 换算为世界单位 ribbon 近似恒定屏幕宽度；独立的屏幕空间描边 shader 推迟（后续里程碑）。
  - **健壮性**：`SceneView` 对 `useFrame` 的 delta 做 `min(delta,0.05)` 截断，避免标签页后台恢复时的大 delta 跳帧。
  - **构建**：库包 tsconfig 覆盖 `paths:{}`，使 tsup 的 dts 生成经 node 解析到各依赖包的 `dist/*.d.ts`（按 pnpm 拓扑序），根 tsconfig 仍用 `paths` 指向源码做开发期类型检查。
  - 浏览器验证：stroke/fill、**nonzero + 带洞（ring/holes）** 三角化、描边 trim reveal（t=0 未绘制、随 seek 平滑画出）、z 序 + 半透明合成、非方形容器下圆形不失真（相机 contain 适配）、px 细线清晰；smoke 测试（geometry builders + `ThreeSceneView` 增删改）通过。**自相交 even-odd 填充**（如五角星/笔画交叉）推迟至 M9/M16。
  - M3 示例：`render/stroke-fill-showcase`、`render/zorder-transparency`、`render/dpi-resize`（均用真实 `IntermactCanvas`）。
- **M4 · 基础动画（数据 + 解释器）**（已完成）：
  - `compileSpec` 现支持 `create`（描边 reveal + 填充 after-stroke-fade）、`fade`、`tween-signal`；`RegisteredObject2D` 提供 `create/fadeIn/fadeOut/moveTo/rotateTo/scaleTo/fadeTo/tween`。
  - 编排：`sequence/parallel/stagger/wait/call`（`call` 为不可 seek 边界，scrub 时告警一次）。
  - **arc-length morph（L1 兜底）**：`morph(source, target, { strategy: "arc-length" })` 在 v0.1 落地（完整 matching 仍属 M9）；编译期对齐轮廓、运行时经 `geometryOverride` 插值，渲染器优先采样 override。
  - M4 示例：`anim/create-fade-move`、`anim/sequence-parallel-stagger`、`anim/easing-gallery`。
- **M5 · 坐标系与轴**（已完成，API 修订见下）：
  - `CoordinateTransform2D`：`absToRel/relToAbs/toPolar/fromPolar`（§7.2）；`Scene2D.coordinate` 只读访问。
  - **API 修订（v0.1.1）**：移除 `Scene.showAxes/hideAxes/registerAxes`；改为 `Scene.getAxes(props) -> RegisteredAxes2D`。`props` 仅描述轴对象自身（数据域、样式、刻度/标签开关）；显隐与运动走 RegisteredObject 标准动画（`fadeIn`/`create`/…），与 intro 中「对象注册 + 动画句柄」模型一致。
  - `AxesHandle.c2p/p2c` 挂在返回的 `RegisteredAxes2D.handle` 上。
  - 最小数理构件（支撑 L1 §19.2，完整 Scale/刻度属 M7）：`axesObject`、`functionGraph`、`decimalNumber`（7-segment 笔画，`registerReactive` 驱动）。
  - 新增 `polyline` 图元工厂；M5 示例：`coords/cartesian-axes`、`coords/fit-strategies`、`coords/polar-scene`。
- **渲染/几何修订（v0.1.1）**：
  - **Arrow**：主轴止于箭头底边中心；箭头为底边垂直于主轴且被主轴平分的实心等腰三角形（`fill` + `stroke`）。**修订（v0.1.2）**：`fill` trait 仅采样**闭合**轮廓（箭头仅三角头部参与 earcut；开放 shaft 仅描边）；`SvgGeometry` 同步改用 `fill.contours()`，避免把 shaft 与 head 拼成错误填充。
  - **Stroke trim**：闭合轮廓的弧长计量包含「末点→首点」闭合段；`revealEnd→1` 时不再瞬间跳满（修复开放/闭合图元节点数与线段数差异带来的进度偏差）。
- **M6 · 响应式最小集**（已完成）：
  - `signal/computed/valueTracker`、`derived`、`ReactiveEngine`（依赖版本 + 最小重算）、`addUpdater`、`tweenSignal`（seekable `SignalTrack`）、`bindSignal`。
  - 构建期通过 `ctx.signal` / `ctx.valueTracker` 创建并注册信号（无进程级全局 registrar）；每帧 `Player.prepareFrame` → `ReactiveEngine.flush` 在快照前重算 derived/运行 updater。
  - `@intermact/react`：`useSignal` hook。
  - M6 示例：`reactive/value-tracker`（§8.2 双曲线内接矩形）、`reactive/leva-binding`（§19.2 精简）。
- **◆ L1 · v0.1 验收**（已完成）：
  - `pnpm run ci` 全绿（lint + typecheck + 67 项 vitest + depcruise + build）；时间线**确定性数值断言**测试保留在 CI。
  - 可运行示例：`l1/basic-2d`（§19.1：Create/轴/arc-length morph/seek）、`l1/interactive-sine`（§19.2：Leva→Signal→derived 曲线实时重算）。
  - **与 §19.2 的微小偏差**：`decimalNumber` 在示例中用 `xy` 世界坐标定位（非 `uv` HUD 贴边）；完整视口级 UV 布局在 Canvas/HUD 里程碑细化。
- **文档站（VitePress + TypeDoc）**（2026-06-06，API Reference 2026-06-07）：
  - 选型 **VitePress**（指南/示例索引）+ **TypeDoc**（`typedoc-plugin-markdown` + `typedoc-vitepress-theme`，从 `packages/*/src` 导出符号与 TSDoc 生成 `docs/reference/`）。站点位于 `docs/`，workspace 包 `@intermact/docs`。
  - 命令：`pnpm run gen:reference`（仅生成 API）、`pnpm run dev:docs`（先 gen 再 VitePress 开发）、`pnpm run build:docs`（静态构建至 `docs/.vitepress/dist`）。**统一站点**（2026-06）：`examples` 构建产物嵌入 `docs/public/demos/`，与 VitePress 同域提供 `/demos/` 交互画廊；`pnpm run dev:site`（文档 `:5174` + 代理）、`pnpm run build:site` / `preview:site`（生产预览）。编排脚本在根目录 `scripts/`：`site-config.mjs`（`SITE_BASE` / `DEMOS_BASE`）、`dev-site.mjs`、`build-site.mjs`（build → embed → vitepress build → verify）、`embed-examples.mjs`、`verify-site-dist.mjs`；GitHub Pages 见 `.github/workflows/site.yml`（`SITE_BASE=/<repo>/`）。示例源码仍留在 `examples/`，不合并 `package.json`。
  - Phase-1 覆盖：指南（概念与用法）、**API Reference**（符号页由 TypeDoc 自动生成；总览架构说明见 `docs/reference-index.src.md`，经 `merge-reference-index.mjs` 并入 `/reference/`）、monorepo 包分层说明、示例索引、`v01-checklist`；架构契约仍以本文件与 `dev-roadmap.md` 为准。

### 0.2 实现进度日志（Phase-2 / v0.2）

记录 Phase-2（数理工具箱）各里程碑落地时与本设计的对齐情况及具体化选择。仅记录偏差/具体化，架构契约以上文各章为准。

- **M7 · Scale 与刻度**（已完成）：
  - 按 §7.3 落地 `Scale<TDomain,TRange>`（可调用 + `invert`/`ticks`/`tickFormat`/`domain`/`range`）及四类实现 `linearScale`/`powScale`/`logScale`/`timeScale`，位于 `packages/core/src/math/scale.ts`。
  - 刻度用 D3「nice number」算法（步长恒为 `1/2/5×10^k`）；导出 `numericTicks`/`tickStep`/`timeTicks` 供 M8 轴刻度复用。`logScale` 域须严格为正、刻度落在 `base` 幂上（小跨度补 1–9 细分）；`timeScale` 刻度按 UTC 日历对齐（秒~年间隔表）。
  - **偏差**：`tickFormat` 的 `spec` 仅支持最小子集（`"%"` 百分比、`".<n>f"` 定点），完整 D3 format mini-language 未实现，按需后续扩展。
  - M7 示例：`scale/scale-playground`（四类标度刻度分布对照 + `tickFormat`）、`scale/log-plot`（`2^x` 对数轴呈直线）。`scale.test.ts` 12 项确定性数值断言纳入 `pnpm run test`。

- **M8 · 数理构件库**（已完成）：
  - 按 §7.4 落地坐标系构件（`numberLine`/`numberPlane`/`polarPlane`/`complexPlane`）、依附构件（`functionGraph` 在 `layout/`，`parametricGraph`/`areaUnderCurve`/`riemannRectangles`/`tangentLine` 在 `constructs/graphs.ts`）、表达标注（`matrixObject`/`tableObject`/`brace`），并复用 M6 的 `decimalNumber`。
  - `axesObject` 基于 §7.3 `Scale` 重写：刻度位置/数字标签由 `linearScale`/`logScale`/`powScale` 生成；`AxesHandle` 新增 `xScale`/`yScale`，依附构件与轴共享标度。导出 `riemannSum`/`slopeAt` 数值工具供读数与测试。
  - **具体化/偏差**：① 构件置于**新建** `packages/core/src/constructs/`（非 §3.3 目录树中的 `math/constructs/`），以避免 `constructs→math/geometry` 与既有反向依赖形成环——depcruise 校验通过（98 模块 0 违规）；② `brace(target, direction, opts)` 形参改为 `Bounds2D | IMObject2D`（读取几何 bounds），不再依赖 `RegisteredObject2D`，保持 core/constructs 与 scene 层解耦；③ 数字标签/矩阵/表格条目沿用 §13 之前的 7-段笔画字形（抽到 `text/seven-segment.ts` 复用），真实字体/LaTeX 在 M10 升级——里程碑边界，非降级；④ Matrix/Table 内部计算列宽/行高并产出单个 `IMObject2D`（与 `axesObject` 同模式）。
  - M8 示例：`math/axes-functiongraph`、`math/riemann-sum`、`math/tangent-derivative`、`math/matrix-table-brace`、`math/planes`。`constructs.test.ts` 14 项（c2p 贴合/反投影、Riemann 收敛、切线斜率、planes 线数、matrix/table/brace bounds）纳入 `pnpm run test`。

- **M9 · Morph（含分部匹配）**（已完成）：
  - 按 §11.4 在 `animation/morph.ts` + `animation/track.ts` 落地四类策略：`arc-length`（逐点）、`anchor`（闭合轮廓最优循环旋转 / 开放轮廓择方向，降低扭转）、`matching`（分部 transformer/remover/introducer）、`cross-fade`（溶解）。轮廓数不同按长度降序配对 + 零长度（质心塌缩）轮廓补齐。
  - 按 §5.3 在 `geometry/group.ts` 落地 `group2D`（聚合子对象几何为单个可渲染对象，同时保留 `parts` 部件 key）；`ObjectPart2D` 加到 `object/types.ts`。新增 `transformMatching` 及 `RegisteredObject2D.morphTo`/`transformMatchingTo`，`MorphOptions.matchBy` 入 spec。
  - **具体化/偏差**：① 渲染层无逐部件透明度通道，故 matching 的 remover/introducer 用**几何塌缩/生长**实现 fade，`cross-fade` 在单个注册对象上是**溶解**（顺序淡出→换几何→淡入）——真正的叠加交叉淡入需两个对象各自 fade；均为单对象架构下的等价实现，非降级。② `group2D` 放在 `geometry/`（既有 geometry→object 方向）以避免 object→geometry 依赖环；depcruise 通过（100 模块 0 违规）。③ 沿用 v0.1 的 geometryOverride 模型，morph 完成时不 `replaceObject`，链式 morph 的 `from` 仍取原定义，示例以单次 morph + 时间线拖拽呈现（§22.1 的"Morph 替换定义"留待序列化/播放器增强）。
  - M9 示例：`morph/shape-morph`、`morph/contour-mismatch`、`morph/matching-shapes`。`morph-strategies.test.ts` 8 项（含 property-based 40 组随机形状）纳入 `pnpm run test`。

- **M10 · Text / LaTeX 管线**（已完成）：
  - 按 §13 落地完整管线：`text/svg-path.ts` 的 `parseSvgPath`（M/L/H/V/C/S/Q/T/A/Z，曲线经共享采样器展平为 contour）是字体/`AssetManager.svg`/未来 MathJax 提供器共享的入口；`text/text-layout.ts` 提供 `placeString`/`composeGlyphs`/`textObject`，每个字形为一个 `ObjectPart2D`（key 默认 `char@index`），整体带 `TextLayoutTrait`（`tokens()`）；`text/latex.ts` 的 `latexObject` 实现 LaTeX 子集（原子/运算符/`^`/`_`/`{}`/`\times`/`\cdot`），token 以值为 key；`text/transform-tex.ts` 的 `transformMatchingTex` 复用 M9 matching；writing 经 `RegisteredObject2D.write()`（描边 reveal，复用 Create）。
  - 按 §14 落地资源/prepare：`resource/asset-manager.ts` 的 `AssetManager`（`font/latex/svg/data/preload`）在 `program/build.ts` 经 `ctx.assets` 暴露，program 构建期 `await` 后再产出 Player，保证播放期无未决异步、可 seek。新增 `TextLayoutTrait`/`TextToken` 到 `object/traits.ts`。
  - **具体化/偏差**：① 引擎采用**内置笔画矢量字体（字形以 SVG `d` 编写，经 `parseSvgPath` 解析）+ LaTeX 子集排版**，而非 §13 所列 KaTeX/MathJax→SVG + troika MSDF——目的是保持 `@intermact/core` 无重依赖且完全确定；trait/部件 key 契约与设计稿一致，把 MathJax 的 SVG 交给 `parseSvgPath`+`composeGlyphs`（相同 token key）即可无缝替换为真实引擎，属里程碑边界下的等价实现，非降级。② 字体覆盖大写+数字+常用符号，小写以 small-caps（缩放大写）呈现。③ 文本经既有 stroke/fill 渲染，矢量字形天然分辨率无关（`text/font-scale` 示例），troika MSDF 文本视图列为后续增强。④ `svg`/`data` 接受内联字符串（core 无 DOM/fetch），URL 需宿主传入 `fetcher`，否则抛 `asset-load-error`。⑤ 顺带把 M8 的轴/矩阵/表格/`decimalNumber` 标签从 7-段字形升级到内置笔画字体（`labelContours`/`glyphText`），`text/seven-segment.ts` 保留为后备。depcruise 通过（108 模块 0 违规）。
  - M10 示例：`text/writing`、`latex/transform-matching-tex`、`text/font-scale`。`text.test.ts` 11 项纳入 `pnpm run test`。
- **M11 · 交互系统**（已完成）：
  - 按 §12 在 `interaction/` 落地 core 交互层：`types.ts` 定义 `IntermactPointerEvent`/`IntermactDragEvent`（screen/sceneAbs/sceneRel 三套坐标）、`PointerEventBinding`、`DragBinding` 与 `PickProxy`（`disc`/`rect`/`band`）；`hit-test.ts` 提供解析命中（`pointInDisc`/`pointInRect`/`distanceToPolyline`/`hitProxy`/`hitTest` 按 zIndex）与 `pickBandFromObject`/`pickRectFromObject`；`object/traits.ts` 的 `InteractiveTrait` 扩展 `pick`/`binding`/`drag`/`cursor`。
  - 按 §12.3 在 `draggable.ts` 落地 `draggablePoint(Source)`/`draggableValue(Source)`（拖拽写 `Signal`，几何以信号当前值居中，经 M6 derived 重算）+ 函数式 `interactive(obj, {pick,binding})`（供 `derived` 构建复用）；`scene/registered-object.ts` 增 `on(binding, pick)`，经 `DefinitionHost`（scene）回写对象定义。
  - 按 §12.2 在 `render-r3f/interaction.ts` 提供纯函数正交反投影 `unprojectOrtho`/`projectOrtho` + `collectHitEntries`/`interactiveTraitOf`；`SceneView.tsx` 加 `interactive` prop，于 `gl.domElement` 监听 pointerdown/move/up，用 `Vector3.unproject` 反投影 + core `hitTest` 分发 binding/drag 并管理 cursor；`react/IntermactCanvas.tsx` 加 `keyboard`（空格 play/pause、方向键逐帧/±1s、Home/End 跳首尾）。
  - **具体化/偏差**：① 命中用**场景空间解析求交**（pick 代理 + 指针 `unproject`）替代 §12.1 的"不可见 pick mesh + WebGL raycast line threshold"——2D 正交下结果等价，且确定/可无头测试、无 raycast 细线精度问题，属等价实现非降级。② 拖拽手柄几何以信号值为中心，须用 `registerReactive`/`*Source` 注册以随信号移动；`on()` 用于静态对象、`interactive()` 用于响应式构建（后者每帧重建会覆盖 `on()` 附加的 trait，故二者分工）。③ depcruise 通过（115 模块 0 违规）。
  - M11 示例：`interaction/draggable-bezier`、`interaction/hit-testing`、`interaction/explorable-derivative`。`interaction.test.ts`（core 6 + render-r3f 3）纳入 `pnpm run test`。
- **M12 · 布局 + Inspector**（已完成）：
  - 按 §9.3 在 `runtime/world-transform.ts` 落地 world-transform 代数（`composeTransform2D`/`transformBounds`/`resolveTransform2D`/`worldDeltaToLocal`，纯函数、无 scene/animation 依赖）；`scene.setParent(child, parent)` 维护父链，`Player.getSnapshot` 在快照阶段沿父链 TRS 合成 world transform 并将透明度沿链相乘后写回 `RuntimeState.transform`（渲染适配器无需改动）。
  - 按 §9.4 在 `scene/layout.ts` 落地 `LayoutHandle`（`getBounds`/`alignTo`/`nextTo`/`fitTo`/`arrange`），挂到 `RegisteredObject2D.layout`（`Scene.register` 注入，避免 scene↔handle 依赖环用 `LayoutHost`/`LayoutSelf` 接口解耦）；方法基于世界 bounds 计算、即时回写授权 transform 以支持链式布局，并返回 Animation 句柄。
  - 按 §16 在 `react/Inspector.tsx` 落地 DOM 检视器：registry + 每对象世界 position/scale/opacity/zIndex/可见性、活跃 Track 数、`ReactiveEngine.inspect()` 的 signals/derived（含依赖）/updaters、SVG bounds 叠层与行点选高亮；`IntermactCanvas` 加 `controls.inspector`。
  - **具体化/偏差**：① LayoutHandle 即时回写授权 transform（便于同一构建内链式布局）+ 返回可 `play`/`commit` 的 Animation，与 §9.4 "方法返回动画句柄" 一致；② world 合成放在 Player 快照阶段而非渲染层（保持 `RenderSnapshot` 为唯一渲染输入），`anchor` 仅用于 `alignTo` 对齐语义、渲染轴心仍为局部原点；③ Inspector bounds 投影默认按 `contain` fit 复算（`fit` prop 可覆盖），仅支持单一 fit 模式；④ `fitTo` 为等比缩放（保宽高比）。depcruise 通过（119 模块 0 违规）。
  - M12 示例：`layout/next-to-arrange`、`layout/responsive-rect`、`devtools/inspector-tour`。`layout.test.ts` 11 项纳入 `pnpm run test`。

- **Phase-2 验收后缺陷修复 / 打磨**（2026-06-08，示例联调发现）：
  - **Examples 卡在 "Building…"**（Reactive/Math/Interaction/Inspector/L1 等依赖响应式的示例）：根因是示例 dev server 同时把 `@intermact/core` 经 `vite-tsconfig-paths` 解析到 `src`、又经 `node_modules` 解析到 `dist`，**双实例**使 `signal.ts` 的模块级 `WeakMap`（signal 注册表）不互通，构建期抛 `Unknown signal instance` 而静默失败。修复：`examples/vite.config.ts` 增 `resolve.alias` 把所有 `@intermact/*` 强制指向各自 `src` 单一实例；`react/useIntermactPlayer.ts` 对 `buildProgram` 失败 `.catch` 并 `console.error`（不再静默停在 Building）。属构建工具配置缺陷，非架构问题。
  - **Morph 无动画**：`render-three/object-view.ts` 仅在 `geometryVersion` 变化时重建几何，而 morph 每帧只改 `geometryOverride`、不动版本号 → 渲染器只建首帧。修复：`animation/track.ts` 在 morph 的 `StatePatch` 写入**随进度变化的** `geometryVersion`（`arc-length`/`anchor`：`BASE + round(eased×SPAN)`；`cross-fade`：前/后半各一离散版本以触发换几何），动画结束即稳定。`group2D` 须显式顶层 `style` 才渲染（`morph/matching-shapes` 黑屏即缺顶层样式）。新增 `examples/src/lib/Caption.tsx` 为各 morph/text demo 叠加"该动画在演示什么"的说明。
  - **Text/LaTeX 笔触细且粗细不一** → 改为 §13 的**常量笔宽轮廓字形**：新增 `geometry/stroke-outline.ts` 的 `strokeContoursToOutline`（中线骨架→等宽闭合轮廓：miter 连接含 `MITER_LIMIT` 回退 + 圆头端帽；开放子路径成"跑道"环，闭合子路径产外环 + 内环洞且**按 winding 自适应外扩方向**，故 `O` 等字怀挖空正确）。`text/text-layout.ts`、`text/latex.ts` 增 `GlyphStyleProps`（`weight`/`fill`/`stroke`/`strokeWidth`）+ `resolveGlyphStyle`，支持**实心 / 空心 / 描边+填充**三态且勾线色与填充色可分离。重写 `geometry/triangulate.ts`：earcut 现按 `signedArea` 区分实心（CCW）/洞（CW）、用 point-in-polygon 将洞归属到最小包含实心，**逐个不相连实心独立三角化再合并**（修复多字形/带洞字形填充溢出）。`render-three/stroke.ts` 的 `appendRibbon` 加 miter join + 圆头帽，使所有 ribbon 描边（含 M8 标签）等宽。
  - 回归：全量 `pnpm run test` **132 项**全绿（含新增 `geometry/stroke-outline` 经由 `text`/`triangulate` 覆盖、`scene-view` 端帽顶点数断言更新）。
- **Text/LaTeX 长期路径落地**（2026-06-08，§13 生产引擎接入）：
  - **自定义 OpenType 字体**：`opentype.js` 解析 TTF/OTF/WOFF → `parseSvgPath` → 填充轮廓；`text/font-registry.ts` + `text/opentype-font.ts` 注册表；`AssetManager.font(src)` 经 `fetchBinary` 加载并注册，`textObject({ font })` / `placeString({ font })` 选用。轮廓字体跳过 `strokeContoursToOutline`（`weight: 0`），消除骨架字体在极尖处（如 V 底端）的轻微尖角伪影。
  - **MathJax 3 LaTeX**：`text/mathjax-latex.ts` 用 `mathjax-full` lite adaptor 将 TeX 排为 SVG，提取 `<path d>` + `translate` 变换后经 `parseSvgPath` + `composeGlyphs`；`ctx.assets.latex(tex, { engine: "mathjax" })` 默认输出**衬线数学字形**（MathJax SVG 内置 STIX/Computer Modern 风格，符合公式排版惯例）。`engine: "builtin"` 保留无重依赖子集引擎供 headless 测试。MathJax 动态 import，未使用时不出现在热路径。
  - **构建期资产**：`BuildOptions` / `IntermactCanvas` 增 `fetchBinary`（字体）与既有 `fetcher`（文本）；示例 `examples/src/lib/assetFetch.ts` + `@fontsource/dejavu-*`。
  - 示例：`text/multi-font-writing`（DejaVu Sans/Serif 轮廓 + `write()`）、`latex/latex-writing`（MathJax 衬线公式 writing）。回归：**135** 项测试（含 OpenType 加载 + MathJax 布局）。
- **移除笔画骨架字体 + 书写/填充机制升级**（2026-06-08）：
  - **删除** `text/stroke-font.ts` 及 `strokeContoursToOutline` 文本路径；文本/LaTeX **仅** OpenType 填充轮廓 + MathJax SVG。构建期 `ctx.assets.font` + `setDefaultFont` 为同步标签 API 之前提。
  - **字距修复**：OpenType `advance` 与路径坐标统一按 `emScale` 缩放（修复多字体 demo 全字叠在同一位置）。
  - **Y 轴朝向修复**：`opentype.js` 的 `toPathData()` 为 SVG y-down；`parseSvgPath(..., { flipY: true })` 翻转为场景 y-up（大写/下降部在基线上方）。示例需硬刷新以重建 program（HMR 不自动重烘焙字形）。
  - **闭合轮廓修复**：`toPathData()` 常省略 `Z`，导致字形子路径 `closed: false`、无 `fill` trait；书写阶段仅靠描边借色，结束后整行消失。`opentype-font.ts` 将字形轮廓一律标为 `closed: true`。
  - **书写策略**：`write({ stroke: { direction: "ltr" | "rtl" | "simultaneous", glyphOverlap } })` 在编译期为每字形生成 `glyphWriteSpans`（`glyphOverlap` 控制下一字在前一字完成前开始的重叠比例；`simultaneous` 为全字同时起笔）。渲染器用 `text-layout.contourGlyphIndex` 按字形裁切描边；填充全程走 per-glyph fill group（完成后 `localFill=1`），避免 merged mesh 切换导致已完成行闪没。对比示例 `text/writing-strategies` 两行 **并行** `scene.play(a, b)` 同屏对照。
  - **按字形 fill group**：`triangulateGroups` + `classifyFillGroup` 在机制上正确处理同字形的内外环（如 `0`、`\frac`），避免积分公式填充成内圈。
  - `latex/transform-matching-tex` 改为 MathJax 衬线。回归：**141** 项测试（含闭合轮廓、LTR 描边裁切、多行书写持久可见）。

### 0.3 实现进度日志（Phase-3 / v1.0）

记录 Phase-3（PCG 演示系统）各里程碑（M13–M17）落地时与本设计的对齐情况及具体化选择。仅记录偏差/具体化，架构契约以上文各章为准。系统性代码评审见 `dev-docs/phase-3-review.md`（§13）。

- 入口基线（2026-06-09）：Phase-2 闸口 `pnpm run ci` 全绿（152 用例 / depcruise 134 模块 0 违规 / 四包 0.2.0）。

- **M13 PCG 核心（2026-06-09，v0.3.0）**：新增 headless `packages/core/src/pcg/` 生成层，落地 §6 全量生成器：
  - 场/采样（§6.2）：`ScalarField2D`/`VectorField2D`/`ScalarField3D` + 构造器；`marchingSquares` + `stitchSegments`；`isoline`/`heatmap`/`vectorFieldObject`/`streamlines`（RK4）。
  - 参数/晶格（§6.3）：`parametricCurve2D`/`lattice`/`tiling`（square/hex/triangle）。
  - 递归/文法（§6.4）：`lSystem`（turtle + 种子化抖动）、`fractal`（Koch/Sierpinski/IFS 混沌游戏）、`recursiveTree`、`graphObject`（force/tree/circular）、`cellularAutomaton`（Rule-N 1D 时空图 / Game of Life 2D）+ `cellularAutomatonFrames`。
  - 数据驱动（§6.5）：`mapData`/`barChart`/`scatter`/`lineChart`（经 §7 `linearScale`，保留 key）。
  - 算子（§6.6）：`transformObject`/`repeatObject`/`instanceField`/`mapPoints`/`along`/`booleanOp`（多边形布尔在 `geometry/boolean.ts`，Greiner–Hormann）。
  - 确定性（§6.7）：随机仅经注入的 `ctx.rng`（`createRng`），同 seed 可复现（已用例固化）。
  - **具体化/与设计稿差异**：
    1. `repeat` 与动画层 `repeat` 在扁平命名空间冲突，PCG 算子改名 `repeatObject`（语义不变）。
    2. `isosurface`（marching cubes）需 3D 网格，顺延至 M14（`ScalarField3D` 已先行）。
    3. `heatmap` 经新增的逐填充组颜色通道渲染（`GeometryProvider2D.fillGroupColors` / `FillTrait.fillGroupColors` + render-three 对应分支），等价于"逐格填色网格"；纹理化属 M16 优化。
    4. `instanceField` 产出 `InstancedTrait` 标记但当前以聚合几何回退渲染（正确但未 GPU 实例化，留待 M16）。
    5. `booleanOp` 面向简单、横切相交的多边形；共享顶点/共线重叠等退化情形不在范围内。
    6. PCG 算子的变换参数采用本地结构化类型（避免 `pcg → scene` 依赖），与 `Transform2D` 在共用子集上结构兼容；算子当前为 2D，3D 变体随 M14。
  - 架构守护：`.dependency-cruiser.cjs` 新增 `pcg-headless-deps`（禁止 `pcg → scene/animation/program/reactive/interaction/resource`）。回归：`pnpm run ci` 全绿（**179** 用例 / depcruise 148 模块 0 违规 / 四包 0.3.0）。

- **M14 3D 全量（2026-06-09，v0.4.0）**：在不改动 2D 路径的前提下并行扩出 3D 管线（§5.3、§9.3、§10、§10.1）。
  - 数学（§10.1）：`math/quaternion.ts` 四元数代数（`quatFromAxisAngle/Euler/Slerp/LookAt/Multiply/RotateVec3`，`[x,y,z,w]` 对齐 three.js）。
  - 运行时（§4.3/§5.3）：`RuntimeState` 联合化（`dimension` 判别）+ `RuntimeState3D`/`ResolvedTransform3D`/`RuntimeState3DPatch`；`store`/`world-transform` 按维度分发，新增 `composeTransform3D`/`resolveTransform3D`/`IDENTITY_TRANSFORM_3D`。
  - 动画（§3.2/§11）：`Player`/`track`/`storyboard`/`spec` 泛化为 2D\|3D；`PropertyPath.space` 区分 2D 标量旋转与 3D 四元数 slerp；3D `Create`（线按段、网格按三角批次 `setDrawRange`）。
  - 几何/对象（§5.3）：`GeometryProvider3D`（line/mesh/points）+ `geometry/provider3d.ts`（弧长/法线/打包）；`object3d/factories.ts`（`polyline3D`/`curve3D`/`meshObject`/`surface3D`/`pointCloud3D`/`axes3D`）。
  - 场景/相机（§10、§10.1）：`Scene3D`（注册/层级/`group3D`/时间线复用 `StoryboardBuilder`）、`RegisteredObject3D`、`RegisteredCamera3D`（`moveTo/lookAt/zoomTo/dollyTo/orbit`，相机即可 seek 的时间线节点——关闭 v0.1 相机延期）。
  - 生成（§6）：`geometry/marching-cubes.ts` + `pcg/isosurface.ts`（接入 `ScalarField3D`）。
  - 程序/渲染（§10、§15.2）：`ctx.createScene3D`/`createCamera3D` + `BuiltProgram.dimension`；`render-three` 3D 视图与 `ThreeSceneView` 维度分发；`render-r3f` `SceneView3D`（透视相机 + 内置 orbit/dolly）与 `RenderedScene`（离屏渲染目标，§19.5）。
  - **具体化/与设计稿差异**：
    1. marching cubes 采用 **marching-tetrahedra** 变体（Bourke）：天然水密、免查表，测试以单位球水密性（每内部边恰 2 三角）+ 面积逼近 \(4\pi r^2\) + 字节级可复现校验。
    2. 并行 3D 管线（非改造 2D）：2D 专用渲染/检视加 `dimension` 守卫；2D 用例零回归。
    3. `render-three` 3D 折线用 `LineSegments`（端点成对）以正确渲染本不相接的多段折线（如 `axes3D`）。
    4. `SceneView3D.interactive`：`true` 内置极坐标 orbit/dolly（脚本相机让位），`false` 严格跟随时间线相机节点；未引入 `@react-three/drei`。
    5. `RenderedScene` 每帧渲染目标前后保存/恢复 `clearColor`/`alpha`，避免污染宿主帧。
    6. 源内 `VERSION` 常量统一升至 `0.4.0`（修正 M13 仅升 `package.json` 的遗留不一致）。
  - 回归：`pnpm run ci` 全绿（**205** 用例 / depcruise 164 模块 0 违规 / 四包 0.4.0）。

- **M15 序列化 / 导出 / 嵌入（2026-06-09，v0.5.0）**：把构建后的程序变为可移植数据并能复原（§17）。
  - 序列化（§17）：新增 `core/src/serialize/`。`serialize(player)` 产出纯 JSON `SerializedProject`（烘焙对象 + 时间线 op-log + 信号 + 种子），`deserialize` 在不重跑用户程序的前提下复原等价 `Player`。
  - op-log（§17）：`StoryboardBuilder` 记录 `TimelineOp`（play/commit/wait/marker 的原始 `AnimationSpec`）；`Scene2D/3D` 额外保存 **pristine 初值**（编译期 baseline 补丁前），反序列化在其上重放 op-log 即可逐字节复现。
  - Phase-1 欠账了结：`EasingFn`→命名 easing（degrade 退化 `linear` / strict 抛错）；`morph.toObject`→`bakeObjectDef` 烘焙；`call`→丢弃或抛错；reactive 信号→数字 id 持久化（`serializeInitialSignals` + `createSignalWithId` 重建并注册）。
  - 分享/导出（§17）：`share-url.ts`（base64url，`TextEncoder`/`TextDecoder`，headless 与浏览器同源）；`frame-hash.ts`（`sampleFrames`/`sampleFrameHashes`/`hashSnapshot`，FNV-1a 仅哈希运行态）；`svg.ts`（2D headless SVG 快照）；`react/export/recordCanvas.ts`（`recordCanvasVideo` 自动协商 mime、`captureFrameSequencePng` 定帧确定性导出、`captureFramePng`/`downloadBlob`）+ `react/export/gif.ts`（无依赖 `encodeGif`/`exportCanvasGif`）+ `react/embed/web-component.ts`（`defineIntermactEmbed`/`buildEmbedIframe`）。
  - 嵌入/语义/a11y（§17）：`react/embed/web-component.ts`（`defineIntermactEmbed` → `<intermact-embed>` 自管 React 根）、`react/components/SerializedCanvas.tsx`（2D/3D 复原渲染）、`semantic.ts` + `SemanticOverlay`（metadata href/a11y 叠加）、`reduced-motion.ts`（`degradeForReducedMotion` 时长归零→终态）+ `usePrefersReducedMotion`。
  - **具体化/与设计稿差异**：
    1. 不重跑程序而重放 op-log + pristine 初值；契约以"帧哈希逐帧相等"校验（2D/3D/morph）。
    2. 烘焙对象按自然顶点采样为扁平几何再经工厂重建——参数化实时重算、交互、文本布局 token 顺序降级为静态几何（外观一致，失活性）。
    3. 派生对象（`registerReactive` 的 `build` 闭包）不序列化；反序列化保留信号 op 但无派生几何重建（帧哈希仅覆盖运行态）。
    4. SVG 快照为 2D headless 路径（按 revealEnd 近似裁剪）；3D 帧与 PNG 走浏览器 GL canvas。
    5. 3D 相机 optics 随工程序列化（`PlayerSerializationMeta.cameras` 从 viewports 采集），反序列化重建 `RegisteredCamera3D`。
    6. `@intermact/react` 新增 `react-dom`（peer + dev），供 `<intermact-embed>` 自挂载。
  - 回归：`pnpm run ci` 全绿（**216** 用例 / depcruise 181 模块 0 违规 / 四包 0.5.0）。

- **M16 性能与大数据（2026-06-09，v0.6.0）**：把 §15.2 的性能策略落到热路径（不改既有渲染契约）。
  - 采样 memoize（§15.2 #1）：`geometry/memoize.ts`（`createSamplingMemo`/`sampleOptionsKey`）接入 `geometry/provider.ts`；对象定义不可变 ⇒ provider 即 `(object, geometryVersion, opts)` 缓存域，同 opts 命中返回同引用。
  - GPU 实例化（§15.2 #3）：`InstancedTrait` 携带 base 几何 + `InstanceTransform2D[]`；`instanceField` 双轨（聚合几何进 trait 供 headless/SVG/拾取 + 实例数据供 GPU）；`render-three/object-view-instanced.ts` 用 `InstancedMesh`（fill/stroke 各一），`ThreeSceneView` 按 trait 分发。
  - 区间剪枝：`animation/player.ts` `applyAt` 对 start 升序轨道二分（`upperBoundByStart`），只评估活动窗口，剪掉未开始尾部。
  - Worker 化（§15.2 #6，core 保持 DOM-free）：`render-three/worker/`（`protocol`/`kernel`/`client`/`entry`）承载纯任务 `resample`/`triangulate`/`marching-cubes`/`parse-svg-path`；`geometry/marching-cubes.ts` 拆出可序列化 `marchingCubesField`（预采样标量场）；宿主构造 Worker，无 Worker 时同步回退。
  - 性能预算：`core/perf/perf-budget.test.ts`（计入 `vitest run`）+ `core/perf/sampling.bench.ts`（`pnpm run bench`）。
  - **具体化/与设计稿差异**：
    1. 实例化对象双轨：GL 走 `InstancedMesh`、无 GPU 路径回退聚合几何（像素一致）；逐实例 reveal 裁剪未做（整体淡入走 group opacity/fillProgress）。
    2. memoize 落 provider 层、命中返回同引用（依赖采样结果不可变、消费只读）。
    3. 区间剪枝仅剪未开始尾部；已完成轨道每帧仍从 baseline 重算（正确性）；依赖 `Storyboard.tracks` 按 start 升序。
    4. Worker 仅纯函数子集；LaTeX 的重纯步骤即 SVG 路径解析（MathJax DOM 步骤留主线程）；glue 全在 `render-three`。
    5. 3D 点云单色（`PointsMaterial` 未用 per-point scalar 着色）。
  - 回归：`pnpm run ci` 全绿（**233** 用例 / depcruise 193 模块 0 违规 / 四包 0.6.0）。
- **M17 扩展性 / 插件（2026-06-09，v0.7.0）**：落地 §18 注册表式扩展——新对象/动画/生成器/渲染后端不改 core。
  - 注册表：`extend/registry.ts` 的泛型 `Registry<K,V>`（register/get/has/require/unregister/override，重复键 `plugin-error`）；`extend/types.ts` 的四类 descriptor（`ObjectTypeDescriptor`/`AnimationCompiler`/`GeneratorDescriptor`/`RendererFactory`）+ `Registries`；`extend/registries.ts` 的 `createRegistries()` 与进程级 `globalRegistries`。
  - 插件：`extend/plugin.ts` 的 `definePlugin`/`installPlugin(plugins?)`（默认装进 `globalRegistries`）+ 分发助手 `createRegisteredObject`/`runGenerator`/`selectRenderer`/`requireRenderer`。
  - 动画接线（§18 关键）：`spec.ts` 增 `custom` 联合项（`type`+`targetId`+可序列化 `params`+`duration`）；`animation/track.ts` 增 `AnimationCompiler`/`CustomAnimationContext`，`compileSpec` 的 `custom` 分支经 `context.resolveAnimation(type)` 取 compiler；`StoryboardBuilder` 默认把 `resolveAnimation` 指向 `globalRegistries.animations`（可覆盖），故 `scene.play(customAnimation(...))` 无需穿线即处处可见；`orchestration.ts` 增 `customAnimation()` 工厂。
  - 序列化：`SerializedSpec`/`bakeSpec`/`unbakeSpec`/reduced-motion 折叠覆盖 `custom`；反序列化经同名注册 compiler 重解析，缺插件则 `unsupported-animation`。
  - 示例：`plugin/custom-object`（注册 gear 对象类型 + spin 动画 kind）、`plugin/custom-generator`（注册 golden-angle phyllotaxis 生成器）、`plugin/webgpu-backend`（注册 `webgpu`/`webgl` `RendererFactory` + `selectRenderer` 选择，PoC）。
  - **具体化/与设计稿差异**：
    1. 自定义动画经「全局注册表 + 注入解析器」接线；为避免环，解析器以函数注入，`animation/track` 不反向依赖 `extend`（仅 `extend → animation/track` 取类型）。
    2. 对象类型注册表与 trait 模型互补：插件对象返回 trait 即走既有渲染管线，descriptor 主要承担按名构造+发现，而非渲染分发开关。
    3. WebGPU 后端为注册表占位（特性探测 + 选择），真实设备接线留 PoC 下一步，场景仍走 WebGL。
    4. 示例 `install` 以 `has()` 守护幂等（防 HMR 重入重复键）；库侧默认重复键报错。
  - 回归：`pnpm run ci` 全绿（**243** 用例 / depcruise 199 模块 0 违规 / 四包 0.7.0）。
- **◆ L3 v1.0 验收（2026-06-09，v1.0.0）**：Phase-3（M13–M17）收口。`pnpm run ci` 全绿（lint + typecheck + 用例 + depcruise 0 违规 + build）；21 个 P3 示例经 `examples` 生产构建可运行；性能预算纳入 CI；插件机制端到端验证（新增对象/生成器/动画 kind 不改 core）。四库包 `VERSION`/`package.json` 升至 `1.0.0`，API Reference 经 TypeDoc 重生。验收清单 `docs/project/v1-checklist.md`。**稳定性**：`@intermact/core` 公共 API（对象/几何/动画/场景/序列化/扩展）标记 stable；`render-*`/`react` 适配层 stable；WebGPU 后端、逐实例 reveal/拾取、对象注册表自定义序列化为 experimental（见 §0.3 各里程碑偏差）。验收时实测 **244 用例 / 199 模块**；经 §0.3.1 评审清偿后增至 **296 用例 / 210 模块**（以 CI 实测为准）。

### 0.3.1 Phase-3 评审清偿与决策台账（2026-06-10）

针对 `dev-docs/phase-3-review.md`（§13）的系统评审，确立"代码 vs 设计稿"裁决原则：**实现更优**者固化为设计决策（保留代码并回写设计稿）；**设计更优**者以代码补齐到契约。逐项清偿进度见 phase-3-review.md §13 清偿记录表。

**A. 保留代码（实现更优 / 合理偏差，固化为设计决策）**

1. **marching-tetrahedra** 取代经典 marching-cubes：天然水密、无查表歧义面（M14 偏差①）。
2. **heatmap 逐填充组 `fillGroupColors`**：等价"逐格填色网格"，纹理化属 M16 性能优化而非正确性（M13 偏差③）。
3. **`repeat` → `repeatObject`**：与动画层 `repeat` 在扁平命名空间冲突，语义不变（M13 偏差①）。
4. **PCG 生成器 headless + `spec.rng` 注入**：保持纯函数、避免 `pcg → scene` 依赖；`ctx.rng` 为 build 期默认随机源。凡需随机而未注入 `rng` 者一律 **fail-fast**（抛 `invalid-argument`），不再静默退化为伪确定输出（§6.7，CP1 已落地：`lSystem` 抖动、`graphObject` force、`cellularAutomaton` 随机初值、`fractal` 空 IFS）。
5. **`SerializedProject` 含 `scene`/`cameras` 字段、`deserialize` 返回 `DeserializedProgram`**：设计稿 §17 原型过窄，**以实现为准更新设计稿**（见 §17）。
6. **WebGPU 维持 PoC**：注册表 + 后端选择即扩展性证明；真实 WGSL 后端工作量与 v1.0 收益不成比例，设计本就标 optional。
7. **字体注册表作用域化保留同步字形 API（残留并发边角）**：`glyphFor`/`textObject` 等是设计稿 §13 既定的**同步构造 API**（构造期即烘焙轮廓），全量线程化会破坏该公共面。故采用「每次 build 用全局注册表子作用域 + 单一 active 指针」方案：顺序构建与全局预载字体**完全隔离/可见**，仅「program 中途 `await` 的并发交错构建」共享 active 指针为已知残留（§22 约束 8、§22.8）。需该边角隔离者显式注入或全局预载。

**B. 代码对齐设计稿（设计更优，以代码补齐到契约）**

- **M14**：`render(scene, camera) → RenderedScene`（core 化为 `IMObject2D`，`live`/`snapshot` 纹理模式）+ `IntermactCanvas` 多视口 `rect` 渲染。
- **M17**：registries 注入化（`build`/`scene`/`storyboard`/`deserialize`/`ctx` 透传），`globalRegistries` 退为默认源；字体注册表作用域化（随 build/AssetManager），消除进程级可变态。
- **3D 管线补完**：相机父子挂载、3D `Create` 弧长 reveal、`ThreeObject3DView` 几何热更新、`Scene3D.getAxes`/`coordinate`、`group3D` 几何聚合工厂、3D traits、点云标量着色、正交相机。
- **序列化稳健化**：`deserialize` schema 校验（→ `serialization-error`）、`hashRuntimeState` 纳入 `styleOverrides`/`glyphWriteSpans`、`bake` 序列化 `sampleCount`、`decodeShareUrl` 大小上限/Unicode、`<intermact-embed>` 重连 DOM 清理。

**清偿后验证（2026-06-10）**：A/B 两栏全部落地，`phase-3-review.md §13.11` 清偿记录表逐项 ✅。`pnpm run ci` 全绿——**40 文件 / 296 用例**、depcruise **210 模块 / 911 依赖 / 0 违规**、四包 ESM+DTS 构建通过；新增 6 个 Phase-3 示例（`pcg/operators-showcase`、`pcg/data-charts`、`pcg/generators-extra`、`export/svg-snapshot`、`3d/grouping`、`pcg/cellular-automaton` 2D Life）与 4 篇专题指南（`guide/pcg`/`3d`/`export-embed`/`performance`），`gen:reference` + `build:site` 校验通过。

## 1. 愿景与范围

### 1.1 三段式愿景

Intermact 的能力分三个同心圆，由内向外扩展，但共用同一套核心运行时：

```text
[1] 可交互 Manim 替代品
    程序化对象、Create/Morph/Tween、Scene/Camera/Canvas 解耦、实时预览
        |
        v
[2] 数理可视化工具箱
    Scale、Axes/NumberPlane、FunctionGraph/VectorField、Matrix/Table、
    ValueTracker + updater 驱动的交互几何
        |
        v
[3] 面向数理的 PCG 演示与交互系统
    场/采样器、生成式语法、数据驱动生成、可拖拽探索、
    可序列化分享、可嵌入网页/讲义、与实验过程解耦
```

每一层都建立在前一层之上，且不破坏前一层的接口契约。

### 1.2 核心目标

1. **实时渲染与调试**：React Three Fiber 管理 WebGL 渲染，参数修改与动画播放在浏览器中实时反馈。
2. **声明式 + 数据优先**：对象定义是不可变数据；动画与时间线也是可被求值/序列化的数据，而非散落的命令式副作用。
3. **可 seek 的确定性时间线**：任意时刻 `t` 都可被确定性地求值与重放，从而支持拖动进度条、时间旅行、导出与回归测试。
4. **Scene / Camera / Canvas 解耦**：Scene 只描述内容与坐标系；Camera 只描述观察方式；Canvas 负责顶层输出与交互。
5. **响应式交互**：几何可声明为参数（Signal/Tracker）的函数，参数变化时自动重算，支撑拖拽探索与实时模拟。
6. **实验与渲染解耦**：训练/仿真/求解器以快照或数据流进入 Intermact，绝不在渲染帧里重复昂贵实验。
7. **组合优先于继承**：对象与动画通过 trait/capability/算子组合而成，公共 API 不要求继承基类（贯彻"原子化组合代替继承"）。
8. **核心无框架依赖、可扩展**：core 不依赖 React/Three/DOM；对象、生成器、动画、渲染器都通过注册表扩展。

### 1.3 非目标

1. 不在早期实现完整 Manim Python API 兼容层。
2. 不以"视频导出优先"约束内部数据结构；导出是核心模型的下游消费者之一。
3. 不要求每个动画都能逐帧反向运算（reversible）；但**所有进入时间线的动画都必须可 seek**（见 §11.5 对可逆与可重放的区分）。
4. 不要求 Text/LaTeX 第一阶段达到与曲线完全一致的逐笔书写，但接口必须预留。
5. 不自带物理/数值求解器；提供把外部求解结果接入的标准入口。

### 1.4 设计原则（方法论总纲）

| 原则 | 含义 | 体现 |
| --- | --- | --- |
| 描述与执行分离 | 程序产出**可被检视/序列化的描述**（对象树 + 时间线），Player 负责求值 | §3.2、§11 |
| 数据即效果 | 动画是 `(progress) -> StatePatch` 的纯描述 + 解释器，而非带副作用的对象 | §11.1 |
| 不可变 + patch | 定义不可变；运行时状态由每帧 patch 累积，渲染层做 diff | §4.3 |
| 组合优先 | trait/capability/算子组合，禁止深继承 | §4.2、§6.6 |
| 确定性 | 时间、随机（种子）、采样都可复现；副作用集中在 `call` 逃生舱并显式标注 | §6.7、§11.5 |
| 契约式类型 | branded 坐标类型、穷尽式 `switch`、dev 期不变量校验 | §7.1、§16 |
| 分层依赖规则 | core → 无 DOM/Three/React；适配层各自隔离 | §3.4 |
| 注册表式扩展 | 新原语/生成器/动画/渲染器不改 core | §18 |

## 2. 术语

| 名称 | 含义 |
| --- | --- |
| `IMObject` | 未注册的对象**定义**，不可变，只描述几何/样式/语义元数据。 |
| `RegisteredObject` | 注册到 Scene 后的实例，拥有 scene-local id、transform、父子关系、运行时状态、动画/交互目标。 |
| `Signal` / `Tracker` | 响应式数值/值容器（对应 Manim `ValueTracker`），可被 tween，也可被 derived/updater 订阅。 |
| `Animation` | 已绑定目标的动画**描述**（数据），是可播放、可组合、可序列化的句柄，不直接执行。 |
| `Storyboard` | 由动画轨道（Track）构成的保留模时间线数据结构，可被任意 seek。 |
| `Player` | 拥有 Storyboard 的播放器，提供 play/pause/seek/rate/loop，并产出每帧状态。 |
| `Scene` | 内容容器，定义坐标系、对象注册表、轴、层级与编排能力。 |
| `Camera` | 注册进 Scene 的特殊对象，含位姿/投影参数与相机动画。 |
| `RenderedScene` | `render(scene, camera)` 的产物，可作为特殊 2D 对象注册进其他 Scene/Canvas。 |
| `Canvas` | 顶层输出容器，可视为覆盖全 UV 的 2D Scene，隐含默认 Camera，可挂载多个视口。 |
| `Field` / `Sampler` | 场/采样器：把空间点映射为标量/向量/颜色，是 PCG 的基础抽象。 |
| `StatePatch` | 对运行时状态的一次不可变增量更新。 |

## 3. 总体架构

### 3.1 分层与依赖规则

```text
User Program / React App
        |
        v
Public DSL              对象/生成器/场景/动画/响应式工厂
        |
        v
Authoring Model         IMObject(定义) · Scene · RegisteredObject · Storyboard(时间线)
        |
        v
Reactive Layer          Signal/Tracker · computed/derived · updater 依赖图
        |
        v
PCG / Generative        Field/Sampler · 生成器 · 组合算子 · 种子化随机
        |
        v
Math Toolbox            Scale · Axes/Plane · FunctionGraph/VectorField · Matrix/Table
        |
        v
Geometry & Layout       采样(arc-length) · 三角化 · bounds · anchor · 坐标变换
        |
        v
Animation Runtime       Player(seek/rate/loop) · 动画解释器 · easing
        |
        v
Renderer Adapter        R3F · Three(geometry/material/shader) · HTML overlay · render target
        |
        v
Web Output              Canvas · 多视口 · GUI · pointer/键盘 · 导出/嵌入
```

**依赖规则（强约束）**：

- `core/*` 不得 import React、three、DOM API。它只依赖纯 TS 与数学工具。
- `render/three` 依赖 three，但不依赖 React。
- `render/r3f`、`react/*` 依赖 React/R3F。
- 任何上层不得被下层反向依赖；跨层通信只通过接口与不可变快照。

这条规则保证：核心可在 Node/Worker 中无头运行（用于测试、导出、SSR 预渲染），渲染器可被替换（例如未来加 WebGPU/Canvas2D/SVG 后端）。

### 3.2 双阶段执行模型：构建期与播放期

这是相对 v0.1 最重要的方法论变更。命令式 `await scene.play()` 易写但**无法回退/拖拽/确定性重放**。Intermact 把生命周期拆成两个阶段：

1. **构建期（build pass）**：运行用户 program。此时逻辑时钟"瞬间推进"，`scene.play(...)` 不真正等待，而是把动画轨道追加进 `Storyboard` 并前移时间游标，立即 resolve。program 跑完即得到一棵对象树 + 一条完整的、可被检视/序列化的时间线。异步资源（字体、LaTeX、SVG、数据）在此阶段全部 resolve（见 §14）。
2. **播放期（play pass）**：`Player` 拥有 `Storyboard`，按真实时钟推进，可 `seek(t)` 到任意时刻、可变速、可循环、可反向。渲染层订阅 Player 的每帧状态。

```ts
export interface Storyboard {
  readonly tracks: readonly Track[];
  readonly duration: number;                 // 由 tracks 推导
  readonly markers: readonly TimelineMarker[]; // 章节/书签，用于幻灯片式跳转
}

export interface Track {
  readonly id: string;
  readonly targetId: string;                 // RegisteredObject id 或通道名
  readonly start: number;                    // 场景时间轴上的起点（秒）
  readonly duration: number;
  readonly easing: Easing;
  /** 纯函数：归一化进度 [0,1] -> 状态补丁。可 seek 的根基。 */
  evaluate(localProgress: number): StatePatch;
}

export interface Player {
  readonly storyboard: Storyboard;
  readonly time: number;
  readonly duration: number;
  readonly state: "idle" | "playing" | "paused" | "finished";
  play(): void;
  pause(): void;
  seek(time: number): void;          // 任意时刻确定性求值
  setRate(rate: number): void;       // 变速，支持负数反向（若所有轨道可逆）
  setLoop(loop: boolean): void;
  jumpToMarker(name: string): void;  // 幻灯片式跳章
  subscribe(onFrame: (snapshot: RenderSnapshot) => void): () => void;
}
```

**为什么这样选**：Motion Canvas 用生成器把动画"描述"出来再由 `PlaybackManager` 做 `seek`；Remotion 把每帧表示为时间的纯函数以获得确定性导出。Intermact 取两者交集——保留 `async/await` 的书写体验（构建期糖衣），但底层落到可 seek 的时间线数据。`call(effect)` 这类不可逆副作用被显式标注为"不可 seek 边界"（见 §11.5）。

**构建期约束（v0.1.3）**：program 构建必须可重入、**不得依赖进程级全局可变状态**（如模块级 signal registrar）。多 `IntermactCanvas`/多 program 并发构建时，信号注册等副作用须闭包在各自的 `ReactiveEngine` 上（`ctx.signal`）。`Create`/`fadeIn` 的「隐藏基线」在动画 **play 进 Storyboard 时**由编译器注入，而非工厂方法副作用。

### 3.3 数据流

```text
program(构建期)
  ├─ 工厂创建 IMObject 定义（不可变）
  ├─ scene.register(obj, transform) -> RegisteredObject
  ├─ 资源 resolve（字体/LaTeX/SVG/数据，见 §14）
  ├─ target.create()/tween()/morph()/... -> Animation(数据)
  └─ scene.play(...) -> 向 Storyboard 追加 Track，前移游标
        |
        v
Storyboard（完整、可序列化、可 seek）
        |
        v
Player.seek(t) / 实时推进
  └─ 对每条活跃 Track 求值 -> 合并 StatePatch -> 不可变 runtime state store
        |
        v
Reactive Layer：Signal 变化 -> 触发 derived/updater 重算受影响对象几何
        |
        v
RenderSnapshot（当前帧的对象/相机/视口快照）
        |
        v
Renderer Adapter：diff -> 更新 R3F/Three 对象、HTML overlay、render target
```

外部状态（jotai/leva/实验 store）通过绑定到 `Signal` 进入系统（§8.3），可在播放期连续驱动几何重算，不必重跑构建期。

### 3.4 推荐模块边界

```text
src/
  core/
    object/        # IMObject 定义、对象工厂、trait/capability、geometry provider
    scene/         # Scene、registry、坐标系、transform hierarchy
    reactive/      # signal、computed、tracker、updater 依赖图
    animation/     # Animation 描述、Storyboard、Player、解释器、easing
    pcg/           # field/sampler、生成器、组合算子、seeded RNG
    math/          # scale、ticks、坐标系构件（NumberLine/Axes/Plane）、向量代数
    layout/        # bounds、anchor、UV/abs transform、相对定位
    geometry/      # 采样、arc-length、三角化、marching squares、SVG 路径解析
    resource/      # asset manager、字体/LaTeX/数据加载、prepare 阶段
  render/
    three/         # 与 React 无关的 three geometry/material/shader 助手
    r3f/           # React Three Fiber renderer adapter（消费 RenderSnapshot）
    html/          # Text/LaTeX/图表 overlay
  react/
    components/    # IntermactCanvas、SceneView、Viewport、TimelineControls、Inspector
    hooks/         # useIntermactPlayer、useSignal、useProgram
  serialize/       # Storyboard/对象树 序列化、分享 URL、导出
  examples/
    basic/ interactive/ pcg/ three-d/
```

## 4. 核心数据模型

### 4.1 不可变对象定义

对象定义只回答三个问题：是什么、如何采样、默认如何显示。它是不可变数据，可结构共享、可缓存、可序列化。

```ts
export type Dimension = "2d" | "3d";

export interface IMObjectBase<TDimension extends Dimension> {
  readonly type: string;            // 注册表键，用于渲染/序列化分发
  readonly dimension: TDimension;
  readonly traits: readonly ObjectTrait[];   // 能力组合，见 §4.2
  readonly style?: ObjectStyle;
  readonly metadata?: ObjectMetadata;         // 语义层：label、href、a11yLabel 等，见 §17
}

export interface IMObject2D extends IMObjectBase<"2d"> {
  readonly geometry: GeometryProvider2D;
}
export interface IMObject3D extends IMObjectBase<"3d"> {
  readonly geometry: GeometryProvider3D;
}
export type IMObject = IMObject2D | IMObject3D;
```

### 4.2 Trait / Capability 组合（组合优先）

为贯彻"原子化组合代替继承"，对象的行为由一组 trait 组合而成，动画与渲染对 trait 做**能力查询**而非类型判断。新对象类型 = 组合已有 trait，而不是继承某个基类。

```ts
export type ObjectTrait =
  | StrokeTrait          // 可描边：提供有序路径
  | FillTrait            // 可填充：提供闭合轮廓 + 填充规则
  | MeshTrait            // 3D 网格：顶点/面片
  | TextLayoutTrait      // 文本/LaTeX：glyph 布局，支持分部匹配
  | MorphableTrait       // 可作为 morph 源/目标，提供归一化轮廓与锚点
  | ParametricTrait      // 由参数函数定义，几何随参数重算（PCG/响应式）
  | InteractiveTrait     // 可命中、可拖拽，提供 pick 代理几何
  | InstancedTrait;      // 实例化：单几何 + transform 列表

export interface StrokeTrait {
  readonly kind: "stroke";
  /** 有序采样路径；contour 可多条（如带洞图形/复合路径） */
  samplePath(opts?: PathSampleOptions): SampledPath2D;
}

export interface FillTrait {
  readonly kind: "fill";
  fillRule: "nonzero" | "evenodd";
  contours(opts?: PathSampleOptions): readonly SampledContour2D[];
}

export interface MorphableTrait {
  readonly kind: "morphable";
  normalizedContours(): readonly NormalizedContour[];
  morphAnchors?(): readonly MorphAnchor[];
}
```

`Create` 动画的分发逻辑示意（穷尽式、按 trait 而非类型）：

```ts
function planCreate(obj: IMObject2D, opts: CreateOptions): AnimationSpec {
  const stroke = findTrait(obj, "stroke");
  const fill = findTrait(obj, "fill");
  const text = findTrait(obj, "textLayout");
  if (text) return planTextWriting(text, opts);     // 逐字/逐笔
  const tracks: AnimationSpec[] = [];
  if (stroke) tracks.push(planStrokeReveal(stroke, opts));  // 沿路径 reveal
  if (fill) tracks.push(planFillReveal(fill, opts));        // 描边后淡入/扫描线
  return sequenceSpec(tracks);
}
```

### 4.3 运行时状态与不可变 patch

定义不可变，但每个 `RegisteredObject` 有一份运行时状态。Player 每帧把活跃 Track 的 `StatePatch` 合并进状态 store；渲染层对前后两帧做 diff。

```ts
export interface RuntimeState2D {
  readonly visible: boolean;
  readonly opacity: number;
  readonly transform: ResolvedTransform2D;  // world transform（含父级）
  readonly revealStart: number;             // 描边裁剪区间 [start,end] ∈ [0,1]
  readonly revealEnd: number;
  readonly fillProgress: number;
  readonly styleOverrides?: Partial<ObjectStyle>;
  readonly geometryVersion: number;         // 几何被 updater 重算后自增，触发重采样
}

export type StatePatch = {
  readonly targetId: string;
  readonly changes: DeepPartial<RuntimeState2D | RuntimeState3D>;
};
```

**三层心智模型**：`IMObject`（定义，不可变） → `RegisteredObject`（注册实例，持有定义引用 + 句柄方法） → `RuntimeState`（每帧由时间线/响应式计算出的可变快照）。动画**只**写 RuntimeState，永不修改定义；Morph 替换的是实例所引用的定义。

## 5. 几何与采样

### 5.1 GeometryProvider 与缓冲通道

`GeometryProvider` 暴露采样能力。为兼顾人体工学与性能，提供**双通道**：作者层用 `xy()` 元组（可读），运行时/大数据走 `Float32Array` 缓冲（少分配）。

```ts
export interface GeometryProvider2D {
  readonly capabilities: readonly GeometryCapability[];
  samplePath(opts?: PathSampleOptions): SampledPath2D;
  getBounds(): Bounds2D;
  /** 性能通道：直接产出交错坐标缓冲，避免逐点分配元组 */
  sampleBuffer?(opts?: PathSampleOptions): Float32Array;
}

export interface SampledPath2D {
  readonly contours: readonly SampledContour2D[];
  readonly totalLength: number;
}
export interface SampledContour2D {
  readonly points: Float32Array;       // [x0,y0,x1,y1,...]
  readonly closed: boolean;
  readonly cumulativeLength: Float32Array; // 弧长前缀和，供 stroke reveal/trim
}
```

### 5.2 采样、bounds、三角化

- **弧长重采样**：曲线按弧长均匀重采样，保证 `Create` 描边速度均匀、Morph 对应点稳定。
- **三角化**：填充用 earcut 处理凹多边形/带洞图形（首轮廓外环、其余为洞，nonzero 语义）。`fillRule: "evenodd"` 类型已预留；**自相交 even-odd 实现**推迟至 M9/M16（v0.1 仅 nonzero + holes）。
- **等值线**：标量场用 marching squares 生成 isoline（PCG，§6.2）。
- **bounds**：所有对象提供 `getBounds()`，供布局/相对定位/相机取景（§7、§9）。

### 5.3 基础对象

2D（第一阶段）：

```ts
export function circle(props: CircleProps): IMObject2D;
export function ellipse(props: EllipseProps): IMObject2D;   // 内部统一拼写 Ellipse
export function rectangle(props: RectangleProps): IMObject2D;
export function arc(props: ArcProps): IMObject2D;
export function polygon(props: PolygonProps): IMObject2D;
export function bezierCurve(props: BezierCurveProps): IMObject2D;
export function line(props: LineProps): IMObject2D;
export function arrow(props: ArrowProps): IMObject2D;
export function svgObject(props: SvgObjectProps): IMObject2D;
export function textObject(props: TextObjectProps): IMObject2D;
export function latexObject(props: LatexObjectProps): IMObject2D;
export function group2D(children: IMObject2D[], props?: GroupProps): IMObject2D;
```

3D 不作为 2D 的特例，而是共享注册/动画/时间线/样式：

```ts
export function curve3D(props: Curve3DProps): IMObject3D;
export function polyline3D(props: Polyline3DProps): IMObject3D;
export function meshObject(props: MeshObjectProps): IMObject3D;
export function surface3D(props: Surface3DProps): IMObject3D;
export function pointCloud3D(props: PointCloud3DProps): IMObject3D;
export function axes3D(props: Axes3DProps): IMObject3D;
export function group3D(children: IMObject3D[], props?: GroupProps): IMObject3D;
```

`Create` 策略：曲线沿弧长 reveal；曲面按 `u/v` 扫描或 shader alpha mask；网格按顶点/面片批次；点云按排序 key（时间/距离/权重）。

## 6. 程序化与生成式内容（PCG 核心）

这是 v0.2 新增的核心层，也是"面向数理可视化的 PCG 系统"的落点。核心理念：**几何是参数的纯函数**。生成器只产出 `IMObject` 定义（数据），可被缓存、组合、随参数重算（配合 §8 响应式）、确定性重放（配合 §6.7 种子）。

### 6.1 设计理念

- 生成器签名统一为 `(spec) => IMObject`，无副作用。
- 生成器可嵌套与组合：先生成基元，再用组合算子（§6.6）变换/重复/布尔/映射。
- 与响应式结合：把 spec 中的标量换成 `Signal`，即得到"可拖拽探索"的活体几何（§8）。

### 6.2 场与采样器

场（Field）把空间点映射为值，是科学可视化的通用抽象。

```ts
export interface ScalarField2D {
  readonly domain: Bounds2D;
  sample(p: AbsXY): number;
}
export interface VectorField2D {
  readonly domain: Bounds2D;
  sample(p: AbsXY): Vec2;
}
export interface ScalarField3D { readonly domain: Bounds3D; sample(p: AbsXYZ): number; }

// 由场生成可视化对象
export function isoline(field: ScalarField2D, levels: number[], opts?: IsolineOptions): IMObject2D;       // marching squares
export function heatmap(field: ScalarField2D, opts?: HeatmapOptions): IMObject2D;                          // 颜色映射纹理
export function vectorFieldObject(field: VectorField2D, opts?: VectorFieldOptions): IMObject2D;            // 箭头网格
export function streamlines(field: VectorField2D, seeds: AbsXY[], opts?: StreamlineOptions): IMObject2D;   // 流线积分
export function isosurface(field: ScalarField3D, level: number, opts?: IsosurfaceOptions): IMObject3D;     // marching cubes
```

### 6.3 参数化与晶格生成器

```ts
export function parametricCurve2D(spec: { domain: Interval; fn: (t: number) => Vec2; samples?: number }): IMObject2D;
export function parametricSurface3D(spec: { u: Interval; v: Interval; fn: (u: number, v: number) => Vec3; samples?: [number, number] }): IMObject3D;
export function lattice(spec: LatticeSpec): IMObject2D | IMObject3D;     // 规则网格/点阵
export function tiling(spec: TilingSpec): IMObject2D;                    // 周期性密铺
```

### 6.4 递归与语法生成

面向数理演示常见的生成式结构：

```ts
export function lSystem(spec: LSystemSpec): IMObject2D;          // 公理 + 产生式 + turtle 解释
export function fractal(spec: FractalSpec): IMObject2D;          // IFS/科赫/谢尔宾斯基等
export function recursiveTree(spec: RecursiveTreeSpec): IMObject2D;
export function graphObject(spec: GraphSpec): IMObject2D;        // 节点/边 + 布局（force/tree/circular）
export function cellularAutomaton(spec: CASpec): IMObject2D;     // 1D/2D 元胞自动机，可随时间步进
```

`graphObject` 与 `cellularAutomaton` 天然带"步进"语义：每一步是一个新定义，配合时间线即可做演化动画（见示例 §19.4）。

### 6.5 数据驱动生成

把数据映射为几何，是连接"实验快照"与"可视化"的桥梁（呼应实验/渲染解耦）。配合 §7.3 的 Scale 使用。

```ts
export function mapData<T>(
  data: readonly T[],
  build: (datum: T, index: number) => IMObject2D,
  opts?: { key?: (d: T, i: number) => string },   // key 用于 Morph/数据更新时的对象匹配
): IMObject2D;

// 常见数据图表（可走 HTML overlay 复用 D3/Echarts/Plotly，或原生几何）
export function barChart(spec: BarChartSpec): IMObject2D;
export function scatter(spec: ScatterSpec): IMObject2D;
export function lineChart(spec: LineChartSpec): IMObject2D;
```

### 6.6 组合算子

生成式系统的威力在于组合。算子输入/输出都是 `IMObject`，可链式叠加：

```ts
export function transformObject(obj: IMObject, t: Transform2D | Transform3D): IMObject;
export function repeat(obj: IMObject, count: number, step: Transform2D | Transform3D): IMObject;
export function instanceField(obj: IMObject, transforms: readonly Transform2D[]): IMObject; // 触发 GPU instancing
export function booleanOp(a: IMObject2D, b: IMObject2D, op: "union" | "intersect" | "subtract" | "xor"): IMObject2D;
export function mapPoints(obj: IMObject2D, f: (p: AbsXY) => AbsXY): IMObject2D;              // 逐点形变（如保角映射演示）
export function along(obj: IMObject2D, path: IMObject2D, opts?: AlongOptions): IMObject2D;   // 沿路径分布/弯曲
```

### 6.7 确定性与种子化随机

PCG 必然涉及随机；为可重放，**禁止在生成器内直接用 `Math.random()`**。随机源由上下文注入的种子化 RNG 提供。

```ts
export interface Rng {
  next(): number;                 // [0,1)
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  gaussian(mean?: number, std?: number): number;
  fork(label: string): Rng;       // 派生子流，保证局部可复现
}
export function createRng(seed: number | string): Rng;
```

构建期上下文（§10.1）提供 `ctx.rng`；同一 seed ⇒ 同一份对象树 ⇒ 可序列化分享与回归测试。

## 7. 坐标系、标度与数理可视化

### 7.1 坐标类型与空间代数

为避免绝对坐标、相对 UV、屏幕像素混用，类型上区分空间，并提供空间感知的向量代数（集中坐标数学，避免散落各处）。

```ts
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];

export type AbsXY = Vec2 & { readonly __space: "abs-xy" };     // 场景世界坐标
export type RelUV = Vec2 & { readonly __space: "rel-uv" };     // 相对视口/域的归一化 [0,1]
export type AbsXYZ = Vec3 & { readonly __space: "abs-xyz" };
export type RelUVW = Vec3 & { readonly __space: "rel-uvw" };

export function xy(x: number, y: number): AbsXY;
export function uv(u: number, v: number): RelUV;
export function xyz(x: number, y: number, z: number): AbsXYZ;

// 空间感知代数（仅同空间可运算，类型层拦截 abs+rel 误用）
export const V2: {
  add<T extends Vec2>(a: T, b: T): T;
  sub<T extends Vec2>(a: T, b: T): T;
  scale<T extends Vec2>(a: T, k: number): T;
  lerp<T extends Vec2>(a: T, b: T, t: number): T;
  len(a: Vec2): number;
};
```

> 实现说明：branded type 运行时即普通数组；构造统一走 `xy/uv/xyz`，避免裸数组绕过类型保护。大数据路径用 `Float32Array`（§5.1）。

### 7.2 Scene 坐标系与单位/纵横比策略

明确 v0.1 含糊的"域 vs 视口 vs 像素"关系：

- `domain`：场景的**世界坐标定义域**（数学量纲，如 x∈[-4,4]）。
- `worldUnit`：1 世界单位对应的逻辑大小；`lineWidth` 等几何尺寸默认以世界单位计（也可显式声明 `"px"` 走屏幕空间，见 §15）。
- `fit`：当画布像素纵横比 ≠ 域纵横比时的策略：`"contain"`（letterbox，保形，默认）/`"cover"`/`"stretch"`。
- `RelUV` 归一化基准：**默认相对 domain 包围盒**；视口级 UV（用于 HUD/字幕贴边）用 `Canvas` 的 UV（§10.4）。

```ts
export interface Scene2DProps {
  readonly coordinate: "cartesian" | "polar";
  readonly domain: { readonly x: readonly [number, number]; readonly y: readonly [number, number] };
  readonly fit?: "contain" | "cover" | "stretch";
  readonly background?: string;
}
export interface Scene3DProps {
  readonly coordinate: "cartesian" | "cylindrical" | "spherical";
  readonly domain: { x: readonly [number, number]; y: readonly [number, number]; z: readonly [number, number] };
  readonly background?: string;
}

export interface CoordinateTransform2D {
  absToRel(value: AbsXY): RelUV;
  relToAbs(value: RelUV): AbsXY;
  toPolar(value: AbsXY): { r: number; theta: number };   // 极坐标场景
  fromPolar(r: number, theta: number): AbsXY;
}
```

### 7.3 Scale 与刻度

数理可视化的基石。Scale 把数据域映射到坐标域，并负责刻度与格式化（对齐 D3 心智）。

```ts
export interface Scale<TDomain = number, TRange = number> {
  (value: TDomain): TRange;
  invert(value: TRange): TDomain;
  ticks(count?: number): TDomain[];
  tickFormat(count?: number, spec?: string): (v: TDomain) => string;
  readonly domain: readonly [TDomain, TDomain];
  readonly range: readonly [TRange, TRange];
}
export function linearScale(domain: [number, number], range: [number, number]): Scale;
export function logScale(domain: [number, number], range: [number, number], base?: number): Scale;
export function powScale(domain: [number, number], range: [number, number], exponent?: number): Scale;
export function timeScale(domain: [Date, Date], range: [number, number]): Scale<Date, number>;
```

### 7.4 数理构件

基于 Scale 与坐标系，提供 Manim 风格、但可交互的数理对象：

```ts
export function numberLine(spec: NumberLineSpec): IMObject2D;
export function axes(spec: AxesSpec): IMObject2D;            // 含 x/y Scale、刻度、标签
export function numberPlane(spec: NumberPlaneSpec): IMObject2D; // 网格平面
export function polarPlane(spec: PolarPlaneSpec): IMObject2D;
export function complexPlane(spec: ComplexPlaneSpec): IMObject2D;

// 依附于坐标系的对象（接受 axes 句柄，使用其 c2p：坐标->点）
export function functionGraph(axes: AxesHandle, fn: (x: number) => number, opts?: FunctionGraphOptions): IMObject2D;
export function parametricGraph(axes: AxesHandle, fn: (t: number) => Vec2, opts?: ParametricOptions): IMObject2D;
export function areaUnderCurve(axes: AxesHandle, fn: (x: number) => number, range: Interval, opts?: AreaOptions): IMObject2D;
export function riemannRectangles(axes: AxesHandle, fn: (x: number) => number, opts?: RiemannOptions): IMObject2D;
export function tangentLine(axes: AxesHandle, fn: (x: number) => number, at: number, opts?: TangentOptions): IMObject2D;

// 表达/标注
export function matrixObject(spec: MatrixSpec): IMObject2D;
export function tableObject(spec: TableSpec): IMObject2D;
export function brace(target: RegisteredObject2D, direction: Vec2, opts?: BraceOptions): IMObject2D;
export function decimalNumber(tracker: Signal<number>, opts?: DecimalOptions): IMObject2D; // 文本随 tracker 实时更新
```

坐标轴通过 `scene.getAxes(props)` 注册，返回 `RegisteredAxes2D`（`RegisteredObject2D & { readonly handle: AxesHandle }`）。`props` 描述轴自身（`x/y` 数据域、样式、`showTicks`/`xLabel` 等），**不**混入 Scene 级动画。显隐示例：`const ax = scene.getAxes({ x: [-4,4], y: [-3,3] }); await scene.play(ax.fadeIn());`

`AxesHandle.c2p(coord)`/`p2c(point)` 连接数据坐标与场景世界坐标；依附构件（FunctionGraph、Riemann、TangentLine 等）通过 `ax.handle` 定位。`numberPlane(...)` 等其它坐标系构件在 M8 以同样模式扩展。

## 8. 响应式与依赖（updater 模型）

v0.1 仅用"外部 tween get/set"覆盖参数变化，不足以支撑"拖拽探索/实时模拟"。v0.2 引入显式的响应式层，对齐 Manim 的 `ValueTracker` + `add_updater` + `always_redraw`，并与时间线分工明确。

### 8.1 Signal / Tracker

```ts
export interface ReadonlySignal<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}
export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}
export function signal<T>(initial: T): Signal<T>;
export function computed<T>(fn: () => T): ReadonlySignal<T>;   // 依赖自动追踪

/** ValueTracker：可被 tween 的数值信号，是连接"动画时间"与"响应式"的关键 */
export function valueTracker(initial: number): Signal<number>;
```

### 8.2 derived 对象与 updater

两种把"几何 = 参数函数"接入场景的方式：

```ts
// 方式 A：derived 定义——几何随依赖信号自动重建（对应 always_redraw）
export function derived(deps: readonly ReadonlySignal<unknown>[], build: () => IMObject2D): ReactiveObjectSource;

// 方式 B：在 RegisteredObject 上挂 updater（对应 add_updater），适合就地修改 transform/局部
registered.addUpdater((ctx: UpdaterContext) => void): () => void;  // 返回卸载函数
```

依赖图保证最小重算：仅当被订阅信号变化（或 `geometryVersion` 自增）时，重算受影响对象并重采样几何。重算发生在每帧 Player 推进之后、生成 `RenderSnapshot` 之前。

示例（双曲线下随 tracker 变化的内接矩形，对应 manim-web 的经典交互演示）：

```ts
const t = valueTracker(2);
const ax = scene.register(axes({ x: [0, 10], y: [0, 10] }));
const k = 25;
const graph = scene.register(functionGraph(ax.handle, (x) => k / x, { domain: [k / 10, 10] }));

const rect = scene.registerReactive(
  derived([t], () => {
    const corners = rectangleCornersUnderCurve(ax.handle, t.get(), k / t.get());
    return polygon({ points: corners, style: { fill: "rgba(59,130,246,0.5)", stroke: "#60a5fa" } });
  }),
);

const dot = scene.register(circle({ radius: 0.06 }));
dot.addUpdater(() => dot.setTransform({ position: ax.handle.c2p([t.get(), k / t.get()]) }));

await scene.play(tweenSignal(t, 10, { duration: 2 }));  // 拖动 tracker，矩形与点自动跟随
```

### 8.3 与外部 store 绑定

外部状态库不被 core 依赖，而是通过双向绑定接入信号：

```ts
export function bindSignal<T>(sig: Signal<T>, external: { get(): T; subscribe(fn: () => void): () => void; set(v: T): void }): () => void;
```

React 侧提供 `useSignal(sig)` 把信号读入组件、以及把 leva/jotai 的值 `bindSignal` 到 program 的信号上（示例 §19.2）。

### 8.4 动画时间 vs 交互时间

- **动画时间**：由 Player 时钟驱动，写入 RuntimeState，可 seek，属于"叙事"。
- **交互时间**：由用户输入/外部 store 驱动信号变化，触发 derived/updater，属于"探索"。

两者通过 `valueTracker` 统一：tween 一个 tracker 即"用动画驱动一个可被交互覆盖的参数"。当用户开始拖拽时可暂停相关 tween，避免争用同一信号。

## 9. Scene、RegisteredObject、层级与布局

### 9.1 Scene 接口

Scene 是注册/布局/编排/坐标转换中心，但不直接持有 React 组件，也不直接持有 Player（Player 在 mount 时由运行时创建并接管 Storyboard）。

```ts
export interface SceneBase<TObject extends IMObject, TRegistered extends RegisteredObject> {
  readonly id: string;
  readonly registry: SceneRegistry<TRegistered>;
  readonly storyboard: StoryboardBuilder;   // 构建期累积时间线

  register(object: TObject, transform?: TransformOf<TRegistered>): TRegistered;
  registerReactive(source: ReactiveObjectSource, transform?: TransformOf<TRegistered>): TRegistered;
  registerEmpty(transform?: TransformOf<TRegistered>): TRegistered;

  /** 构建期：把动画追加进 storyboard 并前移游标，立即 resolve（见 §3.2） */
  play(...animations: Animation[]): Promise<PlaybackResult>;
  /** 即时提交（duration=0 的布局/状态变更），不产生可见过渡 */
  commit(...changes: Animation[]): void;
  wait(duration: number): Promise<void>;
  marker(name: string): void;               // 打章节书签
  free(target: TRegistered): void;
  clear(): void;
}

export interface Scene2D extends SceneBase<IMObject2D, RegisteredObject2D> {
  readonly kind: "scene-2d";
  readonly coordinate: CoordinateTransform2D;
  /** 创建并注册坐标轴对象；显隐/动画由返回的 RegisteredAxes 的 fade/create/… 控制（§9.1）。 */
  getAxes(props: AxesProps, transform?: Transform2D): RegisteredAxes2D;
}
export interface Scene3D extends SceneBase<IMObject3D, RegisteredObject3D> {
  readonly kind: "scene-3d";
  readonly coordinate: CoordinateTransform3D;
  getAxes(props: Axes3DProps, transform?: Transform3D): RegisteredAxes3D;
}
```

### 9.2 RegisteredObject

动画与交互作用的主要目标；持有定义引用、布局句柄、动画工厂、updater 注册。

```ts
export interface RegisteredObjectBase<TObject extends IMObject, TTransform> {
  readonly id: string;
  readonly object: TObject;        // 当前定义引用（Morph 会替换它）
  readonly sceneId: string;
  readonly parentId?: string;
  readonly layout: LayoutHandle;   // 修正 v0.1：布局句柄是 RegisteredObject 的成员

  getTransform(): TTransform;
  setTransform(transform: Partial<TTransform>): void;
  getRuntimeState(): Readonly<RuntimeStateOf<TTransform>>;

  // 动画工厂（返回 Animation 描述，不立即执行）
  create(options?: CreateOptions): Animation;
  fadeIn(options?: FadeOptions): Animation;
  fadeOut(options?: FadeOptions): Animation;
  tween<TValue>(property: TweenProperty<TValue>, to: TValue, options?: TweenOptions): Animation;
  moveTo(position: TransformPositionOf<TTransform>, options?: TweenOptions): Animation;
  rotateTo(rotation: TransformRotationOf<TTransform>, options?: TweenOptions): Animation;
  scaleTo(scale: TransformScaleOf<TTransform>, options?: TweenOptions): Animation;

  // 响应式 & 交互
  addUpdater(fn: (ctx: UpdaterContext) => void): () => void;
  on(binding: PointerEventBinding<this>): () => void;
}

export type RegisteredObject2D = RegisteredObjectBase<IMObject2D, Transform2D>;
export type RegisteredObject3D = RegisteredObjectBase<IMObject3D, Transform3D>;
export type RegisteredObject = RegisteredObject2D | RegisteredObject3D;  // 修正 v0.1：补齐联合类型
```

### 9.3 Transform 与层级

```ts
export interface Transform2D {
  position?: AbsXY;
  rotation?: number;
  scale?: Vec2 | number;
  anchor?: RelUV;        // 自身锚点（基于自身 bounds 的归一化点）
  opacity?: number;
  zIndex?: number;
}
export interface Transform3D {
  position?: AbsXYZ;
  rotation?: EulerRotation | Quaternion;
  scale?: Vec3 | number;
  opacity?: number;
  renderOrder?: number;
}
```

类似 Unity 的 transform hierarchy：

```ts
const root = scene.registerEmpty({ position: xy(0, 0) });
const label = scene.register(textObject({ text: "x" }), { position: xy(1, 0) });
scene.registry.setParent(label, root);
await scene.play(root.rotateTo(Math.PI / 2, { duration: 1 }));  // 子对象继承世界变换
```

动画写 local transform，渲染层解析 world transform 写入 `RuntimeState.transform`。

### 9.4 布局与相对定位

`LayoutHandle` 提供 RectTransform 式与 Manim `next_to` 式能力，方法返回动画句柄（`duration:0` 即即时布局，或用 `scene.commit`）。

```ts
export interface Bounds2D {
  readonly min: AbsXY; readonly max: AbsXY; readonly size: Vec2; readonly center: AbsXY;
}
export interface LayoutHandle {
  getBounds(): Bounds2D;
  alignTo(scenePoint: AbsXY | RelUV, opts: AlignOptions): Animation;          // 对齐到点（含自身 anchor）
  nextTo(target: RegisteredObject2D, direction: Vec2, opts?: NextToOptions): Animation; // 相对另一对象
  fitTo(bounds: Bounds2D, opts?: FitOptions): Animation;                      // 缩放贴合
  arrange(children: RegisteredObject2D[], opts: ArrangeOptions): Animation;   // 行/列/网格排布
}
```

```ts
await scene.play(
  title.layout.alignTo(uv(0.5, 0.92), { anchor: uv(0.5, 1), duration: 0.3 }),
  formula.layout.nextTo(title, [0, -1], { gap: 0.25, duration: 0.3 }),
);
```

## 10. Camera、RenderedScene、Canvas 与多视口

### 10.1 Camera 注册进 Scene

修正 v0.1 的不一致：按 `intro.md`，Camera 是**注册进 Scene 的特殊对象**，从而可被动画、可被父子挂载（实现"相机跟随对象"）。`ctx.createCamera*` 是便捷工厂，内部仍走 `scene.register`。

> **v0.1 实现偏差**：`createCamera2D` 当前返回游离的 `{ id, position, zoom }`，**未**经 `scene.register`；2D MVP 由视口 `computeFit` 驱动正交相机，尚不需要相机动画。Camera 注册化与可动画性推迟至 **M14（3D 相机）**。

```ts
export interface Camera2DProps {
  readonly projection: "orthographic";
  readonly zoom?: number;
  readonly viewport?: Bounds2D;       // 观察的世界区域
}
export interface Camera3DProps {
  readonly projection: "perspective" | "orthographic";
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly lookAt?: AbsXYZ;
}
export interface RegisteredCamera<TTransform> {
  readonly id: string;
  getTransform(): TTransform;
  setTransform(transform: Partial<TTransform>): void;
  moveTo(position: unknown, options?: TweenOptions): Animation;
  lookAt(target: unknown, options?: TweenOptions): Animation;
  zoomTo(value: number, options?: TweenOptions): Animation;
  orbit(opts: OrbitOptions): Animation;   // 3D 环绕
  addUpdater(fn: (ctx: UpdaterContext) => void): () => void;
}
```

### 10.2 RenderedScene

`render(scene, camera)` 产出可嵌套结果。它实现 `IMObject2D` 契约：几何是一个铺满自身的四边形，材质是该子场景渲染到的纹理（render target）。

```ts
export interface RenderedScene extends IMObject2D {
  readonly type: "rendered-scene";
  readonly sourceSceneId: string;
  readonly sourceCameraId: string;
  readonly textureMode: "live" | "snapshot";   // live=每帧重渲染；snapshot=一次性
}
export function render(scene: Scene2D | Scene3D, camera: RegisteredCamera<unknown>): RenderedScene;
```

用途：画中画 3D、把一个 Scene 当对象参与动画、多视角教学（左公式右 3D）。

### 10.3 Canvas

Canvas 是顶层容器：创建 WebGL renderer、挂载 R3F scene graph、管理 pointer/keyboard/resize/pixelRatio、暴露播放控制与调试面板。

```ts
export interface IntermactCanvasProps {
  readonly program: IntermactProgram;
  readonly autoplay?: boolean;
  readonly controls?: CanvasControlsProps;     // 进度条/章节/orbit
  readonly pixelRatio?: number | readonly [number, number];
  readonly responsive?: ResponsiveOptions;     // 见 §17
  readonly onPlayerReady?: (player: Player) => void;  // 暴露 Player 以便外部 seek/控制
}
```

### 10.4 多视口挂载

约束"Canvas 可挂载多个 Scene"需要明确的视口模型。Canvas 维护若干 `Viewport`，每个绑定 `(scene, camera, rect)`，`rect` 用 Canvas 级 UV 表示（与 Scene 域无关，便于做 HUD/分屏）。

```ts
export interface Viewport {
  readonly scene: Scene2D | Scene3D;
  readonly camera: RegisteredCamera<unknown>;
  readonly rect: { min: RelUV; max: RelUV };   // Canvas 归一化区域
  readonly clear?: boolean;
}
// program 上下文里：ctx.mount(scene, camera, rect?)
```

单场景演示时 `rect` 默认全屏；分屏/画中画时给不同 `rect`。`RenderedScene`（§10.2）解决"子场景作为对象嵌入"，而多视口解决"同级并排渲染"，两者互补。

## 11. 动画系统

### 11.1 Animation 作为数据 + 解释器

动画不再是带 `tick` 副作用的对象，而是**纯描述（spec）**，由 Player 解释。这带来可组合、可序列化、可 seek、可测试。

```ts
export type AnimationSpec =
  | { kind: "tween"; targetId: string; property: PropertyPath; from?: unknown; to: unknown; duration: number; easing?: Easing }
  | { kind: "create"; targetId: string; duration: number; stroke?: StrokeRevealSpec; fill?: FillRevealSpec }
  | { kind: "morph"; targetId: string; to: SerializableObjectRef; strategy: MorphStrategy; duration: number }
  | { kind: "fade"; targetId: string; to: number; duration: number }
  | { kind: "sequence"; children: readonly AnimationSpec[] }
  | { kind: "parallel"; children: readonly AnimationSpec[] }
  | { kind: "stagger"; children: readonly AnimationSpec[]; lag: number }
  | { kind: "repeat"; child: AnimationSpec; times: number | "infinite" }
  | { kind: "wait"; duration: number }
  | { kind: "call"; effect: () => void | Promise<void> };   // 逃生舱：不可 seek 边界（见 §11.5）

/** 对外仍是 Animation 句柄，内部携带 spec；编译为 Track 时被解释 */
export interface Animation {
  readonly spec: AnimationSpec;
  readonly duration: number;
  readonly targets: readonly string[];
}
```

每个叶子 spec 编译为一条或多条 `Track`，`Track.evaluate(localProgress)` 是纯函数。组合 spec（sequence/parallel/stagger）展开为带时间偏移的子 Track 集合。

### 11.2 编排工具

```ts
export function sequence(...animations: Animation[]): Animation;
export function parallel(...animations: Animation[]): Animation;
export function stagger(animations: Animation[], lag: number): Animation;   // 错峰（对应 LaggedStart）
export function repeat(animation: Animation, times: number | "infinite"): Animation;
export function wait(duration: number): Animation;
export function call(effect: () => void | Promise<void>): Animation;
export function tweenSignal<T>(sig: Signal<T>, to: T, options?: TweenOptions): Animation;  // 驱动响应式参数
```

`scene.play(a, b, c)` 默认**并行**；需要串行用 `sequence(...)`，避免与 Manim `play` 语义混淆。

### 11.3 时间线 / Player

构建期 `scene.play` 通过 `StoryboardBuilder` 把动画放在当前游标处并前移；最终得到 `Storyboard`。Player 拥有它，提供 §3.2 的 `seek/setRate/setLoop/jumpToMarker`。`marker` 形成"幻灯片章节"，支持演示时按章跳转（对应 Motion Canvas slides）。

### 11.4 Create / Morph / Tween / 快捷动画

**Create**（从不可见展示，play 前对象不显示）：

```ts
export interface CreateOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly stroke?: { mode?: "path-order" | "contour-parallel" };
  readonly fill?: { mode?: "after-stroke-fade" | "during-stroke" | "scanline"; overlap?: number };
}
```

规则：play 前不显示；`prepare` 时置 visible 但 reveal 区间为空；曲线/SVG/Bezier 按弧长 reveal；有填充者默认描边后淡入；Text/LaTeX 优先 glyph path reveal，退化为字符/token reveal。

**Morph**（任意对象到对象，处理点数不同）：

```ts
export type MorphStrategy = "arc-length" | "anchor" | "matching" | "cross-fade";
export interface MorphOptions {
  readonly duration?: number;
  readonly easing?: Easing;
  readonly sampleCount?: number;
  readonly strategy?: MorphStrategy;
  readonly matchBy?: (part: ObjectPart) => string;   // matching 策略：按 key 匹配子部件
  readonly preserveStyle?: boolean;
}
export function morph(source: RegisteredObject2D, target: IMObject2D, options?: MorphOptions): Animation;
```

策略：归一化轮廓 → 按弧长重采样到同点数；contour 数不同则按面积/长度/anchor 匹配，缺失补零长度 contour；topology 差异过大退化 cross-fade；用户可提供 `MorphAnchor` 强制对齐。

**`matching` 策略**专为公式/复合对象：按 `matchBy` 给子部件打 key，相同 key 做平滑变换（transformer），仅源有的淡出（remover），仅目标有的淡入（introducer）——即 Manim 的 `TransformMatchingTex` / reactive-manim 的 `TransformInStages` 模型。对 LaTeX，key 默认取 token/子表达式（见 §13）。

```ts
export function transformMatching(source: RegisteredObject2D, target: IMObject2D, options?: MorphOptions): Animation;
```

**Tween**（任意内部/外部属性）：

```ts
export interface TweenOptions { duration?: number; easing?: Easing; delay?: number; clamp?: boolean }
export type TweenProperty<TValue> =
  | { type: "transform"; key: string }
  | { type: "style"; key: string }
  | { type: "signal"; signal: Signal<TValue> }                       // 推荐：经响应式
  | { type: "external"; get: () => TValue; set: (value: TValue) => void };
```

> 注：`external` get/set 是非确定性逃生舱（外部状态不被时间线记录），seek 时可能不一致；优先使用 `signal` 通道，使参数变化纳入可重放范围。

### 11.5 可逆、可 seek 与确定性

明确区分三个性质：

- **可 seek（必须）**：任意 Track 都能在任意 `localProgress` 求值。tween/create/morph/fade 天然满足（纯函数）。
- **可逆（可选）**：能否负速率反向。`reverse` 需所有活跃 Track 提供逆映射或 from/to 完整记录；满足时 `setRate(<0)` 可用。
- **确定性（必须，除逃生舱外）**：相同 seed + 相同输入 ⇒ 相同输出。`call(effect)` 的副作用不可被 seek 重放，编译时标注为"不可 seek 边界"——seek 跨越它时只在正向实时播放触发，拖拽预览时跳过并告警。建议把状态变更尽量表达为 `tweenSignal` 而非 `call`。

## 12. 交互系统

交互是核心目标之一（参数拖拽、实时模拟、观众互动），需比 v0.1 更深入。

### 12.1 命中测试

WebGL 下细线/空心图形难以直接 raycast。策略：

- 为 `InteractiveTrait` 对象生成**不可见 pick 代理几何**（描边加粗为带状 mesh、点扩为圆盘），与可见几何分层但共享 transform。
- raycast 设阈值（line threshold）兜底。
- 命中按 `zIndex`/`renderOrder` 与 pick 优先级排序，返回最上层。

### 12.2 坐标反投影与拖拽

事件对象同时提供三套坐标，作者无需手动反投影：

```ts
export interface IntermactPointerEvent {
  readonly screen: Vec2;        // 像素
  readonly sceneAbs: AbsXY;     // 场景世界坐标（已反投影）
  readonly sceneRel: RelUV;     // 归一化
  readonly targetId?: string;
  readonly originalEvent: PointerEvent;
}
export interface IntermactDragEvent extends IntermactPointerEvent {
  readonly deltaAbs: AbsXY;
  readonly startAbs: AbsXY;
}
export interface PointerEventBinding<T> {
  readonly onPointerEnter?: (e: IntermactPointerEvent) => void;
  readonly onPointerLeave?: (e: IntermactPointerEvent) => void;
  readonly onPointerDown?: (e: IntermactPointerEvent) => void;
  readonly onDrag?: (e: IntermactDragEvent) => void;
  readonly onClick?: (e: IntermactPointerEvent) => void;
}
```

### 12.3 可拖拽控制点与交互几何

把交互与响应式打通：拖拽控制点直接写信号，依赖该信号的几何自动重算（§8）。这是"观众互动探索"的基本积木。

```ts
export function draggablePoint(sig: Signal<AbsXY>, opts?: DraggablePointOptions): IMObject2D;  // 自带 InteractiveTrait
export function draggableValue(sig: Signal<number>, axis: "x" | "y", opts?: DraggableValueOptions): IMObject2D;
```

```ts
const p0 = signal(xy(-2, 0)), p1 = signal(xy(0, 2)), p2 = signal(xy(2, 0));
scene.register(draggablePoint(p0)); scene.register(draggablePoint(p1)); scene.register(draggablePoint(p2));
scene.registerReactive(derived([p0, p1, p2], () =>
  bezierCurve({ points: [p0.get(), p1.get(), p2.get()], style: { stroke: "#38bdf8" } }),
));
// 拖动任意控制点，曲线实时更新——无需任何动画/重跑构建期
```

### 12.4 手势、键盘、焦点、可访问性

- 手势：滚轮缩放、双指 pan/zoom、拖拽 orbit（3D）。
- 键盘：空格 play/pause、方向键逐帧/逐章、`Home/End` 跳首尾。
- 焦点与可访问性：可交互对象暴露 `metadata.a11yLabel`，生成 DOM `aria` 节点叠加层；尊重 `prefers-reduced-motion`（见 §17），降级为瞬时状态切换。

## 13. 文本与 LaTeX 管线

对 Manim 替代品而言 LaTeX 是核心能力，需明确管线：

1. **LaTeX → 排版**：用 KaTeX（轻、快、覆盖常用）或 MathJax（覆盖更全）把公式排版为 SVG。
2. **SVG → 路径 → 几何**：解析 glyph path，弧长重采样得 `StrokeTrait`（writing 效果），earcut 三角化得 `FillTrait`（实心字形）；或转 MSDF 走 `troika-three-text` 路线渲染清晰文本。
3. **分部语义**：保留 token/子表达式到 glyph 的映射，作为 `TextLayoutTrait` 的部件 key，支撑 `transformMatching`（§11.4）在公式间平滑变形（如 `a²+b²` → `c²`）。
4. **writing**：默认 glyph path 逐笔 reveal；无 path 时退化为按字符 opacity reveal。
5. **字体**：普通文本用 troika MSDF（drei `Text` 基于它），异步加载字体（§14）。

```ts
export interface LatexObjectProps {
  readonly tex: string;
  readonly engine?: "katex" | "mathjax";
  readonly partKey?: (token: LatexToken) => string;  // 自定义分部匹配 key
  readonly style?: ObjectStyle;
}
```

## 14. 资源与异步生命周期

字体/LaTeX/SVG/数据都是异步的。为保证播放期确定性与可 seek，所有异步资源在**构建期的 prepare 阶段**完成解析。

```ts
export interface AssetManager {
  font(src: string): Promise<FontAsset>;
  latex(tex: string, engine?: "katex" | "mathjax"): Promise<GlyphLayout>;
  svg(src: string): Promise<ParsedSvg>;
  data<T>(src: string): Promise<T>;
  preload(specs: readonly AssetSpec[]): Promise<void>;
}
```

机制：

- program 中 `await ctx.assets.latex(...)` 等在构建期解析；解析期间 Player 尚未开始播放。
- 解析结果进入对象定义（不可变），播放期不再有未决异步，故任意 `seek(t)` 都得到稳定结果。
- 未在构建期声明、运行时才出现的资源（如交互中新加载数据）走"占位 + 重建"路径，并提示这部分不可被历史 seek 精确重放。

## 15. 渲染管线细节

把 v0.1 略过的硬问题显式化：

- **线宽单位**：默认世界单位（随缩放变化）；需要"恒定屏幕宽度"时声明 `lineWidth: { value, unit: "px" }`，由 `Line2`/meshline 在屏幕空间渲染。两种单位在类型上区分，避免歧义。
- **stroke reveal/trim**：基于 §5.1 的弧长前缀和，按 `revealStart/revealEnd` 截取，或用 shader 的 `uTrimStart/uTrimEnd` uniform，避免每帧重建几何。
- **填充**：earcut 三角化；自相交/带洞按 `fillRule` 处理；扫描线填充用 alpha mask shader。
- **z 序与透明**：2D 默认关闭 depthWrite，用 `renderOrder = f(zIndex)` 做画家算法；半透明对象按相机距离/zIndex 排序。
- **DPI/resize**：监听 devicePixelRatio 与容器尺寸，结合 §7.2 的 `fit` 策略更新投影；几何用世界单位，故 resize 不需重采样。
- **render target**：`RenderedScene`（§10.2）按需创建/复用 FBO，`live` 模式每帧重渲染，`snapshot` 模式只渲一次。
- **Worker**：重采样、三角化、marching squares/cubes、LaTeX 解析可放 Web Worker，避免阻塞主线程。

### 15.1 Renderer Adapter

适配层只消费 `RenderSnapshot`，不感知动画/时间线，便于替换后端。

```ts
export interface RenderSnapshot {
  readonly viewports: readonly ViewportSnapshot[];
  readonly objects: ReadonlyMap<string, ObjectRenderState>;
  readonly time: number;
}
export interface SceneRendererAdapter {
  mount(container: HTMLElement): void;
  render(snapshot: RenderSnapshot): void;   // 对上一帧做 diff
  dispose(): void;
}
```

> **v0.1 履约方式**：R3F 路径以 `SceneView` + `ThreeSceneView` 组件模型 diff 快照，未实现独立的 `mount/render` 适配器类；无头/WebGPU 后端在 M16/M17 补真正实现该接口的 adapter。

### 15.2 性能策略

1. 对象定义采样结果按 `(object, geometryVersion, sampleOptions)` memoize。
2. 仅更新变化的 RuntimeState，避免每帧重建 React tree。
3. 大量同类对象用 instancing（`InstancedTrait`）。
4. Morph 预计算源/目标点，播放期只做插值（CPU 或 shader）。
5. 大数据走 `Float32Array` 缓冲通道（§5.1），不走元组数组。
6. 复杂 SVG/LaTeX 异步解析（§14）+ Worker（§15）。

## 16. 错误处理、校验与可观测性

```ts
export type IntermactErrorCode =
  | "object-dimension-mismatch"
  | "scene-coordinate-mismatch"
  | "unsupported-animation"
  | "missing-trait"
  | "renderer-adapter-error"
  | "asset-load-error"
  | "non-seekable-side-effect"      // 拖拽预览跨越 call() 边界
  | "external-state-error";

export class IntermactError extends Error {
  constructor(readonly code: IntermactErrorCode, message: string, readonly detail?: unknown) { super(message); }
}
```

- **契约式校验**：dev 模式对工厂 props 做 schema 校验（可选 zod），对坐标空间、trait 缺失、域越界给出可定位报错；prod 模式跳过以省开销。
- **穷尽性**：所有按 `kind`/`type` 分发处用 `assertNever` 兜底，新增类型时编译期暴露遗漏。
- **strict 模式**：开启后把"非确定性逃生舱（external tween/call）"从 warning 升级为 error，用于需要严格可重放的导出/测试场景。
- **Inspector**：dev 期提供时间线检视器，展示 scene registry、每个对象的 visible/opacity/transform/reveal、当前活跃 Track、信号依赖图、坐标转换调试；支持点选对象高亮其 bounds 与 pick 代理。

## 17. 序列化、导出、嵌入与可访问性

呼应"输出格式受限"痛点——产物不应只是视频。

- **Storyboard 序列化**：对象树 + 时间线 + 初始信号值可序列化为 JSON；`call`/`external` 逃生舱不可序列化，序列化时降级或报错（strict）。可用于：保存/加载演示、把当前探索状态编码进**分享 URL**、服务端预渲染。
- **导出**：
  - 视频/GIF：Player 以固定 fps 逐帧 `seek` + 离屏渲染 + 编码（确定性保证逐帧一致）。
  - 静态快照：导出某一 `t` 的 PNG/SVG。
  - 可嵌入 HTML：打包成自带 Player 的 web component / iframe 片段。
- **语义层与讲义**：`metadata` 携带 `label/href/a11yLabel/note`，渲染时生成可点击超链接、脚注、旁注；可导出为带交互的讲义页面。
- **响应式布局**：`ResponsiveOptions` 定义断点下的 domain/视口/字号策略；UV 布局（§7.2、§10.4）让同一演示自适应不同容器。
- **可访问性**：尊重 `prefers-reduced-motion`（降级为瞬时切换）；为可交互对象生成 aria 叠加层；保证键盘可达（§12.4）。

```ts
// 以实现为准（§0.3 决策 5）：相较初版原型，新增 `scene`/`cameras`，使
// `deserialize` 无需重跑用户程序即可复原场景域/相机；`deserialize` 返回
// `DeserializedProgram`（Player + 维度 + 场景/相机元数据）而非裸 Player。
export interface SerializedProject {
  readonly version: string;
  readonly seed: number | string;
  /** 主场景描述（kind + 授时 props：2D domain/fit/background、3D coordinate/domain）。 */
  readonly scene: { readonly kind: "scene-2d" | "scene-3d"; readonly props: unknown };
  readonly objects: readonly SerializedObject[];
  readonly storyboard: SerializedStoryboard;
  readonly signals: Readonly<Record<string, unknown>>;
  /** 注册相机（3D 含 position/target/fov/near/far/projection/zoom）。 */
  readonly cameras: readonly SerializedCamera[];
}

/** 复原后的可播放程序（§17）。 */
export interface DeserializedProgram {
  readonly player: Player;
  readonly dimension: "2d" | "3d";
  readonly sceneKind: "scene-2d" | "scene-3d";
  readonly sceneProps: unknown;
  readonly camera3d?: RegisteredCamera3D;
}

export function serialize(player: Player, options?: SerializeOptions): SerializedProject;
// 反序列化先做结构化 schema 校验（`validateSerializedProject`），损坏/被篡改
// 的载荷以清晰的 `serialization-error` 快速失败。
export function deserialize(data: SerializedProject): DeserializedProgram;

// 分享 URL（base64url，UTF-8）：`decodeShareUrl` 支持 `maxBytes` 上限（默认 2 MB）
// 以拒绝超大/恶意载荷。导出工具（@intermact/react）：`recordCanvasVideo`（自动协商
// MediaRecorder mime）、`captureFrameSequencePng`（定帧确定性 PNG 序列）、
// `encodeGif`/`exportCanvasGif`（无依赖 GIF89a）、`buildEmbedIframe`（自包含 iframe 片段）。
export function decodeShareUrl(encoded: string, options?: { maxBytes?: number }): SerializedProject;
```

## 18. 扩展性：插件与注册表

为支撑"完整系统"的长期演进，对象/生成器/动画/渲染器都通过注册表扩展，新增能力不改 core。

```ts
export interface Registries {
  // type -> 按名构造 + 发现（descriptor.create(params)）；渲染/序列化复用 trait 管线，
  // 不经 descriptor 分发（§0.3 M17 决策②；自定义序列化 experimental）。
  readonly objects: Registry<string, ObjectTypeDescriptor>;
  readonly animations: Registry<string, AnimationCompiler>;     // kind -> 编译为 Track
  readonly generators: Registry<string, GeneratorDescriptor>;   // PCG 生成器
  readonly renderers: Registry<string, RendererFactory>;        // 渲染后端（WebGPU 为 PoC）
}
export interface IntermactPlugin {
  readonly name: string;
  install(registries: Registries): void;
}
export function definePlugin(plugin: IntermactPlugin): IntermactPlugin;
// 定义站点保留参数类型 P 的恒等辅助（注册表内擦除为 unknown 存储）：
export function defineObjectType<P>(d: ObjectTypeDescriptor<P>): ObjectTypeDescriptor<P>;
export function defineGenerator<P>(d: GeneratorDescriptor<P>): GeneratorDescriptor<P>;
```

例如未来加 WebGPU 后端 = 注册一个 `RendererFactory`；加"分形生成器库" = 注册若干 `GeneratorDescriptor`；都不触碰核心模型。

**注册表注入（§22.8 结构性约束）**。`globalRegistries` 是便捷默认，但**可注入**以隔离插件集（多 program、并发构建、并行测试、`src`/`dist` 双实例）：`BuildOptions.registries` 透传至 `Scene2D/3D` → `StoryboardBuilder.resolveAnimation`；`ctx.registries` 暴露给程序与生成器；`DeserializeOptions.registries` 让 `custom` 动画在反序列化端用同一 bundle 解析（缺失即 `unsupported-animation` 快速失败）。`globalRegistries` 经 `globalThis` + `Symbol.for` 单例化，双实例时共享一份并告警。`custom.params` 在 `customAnimation()` 处做 **JSON-safe 校验**（拒绝函数/symbol/undefined/bigint/非有限数/Map/Set/Date/类实例/循环引用），保证 serialize→deserialize 往返。

## 19. 实例程序

### 19.0 Program 与上下文

用户程序是接收构建期上下文的（异步）函数；上下文提供场景/相机工厂、资源管理、种子化随机、挂载入口。

```ts
export interface IntermactProgramContext {
  createScene2D(props: Scene2DProps): Scene2D;
  createScene3D(props: Scene3DProps): Scene3D;
  createCamera2D(scene: Scene2D, props?: Camera2DProps): RegisteredCamera<Transform2D>;
  createCamera3D(scene: Scene3D, props?: Camera3DProps): RegisteredCamera<Transform3D>;
  mount(scene: Scene2D | Scene3D, camera: RegisteredCamera<unknown>, rect?: { min: RelUV; max: RelUV }): void;
  readonly assets: AssetManager;
  readonly rng: Rng;
  readonly registries: Registries;   // 本次构建解析自定义对象/动画/生成器/后端用（§18、§22.8）
}
export type IntermactProgram = (ctx: IntermactProgramContext) => void | Promise<void>;
export function createProgram(program: IntermactProgram): IntermactProgram;
```

### 19.1 基础 2D：创建、显示轴、分部匹配 Morph

```tsx
import { bezierCurve, circle, createProgram, morph, rectangle, sequence, wait, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    fit: "contain",
    background: "#0b1020",
  });
  const camera = ctx.createCamera2D(scene, { zoom: 1 });
  ctx.mount(scene, camera);

  const disk = scene.register(
    circle({ radius: 1, style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.22)", lineWidth: 0.035 } }),
    { position: xy(-1.2, 0) },
  );
  const curve = scene.register(
    bezierCurve({ points: [xy(-2, -1.5), xy(-1, 1.5), xy(1, -1.5), xy(2, 1.2)], style: { stroke: "#f97316", lineWidth: 0.03 } }),
  );

  const axes = scene.getAxes({ x: [-4, 4], y: [-3, 3], xLabel: "x", yLabel: "y", style: { stroke: "#94a3b8" } });
  await scene.play(axes.fadeIn({ duration: 0.6 }));
  await scene.play(disk.create({ duration: 1.2 }), curve.create({ duration: 1.2 }));
  await scene.play(wait(0.25));

  await scene.play(sequence(
    morph(disk, rectangle({ width: 2.4, height: 1.4, cornerRadius: 0.1, style: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.24)", lineWidth: 0.035 } }), { duration: 1.1, strategy: "arc-length" }),
    disk.moveTo(xy(1.2, 0), { duration: 0.7 }),
  ));
  scene.marker("after-morph");   // 章节书签，便于演示跳转
});

export function BasicSceneExample() {
  return <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />;
}
```

### 19.2 交互式：Leva + ValueTracker 驱动，参数可拖拽探索

```tsx
import { useEffect, useMemo } from "react";
import { useControls } from "leva";
import { axes, createProgram, decimalNumber, derived, functionGraph, signal, uv } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

export function InteractiveSineExample() {
  const leva = useControls({
    amplitude: { value: 1, min: 0.1, max: 2, step: 0.05 },
    frequency: { value: 1, min: 0.2, max: 4, step: 0.05 },
  });

  // 信号在组件作用域创建并被 program 闭包捕获——构建期只跑一次
  const { amp, freq, program } = useMemo(() => {
    const amp = signal(1);
    const freq = signal(1);
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({ coordinate: "cartesian", domain: { x: [-6.5, 6.5], y: [-2.6, 2.6] } });
      ctx.mount(scene, ctx.createCamera2D(scene));

      const ax = scene.getAxes({ x: [-6, 6], y: [-2, 2] });
      // derived：曲线是 amp/freq 的函数，信号变化即重算（无需重跑构建期）
      scene.registerReactive(derived([amp, freq], () =>
        functionGraph(ax.handle, (x) => amp.get() * Math.sin(freq.get() * x), { domain: [-6, 6], samples: 256, style: { stroke: "#22c55e" } }),
      ));
      scene.register(decimalNumber(amp, { prefix: "A = ", digits: 2 }), { position: uv(0.04, 0.92) });

      await scene.play(ax.create({ duration: 0.5 }));
    });
    return { amp, freq, program };
  }, []);

  // 把 Leva 值持续写入信号；只更新参数，不重建 program
  useEffect(() => { amp.set(leva.amplitude); }, [amp, leva.amplitude]);
  useEffect(() => { freq.set(leva.frequency); }, [freq, leva.frequency]);

  return <IntermactCanvas program={program} autoplay />;
}
```

要点：构建期只运行一次，交互通过 `Signal` 驱动 `derived` 重算，避免 v0.1 中"每次改参数都用 `useMemo` 重建整个 program"的浪费。若需把参数纳入可序列化分享范围，用 `tweenSignal`/信号初值而非 `external` 通道（§11.4、§17）。

### 19.3 实验解耦：加载训练快照（3D）

```tsx
import { axes3D, createProgram, pointCloud3D, polyline3D, surface3D, xyz } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const snapshots = await ctx.assets.data<TrainingSnapshot[]>("/data/training-snapshots.json"); // prepare 阶段解析
  const scene = ctx.createScene3D({ coordinate: "cartesian", domain: { x: [-3, 3], y: [-3, 3], z: [0, 4] }, background: "#020617" });
  const camera = ctx.createCamera3D(scene, { projection: "perspective", fov: 45, lookAt: xyz(0, 0, 1) });
  ctx.mount(scene, camera);

  const lossSurface = scene.register(surface3D({ u: [-3, 3], v: [-3, 3], samples: [80, 80], fn: (x, y) => Math.sin(x) * Math.cos(y) + 2, style: { color: "#0ea5e9", opacity: 0.38 } }));
  const trajectory = scene.register(polyline3D({ points: snapshots.map((s) => xyz(s.weights[0][0], s.weights[0][1], s.loss)), style: { color: "#f97316", lineWidth: 0.02 } }));
  const finalCloud = scene.register(pointCloud3D({ points: snapshots.at(-1)?.weights.map(([x, y, z]) => xyz(x, y, z)) ?? [], style: { color: "#facc15", size: 0.05 } }));

  const axes = scene.getAxes({ x: [-3, 3], y: [-3, 3], z: [0, 4] } as Axes3DProps);
  await scene.play(axes.fadeIn(), lossSurface.create({ duration: 1.2 }));
  await scene.play(trajectory.create({ duration: 1.5 }));
  await scene.play(finalCloud.create({ duration: 0.8 }));
});

export function TrainingVisualizationExample() {
  return <IntermactCanvas program={program} autoplay controls={{ orbit: true, timeline: true }} />;
}
```

训练在外部完成，Intermact 仅消费快照，不在渲染帧重训。

### 19.4 PCG：种子化 L-system 生长动画

```tsx
import { createProgram, lSystem, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({ coordinate: "cartesian", domain: { x: [-5, 5], y: [0, 10] }, background: "#0b1020" });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // 生成器无副作用，随机来自注入的种子化 RNG —— 同 seed 可复现、可分享
  const plant = scene.register(lSystem({
    axiom: "X",
    rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" },
    iterations: 5,
    angle: 25,
    jitterAngle: 2,                  // 角度抖动幅度（度）
    rng: ctx.rng.fork("plant"),      // 注入种子化随机：同 seed 可复现、可分享
    style: { stroke: "#34d399", lineWidth: 0.02 },
  }));

  await scene.play(plant.create({ duration: 3, stroke: { mode: "path-order" } })); // 沿生长顺序"画"出植物
});

export function LSystemExample() {
  return <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />;
}
```

### 19.5 嵌套渲染：3D Scene 作为 2D 面板

```tsx
import { createProgram, rectangle, render, textObject, uv, xy, xyz } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const canvasScene = ctx.createScene2D({ coordinate: "cartesian", domain: { x: [0, 16], y: [0, 9] } });
  ctx.mount(canvasScene, ctx.createCamera2D(canvasScene));

  const threeD = ctx.createScene3D({ coordinate: "cartesian", domain: { x: [-2, 2], y: [-2, 2], z: [-2, 2] } });
  const threeDCam = ctx.createCamera3D(threeD, { projection: "perspective", lookAt: xyz(0, 0, 0) });
  const rendered3D = render(threeD, threeDCam);   // 子场景作为纹理对象

  const panel = canvasScene.register(rectangle({ width: 7, height: 5, style: { fill: "#111827", stroke: "#475569", lineWidth: 0.03 } }), { position: xy(11.5, 4.5) });
  const view = canvasScene.register(rendered3D, { position: xy(11.5, 4.5), scale: [6.8, 4.8], anchor: uv(0.5, 0.5) });
  const title = canvasScene.register(textObject({ text: "3D View", fontSize: 0.36, style: { fill: "#e5e7eb" } }), { position: xy(1, 8.2) });

  await canvasScene.play(panel.fadeIn(), view.fadeIn(), title.create());
});

export function NestedSceneExample() {
  return <IntermactCanvas program={program} autoplay />;
}
```

## 20. 实现路线

### 20.1 MVP（第一层：可交互 Manim 替代品）

1. 核心模型：`IMObject2D`、trait/capability、`RegisteredObject2D`、不可变 RuntimeState。
2. **保留模时间线 + Player**：`Storyboard`、`Track`、`seek/play/pause`（确定性根基，优先级最高）。
3. 2D primitives：Circle/Ellipse/Rectangle/Arc/Polygon/BezierCurve/Line/Arrow。
4. 基础动画：Create、Fade、Move/Rotate/Scale、Tween（数据+解释器）。
5. 坐标系统：cartesian 2D、abs/rel/fit、`getAxes` + RegisteredObject 动画。
6. R3F adapter：path stroke（含 trim）、shape fill（earcut）、basic material。
7. 响应式最小集：`signal`/`computed`/`valueTracker` + `derived`/`addUpdater`。
8. 示例：§19.1、§19.2。

### 20.2 第二阶段（第二层：数理工具箱）

1. Scale（linear/log/pow/time）+ ticks/format。
2. 数理构件：NumberLine/Axes/NumberPlane/PolarPlane、FunctionGraph/Parametric/Area/Riemann/Tangent、Matrix/Table/Brace/DecimalNumber。
3. Morph：arc-length/anchor/cross-fade + **matching（公式分部）**。
4. Text/LaTeX：KaTeX→path→writing；`transformMatching`。
5. 交互：命中测试、拖拽反投影、`draggablePoint`/`draggableValue`。
6. 布局：anchor/nextTo/alignTo/fitTo/arrange；Inspector。

### 20.3 第三阶段（第三层：PCG 演示系统）

1. PCG：Field/Sampler（isoline/heatmap/vectorField/streamlines）、参数/晶格、L-system/fractal/graph/CA、数据驱动、组合算子、种子化 RNG。
2. 3D 全量：Curve3D/Surface3D/Mesh/PointCloud/Axes3D；相机 orbit/dolly/quaternion；marching cubes。
3. 序列化/分享 URL；导出视频/快照/可嵌入 HTML；语义层/讲义；响应式布局。
4. 性能：instancing、Worker、Float32Array 通道、大规模数据流。
5. 扩展：插件/注册表、（可选）WebGPU 后端。

## 21. 测试策略

1. **确定性时间线快照**：固定 seed，对若干采样 `t` 求值 `Storyboard`，断言数值快照（核心回归手段，依赖 §3.2 的纯函数 evaluate）。
2. **Geometry 单元测试**：采样点数、bounds、弧长、闭合路径、三角化、SVG/LaTeX 解析。
3. **坐标/Scale 测试**：abs/rel 往返、fit 策略、极坐标边界、linear/log/pow/time scale 与 ticks。
4. **响应式测试**：信号变化触发最小重算、依赖图无遗漏/无多余、updater 卸载。
5. **Morph 测试**：不同点数/contour 数、matching 的 key 匹配与 remover/introducer、property-based 随机形状。
6. **Player 测试**：seek/rate/loop/marker、跨 `call` 边界的告警、可逆性。
7. **Renderer 契约测试**：同一 `RenderSnapshot` 在不同后端产出一致语义；smoke test 不抛错。
8. **视觉回归**：关键示例截图对比。
9. **性能预算**：大对象数/大数据帧时间基准，设阈值防退化。

## 22. 关键设计约束

1. 定义不可变；动画/响应式只写 RuntimeState；Morph 替换实例引用的定义。
2. 公共 API 用函数与组合（trait/算子），不要求继承基类。
3. **凡进入时间线的动画都必须可 seek**；非确定性副作用集中于 `call`/`external` 并显式标注。
4. `Create`/`FadeIn` 等在 `play` 前不显示对象。
5. 时间是一等数据：程序产出可检视/序列化的 Storyboard，Player 负责求值。
6. core 不依赖 React/Three/DOM；渲染器、对象、生成器、动画均可经注册表扩展。
7. Camera 注册进 Scene、可动画、可父子挂载，但不混入普通几何对象接口（v0.1 2D 路径为偏差，见 §10.1）。
8. 构建期无进程级全局可变状态；多 program 并发构建须互不干扰（见 §3.2）。注册表（§18）与字体注册表均**可注入/作用域化**：`globalRegistries` 仅为便捷默认（`globalThis`+`Symbol.for` 单例 + 双实例告警），隔离场景经 `BuildOptions.registries`/`DeserializeOptions.registries`/`ctx.registries` 注入；每次 `buildProgram` 用全局字体注册表的**子作用域**（`FontRegistry(parent)`，构建内加载的字体不外泄、全局预载字体仍可见）。**残留**：同步字形 API（`glyphFor`/`textObject`）经单一 active 指针读取该作用域，故在 program 中途 `await` 的**并发交错构建**仍共享 active 指针——此边角需显式注入注册表或全局预载字体。
9. Scene 不依赖 Canvas；Canvas 可挂载多视口（rect）并嵌入 `RenderedScene`。
10. 外部实验数据经构建期资源解析或信号注入，不在渲染帧重复昂贵计算。
11. PCG 随机必须来自种子化 RNG，保证可复现与可分享。
