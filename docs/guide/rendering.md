# 渲染

v0.1 渲染栈：`core` 产出 `RenderSnapshot` → `render-three` 构建 three 几何 → `render-r3f` 在 R3F 中 diff 更新。

## 渲染管线

```text
Player.getSnapshot()
  → RenderSnapshot（对象 id → RuntimeState2D）
  → ThreeSceneView.diff(snapshot)
  → Line/ Mesh geometry + basic material
  → R3F Canvas（正交相机 + fit）
```

### Stroke

- 世界单位 **ribbon** 几何
- **`revealEnd` / `revealStart`**：按弧长 trim，支持 Create 动画
- 闭合轮廓的弧长**包含**首尾闭合段（v0.1.1 修复）

### Fill

- earcut 三角化（nonzero + 带洞）；`evenodd` 自相交填充推迟至 M9/M16
- 材质 unlit + transparent，`depthWrite: false`（2D 画家算法）

### 线宽

- 世界单位：直接按场景尺度
- 像素单位：用 `worldPerPixel` 换算为 ribbon 宽度（恒定屏幕宽度近似）

## IntermactCanvas

```tsx
<IntermactCanvas
  program={program}
  autoplay={true}
  seed={42}
  controls={{ timeline: true }}
  style={{ width: "100%", height: 480 }}
/>
```

- **`fit`**：继承自 `Scene2DProps`（`contain` / `cover` / `stretch`）
- **HiDPI**：`dpr={[1, 2]}`
- **resize**：R3F + `computeFit` 重算正交相机

## SceneRendererAdapter

`render-three` 导出 `SceneRendererAdapter` 接口；默认由 `render-r3f` 的 `SceneView` 实现。高级用法可手动组合 `useIntermactPlayer` + `<Canvas>` + `<SceneView>`。

## 相关示例

| 示例 | 验证点 |
| --- | --- |
| `render/stroke-fill-showcase` | 三行：静态 fill / 纯描边 reveal / Create（描边+填充） |
| `render/zorder-transparency` | z 序与半透明 |
| `render/dpi-resize` | 容器 resize + HiDPI |
