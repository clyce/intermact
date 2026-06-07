import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("seeded RNG (§6.7)", () => {
  it("is reproducible: same seed ⇒ same sequence", () => {
    const a = createRng("plant");
    const b = createRng("plant");
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0,1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int is within the inclusive range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("forks are reproducible but distinct from the parent", () => {
    const parent = createRng("root");
    const f1 = parent.fork("a");
    const parent2 = createRng("root");
    const f2 = parent2.fork("a");
    expect(f1.next()).toEqual(f2.next());

    const other = createRng("root").fork("b");
    expect(createRng("root").fork("a").next()).not.toEqual(other.next());
  });
});
