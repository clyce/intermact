# 动画

v0.1 动画全部编译为 `AnimationSpec` → `Track`，支持任意时刻 `seek`（`call` 除外）。

## Create

描边按弧长画出，填充可选策略：

```ts
await scene.play(
  obj.create({
    duration: 2,
    easing: "cubicInOut",
    fill: { mode: "after-stroke-fade", overlap: 0.2 },
  }),
);
```

| `fill.mode` | 行为 |
| --- | --- |
| `none` | 仅描边 |
| `with-stroke` | 描边同时填充 |
| `after-stroke` | 描边结束后瞬间填充 |
| `after-stroke-fade` | 描边结束后淡入填充 |

**play 之前对象不可见**（reveal 从 0 开始）。

## Fade / Move / Rotate / Scale

```ts
await scene.play(
  obj.fadeIn({ duration: 0.6 }),
  obj.moveTo(xy(2, 0), { duration: 1, easing: "quadOut" }),
  obj.rotateTo(Math.PI / 4, { duration: 0.8 }),
  obj.scaleTo(xy(1.5, 1.5), { duration: 0.5 }),
);
```

## Morph

默认 **arc-length** 弧长归一化插值；v0.2 另提供 `anchor`、`matching`（分部 key 匹配）、`cross-fade` 兜底。详见 [Morph 与分部匹配](/guide/morph)。

```ts
import { morph, rectangle } from "@intermact/core";

await scene.play(
  morph(disk, rectangle({ width: 2, height: 1, style: { … } }), {
    duration: 1.2,
    strategy: "arc-length", // 或 "anchor" | "matching" | "cross-fade"
  }),
);

// 或 RegisteredObject2D 实例方法
await scene.play(disk.morphTo(rectangle({ … }), { duration: 1.2 }));
```

运行时通过 `geometryOverride` 插值采样轮廓，渲染器优先使用 override。

## 通用 tween

```ts
obj.tween({ type: "reveal" }, 1, { duration: 2.5, easing: "cubicInOut" });
```

## 相关示例

- `anim/create-fade-move`
- `anim/sequence-parallel-stagger`
- `anim/easing-gallery`
- `l1/basic-2d` — Create + morph + seek
