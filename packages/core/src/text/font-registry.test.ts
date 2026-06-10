import { describe, expect, it } from "vitest";
import {
  FontRegistry,
  getActiveFontRegistry,
  getGlobalFontRegistry,
  setActiveFontRegistry,
  type RegisteredFont,
} from "./font-registry";

/**
 * Font-registry scoping tests (design.md §22.8). A per-build child scope must see
 * globally pre-loaded faces (parent fallback) yet keep its own registrations and
 * default from leaking back to the process-wide registry.
 */

function fakeFont(id: string): RegisteredFont {
  return { id, family: id, glyphFor: () => ({ contours: [], advance: 0 }) };
}

describe("FontRegistry scoping (M17 / §22.8)", () => {
  it("falls back to the parent for lookups but isolates writes", () => {
    const parent = new FontRegistry();
    parent.register(fakeFont("global"));
    parent.setDefault("global");

    const child = new FontRegistry(parent);
    expect(child.get("global")).toBeTruthy(); // visible via parent
    expect(child.getDefaultId()).toBe("global"); // default via parent

    child.register(fakeFont("scoped"));
    child.setDefault("scoped");
    expect(child.getDefaultId()).toBe("scoped");
    expect(parent.get("scoped")).toBeUndefined(); // not leaked upward
    expect(parent.getDefaultId()).toBe("global"); // parent default intact

    child.clear();
    expect(child.get("scoped")).toBeUndefined();
    expect(child.get("global")).toBeTruthy(); // parent survives child.clear()
  });

  it("setDefault rejects an unresolvable id", () => {
    const reg = new FontRegistry();
    expect(() => reg.setDefault("missing")).toThrow(/not registered/i);
    expect(() => reg.requireDefault()).toThrow(/No default font/i);
  });

  it("setActiveFontRegistry swaps and restores the active scope", () => {
    const scope = new FontRegistry(getGlobalFontRegistry());
    const previous = setActiveFontRegistry(scope);
    try {
      expect(getActiveFontRegistry()).toBe(scope);
    } finally {
      setActiveFontRegistry(previous);
    }
    expect(getActiveFontRegistry()).toBe(previous);
  });
});
