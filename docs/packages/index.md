# Monorepo 包分层

公共 API 的**完整符号列表、参数与返回值**见 **[API Reference](/reference/)**——由 TypeDoc 从 `packages/*/src` 的导出项与 TSDoc 注释自动生成（`pnpm run gen:reference`），请勿在文档站手写重复 API 页。

## 布局

```text
packages/
  core/           @intermact/core
  render-three/   @intermact/render-three
  render-r3f/     @intermact/render-r3f
  react/          @intermact/react
examples/         @intermact/examples（私有，演示画廊）
docs/             @intermact/docs（私有，本文档站）
```

## 依赖规则

| 包 | 可依赖 | 禁止 |
| --- | --- | --- |
| `core` | 自身、纯算法库 | React、three、DOM |
| `render-three` | `core`、three | React、DOM |
| `render-r3f` | `core`、`render-three`、R3F | — |
| `react` | 以上全部 | — |

`pnpm run depcruise` 在 CI 中校验。

## 应用侧依赖

```json
{
  "dependencies": {
    "@intermact/core": "workspace:*",
    "@intermact/react": "workspace:*",
    "@react-three/fiber": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.171.0"
  }
}
```

## 维护 API 文档

1. 在源码中为**公共导出**编写 TSDoc（`/** … */`）
2. 编辑 [`reference-index.src.md`](../reference-index.src.md) 可更新 **API Reference 总览**中的架构说明（Phase-1 & Phase-2 归纳；Phase-3 符号页由 TypeDoc 生成）
3. 运行 `pnpm run gen:reference`（`dev:docs` / `build:docs` 会自动执行）
4. 输出到 `docs/reference/`，由 VitePress 挂载
