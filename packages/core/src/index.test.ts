import { describe, expect, it } from "vitest";
import { VERSION } from "./index";

describe("@intermact/core", () => {
  it("exposes the v0.4 version string", () => {
    expect(VERSION).toBe("1.0.0");
  });
});
