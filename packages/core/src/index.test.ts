import { describe, expect, it } from "vitest";
import { VERSION } from "./index";

describe("@intermact/core", () => {
  it("exposes the v0.1 version string", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
