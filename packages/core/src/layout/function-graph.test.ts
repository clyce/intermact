import { describe, expect, it } from "vitest";
import { createAxesHandle } from "./axes";
import { functionGraph } from "./function-graph";
import { findTrait } from "../object/traits";

describe("functionGraph (M8)", () => {
  it("splits polylines at non-finite samples", () => {
    const handle = createAxesHandle({ x: [-2, 2], y: [-2, 2] }, { x: [-2, 2], y: [-2, 2] });
    const graph = functionGraph(handle, (x) => 1 / x, { domain: [-2, 2], samples: 8 });
    const stroke = findTrait(graph.traits, "stroke");
    expect(stroke!.samplePath().contours.length).toBe(2);
  });
});
