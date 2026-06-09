import { describe, expect, it, afterEach } from "vitest";
import { labelContours } from "./text-layout";
import { clearFontRegistry } from "./font-registry";
import { loadTestFont } from "./test-font";

describe("labelContours without default font (M8 fallback)", () => {
  afterEach(async () => {
    await loadTestFont();
  });

  it("returns empty contours when no font is registered", () => {
    clearFontRegistry();
    const { contours, width } = labelContours("42");
    expect(contours).toHaveLength(0);
    expect(width).toBe(0);
  });
});
