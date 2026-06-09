# v0.1 验收清单

对应 `dev-roadmap.md` §4「◆ v0.1 验收（DoD）」与 `design.md §19.1–19.2`。

## DoD 条目

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| 基础 2D 示例（Create / Move / Tween） | ✅ | `l1/basic-2d` |
| 交互函数曲线（Leva 调参，曲线实时重算） | ✅ | `l1/interactive-sine`（`reactive/leva-binding`） |
| 进度条可 seek，结果确定 | ✅ | `IntermactCanvas` + `TimelineControls`；`timeline.test.ts` |
| 时间线确定性数值断言纳入 CI | ✅ | `pnpm run ci` |
| `design.md §19.1` 可跑通 | ✅ | `l1/basic-2d` |
| `design.md §19.2` 可跑通 | ✅ | `l1/interactive-sine` |
| CI 全绿 | ✅ | lint + typecheck + 67 tests + depcruise + build |

## 各里程碑退出标准（摘要）

### M0

- [x] monorepo + TS strict + tsup/Vite + Vitest + ESLint + depcruise
- [x] `empty-canvas`、`static-circle` 示例

### M1

- [x] `IMObject` / trait / `RuntimeState` / `StatePatch`
- [x] `Storyboard` / `Track` / `Player`（seek 确定性）
- [x] 无头求值 + 确定性数值断言测试

### M2

- [x] 8 类图元 + 弧长采样 + earcut + bounds 单测

### M3

- [x] stroke trim + fill + `IntermactCanvas` + DPI/resize
- [x] renderer smoke 测试

### M4

- [x] Create / Fade / Move / orchestration / easing
- [x] arc-length morph 兜底

### M5

- [x] `CoordinateTransform2D` + `getAxes` + fit 策略
- [x] `functionGraph` / `decimalNumber`（L1 最小集）

### M6

- [x] signal / derived / tweenSignal / `useSignal`
- [x] 依赖最小重算测试

## 已知偏差（不阻塞 v0.1）

- Morph 仅 arc-length；matching 属 M9
- `decimalNumber` 示例用 `xy` 非 `uv` HUD
- `call` 不可 seek
- px 线宽为 ribbon 近似

详见 `design.md §0.1` 实现进度日志。
