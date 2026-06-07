import { describe, expect, it } from "vitest";
import { xy } from "../math/vec";
import { applyPatch2D, createInitialState2D, normalizeScale } from "./state";

describe("runtime state + immutable patch (§4.3)", () => {
  it("derives defaults from an authoring transform", () => {
    const s = createInitialState2D({ position: xy(1, 2) });
    expect(s.transform.position).toEqual([1, 2]);
    expect(s.transform.rotation).toBe(0);
    expect(s.transform.scale).toEqual([1, 1]);
    expect(s.opacity).toBe(1);
    expect(s.visible).toBe(true);
  });

  it("normalizes scalar scale into a Vec2", () => {
    expect(normalizeScale(2)).toEqual([2, 2]);
    expect(normalizeScale([3, 4])).toEqual([3, 4]);
    expect(normalizeScale(undefined)).toEqual([1, 1]);
  });

  it("applies a partial transform patch without dropping siblings", () => {
    const s = createInitialState2D({ position: xy(0, 0), rotation: 1 });
    const next = applyPatch2D(s, { transform: { position: xy(5, 5) } });
    expect(next.transform.position).toEqual([5, 5]);
    expect(next.transform.rotation).toBe(1);
  });

  it("does not mutate the input state (immutability)", () => {
    const s = createInitialState2D();
    const next = applyPatch2D(s, { opacity: 0.5 });
    expect(s.opacity).toBe(1);
    expect(next.opacity).toBe(0.5);
  });

  it("merges style overrides", () => {
    const s = createInitialState2D();
    const a = applyPatch2D(s, { styleOverrides: { stroke: "#fff" } });
    const b = applyPatch2D(a, { styleOverrides: { fill: "#000" } });
    expect(b.styleOverrides).toEqual({ stroke: "#fff", fill: "#000" });
  });
});
