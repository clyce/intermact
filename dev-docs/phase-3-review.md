# 13. Phase-3 代码评审（Code Review · 2026-06-10）

本节是对已落地的 Phase-3（v1.0，里程碑 **M13–M17**）实现的系统性代码评审与对齐度检查，并附**全项目代码健康度检查**（DRY / 组合优于继承 / React 风格函数式）与 **examples / docs 覆盖率检查**。结论基于对 `packages/*/src` 全量源码、`*.test.ts`、`examples/`、`docs/`、文档（`dev-docs/intro.md`、`design.md`、`dev-roadmap.md`）与工具链配置的逐文件审阅，并配合实测命令验证。

> 约定：`[严重度]` 分为 **阻断**（破坏既有契约/数据正确性/CI 红）、**高**（功能缺陷或与设计稿冲突）、**中**（健壮性/性能/可维护性）、**低**（打磨项）。建议清偿优先级见 §13.9。
>
> 与 `design.md §0.3` / `dev-roadmap.md §6` 各处「见 `phase-3-review.md §13.x`」的引用对应：§13.1=M13、§13.2=M14、§13.3=M15、§13.4=M16、§13.5=M17。

## 13.0 实测验证状态（2026-06-10）

`pnpm run ci` **全绿**，所有门禁一次通过：

| 门禁 | 命令 | 初评实测 | 清偿后实测 |
| --- | --- | --- | --- |
| Lint | `eslint . && prettier --check .` | ✅ 零错 | ✅ 零错 |
| 类型 | `tsc -p tsconfig.json --noEmit` | ✅ | ✅ |
| 测试 | `vitest run` | ✅ 36 文件 / 244 用例（7.8s） | ✅ **40 文件 / 296 用例** |
| 依赖分层 | `depcruise packages` | ✅ 199 模块 / 825 依赖 / 0 违规 | ✅ **210 模块 / 911 依赖 / 0 违规** |
| 构建 | `pnpm -r build` | ✅ 4 包 ESM+DTS | ✅ 4 包 ESM+DTS |
| 版本 | `package.json` + 源内 `VERSION` | ✅ 4 包均 `1.0.0`，一致 | ✅ |
| 文档站 | `gen:reference` + `build:site` | — | ✅ 重生 + 校验通过 |

**清偿后验证（2026-06-10 后续）**：本次评审 §13.9 列出的 P0–P3 全部清偿（逐项见 **§13.11**），「实现更优」偏差固化于 `design.md §0.3.1`，「设计更优」差距以代码补齐到契约（M14 `RenderedScene` core 化 + 多视口、M17 registries 注入化 + 字体注册表作用域化、3D 管线补完、序列化稳健化与 GIF/iframe/SVG 定帧导出）。`design.md §0.3` / `dev-roadmap.md` / `v1-checklist.md` 测试数字已统一为"以 CI 实测为准"（验收时 244、清偿后 296），§13.8 全部不一致已闭环。

**核心结论**：Phase-3 五个里程碑功能性落地扎实，门禁健康，**无阻断级问题**；`design.md §0.3` 对各里程碑偏差的记录总体诚实准确。本次评审的主要发现集中在：① M14 的 `RenderedScene`/多视口与设计稿 §10.2/§10.4 仍有系统性差距（部分未充分文档化）；② M17 `globalRegistries` 与 §22.8「构建期无进程级全局可变状态」存在结构性张力（Phase-1 删除 signal registrar 的同类风险）；③ M16 InstancedMesh 视锥剔除/morph 路径两处渲染正确性风险；④ 若干「无 RNG 时静默回退」破坏 PCG 确定性语义；⑤ docs 站对 Phase-3 的教程级覆盖明显滞后于代码与示例。**以上 ①–⑤ 均已于清偿阶段解决（§13.11）。**

### 13.0.1 总体评价（按里程碑）

- **M13 PCG**：§6.2–§6.6 主体 API 齐备、headless 分层被 depcruise 强制、全目录无 `Math.random()`、同 seed 复现有测试固化。主要问题是 `stitchSegments` 单向拼接、无 RNG 时的静默回退、`booleanOp` 仅取首轮廓（§13.1）。
- **M14 3D**：四元数/marching-tetrahedra/Scene3D/相机时间线质量高，2D 零回归。主要差距在 `RenderedScene` 数据契约、多视口渲染、相机父子挂载 API、3D trait 为空数组（§13.2）。
- **M15 序列化**：op-log + pristine + 烘焙的架构选择正确，Phase-1 五项序列化债均有代码落点。主要缺口是帧哈希覆盖矩阵（tweenSignal/matching morph/文本无往返断言）、`deserialize` 无 schema 校验、web component 重连泄漏（§13.3）。
- **M16 性能**：§15.2 六策略中 #1/#3/#4/#6 基本落实、#2/#5 部分落实。两处高优渲染风险：InstancedMesh 未关视锥剔除、instanced 视图不处理 `geometryOverride`（§13.4）。
- **M17 插件**：注册表/插件/custom 动画链路完整，「不改 core 扩展」端到端成立。结构性问题是 `globalRegistries` 的进程级可变状态（§13.5）。

源码 TSDoc 普遍标注对应 `design.md` 章节，延续 Phase-1/2 的文档水准；但公共几何工厂函数（`circle`/`ellipse` 等）的函数级 JSDoc 偏弱（§13.6.4）。

## 13.1 M13 — PCG 核心（`pcg/*`、`geometry/boolean.ts`、`random/*`）

### 13.1.1 与设计稿对齐情况

| API（design §6.2–§6.7） | 状态 | 说明 |
| --- | --- | --- |
| `ScalarField2D`/`VectorField2D`/`ScalarField3D` + 构造器 | ✅ | `field.ts`；另导出 `vectorMagnitudeField` |
| `isoline` / `heatmap` / `vectorFieldObject` / `streamlines` | ✅ | heatmap 走逐格 `fillGroupColors`（§0.3 已记，纹理化留 M16+） |
| `isosurface` | ✅ 偏差 | M14 落地；签名 `isosurface(field, opts?)`，`level` 在 opts 内而非设计稿第二参数 |
| `parametricCurve2D` | ✅ | — |
| `parametricSurface3D` | ⚠️ 缺位 | PCG 层无此名；能力由 `object3d/factories.ts` 的 `surface3D` 提供，设计稿未同步 |
| `lattice` / `tiling` | ✅ 偏差 | `lattice` 仅 2D（设计稿为 2D\|3D 联合） |
| `lSystem` / `fractal` / `recursiveTree` / `graphObject` / `cellularAutomaton(+Frames)` | ✅ | — |
| `mapData` / `barChart` / `scatter` / `lineChart` | ✅ | 经 §7 `linearScale` |
| `transformObject` / `repeatObject` / `instanceField` / `mapPoints` / `along` | ✅ 偏差 | `repeat`→`repeatObject` 改名（已文档化）；算子仅 2D |
| `booleanOp` | ✅ 偏差 | Greiner–Hormann，限简单横切多边形（已文档化）；**仅取两侧 `contours[0]`**（见下） |
| `createRng` / `fork`（§6.7） | ✅ | mulberry32；全 `pcg/` 目录 grep 无 `Math.random()` |

依赖分层：`pcg/**` import 仅限 `math/geometry/object/constructs/random`，`pcg-headless-deps` 规则 0 违规 ✅。

### 13.1.2 问题清单

- **[高] 无 RNG 时的静默非随机回退**（确定性语义破坏）：
  - `pcg/lsystem.ts:105,112`：`jitterAngle > 0` 但未注入 `rng` 时用 `spec.rng?.next() ?? 0.5` —— 抖动恒为 0（`0.5*2*j-j`），既非随机也无告警；
  - `pcg/graph.ts:175-176`：`layout:"force"` 无 `rng` 静默回退 `circular`；
  - `pcg/cellular-automaton.ts:95-110`：`init:"random"` 无 `rng` 回退单中心细胞/全死格。
  - **建议**：统一策略——需要随机而未注入 `rng` 时抛 `IntermactError("invalid-argument")`（headless 宜 fail-fast），并在 §6.7 文档化。
- **[高] `stitchSegments` 仅从尾部单向延伸**（`pcg/marching-squares.ts:152-182`）：种子段若落在开曲线中段，其「头侧」段不会并入同一折线而是另起新线——开等值线可能被拆成多条。测试仅断言 `longest > 10`，未锁定「单条闭合圆 → 1 条折线」。**建议**：补反向延伸 + 首尾 eps 闭合检测，并加 stitch 条数断言。
- **[中] `streamlines` RK4 子步可在域外采样**（`pcg/field-objects.ts:214-222`）：`clipToDomain` 只检查终点，`k2/k3/k4` 可能采样域外向量场。**建议**：子步前 clamp 或域外返回零向量。
- **[中] `booleanOp` 仅取两对象首轮廓**（`pcg/operators.ts:233-239`）：多轮廓/带洞对象结果错误且无告警。**建议**：文档限制 + 多轮廓时抛错或迭代外轮廓。
- **[中] marching squares 鞍点用 cell-center 平均消解**（`marching-squares.ts:109-119`）：标准但非拓扑一致，复杂场可能虚假分支。**建议**：文档注明限制。
- **[低] `fractal.ts:115`**：IFS `maps` 为空时 `rng.int(0,-1)` 行为未定义，应抛错。
- **[低] CA 边界条件不对称未类型化**：1D 周期边界 vs 2D 固定死边界，建议 `boundary?: "wrap" | "fixed"` 显式化。
- **[低] `parametric.ts:30`**：`closed ? samples : samples` 无意义三元，疑似闭合采样逻辑残留。
- **[低/DRY] 「N 段折线近似圆」在 4 处重复**：`graph.ts:191`、`data.ts:131`、`fractal.ts:119`、`parametric.ts:91`。建议抽 `approxCircle(center, radius, segments)`。
- **[低] 空结果占位 `[xy(0,0), xy(0,0)]`**（`field-objects.ts:40,228`）：污染 bounds/hit-test，建议 `emptyObject2D` 语义化。
- **[低/测试] 覆盖缺口**：`vectorFieldObject`、`cellularAutomatonFrames`、`tiling`/`lattice`、tree 布局、随机 init、`rng.gaussian/pick` 均无专项断言。

### 13.1.3 示例符合度

`pcg/*` 6 示例齐全且注册；但 `cellular-automaton` 仅 Rule 30 静态时空图（退出标准提及的「步进驱动演化动画」未演示）；`data-driven-bars` 未演示 roadmap 明确要求的 `mapData` + key 复用；`fractal-graph.tsx:14` 注释写 IFS、实现是 `sierpinski`（注释与实现不符）。

## 13.2 M14 — 3D 全量（`math/quaternion`、`object3d/*`、`scene/scene3d|camera3d`、render 3D）

### 13.2.1 与设计稿对齐情况

| 契约项 | 状态 | 说明 |
| --- | --- | --- |
| §5.3 六类 3D 工厂 | ✅ | `polyline3D/curve3D/meshObject/surface3D/pointCloud3D/axes3D` |
| `group3D` | ⚠️ 偏差 | 设计为不可变工厂 `group3D(children: IMObject3D[])`；实现为 `Scene3D.group3D(registered[])` 场景级父子挂载，无几何聚合/`parts`，无法做 3D morph matching |
| §10.1 相机注册进 Scene、可动画 | ✅(3D)/⚠️(2D) | 3D 相机为可 seek 时间线节点；2D 相机仍游离（v0.1 偏差已文档化） |
| 相机父子挂载（相机跟随对象） | ❌ | 相机背板是 `RegisteredObject3D` 但不对外暴露 `node`，`setParent` 无法触及；`addUpdater` 未实现 |
| §10.2 `RenderedScene` | ❌ 显著偏差 | 无 core 级 `render(scene, camera) → IMObject2D`（`type:"rendered-scene"`、`textureMode: live\|snapshot`）；现为 R3F 组件「2D Player → FBO 贴图」变通，**§0.3 未充分记录此差距** |
| §10.4 多视口 | ❌ | `ctx.mount` 记录 viewports，但构建只取 primary、Canvas 只渲染单全屏视口；`build.ts:62` 注释仍写「M12/M15」 |
| §9.1 `Scene3D.coordinate` / `getAxes` | ❌ | 无 `CoordinateTransform3D` 与 `RegisteredAxes3D`；`axes3D` 仅是几何工厂 |
| marching cubes | ✅ 变体 | marching-tetrahedra（水密性 + 面积 + 字节复现测试质量高） |

### 13.2.2 问题清单

- **[高] `RenderedScene` 与多视口未达设计契约且文档化不足**（见上表）。**建议**：要么补 core 级 `render()` 工厂 + 多 rect 渲染，要么在 `design.md §0.3` 显式记录「§10.2/§10.4 为 R3F 变通 + 推迟」，避免契约悬空。
- **[中] 3D 折线 Create 非弧长匀速**（`render-three/object-view-3d.ts:142-158`）：按 `floor(vertexCount × revealEnd)` 顶点对裁剪，未用已有的 `cumulativeLengths3`；`revealStart` 被忽略。
- **[中] `ThreeObject3DView.update` 不重建几何**（`object-view-3d.ts:122-160`）：`geometryVersion` 变化或 `replaceObject` 后网格陈旧（2D 视图有版本驱动重建，3D 缺失）。
- **[中] 相机句柄 getter 返回构建期终态**（`camera3d.ts:76-132`）：`moveTo/lookAt/orbit/dollyTo` 构建期即写 `this.eye/targetPoint`，`camera.position` 在播放期不反映当前时间（渲染走 snapshot 正确）。建议 getter 从 node transform 推导或文档标明。
- **[中] 3D 工厂 `traits: []`**（`object3d/factories.ts:42-48` 等）：与 §4.2「Create 按 trait 分发」背离，Create 靠通用 reveal tween + `geometry.kind` 判断。建议至少补 3D capability 标记。
- **[中] `assertNever` 未在维度分发处使用**（`player.ts`/`store.ts`/`track.ts`）：`dimension`/`PropertyPath` 分支无穷尽性兜底，违背 §16「穷尽式 switch」。
- **[中] 点云 `scalars` 已采样但渲染单色**（`object-view-3d.ts:104-118`）：`training-trajectory` 的标量着色无效（§0.3 已记为 M16 偏差，但示例观感受损）。
- **[低] 混维父子无校验**（`player.ts:304-330`）：2D 父 + 3D 子时子不继承父变换且无报错；建议 `setParent` 校验 dimension。
- **[低] `resolveRotation3D` 用 `Array.isArray` 判别四元数**（`runtime/state.ts:197-201`）：`Vec3` 误传无守卫。
- **[低] `SceneView3D` 不消费 `projection:"orthographic"`/`zoom`**（恒透视）。
- **[低] 3D 透明物体未统一 `depthWrite`/排序策略**；`style.lineWidth` 在 3D 线类无效但示例仍在设置。
- **[低] `empty-3d` 节点仍建空 `LineSegments` 视图**（`scene-view.ts:42`），轻微浪费。

### 13.2.3 做得好

并行 3D 管线对 2D 零侵入（联合化 + dimension 分发）；四元数 slerp 短弧/归一化/lookAt 有一致测试；marching-tetrahedra 水密性测试设计优秀；`SceneView3D` 交互/脚本相机互斥语义清晰。

## 13.3 M15 — 序列化 / 导出 / 嵌入（`serialize/*`、react embed/export）

### 13.3.1 Phase-1 序列化债清偿核实

| 债项（roadmap M15） | 处理 | 测试 | 结论 |
| --- | --- | --- | --- |
| `EasingFn` 内联函数 | `timeline.ts` strict 抛错 / degrade 省略字段（编译默认 linear） | ⚠️ 无函数 easing 专项测试 | ✅ 清偿，测试偏弱 |
| `morph` 内嵌 `IMObject2D` | `bakeObjectDef` 烘焙 | ✅ arc-length 帧哈希 | ✅ 清偿，仅 arc-length 覆盖 |
| `call` 逃生舱 | degrade 丢弃 / strict 抛错 | ✅ | ✅ 清偿 |
| `ctx.assets` 资源 | 构建期烘焙进对象几何 | ⚠️ 无 text/LaTeX serialize 往返 | ✅ 显式降级 |
| reactive 闭包信号 | `createSignalWithId` + `serializeInitialSignals` 数字 id | ⚠️ 无 tweenSignal 帧哈希 | ✅ id 持久化；derived 闭包不序列化（§0.3 已记） |
| `external`（bindSignal/Leva） | 无 runtime 守卫，仅设计约束 | ❌ | ⚠️ 文档化即可，建议 strict 检测 |

### 13.3.2 帧哈希契约的覆盖范围（评审修正）

`hashRuntimeState`（`frame-hash.ts:19-57`）哈希 visible/opacity/transform/reveal/fillProgress/geometryVersion。经核实：

- **父链已覆盖**：快照 transform 为 Player 合成后的 world transform（M12 机制），层级动画的哈希有效；
- **morph 间接覆盖**：`geometryVersion` 随 eased 进度变化（M9 机制），帧哈希能区分 morph 进度——但**不验证插值出的几何内容**，插值算法回归无法被哈希捕获；
- **真实缺口**：`styleOverrides`、`glyphWriteSpans`（文本书写状态）不入哈希；文本 write、样式动画的往返一致性无契约保护。

**往返一致性覆盖矩阵**（`serialize.test.ts`）：

| 路径 | 帧哈希全等 | 备注 |
| --- | --- | --- |
| 2D create/move/fade/scale/wait/marker | ✅ | |
| morph arc-length | ✅ | |
| 3D surface+polyline+fade+move | ✅ @24fps | |
| share-url base64url | ✅(JSON 等价) | ⚠️ 无 Unicode 用例 |
| reduced-motion | ⚠️ 仅终态单帧 | |
| tweenSignal | ❌ 仅 seed/键值/duration | **缺口** |
| morph anchor/matching/cross-fade | ❌ | **缺口**（matching 的 `matchBy` 函数 bake 时丢弃，fallback `part.key`） |
| 文本 write / LaTeX 烘焙对象 | ❌ | **缺口** |
| custom 动画（M17） | ❌ | serialize 路径未测（见 §13.5） |
| parent 层级 / commit op / 函数 easing degrade | ❌ | 无专项 |

### 13.3.3 问题清单

- **[高] `deserialize` 无 schema 校验**（`serialize.ts:89-110`）：仅检查 `version`；损坏/恶意 JSON 在 `rebuildObject`/`unbakeSpec` 深处抛难懂错误。**建议**：必填字段/id 引用/op 形状校验，统一 `serialization-error`。
- **[中] `recordCanvasVideo` 非确定性导出**（`react/export/recordCanvas.ts:28-60`）：实时 `player.play()` + `captureStream`，受帧率抖动/tab 节流影响，与 §17「固定 fps 逐帧 seek」要求不符；且未 `MediaRecorder.isTypeSupported` 探测（Safari 风险）、结束后未复位 Player。**建议**：文档区分「预览录制 vs 确定性导出」，补逐帧 seek + PNG 序列路径示例。
- **[中] web component 重连泄漏**（`react/embed/web-component.ts:63-67`，已核实）：`disconnectedCallback` 置空 `mountPoint` 引用但**未 `removeChild`**，元素重新接入 DOM 时 append 第二个 div，旧 div 残留。`readProject` 失败时 `render` 静默空白。
- **[中] `bake.ts:166` 硬编码 `morphableTraitFrom(provider, 64)`**：与原对象采样数可能不同，极端 morph 反序列化后数值漂移。
- **[中] `decodeShareUrl` 无大小限制 / 版本硬拒绝无迁移钩子**（`share-url.ts`、`serialize.ts:90-94`）。
- **[中] GIF 导出与 iframe 嵌入未交付**：roadmap M15 交付物列出，二者实现缺位（WebM + web component 已有），文档未标注推迟。
- **[低] `useDeserializedProject` 不 dispose 旧 Player**；`createSignalWithId` 对非数字键无校验；`SemanticOverlay` 无空间锚定（仅链接列表，§17「可点击超链接」子集）；degrade 下 parallel 全 call 时可能产出空 play op。
- **[低/对齐] `SerializedProject` 实现含 `scene`/`cameras` 字段、`deserialize` 返回 `DeserializedProgram`**，与 §17 接口（仅 5 字段、返回 Player）不一致——属必要扩展，应回写设计稿。

### 13.3.4 做得好

op-log + pristine + 烘焙三件套架构正确且 core 全程 DOM-free；`timeline.ts` 集中处理逃生舱、TSDoc 与 roadmap 互引；「帧哈希逐帧相等」作为 round-trip 契约的测试表述清晰；4 个示例端到端覆盖 share-url/嵌入/录制/语义层。

## 13.4 M16 — 性能与大数据（memoize、instancing、剪枝、Worker）

### 13.4.1 §15.2 六策略落实表

| # | 策略 | 落实度 | 备注 |
| --- | --- | --- | --- |
| 1 | 采样 memoize | ✅ 基本落实 | 落 provider 层，`(object, opts)` 键 + 同引用命中 |
| 2 | 仅更新变化的 RuntimeState | ⚠️ 部分 | React 层已规避每帧 reconcile；Player 仍每帧 baseline 重放全部已启动 track |
| 3 | GPU instancing | ✅ 基本落实 | 双轨（聚合几何 + InstancedMesh）；逐实例 reveal 未做（已文档化） |
| 4 | Morph 预计算 | ✅（M16 前已有） | 播放期仅插值 |
| 5 | Float32Array 通道 | ⚠️ 部分 | 创作侧已打包；`object-view-3d.ts:107` 上传 GL 时 `[...positions]` 拷贝 60k+ 顶点，抵消收益 |
| 6 | Worker | ✅ 基本落实 | 纯任务子集 + 同步回退；主渲染热路径未自动接入（已文档化） |

### 13.4.2 问题清单

- **[高] `InstancedMesh` 未设 `frustumCulled = false`**（`render-three/object-view-instanced.ts:150-164`）：包围球仅基于 base 几何不含实例矩阵，大范围实例场在相机偏置时可能被整体错误剔除（`instanced-10k` 即风险场景）。
- **[高] instanced 视图不处理 `geometryOverride`**（同文件 61-82）：morph 作用于实例化对象时渲染不更新（普通 `ThreeObjectView` 有完整 override 分支）。**建议**：morph 时回退聚合视图或在 instanced 视图实现 override。
- **[中] 视图类型在首次 `createView` 固定**（`scene-view.ts:43-50`）：reactive `replaceObject` 改变 `instanced` trait 有无时不重分发视图。
- **[中] 剪枝缺等价性测试**（`player.ts:361-379`）：无「剪枝 ≡ 全量扫描」golden 断言（perf-budget 仅验两点位置）；同 start 多 track 依赖 builder 稳定排序但无注释锁定。
- **[中] `sampleOptionsKey` 未编码 `defaultSamples`**（`memoize.ts:52-56`）：`samplePath()` 与 `samplePath({samples: N})` 在 N=默认值时键不同，重复计算。
- **[中] Worker 无任务取消 / 输入未 transfer**（`worker/client.ts:71-80`）：长 marching-cubes 无法 supersede；大 field 结构化克隆拷贝。
- **[中] memoize 返回同引用依赖「消费方不 mutate」**：`Float32Array` 未冻结，违约会污染缓存。建议 dev 模式 freeze 或文档强约束。
- **[低] memoize 无界 Map**（键空间小，可接受但应文档化）；性能预算阈值宽松（2000ms），回归敏感度弱；`worker-sampling` 示例 benchmark 把 field 重建计入 worker 耗时，对比不公平。

### 13.4.3 做得好

Worker `protocol → kernel → client/entry` 分层干净、双路径字节一致有测试；instancing 双轨保住 SVG/headless/拾取语义；剪枝 `upperBoundByStart` O(log n) 不破坏 baseline 语义；CI 用宽松 wall-clock + 确定性断言、bench 分离，flaky 风险低。

## 13.5 M17 — 扩展性 / 插件（`extend/*`、custom 动画接线）

### 13.5.1 §18 对齐表

| 契约项 | 状态 | 说明 |
| --- | --- | --- |
| `Registry<K,V>` / `Registries` 四类 | ✅ | 重复键 `plugin-error` fail-fast，`override/require/unregister` 语义清晰 |
| `definePlugin` / `installPlugin(s)` | ✅ | |
| `AnimationCompiler` + `custom` spec 接线 | ✅ | `compileSpec` 经注入 `resolveAnimation`，无依赖环 |
| 序列化覆盖 `custom` | ✅ | bake/unbake/reduced-motion；缺插件抛 `unsupported-animation` |
| `ObjectTypeDescriptor`「采样/序列化/渲染映射」 | ⚠️ 收窄 | 仅 `create(params)` 按名构造；渲染/序列化分发未消费 descriptor（§0.3 已记 experimental，但 §18 原文注释未同步） |
| `RendererFactory` | ⚠️ 占位 | 类型 + `selectRenderer` 存在；`render-three`/`render-r3f` 无任何消费，WebGPU 为纯 PoC |
| 退出标准「不改 core 增对象+生成器+动画」 | ✅ | 示例 + `extend.test.ts` e2e 成立 |
| §22.8 构建期无进程级全局可变状态 | ❌ 张力 | 见下 |

### 13.5.2 问题清单

- **[高] `globalRegistries` 进程级单例与 §22.8 的结构性张力**（`extend/registries.ts:32`）：`StoryboardBuilder` 默认 `resolveAnimation` 读全局（`storyboard.ts:114`），且 `Scene2D/3D` 构造 builder 时**无注入口**（`scene.ts:51`、`scene3d.ts:39`），`deserialize` 同样默认全局。这正是 Phase-1 删除模块级 signal registrar 时规避的模式：多 program 不同插件集、并发构建、测试并行、src/dist 双实例（`examples/vite.config.ts` 注释里的旧案）都可能出问题。**建议**：将 `Registries`/`AnimationResolver` 注入 `BuildOptions`/`IntermactProgramContext`/Scene 构造器，`globalRegistries` 退为便捷默认；§22.8 加脚注交叉引用本偏差。
- **[中] `storyboard.ts` 直接 import `extend/registries`**：core 动画编译路径硬绑定扩展模块，削弱「extend 纯可选层」分层。建议默认 resolver 由 `program/build.ts` 注入。
- **[中] `custom.params` 无 JSON-safe 校验**（`serialize/timeline.ts:118-125`）：含函数/循环引用时 `JSON.stringify` 静默丢字段或在远端抛错。建议 strict 模式 round-trip 探测，失败抛 `serialization-error`。
- **[中] custom 动画缺 serialize → deserialize → seek 全链路测试**：`extend.test.ts` 覆盖 build+seek；缺「卸载插件后反序列化抛 `unsupported-animation`」与成功 round-trip 自动化用例。
- **[中] 注册表参数类型擦除**：`createRegisteredObject<P>`/`runGenerator<P>` 的 `P` 与 descriptor 键无关联，示例大量 `as GearParams`。建议提供 typed helper 模式。
- **[中] compiler 纯函数契约无运行时校验**；`duration: result.duration ?? spec.duration` 允许 compiler 覆盖时长，与 play 游标不一致时难排查。
- **[低] 插件对象序列化后丢参数**（gear → 烘焙 contour，无 `pluginType/pluginParams`，已标 experimental）；示例幂等写法不统一（`if(!has)` vs `if(has) return`）；`requireRenderer` 无单测；示例模块顶层 `installPlugin` 随路由/HMR 累积全局状态。

### 13.5.3 做得好

`Registry` 实现干净、错误信息可行动；custom 动画经函数注入解析器避免依赖环的设计正确；插件对象复用 trait 即走既有渲染管线（无需改 render-three）验证了组合模型的扩展力；`docs/guide/extensibility.md` + vite alias 防双实例 + HMR 幂等的工程意识到位。

## 13.6 全项目代码健康度检查

> 综合评分：**7.5 / 10**（架构清晰、执行质量高，改进清单明确）。`packages/*/src` 无超过 800 行的源文件（最大 `animation/track.ts` 567 行）。

### 13.6.1 DRY

- **[中] 2D/3D 平行管线的机械重复**（M14 扩张后的主要债）：
  - `scene/scene.ts:174-248` ↔ `scene3d.ts:133-181`：`play/commit/wait/marker/buildStoryboard/getTimelineOps/getObjects/getInitialStates*` 逐行复制 → 提炼共享 scene-host 组合函数；
  - `setParent` 环检测约 30 行两份（`scene.ts:81-111` ↔ `scene3d.ts:83-112`）→ 提取 `validateAndSetParent`；
  - `registered-object.ts:100-162` ↔ `registered-object-3d.ts:60-131`：tween/fade 全家桶样板 → 共享 `buildTweenSpec`；
  - `render-three/object-view.ts:29-37` ↔ `object-view-instanced.ts:27-36`：`resolveLineWidth`/`effectiveStyle` 完全相同 → 抽 `object-view-utils.ts`。
- **[低] 工具级重复（可接受/小改进）**：弧长前缀和 2D/3D（stride 泛型可合并）；椭圆采样 `primitives.ts` ↔ `curves.ts`；PCG 四处近似圆（见 §13.1）。`lerp/clamp`、颜色解析无重复，职责清晰 ✅。
- **[中] examples 样板**：50+ 示例重复 `createScene2D({domain, background:"#0b1020"})` 模式，建议 `examples/src/lib` 提供 scene preset。
- world-transform / runtime state / provider 的 2D/3D 平行属**数学维度本质差异**，不建议强行抽象（文件头可注明）。

### 13.6.2 组合优于继承

✅ **贯彻良好**。全仓库 `class` 审计：`IntermactError extends Error`、`IntermactEmbedElement extends HTMLElement`（Web Component 必需）、`Registry`/`Player`/`ReactiveEngine`/`RuntimeStateStore`/`StoryboardBuilder`/`ThreeObjectView` 系列（有状态引擎/three 句柄封装）均合理；**无任何几何/动画对象继承层次**，对象模型全部走 trait 组合 + `findTrait` 能力查询。

改进点：

- **[中] `program/build.ts:119-126` 用 `instanceof Scene2D` 做维度分发**：与 `isObject2D` 的 discriminant 风格不一致，建议改 `scene.kind === "scene-2d"`。
- **[低] `CoordinateTransform2D` 类仅包 4 个纯函数**，可改工厂函数（非必须）。
- **[低] `MorphAnchor` 声明仍未实现**（Phase-2 遗留，roadmap §5.1 已决策推迟，维持）。

### 13.6.3 React 风格函数式 / 全局可变状态

工厂 + 不可变定义 + patch 式 RuntimeState 贯彻到位 ✅；core 无 `Math.random`/`Date.now` 散用 ✅；react 包 hooks 规范、渲染走快照 diff 而非每帧 reconcile ✅。

**进程级可变状态清单**（§22.8 张力点，按风险排序）：

| 状态 | 位置 | 风险 | 建议 |
| --- | --- | --- | --- |
| `globalRegistries` | `extend/registries.ts:32` | **高**（见 §13.5.2） | 注入式 + 全局退为默认 |
| 字体注册表 + `defaultFontId` | `text/font-registry.ts:16-42` | **高**：多 program 并发构建共享/竞态；测试靠 `clearFontRegistry` | scoped registry 或 ctx 注入；至少文档声明「进程级、install 先于 build」 |
| `nextSignalId` / `activeCollector` | `reactive/signal.ts:21-33` | 中：id 全局递增，单线程构建实际安全 | 文档注明；序列化依赖 id 稳定性时需注意 |
| MathJax 懒初始化缓存 | `text/mathjax-latex.ts:30` | 低：一次性 promise | 可接受 |

### 13.6.4 死代码与 TSDoc

- **[中] `text/seven-segment.ts` 孤儿模块**：未从 `text/index.ts` 导出、全仓库无 import（M10 已升级字体路径）。删除或移 `_archive`。注：phase-2 评审写「`text/index.ts` 仍导出 seven-segment」，现状已不导出但文件残留。
- **[低] `examples/src/lib/SvgGeometry.tsx` / `SvgScene.tsx`**：Phase-1 评审已标记可删，至今无引用。
- **[低] TSDoc 覆盖约 70–80%**：模块级/类型/架构文档优秀（普遍引用 design 章节）；**公共工厂函数级 JSDoc 偏弱**（`primitives.ts` 的 `circle()`/`ellipse()` 等无独立函数文档）——按「始终保持代码有完整文档」规则应补齐。

### 13.6.5 Phase-2 遗留复核

- ✅ 已修：`setParent` 环检测、RTL 双重反转、functionGraph 非有限值、seek 信号回置（`resetSignalsToInitial` 已接入 player）、命中测试 rotation/scale（`worldPointToLocal`）。
- ⏳ 仍开放：`MorphAnchor`（推迟决策维持）、`LayoutHandle` 急切提交语义（待 §9 固化）、log 负域/timeScale 分辨率/空心标签等 P3 打磨。

## 13.7 examples 与 docs 覆盖率检查

### 13.7.1 Phase-3 目标示例核对（21/21 落地）

roadmap 声明的 21 个示例**全部存在、全部注册进 `examples/src/registry.tsx`、全部带 caption**。质量评级：18 个 A；3 个 B——`pcg/cellular-automaton`（静态时空图，无演化动画）、`export/video-render`（仅实时录制，无定帧确定性路径）、`plugin/webgpu-backend`（注册表 PoC，场景仍走 WebGL，已注明）。

### 13.7.2 无示例覆盖的 Phase-3 公共 API

- **PCG（缺口最大）**：`tiling`、`lattice`、`parametricCurve2D`、`recursiveTree`、`scatter`、`mapData`（仅注释提及）、`repeatObject`、`booleanOp`、`mapPoints`、`along`、`cellularAutomatonFrames`/2D Life、`vectorMagnitudeField`。
- **3D**：`Scene3D.group3D`、`polyline3D`（仅单测）。
- **序列化**：`snapshotToSVG`、`sampleFrames/sampleFrameHashes`（定帧导出管线无 UI 示例）、`deserialize`/`decodeShareUrl` 仅经 `SerializedCanvas` 间接使用。
- **扩展**：`createRegistries`（隔离注册表，仅文档代码块）。

**建议**：增 2–3 个「算子组合」「数据图表（scatter+mapData key 复用）」「SVG/定帧导出」示例，即可覆盖绝大多数缺口。

### 13.7.3 docs 站覆盖矩阵

| 能力域 | guide | examples 索引 | reference（TypeDoc） |
| --- | --- | --- | --- |
| PCG 核心 | ❌ 无专题章 | ❌ 缺失 | ⚠️ 符号页齐全，总览仍 P1–P2 中心 |
| 3D 全量 | ❌ 无专题章 | ❌ 缺失 | ⚠️ core 符号有；`RenderedScene`（render-r3f）不在 reference |
| 序列化/导出/嵌入 | ❌ 仅 introduction 提及 | ❌ 缺失 | ⚠️ 符号有、教程无 |
| 性能与大数据 | ⚠️ geometry.md 提 Float32Array | ❌ 缺失 | ⚠️ 同上 |
| 插件扩展 | ✅ `guide/extensibility.md` | ❌ 缺失 | ✅ |

**主要问题**（按严重度）：

- **[高] `docs/examples/index.md` 完全缺失 Phase-3 的 21 个示例**（止于 Phase-2）。
- **[高] 无 PCG / 3D / 导出嵌入 / 性能四个专题指南**；VitePress 侧边栏止于「扩展系统（v0.7）」。
- **[高] `docs/.vitepress/config.ts` 页脚仍写「文档覆盖 Phase-1 & Phase-2」**，与 v1.0 发布状态矛盾。
- **[中] 画廊无源码展示/GitHub 链接**；guide ↔ demo 互链稀疏（extensibility 提及 demo id 但无 `/demos/#` 链接）。
- **[中] TypeDoc 入口仅 core**：`@intermact/react`/`render-r3f` 的公共符号（`RenderedScene`、`recordCanvasVideo`、`defineIntermactEmbed`）无 reference 页。
- **[低] `docs/reference/index.md` 总览需补 Phase-3 API 地图**（PCG/3D/serialize/extend 四节）。

`docs/project/v1-checklist.md` 存在且与 roadmap DoD 对应良好 ✅（其引用的本文件此前为空，已由本次评审补齐）。

## 13.8 跨切面与文档一致性

> **清偿状态（2026-06-10）**：下表 11 项**全部闭环**（✅）。

| # | 事项 | 现状 | 建议 | 清偿 |
| --- | --- | --- | --- | --- |
| 1 | 测试数：文档多处写 **243** | 实测 **244**（清偿后 296） | 同步数字或改「以 CI 实测为准」 | ✅ 三处文档改为"以 CI 实测为准"（验收 244 / 清偿后 296） |
| 2 | depcruise 模块数 199 | ✅ 实测一致（清偿后 210） | — | ✅ |
| 3 | 四包版本 `1.0.0`（package.json + 源内 `VERSION`） | ✅ 一致 | — | ✅ |
| 4 | `design.md §0.3` 偏差记录 | 总体诚实；**M14 §10.2/§10.4 差距记录不足**（RenderedScene 写成「离屏渲染目标」易读作已达契约） | §0.3 M14 补「RenderedScene 为 R3F 变通、多视口未渲染」两条 | ✅ 改为以代码补齐契约：§0.3.1 B 记 `render()` core 化 + 多视口；§10.2/§10.4 已落地 |
| 5 | `program/build.ts:62` 注释「多视口 M12/M15」 | 与 M14/M15 已完成状态矛盾 | 更新注释 | ✅ 注释更新；`instanceof Scene2D`→`scene.kind` 判别 |
| 6 | §17 `SerializedProject`/`deserialize` 签名 | 实现扩展了 `scene`/`cameras`/返回类型 | 回写设计稿 | ✅ §17 回写（§0.3.1 决策 5） |
| 7 | roadmap M15 交付物「GIF / iframe」 | 未交付未标注 | 标注推迟或补实现 | ✅ 补实现：`encodeGif`/`exportCanvasGif`/`buildEmbedIframe` + 示例 |
| 8 | §18 `ObjectTypeDescriptor` 注释「采样/序列化/渲染映射」 | 实现仅按名构造 | 同步 §18 措辞或扩展 descriptor | ✅ §18 注释改为「按名构造 + 发现，渲染/序列化复用 trait 管线」 |
| 9 | §22.8 与 `globalRegistries`/字体注册表 | 字面冲突无交叉引用 | §22.8 加例外说明或推进注入化 | ✅ 推进注入化 + §22.8 约束 8 交叉引用 |
| 10 | `pcg/fractal-graph.tsx:14` 注释 IFS、实现 sierpinski | 注释与实现不符 | 改注释或改实现 | ✅ 注释改为 Sierpinski 递归细分（非 chaos-game IFS） |
| 11 | phase-2-review §12.6「`text/index.ts` 导出 seven-segment」 | 现已不导出，但文件残留为孤儿 | 删除文件，闭环该项 | ✅ 删除 `text/seven-segment.ts`（连同 `SvgGeometry/SvgScene.tsx`） |

## 13.9 建议清偿优先级

> Phase-3 闸口（v1.0）**不被以下任何一项阻断**——CI 全绿、退出标准达成。以下为 v1.0.x 补丁与 v1.1 入口的建议排序。

| 优先级 | 事项 | 类型 | 参考 |
| --- | --- | --- | --- |
| **P0** | `InstancedMesh.frustumCulled = false`（或扩 bounding）+ instanced 视图 morph/`geometryOverride` 处理 | 渲染正确性 | §13.4 |
| **P0** | PCG 无 RNG 静默回退改为 fail-fast（lsystem/graph/CA/fractal 空 maps） | 确定性契约 | §13.1 |
| **P0** | docs：examples 索引补 Phase-3 21 项、页脚/导航更新到 v1.0 | 文档债（发布观感） | §13.7 |
| **P1** | `globalRegistries`/字体注册表注入化（或 §22.8 显式例外 + 双实例警告） | 架构一致性 | §13.5、§13.6.3 |
| **P1** | `stitchSegments` 双向拼接 + 闭合检测 + 条数断言 | 算法正确性 | §13.1 |
| **P1** | `deserialize` schema 校验；web component 重连清理；`MediaRecorder` mime 探测 | 健壮性 | §13.3 |
| **P1** | 帧哈希补 `styleOverrides`/`glyphWriteSpans`；补 tweenSignal / matching morph / custom 动画 round-trip 测试 | 序列化契约 | §13.3、§13.5 |
| **P1** | `ThreeObject3DView` 几何热更新（geometryVersion/replaceObject） | 3D 渲染正确性 | §13.2 |
| **P1** | PCG/3D/导出/性能四篇专题指南 | 文档 | §13.7 |
| **P2** | M14 设计稿对齐决策：`RenderedScene` core 化 + 多视口渲染（或显式记偏差）；相机父子挂载 API；3D Create 弧长 reveal | 设计固化 | §13.2 |
| **P2** | 2D/3D DRY 提炼（scene-host/`validateAndSetParent`/`buildTweenSpec`/object-view-utils） | 可维护性 | §13.6.1 |
| **P2** | 剪枝等价性 golden 测试；`sampleOptionsKey` 含 `defaultSamples`；Worker 取消/transfer | 性能层完善 | §13.4 |
| **P2** | `custom.params` JSON-safe 校验；`booleanOp` 多轮廓守卫；streamlines 子步 clamp | 健壮性 | §13.1、§13.5 |
| **P2** | 删除 `seven-segment.ts`/`SvgGeometry.tsx`/`SvgScene.tsx`；`instanceof Scene2D` → `kind` 判别 | 卫生 | §13.6 |
| **P3** | 工厂函数级 JSDoc 补齐；测试数/注释/设计稿措辞同步（§13.8 全表）；示例缺口补充（scatter/mapData/booleanOp/SVG 导出）；`assertNever` 接入维度分发；点云标量着色；正交相机消费 | 打磨/文档 | §13.1–§13.8 |

## 13.10 验证命令与关键触点

```bash
pnpm run ci          # 实测全绿：lint + typecheck + 296 tests + depcruise(210 模块 0 违规) + build
pnpm run bench       # 采样基准（不入 CI）
pnpm dev:examples    # 目视：pcg/* 3d/* export/* embed/* perf/* plugin/*
pnpm run gen:reference # TypeDoc 重生符号页（四包）
pnpm run build:site  # 文档站（§13.7.3 缺口已于 §13.11 清偿）
```

| 区域 | 文件 / 符号（便于定位） |
| --- | --- |
| M13 PCG | `pcg/lsystem.ts:105`、`pcg/marching-squares.ts:152`（stitch）、`pcg/operators.ts:233`（booleanOp）、`pcg/field-objects.ts:214`（RK4）、`pcg/graph.ts:175`、`pcg/cellular-automaton.ts:95` |
| M14 3D | `render-r3f/RenderedScene.tsx`、`program/build.ts:62,119`、`scene/camera3d.ts:76`、`render-three/object-view-3d.ts:122,142`、`object3d/factories.ts:42`（traits:[]） |
| M15 序列化 | `serialize/serialize.ts:89`（无校验）、`serialize/frame-hash.ts:19`（哈希范围）、`serialize/bake.ts:166`（硬编码 64）、`react/embed/web-component.ts:63`、`react/export/recordCanvas.ts:28` |
| M16 性能 | `render-three/object-view-instanced.ts:61,150`、`render-three/scene-view.ts:43`、`geometry/memoize.ts:52`、`animation/player.ts:361,430`、`render-three/worker/client.ts:71` |
| M17 插件 | `extend/registries.ts:32`（globalRegistries）、`animation/storyboard.ts:114`、`serialize/timeline.ts:118`（custom params）、`extend/plugin.ts` |
| 健康度 | `scene/scene.ts:174` ↔ `scene3d.ts:133`（DRY）、`text/font-registry.ts:16`、`text/seven-segment.ts`（孤儿）、`reactive/signal.ts:21` |
| 覆盖率 | `examples/src/registry.tsx`、`docs/examples/index.md`、`docs/.vitepress/config.ts`（页脚/侧边栏）、`docs/reference/index.md` |

## 13.11 清偿记录（2026-06-10 后续）

§13.9 的 **P0–P3 全部清偿**；按 checkpoint（CP1–CP9）推进，每个 CP 收尾 `pnpm run ci` 全绿。"实现更优"偏差固化于 `design.md §0.3.1 A`，"设计更优"差距以代码补齐（`§0.3.1 B`）。

| 优先级 | 事项 | 状态 | 主要触点 |
| --- | --- | --- | --- |
| **P0** | InstancedMesh `frustumCulled=false`（扩包围球）+ instanced 视图 morph/`geometryOverride` 处理 + trait 变更重分发 | **✅** | `render-three/object-view-instanced.ts`、`scene-view.ts`、`object-view-instanced.test.ts` |
| **P0** | PCG 无 RNG 静默回退→fail-fast（lsystem/graph/CA/fractal 空 maps） | **✅** | `pcg/lsystem.ts`、`graph.ts`、`cellular-automaton.ts`、`fractal.ts`、`pcg.test.ts` |
| **P0** | docs：examples 索引补 Phase-3、页脚/导航更新到 v1.0 | **✅** | `docs/examples/index.md`、`docs/.vitepress/config.ts` |
| **P1** | `globalRegistries`/字体注册表注入化（`build`/`scene`/`storyboard`/`deserialize`/`ctx` 透传 + 双实例告警 + 子作用域字体） | **✅** | `extend/registries.ts`、`animation/storyboard.ts`、`program/build.ts`、`scene/scene.ts`/`scene3d.ts`、`text/font-registry.ts`、`§22.8` |
| **P1** | `stitchSegments` 双向延伸 + 首尾 eps 闭合 + 条数断言 | **✅** | `pcg/marching-squares.ts`、`pcg.test.ts` |
| **P1** | `deserialize` schema 校验（→`serialization-error`）；web component 重连 `removeChild` 清理；`MediaRecorder` mime 探测 | **✅** | `serialize/serialize.ts`（`validateSerializedProject`）、`react/embed/web-component.ts`、`react/export/recordCanvas.ts` |
| **P1** | 帧哈希纳入 `styleOverrides`/`glyphWriteSpans`；补 tweenSignal/anchor/matching/cross-fade morph/text write/custom/parent/commit/函数 easing round-trip 测试矩阵 | **✅** | `serialize/frame-hash.ts`、`serialize.test.ts` |
| **P1** | `ThreeObject3DView` 几何热更新（geometryVersion/replaceObject） | **✅** | `render-three/object-view-3d.ts` |
| **P1** | PCG/3D/导出/性能四篇专题指南 | **✅** | `docs/guide/{pcg,3d,export-embed,performance}.md`、`config.ts` 侧栏 |
| **P2** | M14 `RenderedScene` core 化（`render(scene,camera)→IMObject2D`，`live`/`snapshot`）+ 多视口 `rect` 渲染；改写 `nested-scene-panel` | **✅** | `core` `render()`、`render-r3f`/`render-three` 消费、`examples/src/3d/nested-scene-panel.tsx`、`§10.2`/`§10.4` |
| **P2** | 相机父子挂载 API；3D Create 弧长 reveal（`cumulativeLengths3`，尊重 `revealStart`）；`Scene3D.getAxes`/`coordinate`；`group3D` 聚合工厂 | **✅** | `scene/camera3d.ts`、`render-three/object-view-3d.ts`、`scene/scene3d.ts`、`layout/coordinate-transform-3d.ts`、`object3d/group.ts` |
| **P2** | 2D/3D DRY 提炼（`scene-host`/`validateAndSetParent`/`buildTweenSpec`/`object-view-utils`/`approxCircle`） | **✅** | `scene/scene-host.ts`、`animation/tween-spec.ts`、`render-three/object-view-utils.ts`、`geometry/sampling.ts` |
| **P2** | `bake` 序列化 `sampleCount`（去硬编码 64）；`decodeShareUrl` 大小上限/版本前缀/Unicode | **✅** | `serialize/bake.ts`、`serialize/share-url.ts`、`serialize.test.ts` |
| **P2** | `custom.params` JSON-safe 校验；`booleanOp` 多轮廓守卫；streamlines RK4 子步 clamp；`assertNever` 接入维度分发 | **✅** | `serialize/timeline.ts`/`animation/orchestration.ts`、`pcg/operators.ts`、`pcg/field-objects.ts`、`player.ts`/`store.ts` |
| **P2** | GIF 导出 + iframe 片段生成（关闭 M15 缺口） | **✅** | `react/export/gif.ts`（`encodeGif`/`exportCanvasGif`）、`react/embed/web-component.ts`（`buildEmbedIframe`） |
| **P2** | 删孤儿模块；`instanceof Scene2D`→`kind` 判别 | **✅** | 删 `text/seven-segment.ts`/`examples lib/SvgGeometry/SvgScene.tsx`；`program/build.ts` |
| **P3** | 公共几何工厂 JSDoc 补齐 | **✅** | `geometry/primitives.ts` |
| **P3** | examples 缺口补充（算子组合/数据图表/额外生成器/SVG 定帧/3D 分组 + CA 2D Life） | **✅** | `examples/src/pcg/{operators-showcase,data-charts,generators-extra,cellular-automaton}.tsx`、`export/svg-snapshot.tsx`、`3d/grouping.tsx` |
| **P3** | typed helper `defineObjectType<P>`/`defineGenerator<P>`；点云标量着色；正交相机+zoom 消费 | **✅** | `extend/plugin.ts`、`render-three/object-view-3d.ts`、`render-r3f/SceneView3D` |
| **P3** | 文档一致性（§13.8 全表：测试数/`build.ts` 注释/fractal-graph 注释/`SerializedProject`/§18 措辞/§22.8 交叉引用） | **✅** | `design.md §0.3.1`/§17/§18/§22.8、`dev-roadmap.md §6`、本文件 §13.8 |
| **P3** | docs：reference 总览 Phase-3 API 地图；画廊「View source」链接 + guide↔demo 互链；TypeDoc 含四包 | **✅** | `docs/reference-index.src.md`、`examples/src/App.tsx`/`registry.tsx`、`docs/typedoc.json` |

**说明**：唯一不走"全代码后端"处为 **WebGPU 维持 PoC**（`design.md §0.3.1 A.6`，注册表 + 后端选择即扩展性证明；真实 WGSL 后端列为 optional/后续里程碑，非本次清偿范围）。Phase-2 遗留 `MorphAnchor` 维持推迟决策（`dev-roadmap.md §5.1`）。
