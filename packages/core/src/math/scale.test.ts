import { describe, expect, it } from "vitest";
import {
  linearScale,
  logScale,
  numericTicks,
  powScale,
  tickStep,
  timeScale,
  timeTicks,
} from "./scale";

describe("linearScale", () => {
  it("maps domain to range and inverts round-trip", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
    expect(s.invert(50)).toBe(5);
    expect(s.invert(s(7.3))).toBeCloseTo(7.3, 12);
  });

  it("handles reversed and negative domains", () => {
    const s = linearScale([-4, 4], [0, 8]);
    expect(s(-4)).toBe(0);
    expect(s(0)).toBe(4);
    const r = linearScale([0, 1], [100, 0]);
    expect(r(0)).toBe(100);
    expect(r(1)).toBe(0);
  });

  it("produces nice ticks with 1/2/5 steps", () => {
    expect(numericTicks(0, 10, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(numericTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(tickStep(0, 100, 10)).toBe(10);
    expect(tickStep(0, 1, 5)).toBeCloseTo(0.2, 12);
  });

  it("formats ticks with step-derived decimals", () => {
    const s = linearScale([0, 1], [0, 1]);
    const fmt = s.tickFormat(5);
    expect(fmt(0.2)).toBe("0.2");
    expect(s.tickFormat(5, ".2f")(0.5)).toBe("0.50");
    expect(s.tickFormat(5, "%")(0.25)).toBe("25%");
  });
});

describe("powScale", () => {
  it("applies the exponent transform and inverts", () => {
    const sqrt = powScale([0, 100], [0, 10], 0.5);
    expect(sqrt(0)).toBe(0);
    expect(sqrt(100)).toBe(10);
    expect(sqrt(25)).toBeCloseTo(5, 12);
    expect(sqrt.invert(5)).toBeCloseTo(25, 10);
  });

  it("defaults to linear when exponent is 1", () => {
    const s = powScale([0, 10], [0, 1]);
    expect(s(5)).toBeCloseTo(0.5, 12);
  });
});

describe("logScale", () => {
  it("maps logarithmically and inverts", () => {
    const s = logScale([1, 1000], [0, 3]);
    expect(s(1)).toBeCloseTo(0, 12);
    expect(s(10)).toBeCloseTo(1, 12);
    expect(s(100)).toBeCloseTo(2, 12);
    expect(s(1000)).toBeCloseTo(3, 12);
    expect(s.invert(2)).toBeCloseTo(100, 9);
  });

  it("generates power-of-base ticks across decades", () => {
    const s = logScale([1, 1000], [0, 3]);
    expect(s.ticks(3)).toEqual([1, 10, 100, 1000]);
    expect(s.tickFormat()(100)).toBe("100");
  });

  it("rejects non-positive domains", () => {
    expect(() => logScale([0, 10], [0, 1])).toThrow();
    expect(() => logScale([-1, 10], [0, 1])).toThrow();
  });
});

describe("timeScale", () => {
  it("maps dates to a numeric range and inverts", () => {
    const start = new Date(Date.UTC(2020, 0, 1));
    const end = new Date(Date.UTC(2020, 0, 11));
    const s = timeScale([start, end], [0, 10]);
    expect(s(start)).toBe(0);
    expect(s(end)).toBe(10);
    const mid = new Date(Date.UTC(2020, 0, 6));
    expect(s(mid)).toBeCloseTo(5, 9);
    expect(s.invert(5).getTime()).toBe(mid.getTime());
  });

  it("generates calendar-aware ticks across a multi-day span", () => {
    const a = Date.UTC(2020, 0, 1);
    const b = Date.UTC(2020, 0, 11);
    const ticks = timeTicks(a, b, 10);
    expect(ticks.length).toBeGreaterThan(0);
    // every tick is inside the span and on a day boundary (UTC)
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(a);
      expect(t).toBeLessThanOrEqual(b);
      expect(new Date(t).getUTCHours()).toBe(0);
    }
  });

  it("formats year-spaced ticks as years", () => {
    const start = new Date(Date.UTC(2015, 0, 1));
    const end = new Date(Date.UTC(2025, 0, 1));
    const s = timeScale([start, end], [0, 1]);
    const fmt = s.tickFormat(10);
    expect(fmt(new Date(Date.UTC(2020, 0, 1)))).toBe("2020");
  });
});
