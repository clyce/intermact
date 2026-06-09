import { describe, expect, it } from "vitest";
import { createSignal } from "../reactive/signal";
import { findTrait } from "../object/traits";
import { xy } from "../math/vec";
import {
  distanceToPolyline,
  hitProxy,
  hitTest,
  pickBandFromObject,
  pointInDisc,
  pointInRect,
  type HitEntry,
} from "./hit-test";
import { draggablePoint, draggableValue } from "./draggable";
import { circle } from "../geometry/primitives";

describe("hit-test primitives (M11 / §12.1)", () => {
  it("tests discs, rects, and polyline bands", () => {
    expect(pointInDisc(xy(0.1, 0), xy(0, 0), 0.2)).toBe(true);
    expect(pointInDisc(xy(0.3, 0), xy(0, 0), 0.2)).toBe(false);
    expect(pointInRect(xy(0, 0), xy(-1, -1), xy(1, 1))).toBe(true);
    const line = new Float32Array([0, 0, 1, 0]);
    expect(distanceToPolyline(xy(0.5, 0.05), line)).toBeCloseTo(0.05, 6);
  });

  it("hitProxy offsets the proxy by the object's world position", () => {
    const proxy = { kind: "disc" as const, center: xy(0, 0), radius: 0.2 };
    expect(hitProxy(proxy, xy(2.05, 0), xy(2, 0))).toBe(true);
    expect(hitProxy(proxy, xy(0.05, 0), xy(2, 0))).toBe(false);
  });

  it("hitTest returns the topmost entry by zIndex", () => {
    const entries: HitEntry[] = [
      {
        id: "a",
        proxy: { kind: "disc", center: xy(0, 0), radius: 0.5 },
        offset: xy(0, 0),
        zIndex: 0,
      },
      {
        id: "b",
        proxy: { kind: "disc", center: xy(0, 0), radius: 0.5 },
        offset: xy(0, 0),
        zIndex: 5,
      },
    ];
    expect(hitTest(entries, xy(0, 0))).toBe("b");
    expect(hitTest(entries, xy(5, 5))).toBeNull();
  });

  it("builds a precise band proxy for a thin stroke (hit-testing lines)", () => {
    const c = circle({ radius: 1 });
    const proxy = pickBandFromObject(c, 0.1);
    expect(proxy.kind).toBe("band");
    // A point right on the ring is a hit; the empty center is not.
    expect(hitProxy(proxy, xy(1, 0), xy(0, 0))).toBe(true);
    expect(hitProxy(proxy, xy(0, 0), xy(0, 0))).toBe(false);
  });
});

describe("draggable handles (M11 / §12.3)", () => {
  it("draggablePoint follows and writes its signal", () => {
    const p = createSignal(xy(1, 2));
    const obj = draggablePoint(p, { radius: 0.1 });
    const it = findTrait(obj.traits, "interactive")!;
    expect(it.drag?.read()).toEqual(xy(1, 2));
    // Geometry is centered at the signal value.
    expect(obj.geometry.getBounds().center[0]).toBeCloseTo(1, 6);
    // Dragging writes the signal.
    it.drag?.write(xy(-3, 4));
    expect(p.get()).toEqual(xy(-3, 4));
  });

  it("draggableValue maps an axis and clamps to range", () => {
    const v = createSignal(0.5);
    const obj = draggableValue(v, "x", { baseline: -1, range: [0, 1] });
    const it = findTrait(obj.traits, "interactive")!;
    expect(it.drag?.read()).toEqual(xy(0.5, -1));
    it.drag?.write(xy(5, -1)); // beyond range → clamped to 1
    expect(v.get()).toBe(1);
    it.drag?.write(xy(-5, -1));
    expect(v.get()).toBe(0);
  });
});
