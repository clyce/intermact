# 响应式

响应式层对齐 Manim 的 `ValueTracker` + `add_updater` + `always_redraw`（`design.md §8`）。

## Signal 与 computed

```ts
import { signal, computed } from "@intermact/core";

const radius = signal(1);
const area = computed(() => Math.PI * radius.get() * radius.get());
```

构建期在 `createProgram` 内创建的信号会通过 `setSignalRegistrar` 自动注册到 `ReactiveEngine`。

## derived

几何工厂，依赖信号变化时最小重算：

```ts
import { derived, circle } from "@intermact/core";

const disk = derived(
  () =>
    circle({
      radius: radius.get(),
      style: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.2)" },
    }),
  [radius],
);

scene.register(disk, { position: xy(0, 0) });
```

## valueTracker 与 tweenSignal

```ts
import { valueTracker, tweenSignal } from "@intermact/core";

const t = valueTracker(0);
await scene.play(tweenSignal(t, 1, { duration: 2 }));
```

`tweenSignal` 编译为可 seek 的 `SignalTrack`。

## bindSignal 与 useSignal

- **`bindSignal`**：把外部源（如 Leva）绑定到 signal
- **`useSignal`**（`@intermact/react`）：在 React 组件中订阅 signal

```tsx
import { useSignal } from "@intermact/react";

function Panel({ freq }: { freq: Signal<number> }) {
  const f = useSignal(freq);
  return <span>f = {f.toFixed(2)}</span>;
}
```

## 帧循环

`Player.prepareFrame` → `ReactiveEngine.flush` → 重算 derived / 运行 `addUpdater` → 再生成 `RenderSnapshot`。

## 相关示例

- `reactive/value-tracker` — §8.2 双曲线内接矩形
- `reactive/leva-binding` — §19.2 交互正弦曲线
- `l1/interactive-sine` — L1 闸口演示
