# 2D 几何

`@intermact/core` 的 `geometry` 模块提供不可变图元工厂与采样内核（`design.md §5`）。

## 图元工厂

| 工厂 | 说明 |
| --- | --- |
| `circle` | 圆，`radius` + `samples` |
| `ellipse` | 椭圆，`rx` / `ry` |
| `rectangle` | 矩形，支持 `cornerRadius` |
| `arc` | 圆弧 |
| `polygon` | 多边形，支持 `holes`（洞） |
| `bezierCurve` | 二次/三次贝塞尔链 |
| `line` | 折线 |
| `arrow` | 线段 + 实心三角箭头（底边垂直于轴） |
| `polyline` | 函数/数据折线（M5+） |

```ts
import { circle, polygon, xy } from "@intermact/core";

const star = polygon({
  points: [xy(0, 1), xy(0.3, 0.1) /* … */],
  style: {
    stroke: "#f59e0b",
    fill: "rgba(245,158,11,0.2)",
    fillRule: "evenodd",
    lineWidth: 0.05,
  },
});
```

## 样式 Style2D

```ts
style: {
  stroke: "#38bdf8",           // 颜色字符串
  fill: "rgba(56,189,248,0.2)",
  lineWidth: 0.06,             // 世界单位
  lineWidth: { value: 3, unit: "px" }, // 屏幕像素近似
  fillRule: "nonzero" | "evenodd", // v0.1: only nonzero + holes; even-odd deferred
}
```

## 采样与三角化

- **`resampleByArcLength`**：弧长均匀重采样
- **`SampledPath2D`**：`Float32Array` 高性能通道
- **`triangulate`**：earcut，外轮廓 + 洞
- **`computeBounds`**：轴对齐包围盒

`GeometryProvider2D` 统一 `samplePath` / `getBounds` / `sampleBuffer`。

## Trait 组合

对象通过 trait 声明能力：`stroke`、`fill`（闭合形）、`morphable`（可 morph）。用 `findTrait` 查询能力，避免继承树。

## 相关示例

- `geometry/primitives-gallery` — 全图元一览
- `geometry/sampling-debug` — 采样点、bounds、三角网可视化
