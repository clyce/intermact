# 交互系统

把指针/键盘交互与响应式打通（`design.md §12`）：拖拽控制点直接写信号，依赖它的几何自动重算（§8）。这是"观众互动探索"的基本积木。

## 命中测试（pick 代理）

WebGL 下细线/空心图形难以直接 raycast。Intermact 为可交互对象生成**pick 代理几何**，并在场景空间做**解析命中测试**（指针反投影到世界坐标后与代理求交）——对细线/点精确，且无 raycast 精度问题。

```ts
type PickProxy =
  | { kind: "disc"; center: AbsXY; radius: number }   // 点
  | { kind: "rect"; min: AbsXY; max: AbsXY }           // 区域
  | { kind: "band"; polylines: Float32Array[]; width: number }; // 细线带状

// 工具：从对象描边生成带状代理 / 从 bounds 生成矩形代理
pickBandFromObject(object, width);
pickRectFromObject(object, pad?);
```

`hitTest(entries, p)` 返回最上层命中的对象 id（按 `zIndex`）。

## 事件与坐标反投影

事件对象同时提供三套坐标（`design.md §12.2），作者无需手动反投影：

```ts
interface IntermactPointerEvent {
  screen: Vec2;     // 像素
  sceneAbs: AbsXY;  // 场景世界坐标（已反投影）
  sceneRel: RelUV;  // 归一化
  targetId?: string;
}
interface IntermactDragEvent extends IntermactPointerEvent {
  deltaAbs: AbsXY;
  startAbs: AbsXY;
}
```

绑定通过 `RegisteredObject2D.on(binding, pick?)`（静态对象）或 `interactive(object, { pick, binding })`（用于 `derived` 构建）附加：

```ts
scene.register(line({ from, to })).on(
  { onPointerDown: (e) => console.log("hit", e.sceneAbs) },
  pickBandFromObject(obj, 0.18),
);
```

## 可拖拽控制点

```ts
import { draggablePointSource, draggableValueSource, signal, derived } from "@intermact/core";

const p0 = signal(xy(-2, 0));
scene.registerReactive(draggablePointSource(p0));
scene.registerReactive(derived([p0], () => bezierCurve({ points: [p0.get(), /* … */] })));
// 拖动控制点 → 写信号 → 曲线实时重算
```

- `draggablePoint(sig)` / `draggablePointSource(sig)` — 2D 点，拖拽写 `Signal<AbsXY>`。
- `draggableValue(sig, axis)` / `draggableValueSource(...)` — 沿轴滑动的标量手柄，支持 `range` 钳制、`toWorld`/`fromWorld` 自定义映射（让手柄贴着曲线滑动）。

> 句柄几何以信号当前值为中心，故请用 `registerReactive`（或 `*Source`）注册，使其跟随信号移动。

## 键盘

`IntermactCanvas`（`keyboard` 默认开）支持：空格 play/pause、← →逐帧（`Shift`+←→为 ±1s）、`Home`/`End` 跳首尾。

## 与设计稿偏差（具体化）

- 命中测试用**场景空间解析求交**（pick 代理 disc/rect/band），而非生成不可见 pick mesh + WebGL raycast——2D 正交下结果等价且更稳定/确定。
- 反投影用正交相机 `unproject`；纯函数 `unprojectOrtho`/`projectOrtho` 供测试与无头使用。

## 相关示例

- `interaction/draggable-bezier` — 拖控制点实时重算的贝塞尔曲线。
- `interaction/hit-testing` — 细线/圆环的精确命中与高亮。
- `interaction/explorable-derivative` — 拖动 `x` 探索切线/导数读数。
