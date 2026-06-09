import { circle, createProgram, group2D, polygon, xy } from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M9 / design.md §11.4: morphing across differing contour counts. The left
 * object (1 ring) morphs into a 2-ring group — the extra contour grows from the
 * centroid (zero-length padding). The right object uses the `cross-fade`
 * (dissolve) fallback for a topology change that arc-length can't track well.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-2.6, 2.6] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const stroke = { stroke: "#34d399", lineWidth: 0.04 };
  const stroke2 = { stroke: "#fbbf24", lineWidth: 0.04 };

  // Left: 1 contour -> 2 contours (padding grows the new ring in).
  const splitter = scene.register(circle({ radius: 1.2, center: xy(-3, 0), style: stroke }));
  const twoRings = group2D(
    [
      circle({ radius: 0.7, center: xy(-3.9, 0), style: stroke }),
      circle({ radius: 0.7, center: xy(-2.1, 0), style: stroke }),
    ],
    { style: stroke },
  );

  // Right: topology mismatch -> cross-fade dissolve.
  const blob = scene.register(
    polygon({ points: [xy(2, -1), xy(4, -1), xy(4, 1), xy(2, 1)], style: stroke2 }),
  );
  const starish = polygon({
    points: [
      xy(3, 1.3),
      xy(3.4, 0.2),
      xy(4.4, 0.2),
      xy(3.6, -0.5),
      xy(3.9, -1.4),
      xy(3, -0.8),
      xy(2.1, -1.4),
      xy(2.4, -0.5),
      xy(1.6, 0.2),
      xy(2.6, 0.2),
    ],
    style: stroke2,
  });

  await scene.play(
    splitter.morphTo(twoRings, { strategy: "arc-length", duration: 1.8 }),
    blob.morphTo(starish, { strategy: "cross-fade", duration: 1.8 }),
  );
});

export function ContourMismatchDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
