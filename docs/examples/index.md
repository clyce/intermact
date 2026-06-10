# 示例目录

源码位于 `examples/src/`，由 `registry.tsx` 注册。

- **[打开交互演示画廊 →](/demos/)**（与文档同站，推荐 `pnpm run dev:site`）
- 独立调试画廊：`pnpm run dev:examples`（`http://localhost:5173`）

下表按 **group** 分组，与 `dev-roadmap.md` 各里程碑 Examples 条目对应。链到具体 demo：`/demos/#<id>`（例如 [`/demos/#reactive/value-tracker`](/demos/#reactive/value-tracker)）。

## Phase-1（v0.1）

### 脚手架 / 冒烟

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `_template/empty-canvas` | M0 | 最小空 Canvas |
| `_smoke/static-circle` | M0 | 静态圆烟雾测试 |

### timeline

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `timeline/seek-basics` | M1 | seek / 变速 / 反向 |
| `timeline/headless-eval` | M1 | Node 无头求值 |
| `timeline/markers-slides` | M1 | marker 跳章 |

### geometry

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `geometry/primitives-gallery` | M2 | 全图元一览 |
| `geometry/sampling-debug` | M2 | 采样 / bounds / 三角网 |

### render

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `render/stroke-fill-showcase` | M3 | 三行：静态 fill / 描边 reveal / Create |
| `render/zorder-transparency` | M3 | z 序与透明 |
| `render/dpi-resize` | M3 | HiDPI + resize |

### anim

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `anim/create-fade-move` | M4 | Create / Fade / Move / Rotate / Scale |
| `anim/sequence-parallel-stagger` | M4 | 编排对照 |
| `anim/easing-gallery` | M4 | easing 曲线 |

### coords

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `coords/cartesian-axes` | M5 | `getAxes` + fade |
| `coords/fit-strategies` | M5 | contain / cover / stretch |
| `coords/polar-scene` | M5 | 极坐标 |

### reactive

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `reactive/value-tracker` | M6 | §8.2 内接矩形 |
| `reactive/leva-binding` | M6 | Leva → Signal |

### L1 闸口

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `l1/basic-2d` | L1 | §19.1 基础 2D 叙事 |
| `l1/interactive-sine` | L1 | §19.2 交互函数曲线 |

## Phase-2（v0.2 · 数理工具箱）

### scale

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `scale/scale-playground` | M7 | linear/log/pow/time 对照 + ticks/format |
| `scale/log-plot` | M7 | 对数坐标作图 |

### math

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `math/axes-functiongraph` | M8 | Axes + FunctionGraph/Parametric，`c2p` 贴合 |
| `math/riemann-sum` | M8 | Riemann 矩形随 `n` 收敛 |
| `math/tangent-derivative` | M8 | 切线随动点、斜率实时 |
| `math/matrix-table-brace` | M8 | Matrix/Table/Brace + DecimalNumber |
| `math/planes` | M8 | NumberPlane / PolarPlane / ComplexPlane |

### morph

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `morph/shape-morph` | M9 | arc-length / anchor 变换 |
| `morph/contour-mismatch` | M9 | contour 补齐 + cross-fade 兜底 |
| `morph/matching-shapes` | M9 | `transformMatching` 分部匹配 |

### text / latex

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `text/writing` | M10 | 文本逐笔 writing |
| `text/writing-strategies` | M10 | sequential / simultaneous / per-glyph writing 策略 |
| `text/multi-font-writing` | M10 | 多字体混排 writing |
| `text/font-scale` | M10 | 矢量字形多尺寸 |
| `latex/latex-writing` | M10 | LaTeX 公式逐笔 writing |
| `latex/transform-matching-tex` | M10 | 公式分部变形 |

### interaction

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `interaction/draggable-bezier` | M11 | 拖控制点实时重算贝塞尔 |
| `interaction/hit-testing` | M11 | 细线/圆环精确命中 |
| `interaction/explorable-derivative` | M11 | 拖动 `x` 探索切线/导数 |

### layout / devtools

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `layout/next-to-arrange` | M12 | `alignTo/nextTo/arrange` 自动排版 |
| `layout/responsive-rect` | M12 | 域相对 UV 锚点 + `fitTo` |
| `devtools/inspector-tour` | M12 | Inspector 全功能巡览 |

## Phase-3（v1.0 · PCG / 3D / 导出嵌入 / 性能 / 扩展）

### pcg（程序化生成）

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `pcg/lsystem-plant` | M13 | 括号 L-system 植物，按生长序 Create |
| `pcg/scalar-field-isolines` | M13 | 标量场热力图 + marching-squares 等值线 |
| `pcg/vector-field-streamlines` | M13 | 向量场箭头网格 + RK4 流线 |
| `pcg/cellular-automaton` | M13 | Rule 30 时空图 + 2D Life `cellularAutomatonFrames` 演化 |
| `pcg/data-driven-bars` | M13 | 单数组 → 柱状图 + 趋势线（保留 keyed part） |
| `pcg/fractal-graph` | M13 | Sierpinski 分形 + 力导向图，`transformObject` 定位 |
| `pcg/operators-showcase` | M13 | `repeatObject` / `booleanOp` / `mapPoints` / `along` 算子组合 |
| `pcg/data-charts` | M13 | `scatter` + `lineChart` 共享数据；`mapData` keyed 气泡 |
| `pcg/generators-extra` | M13 | `tiling` / `lattice` / `recursiveTree` / `parametricCurve2D` |

### 3d

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `3d/surface-plot` | M14 | 参数曲面 + 3D 轴，Create 揭示网格 |
| `3d/training-trajectory` | M14 | §19.3 损失曲面 + 优化轨迹 3D 曲线 |
| `3d/isosurface` | M14 | marching-cubes 提取水密等值面 |
| `3d/camera-moves` | M14 | §10.1 注册相机：orbit/dolly/lookAt 可 seek |
| `3d/nested-scene-panel` | M14 | §10.2 `render(scene, camera)` 子场景为可注册对象 |
| `3d/grouping` | M14 | §9.3 `group3D` 聚合多对象 + `polyline3D` 整体旋转 |

### export / embed

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `export/share-url` | M15 | §17 序列化 → URL → 由字符串重建场景 |
| `export/video-render` | M15 | §17 `MediaRecorder` 录制 GL 画布为 WebM |
| `export/semantic-handout` | M15 | §17 元数据语义叠层 + reduced-motion 降级 |
| `export/svg-snapshot` | M15 | §17 无头 `snapshotToSVG` 定帧 + `sampleFrameHashes` 确定性 |
| `embed/web-component` | M15 | §17 `<intermact-embed>` 自定义元素挂载 share-url |

### perf

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `perf/instanced-10k` | M16 | §15.2 `instanceField` → 单 `InstancedMesh` 万级实例 |
| `perf/large-pointcloud` | M16 | §15.2 6 万点 Float32Array 流式点云 |
| `perf/worker-sampling` | M16 | §15.2 marching-cubes 主线程 vs Worker |

### plugin（扩展）

| ID | 里程碑 | 说明 |
| --- | --- | --- |
| `plugin/custom-object` | M17 | §18 注册新对象类型 + 新动画类型 |
| `plugin/custom-generator` | M17 | §18 注册 PCG 生成器，`runGenerator` 按名分发 |
| `plugin/webgpu-backend` | M17 | §18 渲染后端即注册的 `RendererFactory`（PoC） |

## 添加新示例

1. 在 `examples/src/<group>/` 新建 `*.tsx`，导出 `*Demo` 组件
2. 在 `registry.tsx` 的 `demos` 数组追加条目
3. 同步更新本页与 `dev-roadmap.md` 对应里程碑 Examples
