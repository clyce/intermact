# 时间线与 Player

## Storyboard 与 Track

构建期每次 `scene.play` 向 `StoryboardBuilder` 追加：

- **Tracks**：针对 `(targetId, property)` 的 tween / reveal / morph 等
- **Effects**：`call` 副作用（**不可 seek**）
- **Markers**：命名时间点，供 `jumpToMarker` 跳章

播放期 `Track.evaluate(localProgress)` 为纯函数，给定进度返回 `StatePatch`。

## Player API

`IntermactCanvas` 内部创建 `Player`；也可通过 `useIntermactPlayer` 或 `buildProgram` 获取：

| 方法 | 说明 |
| --- | --- |
| `play()` / `pause()` | 播放/暂停 |
| `seek(t)` | 跳到时间 `t`（秒），**确定性**重算状态 |
| `setRate(rate)` | 播放速率（负值反向） |
| `setLoop(loop)` | 是否循环 |
| `jumpToMarker(name)` | 跳到 marker |
| `subscribe(fn)` | 状态变化通知 |
| `update(deltaSeconds)` | 外部时钟步进（R3F `useFrame` 调用） |
| `getSnapshot()` | 当前 `RenderSnapshot` |

浏览器中连续播放由 `@intermact/render-r3f` 的 `SceneView` 在 `useFrame` 里驱动 `player.update`；`seek` 由时间线 UI 直接调用。

## 编排原语

```ts
import { sequence, parallel, stagger, wait, call } from "@intermact/core";

await scene.play(
  sequence(
    obj.create({ duration: 1 }),
    wait(0.3),
    obj.moveTo(xy(2, 0), { duration: 0.8 }),
  ),
);

await scene.play(
  parallel(
    a.fadeIn({ duration: 0.5 }),
    b.fadeIn({ duration: 0.5 }),
  ),
);

await scene.play(
  stagger(
    [a, b, c].map((o) => o.create({ duration: 1 })),
    { lag: 0.2 },
  ),
);

await scene.play(
  call(() => console.log("仅正向播放触发；seek 时跳过")),
);
```

### 不可 seek 边界

`call` 在 `seek` / 拖拽预览时**不执行**，并会在控制台告警一次（`design.md §11.5`）。需要可重放逻辑时请用 tween 或数据驱动状态，勿依赖 `call` 改运行时数据。

## 确定性测试

`packages/core/src/animation/timeline.test.ts` 对 Storyboard 在多个 `t` 采样做快照断言；`timeline/headless-eval` 示例演示 Node 无头求值。

同一 `seed`、同一构建程序、同一 `seek(t)` 必须得到相同 `RuntimeState`。

## Easing

`easing` 模块导出 `linear`、`cubicInOut`、`elasticOut` 等曲线名，用于 `AnimationSpec` 与各 `RegisteredObject` 动画选项。

完整对照见示例 `anim/easing-gallery`。

## 相关示例

- `timeline/seek-basics`
- `timeline/markers-slides`
- `timeline/headless-eval`
- `anim/sequence-parallel-stagger`
