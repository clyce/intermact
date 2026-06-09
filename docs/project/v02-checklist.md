# v0.2 验收清单

对应 `dev-roadmap.md` §5「◆ v0.2 验收（DoD）」与 `design.md §0.2` 实现进度日志。

## DoD 条目

| 要求 | 状态 | 证据 |
| --- | --- | --- |
| Scale（linear/log/pow/time + ticks/format/invert） | ✅ | `scale/scale-playground`、`scale/log-plot`；`scale.test.ts` |
| 数理构件库（NumberLine/Axes/Planes/Graph/Riemann/Tangent/Matrix/Table/Brace/DecimalNumber） | ✅ | `math/*`（5）；`constructs.test.ts` |
| Morph（arc-length/anchor/cross-fade + matching 分部匹配） | ✅ | `morph/*`（3）；`morph-strategies.test.ts` |
| Text / LaTeX 管线（解析→布局→writing→matching + AssetManager） | ✅ | `text/*`、`latex/*`；`text.test.ts` |
| 交互系统（pick 代理命中、反投影、draggable、键盘） | ✅ | `interaction/*`（3）；`interaction.test.ts` |
| 布局 + Inspector（alignTo/nextTo/fitTo/arrange、层级、检视器） | ✅ | `layout/*`、`devtools/inspector-tour`；`layout.test.ts` |
| 可交互微积分演示（Riemann 收敛、切线随动点、拖动探索） | ✅ | `math/riemann-sum`、`math/tangent-derivative`、`interaction/explorable-derivative` |
| 公式分部变形可用 | ✅ | `latex/transform-matching-tex`、`morph/matching-shapes` |
| 各包 `VERSION` 升至 `0.2.0` | ✅ | `packages/*/src/index.ts`、`packages/*/package.json` |
| CI 全绿 | ✅ | lint + typecheck + vitest + depcruise（119 模块 0 违规）+ build |

## 各里程碑退出标准（摘要）

### M7 · Scale

- [x] `linearScale`/`logScale`/`powScale`/`timeScale` + `ticks`/`tickFormat`/`invert`
- [x] D3 nice-number 刻度；log 边界、time 跨度用例

### M8 · 数理构件库

- [x] 构件工厂（`constructs/`）+ 基于 `Scale` 重写的 `axesObject`（`xScale/yScale`）
- [x] 依附构件经 `c2p` 定位；Riemann 收敛、tangent 斜率、planes 往返

### M9 · Morph

- [x] arc-length / anchor / cross-fade / matching 四策略
- [x] `group2D` + 部件 key；contour 补齐；property-based 随机形状稳定

### M10 · Text / LaTeX

- [x] `parseSvgPath` + 内置笔画字体 + LaTeX 子集；`textObject`/`latexObject`
- [x] `write()` 描边 reveal；`transformMatchingTex`；`AssetManager` 构建期 prepare
- [x] M8 标签升级到笔画字体

### M11 · 交互系统

- [x] `PickProxy`（disc/rect/band）+ `hitTest`；三套坐标事件
- [x] `draggablePoint/Value(Source)`；`on()`/`interactive()`
- [x] R3F 反投影 + 指针分发 + cursor；`IntermactCanvas` 键盘传输

### M12 · 布局 + Inspector

- [x] `LayoutHandle`（`getBounds/alignTo/nextTo/fitTo/arrange`）
- [x] transform 层级（`setParent` + Player 快照世界变换合成）
- [x] Inspector（registry/运行时态/活跃 Track/响应式图/bounds 高亮）

## 已知偏差（不阻塞 v0.2）

- Text/LaTeX 采用**内置笔画矢量字体 + LaTeX 子集**（非 KaTeX/MathJax + troika MSDF）；trait/部件 key 契约不变，可无缝替换真实引擎。
- 小写以 small-caps 呈现；字体覆盖大写+数字+常用符号。
- 交互命中用**场景空间解析求交**（pick 代理）替代 WebGL raycast 阈值；2D 正交下等价。
- LayoutHandle 即时回写授权 transform 以支持链式布局；`fitTo` 为等比缩放。
- Inspector bounds 投影默认 `contain` fit。
- Morph 不在完成时 `replaceObject`（沿用 geometryOverride 模型），链式 morph 待序列化/播放器增强（§22.1）。

详见 `design.md §0.2` 实现进度日志。
