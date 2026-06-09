# 数理构件库

数理构件层（`design.md §7.4`）在 [Scale](/guide/scale) 与坐标系之上，提供 Manim 风格但可交互的数理对象。所有构件都是纯函数，产出单个 `IMObject2D`（内部自带全部 contour），可无头运行，并通过 `RegisteredObject2D` 的标准动画 API（`create`/`fadeIn`/…）显隐。

> **数字标签**：当前轴刻度、矩阵/表格条目与 `decimalNumber` 使用 7-段笔画字形（`packages/core/src/text/seven-segment.ts`）作为过渡渲染。真实字体/LaTeX 在 M10 升级，这是里程碑边界而非降级。

## 坐标系构件

| 工厂 | 说明 |
| --- | --- |
| `scene.getAxes(props)` | 注册坐标轴，返回 `RegisteredAxes2D`（含 `handle`）；刻度/标签由 `Scale` 生成 |
| `numberLine(spec)` | 一维数轴：把数据域映射到世界线段，带刻度与数字 |
| `numberPlane(spec)` | 笛卡尔网格平面 |
| `polarPlane(spec)` | 极坐标网格（同心圆 + 辐射线） |
| `complexPlane(spec)` | 复平面（与 `numberPlane` 同构，承载 Re/Im 语义） |

```ts
import { numberLine, numberPlane, polarPlane } from "@intermact/core";

const line = numberLine({ domain: [0, 10], center: xy(0, 0), length: 10, tickCount: 6 });
const grid = numberPlane({ x: [-5, 5], y: [-3, 3], tickCount: 8 });
const polar = polarPlane({ center: xy(0, 0), maxRadius: 4, radiusStep: 1, spokes: 12 });
```

## 依附坐标系的构件

下列构件接受 `ax.handle`（`AxesHandle`），通过 `c2p`（数据坐标 → 世界点）保持与坐标轴贴合。`AxesHandle` 现额外暴露 `xScale`/`yScale`（M7），构件与轴共享同一标度。

| 工厂 | 说明 |
| --- | --- |
| `functionGraph(handle, fn, opts?)` | `y = f(x)` 折线 |
| `parametricGraph(handle, fn, opts?)` | 参数曲线 `t → [x, y]` |
| `areaUnderCurve(handle, fn, range, opts?)` | 曲线与基线间的填充区域 |
| `riemannRectangles(handle, fn, opts?)` | 黎曼和矩形，随 `n` 收敛 |
| `tangentLine(handle, fn, at, opts?)` | 切线（中心差分求斜率） |

```ts
import { functionGraph, riemannRectangles, tangentLine } from "@intermact/core";

const ax = scene.getAxes({ x: [0, 3], y: [0, 9], tickCount: 6 });
scene.register(functionGraph(ax.handle, (x) => x * x));
scene.register(riemannRectangles(ax.handle, (x) => x * x, { domain: [0, 3], n: 12 }));
scene.register(tangentLine(ax.handle, (x) => x * x, 1.5, { length: 1 }));
```

工具函数 `riemannSum(fn, domain, n, sample?)` 与 `slopeAt(fn, at, dx?)` 返回数值，便于做读数或测试断言。三种取样位置 `"left" | "midpoint" | "right"` 决定矩形高度的采样点。

## 表达与标注

| 工厂 | 说明 |
| --- | --- |
| `matrixObject(spec)` | 带括号的矩阵；内部计算列宽/行高 |
| `tableObject(spec)` | 带网格线的表格 |
| `brace(target, direction, opts?)` | 沿目标某一边的花括号 |
| `decimalNumber(tracker, opts?)` | 随 `tracker` 实时刷新的数字（M6 响应式） |

`brace` 接受 `Bounds2D` 或任意 `IMObject2D`（读取其几何 bounds），`direction` 为指向方向（如 `[0, -1]` 表示在下方）。这样 `constructs` 层不依赖 scene/`RegisteredObject`。

```ts
import { matrixObject, brace } from "@intermact/core";

const m = matrixObject({ values: [[2, -1], [0, 3]], center: xy(-3, 1) });
scene.register(m);
scene.register(brace(m, [0, -1], { depth: 0.35 }));
```

## c2p 贴合与响应式

`functionGraph`/`riemann`/`tangent` 等都在每次重建时调用 `handle.c2p`，因此当它们被包进 `derived([...])` 并由 `signal`/`valueTracker` 驱动时，会随参数实时重算（`riemann` 随 `n` 收敛、`tangent` 随动点斜率刷新）。这与 M6 响应式链路一致。

## 相关示例

- `math/axes-functiongraph` — Axes + FunctionGraph/Parametric，验证 `c2p` 贴合
- `math/riemann-sum` — 黎曼和随 `n` 收敛到 ∫₀³x²dx = 9
- `math/tangent-derivative` — 可探索导数：动点切线 + 斜率读数
- `math/matrix-table-brace` — Matrix/Table/Brace + 随 tween 刷新的 DecimalNumber
- `math/planes` — NumberPlane / PolarPlane / ComplexPlane
