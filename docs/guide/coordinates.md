# 坐标系与轴

## Scene2D 域

```ts
const scene = ctx.createScene2D({
  coordinate: "cartesian", // 或 "polar"
  domain: { x: [-6, 6], y: [-4, 4] },
  fit: "contain",
});
```

`domain` 定义场景逻辑坐标范围；`fit` 控制视口宽高比下的相机适配。

## CoordinateTransform2D

| 方法 | 说明 |
| --- | --- |
| `absToRel` / `relToAbs` | 绝对 ↔ 相对 UV |
| `toPolar` / `fromPolar` | 笛卡尔 ↔ 极坐标 |

往返一致性有单测覆盖（`coordinate-transform.test.ts`）。

## getAxes

轴对象通过 `scene.getAxes(props)` 注册，显隐用标准动画：

```ts
const axes = scene.getAxes({
  x: [-4, 4],
  y: [-3, 3],
  style: { stroke: "#64748b" },
  showTicks: true,
});

await scene.play(axes.fadeIn({ duration: 0.5 }));
// axes.handle.c2p(x, y) — 数据坐标 → 场景坐标
```

> **API 修订（v0.1.1）**：已移除 `showAxes` / `hideAxes` Scene 级辅助方法；轴与普通 `RegisteredObject` 一致。

## 最小数理构件（L1）

| 工厂 | 用途 |
| --- | --- |
| `functionGraph` | `fn(x)` 曲线，经 `c2p` 贴合轴 |
| `decimalNumber` | 七段数码管数字，可 `registerReactive` |
| `axesObject` | 底层轴几何（通常用 `getAxes`） |

完整 `Scale` / 刻度格式化在 M7；`NumberPlane` / `Riemann` 等在 M8。

## 相关示例

- `coords/cartesian-axes`
- `coords/fit-strategies`
- `coords/polar-scene`
- `l1/interactive-sine` — 函数图 + Leva 调参
