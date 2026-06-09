# Scale 与刻度

`Scale` 把数据域映射到坐标域，并负责刻度生成与格式化（对齐 D3 心智，`design.md §7.3`）。它是 M8 数理构件（`axes`/`numberLine`/`functionGraph`/`riemann` 等）的定位基石。所有 Scale 均为纯 TS，可无头运行。

## Scale 接口

```ts
interface Scale<TDomain = number, TRange = number> {
  (value: TDomain): TRange; // 正向映射（可调用）
  invert(value: TRange): TDomain; // 反向映射
  ticks(count?: number): TDomain[]; // 约 count 个 nice 刻度
  tickFormat(count?: number, spec?: string): (v: TDomain) => string;
  readonly domain: readonly [TDomain, TDomain];
  readonly range: readonly [TRange, TRange];
}
```

## 四种 Scale

| 工厂 | 用途 |
| --- | --- |
| `linearScale(domain, range)` | 线性映射 |
| `powScale(domain, range, exponent?)` | 幂映射（`0.5` 即 sqrt 标度） |
| `logScale(domain, range, base?)` | 对数映射（域须严格为正） |
| `timeScale([Date, Date], range)` | 时间标度，刻度按日历对齐（UTC） |

```ts
import { linearScale, logScale, powScale, timeScale } from "@intermact/core";

const x = linearScale([0, 100], [0, 10]);
x(50); // 5
x.invert(5); // 50
x.ticks(5); // [0, 20, 40, 60, 80, 100]
x.tickFormat(5)(20); // "20"

const y = logScale([1, 1000], [0, 3]);
y.ticks(3); // [1, 10, 100, 1000]
```

## 刻度算法

`ticks` 采用 D3 的「nice number」算法：步长恒为 `1 / 2 / 5 × 10^k`。`tickFormat` 的小数位数由刻度步长推导，`spec` 支持最小子集：`"%"`（百分比）与 `".<n>f"`（定点小数）。

`logScale` 刻度落在 `base` 的整数幂上，跨度较小时在十进制下补 1–9 的细分；`timeScale` 在秒/分/时/日/周/月/年中选取最接近目标密度的日历间隔。

## 相关示例

- `scale/scale-playground` — linear/pow/log/time 刻度分布对照 + `tickFormat`
- `scale/log-plot` — `2^x` 在对数 y 轴上呈直线
