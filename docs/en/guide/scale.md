# Scale and Ticks

`Scale` maps data domains to coordinate domains and handles tick generation and formatting (D3 mental model, `design.md §7.3`). It is the positioning foundation for M8 math constructs (`axes`/`numberLine`/`functionGraph`/`riemann` etc.). All Scales are pure TS and run headlessly.

## Scale interface

```ts
interface Scale<TDomain = number, TRange = number> {
  (value: TDomain): TRange; // forward map (callable)
  invert(value: TRange): TDomain; // inverse map
  ticks(count?: number): TDomain[]; // ~count nice ticks
  tickFormat(count?: number, spec?: string): (v: TDomain) => string;
  readonly domain: readonly [TDomain, TDomain];
  readonly range: readonly [TRange, TRange];
}
```

## Four scale types

| Factory | Purpose |
| --- | --- |
| `linearScale(domain, range)` | Linear mapping |
| `powScale(domain, range, exponent?)` | Power mapping (`0.5` = sqrt scale) |
| `logScale(domain, range, base?)` | Log mapping (domain must be strictly positive) |
| `timeScale([Date, Date], range)` | Time scale; ticks aligned to calendar (UTC) |

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

## Tick algorithm

`ticks` uses D3's "nice number" algorithm: step is always `1 / 2 / 5 × 10^k`. Decimal places in `tickFormat` derive from tick step; `spec` supports a minimal subset: `"%"` (percent) and `".<n>f"` (fixed decimal).

`logScale` ticks fall on integer powers of `base`; for small spans, 1–9 subdivisions under decimal; `timeScale` picks calendar intervals (second/minute/hour/day/week/month/year) closest to target density.

## Related examples

- `scale/scale-playground` — linear/pow/log/time tick distribution + `tickFormat`
- `scale/log-plot` — `2^x` as a straight line on log y-axis
