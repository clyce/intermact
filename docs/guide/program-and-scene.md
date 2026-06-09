# 程序与场景

## createProgram

`createProgram` 包装异步构建回调，返回 `IntermactProgram`。`IntermactCanvas` 或 `buildProgram` 会执行一次构建，产出 `Player` + `Storyboard`。

```ts
import { createProgram, xy } from "@intermact/core";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian", // 或 "polar"
    domain: { x: [-5, 5], y: [-4, 4] },
    fit: "contain",          // contain | cover | stretch
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // … register objects, scene.play(…)
});
```

### IntermactProgramContext

| 方法 | 说明 |
| --- | --- |
| `createScene2D(props)` | 创建 `Scene2D`，绑定 `ReactiveEngine` |
| `createCamera2D(scene, props?)` | 2D 正交相机描述 |
| `mount(scene, camera, rect?)` | 记录视口（v0.1 单主场景） |
| `rng` | 种子化 RNG（`createRng`），同 seed 可复现 |

`buildProgram(program, { seed })` 可在 Node 中无头运行，用于测试与导出管线。

## Scene2D

### register

把不可变 `IMObject2D` 注册进场景：

```ts
const obj = scene.register(circle({ radius: 1, style: { stroke: "#fff" } }), {
  position: xy(1, 2),
  rotation: 0,
  scale: xy(1, 1),
  opacity: 1,
});
```

`register` 返回 `RegisteredObject2D`——所有动画 API 的接收者。

### play

```ts
await scene.play(
  obj.create({ duration: 1 }),
  other.fadeIn({ duration: 0.5 }),
);
```

并行传入多个 `Animation` 时同时播放。内部编译为 `Storyboard` 轨道，不执行墙钟等待。

### getAxes

坐标轴是**普通注册对象**，不是 Scene 上的特殊副作用 API：

```ts
const axes = scene.getAxes({
  x: [-4, 4],
  y: [-3, 3],
  style: { stroke: "#94a3b8", lineWidth: 0.03 },
  xLabel: "x",
  yLabel: "y",
  showTicks: true,
  showTickLabels: false,
});

await scene.play(axes.fadeIn({ duration: 0.6 }));
```

`axes.handle` 提供 `c2p` / `p2c` 坐标映射（数理构件贴合用）。

## RegisteredObject2D 动画快捷方法

| 方法 | 说明 |
| --- | --- |
| `create(opts?)` | 描边 reveal + 可选填充策略 |
| `fadeIn` / `fadeOut` | 透明度 tween |
| `moveTo` / `rotateTo` / `scaleTo` | 变换 tween |
| `fadeTo` | 透明度到目标值 |
| `tween(property, to, opts?)` | 通用属性 tween（含 `reveal`） |
| `addUpdater(fn)` | 每帧更新回调（需场景绑定 ReactiveEngine） |

详见 [动画](./animation.md)。

## 坐标辅助

```ts
import { xy, uv } from "@intermact/core";

xy(1, 2);   // 场景绝对坐标（与 domain 同单位）
uv(0.5, 0); // 相对 UV（布局里程碑扩展）
```

`scene.coordinateTransform` 提供 `absToRel` / `relToAbs` / `toPolar` / `fromPolar`（见 [坐标系](./coordinates.md)）。

## 相关示例

- `timeline/seek-basics` — 单 tween seek
- `coords/cartesian-axes` — `getAxes` + fadeIn
- `l1/basic-2d` — §19.1 综合叙事
