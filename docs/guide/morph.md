# Morph 与分部匹配

Morph 把一个已注册对象的几何平滑变换到另一个对象定义（`design.md §11.4`）。所有策略都编译成**纯函数、可 seek** 的 Track：任意时间 `t` 都能确定性求值，可在时间线上来回拖拽。

## 策略一览

```ts
type MorphStrategy = "arc-length" | "anchor" | "matching" | "cross-fade";

// 独立函数
morph(source, target, { strategy, duration, easing, sampleCount, matchBy, preserveStyle });
transformMatching(source, target, options); // = morph(..., { strategy: "matching" })

// RegisteredObject2D 方法
obj.morphTo(target, options);
obj.transformMatchingTo(target, options);
```

| 策略 | 用途 |
| --- | --- |
| `arc-length` | 默认。两边按弧长重采样到同点数后逐点插值 |
| `anchor` | 在 `arc-length` 基础上对每条轮廓做最优对齐（闭合轮廓择最优循环旋转，开放轮廓择方向），减少扭转 |
| `matching` | 复合对象按**部件 key** 分部变换（见下） |
| `cross-fade` | 拓扑差异过大时的兜底：单对象溶解（源淡出→换几何→目标淡入） |

## 轮廓数不同

`morph` 先把两边轮廓**按长度降序配对**（`design.md §11.4`：按面积/长度匹配），数目不等时用**塌缩到质心的零长度轮廓**补齐。于是多出来的目标轮廓从质心“生长”出现，多出来的源轮廓塌缩消失。

```ts
// 1 个圆 → 2 个圆的组：第二个环从质心生长
circleObj.morphTo(group2D([circle({ center: xy(-2, 0) }), circle({ center: xy(2, 0) })]));
```

## group2D 与部件 key

复合对象用 `group2D` 表达，保留每个子对象的 **key**：

```ts
import { group2D } from "@intermact/core";

const g = group2D([
  { key: "a", object: circle({ center: xy(-2, 0) }) },
  { key: "b", object: circle({ center: xy(2, 0) }) },
]);
// 或自动用下标作 key：group2D([objA, objB])
// 或派生 key：group2D([objA, objB], { keyOf: (o, i) => o.type + i })
```

聚合后 `group2D` 渲染为单个对象（合并所有子轮廓），但 `parts` 元数据供 matching 使用。

## matching 分部匹配

`transformMatching` 按 key 对子部件分三类处理（即 Manim 的 `TransformMatchingTex` 模型）：

- **transformer**：两边都有的 key → 平滑变换；
- **remover**：仅源有的 key → 塌缩到该部件质心而消失；
- **introducer**：仅目标有的 key → 从质心生长而出现。

```ts
const source = group2D([
  { key: "a", object: circle(...) },
  { key: "b", object: circle(...) }, // 仅源：remover
]);
const target = group2D([
  { key: "a", object: rectangle(...) }, // 共有：transformer
  { key: "c", object: triangle(...) }, // 仅目标：introducer
]);
source.transformMatchingTo(target, { duration: 2 });
```

> **具体化说明**：当前单对象渲染没有“逐部件透明度”通道，因此 remover/introducer 用**几何塌缩/生长**实现 fade 语义（而非逐部件 alpha）。`cross-fade` 在单个注册对象上是**溶解**（顺序淡出→淡入）；要做真正的叠加交叉淡入，请用两个对象各自 `fadeOut`/`fadeIn`。这些都是单对象架构下的等价实现，非降级；M10 的公式管线会以 token 作为部件 key 复用 matching。

## 相关示例

- `morph/shape-morph` — 不同点数的圆/多边形/星形 arc-length 与 anchor 变换
- `morph/contour-mismatch` — 轮廓数不同的补齐 + cross-fade 兜底
- `morph/matching-shapes` — `transformMatching` 按 key 的 transformer/remover/introducer
