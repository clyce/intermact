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
  - M1 示例：`timeline/seek-basics`、`timeline/markers-slides`、`timeline/headless-eval`（示例暂用内联 SVG 可视化 + 时间线控件，真正的 R3F 渲染在 M3 接入）。确定性时间线快照测试已纳入 `pnpm run test`/`ci`。
- **M2 · 2D 几何与采样**（已完成）：
  - 按 §5 落地 8 类图元工厂：`circle/ellipse/rectangle(含圆角)/arc/polygon(含洞)/bezierCurve(二次/三次链)/line/arrow`，均产出不可变 `IMObject2D` + 组合 trait（`stroke`，闭合形加 `fill`/`morphable`）。
  - 几何内核：`resampleByArcLength`（弧长均匀重采样）、`cumulativeLengths`（前缀和，含闭合段）、`SampledPath2D`/`SampledContour2D`（`Float32Array` 缓冲通道）、`pointsToTuples`（作者层元组通道）、`earcut` 三角化（`triangulate`，首轮廓为外环、其余为洞）、`computeBounds`（AABB）。
  - `GeometryProvider2D` 由 `createGeometryProvider2D` 统一构建：`samplePath(opts)` 支持按 `samples` 弧长重采样、`getBounds`、`sampleBuffer` 缓冲通道；trait 经 `strokeTraitFrom/fillTraitFrom/morphableTraitFrom` 组合。
  - 单测覆盖：采样点数、弧长（圆周长≈2πr）、bounds、带洞三角化面积（外−洞）、缓冲/元组通道一致性。
  - M2 示例：`geometry/primitives-gallery`、`geometry/sampling-debug`（暂用内联 SVG 几何渲染叠加采样点/bounds/三角网，真正的 R3F 渲染在 M3）。
- **M3 · R3F 渲染适配**（已完成）：
  - `render-three`（无 React）：`buildStrokeGeometry`（世界单位 ribbon + 按弧长 trim 实现描边 reveal）、`buildFillGeometry`（earcut→索引几何）、`makeBasicMaterial`（unlit + transparent + `depthWrite=false`，2D 画家算法）、`parseColor`（解析 rgba/hsla alpha）、`ThreeObjectView`/`ThreeSceneView`（按 id 增量 diff 快照 → three 场景图，仅变化项重建几何）、`SceneRendererAdapter` 接口（§15.1，R3F 路径由 SceneView 履行）。
  - `render-r3f`：`computeFit`（contain/cover/stretch 正交相机适配 + worldPerPixel）、`SceneView`（R3F 内组件：托管 `ThreeSceneView`，`useFrame` 驱动 Player 并 diff 更新，resize/DPI 由 R3F 处理，相机随域重拟合）。
  - `react`：`IntermactCanvas`（构建程序 + R3F `<Canvas orthographic>` + 背景色 + 时间线控件叠层）、`useIntermactPlayer` hook、`TimelineControls`（DOM 叠层：scrub/播放/速率/反向/loop）。
  - **px 线宽**：以视口 `worldPerPixel` 换算为世界单位 ribbon 近似恒定屏幕宽度；独立的屏幕空间描边 shader 推迟（后续里程碑）。
  - **健壮性**：`SceneView` 对 `useFrame` 的 delta 做 `min(delta,0.05)` 截断，避免标签页后台恢复时的大 delta 跳帧。
  - **构建**：库包 tsconfig 覆盖 `paths:{}`，使 tsup 的 dts 生成经 node 解析到各依赖包的 `dist/*.d.ts`（按 pnpm 拓扑序），根 tsconfig 仍用 `paths` 指向源码做开发期类型检查。
  - 浏览器验证：stroke/fill/even-odd、描边 trim reveal（t=0 未绘制、随 seek 平滑画出）、z 序 + 半透明合成、非方形容器下圆形不失真（相机 contain 适配）、px 细线清晰；smoke 测试（geometry builders + `ThreeSceneView` 增删改）通过。
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
  - **Arrow**：主轴止于箭头底边中心；箭头为底边垂直于主轴且被主轴平分的实心等腰三角形（`fill` + `stroke`）。
  - **Stroke trim**：闭合轮廓的弧长计量包含「末点→首点」闭合段；`revealEnd→1` 时不再瞬间跳满（修复开放/闭合图元节点数与线段数差异带来的进度偏差）。
- **M6 · 响应式最小集**（已完成）：
  - `signal/computed/valueTracker`、`derived`、`ReactiveEngine`（依赖版本 + 最小重算）、`addUpdater`、`tweenSignal`（seekable `SignalTrack`）、`bindSignal`。
  - 构建期 `setSignalRegistrar` 自动注册 program 内创建的信号；每帧 `Player.prepareFrame` → `ReactiveEngine.flush` 在快照前重算 derived/运行 updater。
  - `@intermact/react`：`useSignal` hook。
  - M6 示例：`reactive/value-tracker`（§8.2 双曲线内接矩形）、`reactive/leva-binding`（§19.2 精简）。
- **◆ L1 · v0.1 验收**（已完成）：
  - `pnpm run ci` 全绿（lint + typecheck + 62 项 vitest + depcruise + build）；时间线确定性快照测试保留在 CI。
  - 可运行示例：`l1/basic-2d`（§19.1：Create/轴/arc-length morph/seek）、`l1/interactive-sine`（§19.2：Leva→Signal→derived 曲线实时重算）。
  - **与 §19.2 的微小偏差**：`decimalNumber` 在示例中用 `xy` 世界坐标定位（非 `uv` HUD 贴边）；完整视口级 UV 布局在 Canvas/HUD 里程碑细化。

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
- **三角化**：填充用 earcut 处理凹多边形/带洞图形；`fillRule` 决定 nonzero/evenodd。
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
export interface SerializedProject {
  readonly version: string;
  readonly objects: readonly SerializedObject[];
  readonly storyboard: SerializedStoryboard;
  readonly signals: Readonly<Record<string, unknown>>;
  readonly seed: number | string;
}
export function serialize(player: Player): SerializedProject;
export function deserialize(data: SerializedProject): Player;
```

## 18. 扩展性：插件与注册表

为支撑"完整系统"的长期演进，对象/生成器/动画/渲染器都通过注册表扩展，新增能力不改 core。

```ts
export interface Registries {
  readonly objects: Registry<string, ObjectTypeDescriptor>;     // type -> 采样/序列化/渲染映射
  readonly animations: Registry<string, AnimationCompiler>;     // kind -> 编译为 Track
  readonly generators: Registry<string, GeneratorDescriptor>;   // PCG 生成器
  readonly renderers: Registry<string, RendererFactory>;        // 渲染后端
}
export interface IntermactPlugin {
  readonly name: string;
  install(registries: Registries): void;
}
export function definePlugin(plugin: IntermactPlugin): IntermactPlugin;
```

例如未来加 WebGPU 后端 = 注册一个 `RendererFactory`；加"分形生成器库" = 注册若干 `GeneratorDescriptor`；都不触碰核心模型。

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
7. Camera 注册进 Scene、可动画、可父子挂载，但不混入普通几何对象接口。
8. Scene 不依赖 Canvas；Canvas 可挂载多视口（rect）并嵌入 `RenderedScene`。
9. 外部实验数据经构建期资源解析或信号注入，不在渲染帧重复昂贵计算。
10. PCG 随机必须来自种子化 RNG，保证可复现与可分享。
