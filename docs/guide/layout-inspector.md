# 布局与 Inspector

M12 落地两件事：**布局/层级**（RectTransform + Manim `next_to` 式相对定位，`design.md §9.3、§9.4`）与 **Inspector** 开发期检视器（`design.md §16`）。

## LayoutHandle

每个 `RegisteredObject2D` 暴露 `obj.layout`，方法返回 **Animation 句柄**（`duration: 0` 即即时；`scene.commit(...)` 或 `scene.play(...)` 应用）。布局基于**世界空间 bounds**（已合成父级变换），并即时回写授权 transform，使同一构建过程内的链式 `getBounds`/布局确定可推。

```ts
interface LayoutHandle {
  getBounds(): Bounds2D;                                  // 世界 AABB
  alignTo(point: AbsXY, opts?): Animation;                // 把自身 anchor 对齐到点
  nextTo(target, direction: Vec2, opts?): Animation;      // 贴着另一对象（[1,0]=右…）
  fitTo(bounds: Bounds2D, opts?): Animation;              // 等比缩放 + 居中贴合
  arrange(children, opts?): Animation;                    // row/column/grid 排布（parallel）
}
```

```ts
// 标题贴顶，副标题贴在标题下方，卡片排成一行
scene.commit(title.layout.alignTo(scene.coordinate.relToAbs(uv(0.5, 0.86)), { anchor: uv(0.5, 0.5) }));
await scene.play(
  subtitle.layout.nextTo(title, [0, -1], { gap: 0.3, duration: 0.4 }),
  subtitle.create({ duration: 0.4 }),
);
await scene.play(container.layout.arrange(cards, { direction: "row", gap: 0.4, duration: 0.7 }));
```

- `alignTo` 的 `anchor` 是**自身 bounds 的归一化点**（`uv(0,0)` 左下、`uv(0.5,0.5)` 中心、`uv(1,1)` 右上）。
- `nextTo` 的 `direction` 取每分量符号；非零轴按"半宽+半宽+gap"贴边，另一轴对齐目标中心。
- `fitTo` 为**等比**缩放（保宽高比）后居中，`padding` 先内缩目标框。
- `arrange` 支持 `row`/`column`/`grid`（`cols`），返回 `parallel` 动画。

## Transform 层级（§9.3）

```ts
const root = scene.registerEmpty({ position: xy(1, 0) });
const child = scene.register(circle({ radius: 0.2 }), { position: xy(2, 0) });
scene.setParent(child, root);
await scene.play(root.rotateTo(Math.PI / 2, { duration: 1 })); // 子对象继承世界变换
```

动画写 **local** transform；Player 在**快照阶段**沿父链合成 **world** transform（TRS，无切变）写入 `RuntimeState.transform`，透明度沿父链相乘。`obj.layout.getBounds()` 也据此返回真实世界 bounds；对带父级的对象，布局在父空间内换算 local 偏移。

## Inspector（§16）

DOM 叠层检视器，置于 canvas 之上：

```tsx
<IntermactCanvas program={program} controls={{ timeline: true, inspector: true }} />
```

展示：

- **registry + 运行时态**：每个对象的 id / 世界 position / scale / opacity / zIndex / 可见性；
- **活跃 Track**：当前时间命中的 track 数；
- **响应式图**：signals / derived（含其 signal 依赖）/ updaters 计数；
- **bounds 高亮**：勾选 `bounds` 后用 SVG 叠层描出各对象世界 AABB，点选某行高亮该对象。

也可单独使用 `<Inspector built={built} />`（须置于相对定位容器内）。

## 与设计稿偏差（具体化）

- LayoutHandle 在世界空间计算并**即时回写授权 transform**（便于链式布局），同时返回可播放/可 commit 的 Animation，与 §9.4 "方法返回动画句柄" 一致。
- world transform 合成放在 **Player 快照阶段**（而非渲染层），保持渲染适配器只消费 `RenderSnapshot`；`anchor` 字段用于 `alignTo` 的对齐语义，渲染轴心仍为对象局部原点。
- Inspector 的 bounds 投影默认按 `contain` fit 复算（与 `IntermactCanvas` 一致）；自定义 fit 经 `fit` prop 传入。

## 相关示例

- `layout/next-to-arrange` — `alignTo`/`nextTo`/`arrange` 组合布局。
- `layout/responsive-rect` — 域相对 UV 锚点 + `fitTo`。
- `devtools/inspector-tour` — Inspector 全功能巡览（registry/track/响应式图/bounds）。
