# v1.0 验收清单

对应 `dev-roadmap.md` §6「◆ v1.0 发布（DoD）」与 `design.md §0.3` Phase-3 实现进度日志。Phase-3（M13–M17）= PCG 核心 / 完整 3D / 序列化·导出·嵌入 / 性能与大数据 / 扩展性插件，闸口 ◆ L3。

## DoD 条目

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| PCG 核心（场/采样、参数/晶格、递归/文法、数据驱动、算子） | ✅ | `pcg/*`（6 示例）；`pcg.test.ts`（27） |
| 完整 3D（Transform3D/RuntimeState3D、Scene3D、注册相机、3D 工厂、marching-cubes） | ✅ | `3d/*`（5 示例）；3D 工厂/相机/marching-cubes 用例 |
| 序列化 / 导出 / 嵌入（serialize·deserialize、share-url、定帧导出、web-component、语义层、reduced-motion） | ✅ | `export/*`、`embed/*`（4 示例）；`serialize.test.ts`（11） |
| 性能与大数据（GPU 实例化、采样 memoize、轨道剪枝、Worker 化、性能预算） | ✅ | `perf/*`（3 示例）；`memoize`/`instanced`/`worker`/`perf-budget` 用例 |
| 扩展性 / 插件（注册表、definePlugin/install、四扩展点经 dispatch） | ✅ | `plugin/*`（3 示例）；`extend.test.ts`（10） |
| 所有 P3 示例可运行 | ✅ | `pnpm --filter @intermact/examples run build`（925 模块，含 worker chunk） |
| 性能预算达标 | ✅ | `core/perf/perf-budget.test.ts` 计入 `vitest run`；`pnpm run bench` |
| 插件机制可用（新增对象类型+生成器不改 core 即生效） | ✅ | `extend.test.ts` 端到端 + `plugin/custom-object`·`plugin/custom-generator` |
| 四库包 `VERSION` 升至 `1.0.0` | ✅ | `packages/{core,react,render-three,render-r3f}/src/index.ts`、`package.json` |
| CI 全绿 | ✅ | lint + typecheck + vitest（**296**，以 CI 实测为准）+ depcruise（**210** 模块 0 违规）+ build |
| API Reference 重新生成 | ✅ | `pnpm run gen:reference`（TypeDoc + `typedoc-vitepress-theme`） |

## 各里程碑退出标准（摘要）

### M13 · PCG 核心（v0.3.0）

- [x] `pcg/` 层：场/采样（isoline 行进方格、heatmap、vectorField、streamlines）、参数/晶格/铺贴、lSystem/fractal/recursiveTree/graphObject/cellularAutomaton、mapData/barChart/scatter/lineChart、算子（transformObject/repeatObject/instanceField/booleanOp/mapPoints/along）
- [x] 确定性走注入 `ctx.rng`；depcruise `pcg-headless-deps` 规则
- [x] 6 示例 + `pcg.test.ts`（同种子复现、行进方格、CA 步进、算子组合）

### M14 · 完整 3D（v0.4.0）

- [x] `Transform3D`/`RuntimeState3D` + 2D|3D snapshot/Player 泛化；四元数
- [x] `Scene3D` + 注册 `Camera3D`（orbit/dolly/zoom/lookAt/quaternion）
- [x] 3D 工厂（curve3D/polyline3D/meshObject/surface3D/pointCloud3D/axes3D/group3D）+ 3D Create + marching-cubes
- [x] `render-three`/`render-r3f` 3D 视图 + 透视/orbit + `RenderedScene`
- [x] 5 示例 + 3D bounds/transform/相机/采样/marching-cubes 用例

### M15 · 序列化 / 导出 / 嵌入（v0.5.0）

- [x] `serialize/`：op-log + 烘焙几何 + pristine 初值 + 信号 + seed；定帧帧哈希逐帧相等
- [x] Phase-1 序列化债了结（easing/morph/call/reactive）；share-url；SVG/帧哈希；web-component；语义层 + reduced-motion
- [x] 4 示例 + `serialize.test.ts`（往返相等、定帧哈希、reduced-motion 降级）

### M16 · 性能与大数据（v0.6.0）

- [x] 真 GPU 实例化（`InstancedTrait`→`InstancedMesh`）；采样 memoize（provider 层）
- [x] Player 轨道区间剪枝（二分活动窗口）；Worker 化纯任务（`render-three/worker/`，core 保持 DOM-free）
- [x] 性能预算基准纳入 CI（`perf-budget.test.ts`）+ `pnpm run bench`
- [x] 3 示例（instanced-10k/large-pointcloud/worker-sampling）

### M17 · 扩展性 / 插件（v0.7.0）

- [x] `extend/`：泛型 `Registry<K,V>` + 四类 descriptor + `Registries` + `globalRegistries`
- [x] `definePlugin`/`installPlugin` + 分发助手（`createRegisteredObject`/`runGenerator`/`selectRenderer`）
- [x] 自定义动画经全局注册表 + 注入解析器接线（`custom` spec/`compileSpec`/`StoryboardBuilder`/`customAnimation()`），序列化覆盖 `custom`
- [x] 3 示例（custom-object/custom-generator/webgpu-backend PoC）+ `extend.test.ts`（10）

## 已知偏差 / 开放项（不阻塞 v1.0）

- **派生对象/外部绑定**不进序列化往返（按设计，活性逻辑需宿主重接线）；烘焙对象失去交互/参数化活性（静态几何等价）。
- **GPU 实例化**逐实例 reveal/拾取未做（整体淡入走 group opacity/fillProgress）；点云 per-point 着色未做（单色辉光）。
- **Worker 化**为纯函数子集（resample/triangulate/marching-cubes/parse-svg-path）；MathJax 的 DOM 步骤留主线程；Worker 构造由宿主负责（bundler 相关）。
- **WebGPU 后端**为注册表占位 PoC（特性探测 + `selectRenderer` 选择 + 叠层显示）；真实 `WebGPURenderer` 设备接线（经 R3F `<Canvas gl>`）留作 PoC 下一步，场景仍走默认 WebGL。
- **对象类型注册表**当前经通用烘焙路径序列化几何（自定义序列化钩子未做）；与 trait 模型互补，descriptor 主承担按名构造 + 工具发现。

详见 `design.md §0.3` 实现进度日志、`phase-3-review.md §13.1–§13.5` 各里程碑评审。
