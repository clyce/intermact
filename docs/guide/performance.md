# 性能与大数据

Intermact 的渲染面向「大量对象 / 大点云 / 重采样」做了三条优化路径（`design.md §15.2`）：GPU 实例化、Float32Array 缓冲通道、Worker 离主线程采样。核心始终保持 DOM/GL 无关。

## GPU 实例化

`instanceField(object, transforms)` 用单一基础几何 + 逐实例变换表达海量重复对象。它同时：

- 烘焙聚合几何进 stroke/fill trait——无头采样、SVG、拾取、bounds 全部正确；
- 携带 `InstancedTrait`，GPU 渲染器用真正的 `InstancedMesh` 每实例画一次基础几何（而非巨型聚合缓冲）。

无实例化路径的渲染器自动回退到烘焙后的组几何（像素一致，仅无 GPU 加速）。实例视图禁用视锥剔除（或扩展包围盒）以避免被错误剔除，并正确处理 morph 的 `geometryOverride` 与 trait 变更重分发。

```ts
import { circle, instanceField } from "@intermact/core";
const dots = instanceField(
  circle({ radius: 0.02 }),
  Array.from({ length: 10000 }, () => ({ position: [Math.random() * 8 - 4, Math.random() * 6 - 3] })),
);
```

## 大点云：Float32Array 通道

`pointCloud3D` 直接消费 `Float32Array` 位置缓冲，渲染器按该通道上传，无每帧几何重建。`Create` 通过裁剪 draw range 揭示，避免逐帧 churn——6 万点也能流畅 seek。

## Worker 采样

重型 polygonization（如 marching-cubes）可离主线程：`@intermact/render-three` 提供 worker 协议/内核/客户端胶水，`core` 保持纯净。主线程与 Worker 路径产出一致几何。

## 几何记忆化与预算

- 采样/三角网结果按内容记忆化（`geometry/memoize`），相同输入复用缓冲。
- 时间线 seek 为纯函数：2000-track 交错时间线的 seek 仍是正确且快速的（见 `perf/perf-budget` 测试）。

## 相关示例

- `perf/instanced-10k` — `instanceField` GPU 实例化 1 万对象
- `perf/large-pointcloud` — Float32Array 通道大点云
- `perf/worker-sampling` — Worker 离主线程 marching-cubes 采样

完整清单见[示例索引](/examples/)。
