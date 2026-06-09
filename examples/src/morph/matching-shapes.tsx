import { circle, createProgram, group2D, polygon, rectangle, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M9 / design.md §11.4: `transformMatching` on composite objects. Parts share
 * keys: `a` (left) transforms in place, `keep` (center) stays, the source-only
 * `b` collapses (remover) and the target-only `c` grows (introducer). This is
 * the model the M10 LaTeX pipeline reuses with token keys.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-2.6, 2.6] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  // A composite (group2D) renders as ONE object with a single top-level style —
  // the per-child styles only feed aggregation, so the group MUST carry a style
  // of its own or it draws nothing.
  const groupStyle = { stroke: "#e2e8f0", lineWidth: 0.04 };

  const source = scene.register(
    group2D(
      [
        { key: "a", object: circle({ radius: 0.9, center: xy(-3.5, 0) }) },
        { key: "keep", object: rectangle({ width: 1.4, height: 1.4, center: xy(0, 0) }) },
        { key: "b", object: circle({ radius: 0.9, center: xy(3.5, 0) }) },
      ],
      { style: groupStyle },
    ),
  );

  const target = group2D(
    [
      { key: "a", object: rectangle({ width: 1.8, height: 1.8, center: xy(-3.5, 0) }) },
      { key: "keep", object: rectangle({ width: 1.4, height: 1.4, center: xy(0, 0) }) },
      {
        key: "c",
        object: polygon({ points: [xy(2.6, -0.9), xy(4.4, -0.9), xy(3.5, 0.9)] }),
      },
    ],
    { style: groupStyle },
  );

  await scene.play(source.transformMatchingTo(target, { duration: 2, easing: "sineInOut" }));
});

export function MatchingShapesDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
