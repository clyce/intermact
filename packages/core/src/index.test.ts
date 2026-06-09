import { describe, expect, it } from "vitest";
import { VERSION } from "./index";

describe("@intermact/core", () => {
  it("exposes the v0.2 version string", () => {
    expect(VERSION).toBe("0.2.0");
  });
});
