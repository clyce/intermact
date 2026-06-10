# 程序化生成（PCG）

PCG 把「数据/规则 → 几何」做成一组**纯函数** `(spec) => IMObject2D`（`design.md §6`）。生成器无副作用、不接触场景，随机性一律走注入的 `rng`，因此同一 `spec` + 同一种子永远得到同一结果——可序列化、可 seek、可测试。

## 生成器家族

| 类别 | 函数 | 说明 |
| --- | --- | --- |
| 参数/点阵 | `parametricCurve2D` / `lattice` / `tiling` | 参数曲线、网格、周期铺砌（§6.3） |
| 分形/规则 | `fractal` / `recursiveTree` / `lSystem` / `cellularAutomaton` | IFS/科赫/谢尔宾斯基、递归树、L-system、元胞自动机（§6.4） |
| 场 | `functionGraph` / `isoline` / `heatmap` / `streamlines` | 函数图、等值线、热力图、流线（§6.2） |
| 图/数据 | `graphObject` / `barChart` / `scatter` / `lineChart` / `mapData` | 力导向图、数据图表（§6.5） |

```ts
import { parametricCurve2D, recursiveTree, scatter, xy } from "@intermact/core";

const rose = parametricCurve2D({
  domain: [0, Math.PI * 2],
  fn: (t) => [Math.cos(3 * t) * Math.cos(t), Math.cos(3 * t) * Math.sin(t)],
  samples: 400,
  closed: true,
});

const tree = recursiveTree({ depth: 7, branchAngle: 26 });

const dots = scatter({ points: [xy(0, 1), xy(1, 2), xy(2, 1.5)], size: [4, 2] });
```

## 确定性随机：`spec.rng`

需要随机的生成器（`fractal` 的混沌游戏、`graphObject` 的力导向布局、`cellularAutomaton` 的随机初始）显式接收一个 `rng`。**没有注入 `rng` 时会 fail-fast 抛错**，而非静默回退到非确定结果。

```ts
import { createRng, graphObject } from "@intermact/core";

const graph = graphObject({
  nodes: ["a", "b", "c", "d"],
  edges: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"]],
  layout: "force",
  rng: createRng("my-seed"), // 同一种子 ⇒ 同一布局
});
```

> 构建期可用 `ctx.rng` 作为默认随机源；生成器本身保持纯函数，便于在 Node/测试中独立调用。

## 组合算子

算子是 `IMObject2D → IMObject2D` 的纯变换，可链式叠加；变换会**烘焙进几何**，产出新的不可变定义（`design.md §6.6）。

| 算子 | 作用 |
| --- | --- |
| `transformObject(obj, t)` | 平移/旋转/缩放烘焙进几何 |
| `repeatObject(obj, n, step)` | 按复合步进重复 `n` 份 |
| `instanceField(obj, transforms)` | 单一几何 + 逐实例变换（M16 GPU 实例化） |
| `mapPoints(obj, f)` | 逐点映射（如共形变换） |
| `along(obj, path, opts)` | 沿路径均匀分布、可朝向切线 |
| `booleanOp(a, b, op)` | 单环多边形并/交/差/异或 |

```ts
import { booleanOp, circle, repeatObject, transformObject, xy } from "@intermact/core";

const crescent = booleanOp(circle({ radius: 1 }), circle({ radius: 1, center: xy(0.5, 0) }), "subtract");

const fan = transformObject(
  repeatObject(circle({ radius: 0.1 }), 8, { position: xy(0.2, 0), rotation: Math.PI / 8 }),
  { position: xy(-2, 0) },
);
```

`booleanOp` 仅支持单环操作数；传入多轮廓对象会抛 `invalid-argument`（避免静默丢环得到错误结果）。

## 插件生成器

PCG 也是注册表扩展点之一：注册一个 `GeneratorDescriptor`，用 `runGenerator(name, params, rng)` 按名分发（见[扩展性指南](/guide/extensibility)）。

## 相关示例

- `pcg/operators-showcase` — `transformObject`/`repeatObject`/`booleanOp`/`mapPoints`/`along` 组合算子
- `pcg/data-charts` — `mapData` 数据绑定 + `scatter`/`lineChart`
- `pcg/generators-extra` — `tiling`/`lattice`/`recursiveTree`/`parametricCurve2D`
- `pcg/lsystem-plant` — L-system 植物（确定性 `spec.rng`）
- `pcg/scalar-field-isolines` — `isoline`/`heatmap` 标量场
- `pcg/vector-field-streamlines` — RK4 `streamlines` 向量场
- `pcg/cellular-automaton` — Wolfram Rule 30 + 2D 生命游戏 `cellularAutomatonFrames`
- `pcg/fractal-graph` — Sierpinski 分形 + `graphObject`
- `pcg/data-driven-bars` — `barChart` 数据驱动

完整清单见[示例索引](/examples/)。
