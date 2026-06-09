/**
 * Scales and ticks (design.md §7.3). A {@link Scale} maps a data domain onto a
 * coordinate range and owns tick generation + formatting, mirroring the D3
 * mental model. Scales are the basis of every axis-bound math construct (M8):
 * `axes`, `numberLine`, `functionGraph`, `riemann`, etc. resolve data → world
 * coordinates through a scale.
 *
 * All scales are framework-free (pure TS) so they run headless in Node/Worker.
 */

/**
 * Maps values from a data domain to a coordinate range and back, and produces
 * human-friendly ticks. Callable: `scale(value)` performs the forward mapping.
 *
 * @typeParam TDomain - Domain value type (number, or `Date` for time scales).
 * @typeParam TRange - Range value type (always `number` for the v0.2 scales).
 */
export interface Scale<TDomain = number, TRange = number> {
  /** Forward map a domain value to the range. */
  (value: TDomain): TRange;
  /** Inverse map a range value back to the domain. */
  invert(value: TRange): TDomain;
  /** Generate approximately `count` nicely-rounded ticks across the domain. */
  ticks(count?: number): TDomain[];
  /**
   * Build a formatter for ticks. `count` matches the tick request (so decimals
   * track the tick step); `spec` is an optional minimal format hint
   * (`"%"` for percent, `".<n>f"` for fixed decimals).
   */
  tickFormat(count?: number, spec?: string): (value: TDomain) => string;
  readonly domain: readonly [TDomain, TDomain];
  readonly range: readonly [TRange, TRange];
}

const DEFAULT_TICK_COUNT = 10;

/** Internal mutable shape used while assembling a {@link Scale} function object. */
type MutableScale<TDomain, TRange> = {
  (value: TDomain): TRange;
  invert(value: TRange): TDomain;
  ticks(count?: number): TDomain[];
  tickFormat(count?: number, spec?: string): (value: TDomain) => string;
  domain: readonly [TDomain, TDomain];
  range: readonly [TRange, TRange];
};

function assembleScale<TDomain, TRange>(
  forward: (value: TDomain) => TRange,
  parts: Omit<MutableScale<TDomain, TRange>, "domain" | "range"> & {
    domain: readonly [TDomain, TDomain];
    range: readonly [TRange, TRange];
  },
): Scale<TDomain, TRange> {
  const scale = forward as unknown as MutableScale<TDomain, TRange>;
  scale.invert = parts.invert;
  scale.ticks = parts.ticks;
  scale.tickFormat = parts.tickFormat;
  scale.domain = parts.domain;
  scale.range = parts.range;
  return scale as Scale<TDomain, TRange>;
}

// ---------------------------------------------------------------------------
// Numeric tick generation (D3-equivalent "nice number" algorithm).
// ---------------------------------------------------------------------------

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

/**
 * Compute `[i1, i2, inc]` describing nice ticks for `[start, stop]`: ticks are
 * `i1*inc … i2*inc` (or divided by `-inc` when `inc < 0`). Ported from D3's
 * `tickSpec` so step sizes are always 1, 2 or 5 times a power of ten.
 */
function tickSpec(start: number, stop: number, count: number): [number, number, number] {
  const step = (stop - start) / Math.max(0, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  let i1: number;
  let i2: number;
  let inc: number;
  if (power < 0) {
    inc = 10 ** -power / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = 10 ** power * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && count >= 0.5 && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

/** Generate approximately `count` nicely-rounded ticks across `[start, stop]`. */
export function numericTicks(start: number, stop: number, count = DEFAULT_TICK_COUNT): number[] {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start;
  const [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (i2 < i1) return [];
  const n = i2 - i1 + 1;
  const out = new Array<number>(n);
  for (let i = 0; i < n; ++i) {
    out[i] = inc < 0 ? (i1 + i) / -inc : (i1 + i) * inc;
  }
  return reverse ? out.reverse() : out;
}

/** The "nice" step size that {@link numericTicks} would use for `[start, stop]`. */
export function tickStep(start: number, stop: number, count = DEFAULT_TICK_COUNT): number {
  const [, , inc] = tickSpec(start, stop, count);
  return inc < 0 ? 1 / -inc : inc;
}

/** Number of fractional digits needed to print ticks separated by `step`. */
function decimalsForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-12));
}

/** Build a numeric formatter from a tick step and an optional minimal spec. */
function numberFormatter(step: number, spec?: string): (value: number) => string {
  if (spec === "%") {
    const decimals = decimalsForStep(step * 100);
    return (v) => `${(v * 100).toFixed(decimals)}%`;
  }
  const fixedMatch = spec?.match(/^\.(\d+)f$/);
  if (fixedMatch) {
    const decimals = Number(fixedMatch[1]);
    return (v) => v.toFixed(decimals);
  }
  const decimals = decimalsForStep(step);
  return (v) => v.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Linear / power / log scales
// ---------------------------------------------------------------------------

/** Linear scale mapping `[d0,d1]` onto `[r0,r1]` (design.md §7.3). */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const dSpan = d1 - d0;
  const rSpan = r1 - r0;
  const forward = (value: number): number =>
    dSpan === 0 ? r0 : r0 + ((value - d0) / dSpan) * rSpan;
  return assembleScale(forward, {
    domain,
    range,
    invert: (value: number): number => (rSpan === 0 ? d0 : d0 + ((value - r0) / rSpan) * dSpan),
    ticks: (count = DEFAULT_TICK_COUNT) => numericTicks(d0, d1, count),
    tickFormat: (count = DEFAULT_TICK_COUNT, spec?: string) =>
      numberFormatter(tickStep(d0, d1, count), spec),
  });
}

/**
 * Power scale: applies `sign(x)·|x|^exponent` before a linear map (design.md
 * §7.3). `exponent` defaults to 1 (linear); 0.5 gives the classic sqrt scale.
 */
export function powScale(
  domain: readonly [number, number],
  range: readonly [number, number],
  exponent = 1,
): Scale {
  const transform = (x: number): number => (x < 0 ? -((-x) ** exponent) : x ** exponent);
  const untransform = (x: number): number =>
    x < 0 ? -((-x) ** (1 / exponent)) : x ** (1 / exponent);
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const t0 = transform(d0);
  const t1 = transform(d1);
  const tSpan = t1 - t0;
  const rSpan = r1 - r0;
  const forward = (value: number): number =>
    tSpan === 0 ? r0 : r0 + ((transform(value) - t0) / tSpan) * rSpan;
  return assembleScale(forward, {
    domain,
    range,
    invert: (value: number): number =>
      rSpan === 0 ? d0 : untransform(t0 + ((value - r0) / rSpan) * tSpan),
    ticks: (count = DEFAULT_TICK_COUNT) => numericTicks(d0, d1, count),
    tickFormat: (count = DEFAULT_TICK_COUNT, spec?: string) =>
      numberFormatter(tickStep(d0, d1, count), spec),
  });
}

/**
 * Logarithmic scale (design.md §7.3). Domain must be strictly positive (or
 * strictly negative); ticks fall on powers of `base` with 1–9 subdivisions when
 * the span is small. `base` defaults to 10.
 */
export function logScale(
  domain: readonly [number, number],
  range: readonly [number, number],
  base = 10,
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d0 <= 0 || d1 <= 0) {
    throw new Error(`logScale domain must be strictly positive, received [${d0}, ${d1}].`);
  }
  const logBase = Math.log(base);
  const logOf = (x: number): number => Math.log(x) / logBase;
  const l0 = logOf(d0);
  const l1 = logOf(d1);
  const lSpan = l1 - l0;
  const rSpan = r1 - r0;
  const forward = (value: number): number =>
    lSpan === 0 ? r0 : r0 + ((logOf(value) - l0) / lSpan) * rSpan;
  const ticks = (count = DEFAULT_TICK_COUNT): number[] => {
    const lo = Math.min(d0, d1);
    const hi = Math.max(d0, d1);
    const pStart = Math.floor(logOf(lo));
    const pEnd = Math.ceil(logOf(hi));
    const out: number[] = [];
    const subdivide = pEnd - pStart < count;
    for (let p = pStart; p <= pEnd; p++) {
      const decade = base ** p;
      if (subdivide && base === 10) {
        for (let k = 1; k < 10; k++) {
          const v = decade * k;
          if (v >= lo - 1e-12 && v <= hi + 1e-12) out.push(v);
        }
      } else if (decade >= lo - 1e-12 && decade <= hi + 1e-12) {
        out.push(decade);
      }
    }
    return d1 < d0 ? out.reverse() : out;
  };
  return assembleScale(forward, {
    domain,
    range,
    invert: (value: number): number =>
      rSpan === 0 ? d0 : base ** (l0 + ((value - r0) / rSpan) * lSpan),
    ticks,
    tickFormat:
      (_count = DEFAULT_TICK_COUNT, spec?: string) =>
      (value: number): string => {
        if (spec) return numberFormatter(0, spec)(value);
        const p = logOf(value);
        const rounded = Math.round(p);
        const isPower = Math.abs(p - rounded) < 1e-6;
        if (isPower) return String(base ** rounded);
        return value.toPrecision(2);
      },
  });
}

// ---------------------------------------------------------------------------
// Time scale
// ---------------------------------------------------------------------------

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;
const MS_MONTH = 30 * MS_DAY;
const MS_YEAR = 365 * MS_DAY;

/** Candidate `[approxDurationMs, kind, step]` intervals for time ticks. */
const TIME_INTERVALS: readonly [number, "ms" | "month" | "year", number][] = [
  [MS_SECOND, "ms", 1],
  [5 * MS_SECOND, "ms", 5],
  [15 * MS_SECOND, "ms", 15],
  [30 * MS_SECOND, "ms", 30],
  [MS_MINUTE, "ms", 1],
  [5 * MS_MINUTE, "ms", 5],
  [15 * MS_MINUTE, "ms", 15],
  [30 * MS_MINUTE, "ms", 30],
  [MS_HOUR, "ms", 1],
  [3 * MS_HOUR, "ms", 3],
  [6 * MS_HOUR, "ms", 6],
  [12 * MS_HOUR, "ms", 12],
  [MS_DAY, "ms", 1],
  [2 * MS_DAY, "ms", 2],
  [MS_WEEK, "ms", 1],
  [MS_MONTH, "month", 1],
  [3 * MS_MONTH, "month", 3],
  [MS_YEAR, "year", 1],
];

/** Generate calendar-aware time ticks (UTC) across `[startMs, stopMs]`. */
export function timeTicks(startMs: number, stopMs: number, count = DEFAULT_TICK_COUNT): number[] {
  if (!(count > 0) || startMs === stopMs) return startMs === stopMs ? [startMs] : [];
  const reverse = stopMs < startMs;
  const lo = Math.min(startMs, stopMs);
  const hi = Math.max(startMs, stopMs);
  const target = (hi - lo) / count;

  // For sub-second targets, fall back to linear numeric ticks on milliseconds.
  if (target < MS_SECOND) {
    const ticks = numericTicks(lo, hi, count);
    return reverse ? ticks.reverse() : ticks;
  }

  // Pick the candidate interval whose duration is closest to the target.
  let best = TIME_INTERVALS[TIME_INTERVALS.length - 1]!;
  let bestErr = Infinity;
  for (const candidate of TIME_INTERVALS) {
    const err = Math.abs(candidate[0] - target);
    if (err < bestErr) {
      bestErr = err;
      best = candidate;
    }
  }
  const [durationMs, kind, step] = best;

  const out: number[] = [];
  if (kind === "ms") {
    // For sub-month intervals the candidate duration is the exact spacing.
    const everyMs = durationMs;
    let t = Math.ceil(lo / everyMs) * everyMs;
    for (; t <= hi + 1e-6; t += everyMs) out.push(t);
  } else if (kind === "month") {
    const start = new Date(lo);
    let year = start.getUTCFullYear();
    let month = Math.ceil(start.getUTCMonth() / step) * step;
    for (;;) {
      const t = Date.UTC(year, month, 1);
      if (t > hi) break;
      if (t >= lo) out.push(t);
      month += step;
      while (month >= 12) {
        month -= 12;
        year += 1;
      }
    }
  } else {
    // Year: step may exceed 1 for very large spans; use nice year stepping.
    const startYear = new Date(lo).getUTCFullYear();
    const endYear = new Date(hi).getUTCFullYear();
    const yearStep = Math.max(1, tickStep(startYear, endYear, count));
    let y = Math.ceil(startYear / yearStep) * yearStep;
    for (; y <= endYear; y += yearStep) {
      const t = Date.UTC(y, 0, 1);
      if (t >= lo && t <= hi) out.push(t);
    }
  }
  return reverse ? out.reverse() : out;
}

/** Format a UTC date at a resolution implied by the tick spacing. */
function timeFormatter(stepMs: number): (date: Date) => string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return (date: Date): string => {
    const y = date.getUTCFullYear();
    const mo = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    const mi = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    if (stepMs >= MS_YEAR) return String(y);
    if (stepMs >= MS_MONTH) return `${y}-${pad(mo)}`;
    if (stepMs >= MS_DAY) return `${y}-${pad(mo)}-${pad(d)}`;
    if (stepMs >= MS_MINUTE) return `${pad(h)}:${pad(mi)}`;
    return `${pad(h)}:${pad(mi)}:${pad(s)}`;
  };
}

/** Time scale mapping `[Date, Date]` onto a numeric range (design.md §7.3). */
export function timeScale(
  domain: readonly [Date, Date],
  range: readonly [number, number],
): Scale<Date, number> {
  const d0 = domain[0].getTime();
  const d1 = domain[1].getTime();
  const [r0, r1] = range;
  const dSpan = d1 - d0;
  const rSpan = r1 - r0;
  const forward = (value: Date): number =>
    dSpan === 0 ? r0 : r0 + ((value.getTime() - d0) / dSpan) * rSpan;
  return assembleScale(forward, {
    domain,
    range,
    invert: (value: number): Date =>
      new Date(rSpan === 0 ? d0 : d0 + ((value - r0) / rSpan) * dSpan),
    ticks: (count = DEFAULT_TICK_COUNT) => timeTicks(d0, d1, count).map((t) => new Date(t)),
    tickFormat: (count = DEFAULT_TICK_COUNT) => {
      const stepMs = Math.abs(dSpan) / Math.max(1, count);
      const fmt = timeFormatter(stepMs);
      return (date: Date) => fmt(date);
    },
  });
}
