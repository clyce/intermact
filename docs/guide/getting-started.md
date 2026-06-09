# 快速上手

## 环境要求

- **Node.js** ≥ 20
- **pnpm** ≥ 10

## 安装与运行

```bash
git clone <repo-url> intermact
cd intermact
pnpm install
```

### 官网（文档 + 交互示例，推荐）

```bash
pnpm run dev:site
```

浏览器打开 **`http://localhost:5174`**：指南、API Reference、路线图与 **`/demos/`** 可交互画廊在同一站点。开发期 `/demos/` 由 VitePress 代理到示例 dev server（`5173`）。

生产构建：

```bash
pnpm run build:site    # examples → docs/public/demos + VitePress 静态站
pnpm run preview:site  # 本地预览完整站点
```

### 仅示例画廊（独立调试）

```bash
pnpm run dev:examples
```

浏览器打开 `http://localhost:5173`（根路径 `/`，不含文档导航）。

### 仅文档站

```bash
pnpm run dev:docs
```

`http://localhost:5174`；**`/demos/` 需 `dev:site`（实时画廊）或先 `build:site`（静态嵌入）**，单独 `dev:docs` 不会启动 `:5173` 示例服务。

### 质量闸口

```bash
pnpm run ci
```

等价于 `lint` + `typecheck` + `test`（67 项 Vitest）+ `depcruise` + `build`。

## 最小示例

下面是一个带 Create 动画与可 seek 时间线的完整程序：

```tsx
import { circle, createProgram, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4, 4], y: [-3, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const disk = scene.register(
    circle({
      radius: 1.2,
      style: {
        stroke: "#38bdf8",
        fill: "rgba(56,189,248,0.2)",
        lineWidth: 0.05,
      },
    }),
    { position: xy(0, 0) },
  );

  await scene.play(disk.create({ duration: 1.5, easing: "cubicInOut" }));
});

export function Demo() {
  return (
    <div style={{ width: "100%", height: 400 }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} autoplay />
    </div>
  );
}
```

要点：

1. **`createProgram`**：构建期回调，`await scene.play(...)` 只向 Storyboard **追加**轨道，不阻塞真实时间。
2. **`scene.register`**：把不可变 `IMObject2D` 放入场景，返回 `RegisteredObject2D`（动画句柄挂在这里）。
3. **`IntermactCanvas`**：构建程序、挂载 R3F Canvas、驱动 Player，可选时间线叠层。

## Monorepo 包一览

| 包 | 用途 |
| --- | --- |
| `@intermact/core` | 模型、几何、时间线、响应式（无 React/three/DOM） |
| `@intermact/render-three` | three.js 几何/材质构建（无 React） |
| `@intermact/render-r3f` | R3F `SceneView`、相机 fit |
| `@intermact/react` | `IntermactCanvas`、hooks、时间线控件 |
| `@intermact/examples` | Vite 演示画廊（非发布包） |

应用侧通常只直接依赖 `@intermact/core` 与 `@intermact/react`。

## 下一步

- [架构概览](./architecture.md) — 构建期 vs 播放期、包边界
- [程序与场景](./program-and-scene.md) — `createProgram` / `Scene2D` / `register`
- [API Reference](/reference/) — 从源码 TSDoc 自动生成的符号文档
- [交互示例 `/demos/`](/demos/) — 可运行画廊（与文档同站）
- [示例目录](../examples/) — 按里程碑的文字索引（可链到 `/demos/#<id>`）
