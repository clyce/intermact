import { describe, expect, it } from "vitest";
import { computeFit } from "./fit";

const domain = { x: [-4, 4] as const, y: [-2, 2] as const };

describe("camera fit (§9/§10)", () => {
  it("contain letterboxes a wide canvas (keeps full domain)", () => {
    const { frustum } = computeFit(domain, "contain", 800, 200); // canvas aspect 4 > domain aspect 2
    expect(frustum.bottom).toBeCloseTo(-2);
    expect(frustum.top).toBeCloseTo(2);
    // width expands to satisfy the canvas aspect.
    expect(frustum.right - frustum.left).toBeCloseTo(8 * (4 / 2));
  });

  it("stretch matches the domain exactly", () => {
    const { frustum } = computeFit(domain, "stretch", 800, 200);
    expect(frustum.left).toBeCloseTo(-4);
    expect(frustum.right).toBeCloseTo(4);
    expect(frustum.top).toBeCloseTo(2);
    expect(frustum.bottom).toBeCloseTo(-2);
  });

  it("reports world units per pixel", () => {
    const { worldPerPixel } = computeFit(domain, "stretch", 800, 400);
    expect(worldPerPixel).toBeCloseTo(8 / 800);
  });
});
