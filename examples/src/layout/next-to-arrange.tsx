import { createProgram, rectangle, textObject, uv, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * M12 / design.md §9.4: relative layout. The title is pinned with `alignTo`, the
 * subtitle is placed with `nextTo`, and the cards are packed with `arrange`
 * (each layout call returns an Animation, so the placement is animated).
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-6, 6], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const title = scene.register(
    textObject({
      text: "LAYOUT",
      size: 0.8,
      align: "center",
      style: { stroke: "#e2e8f0", lineWidth: 0.05 },
    }),
  );
  const subtitle = scene.register(
    textObject({
      text: "NEXTTO + ARRANGE",
      size: 0.32,
      align: "center",
      style: { stroke: "#38bdf8", lineWidth: 0.03 },
    }),
  );
  const cards = [0, 1, 2, 3].map(() =>
    scene.register(
      rectangle({
        width: 1.6,
        height: 1,
        cornerRadius: 0.12,
        style: { stroke: "#a78bfa", lineWidth: 0.04, fill: "#312e81" },
      }),
    ),
  );
  const container = scene.register(rectangle({ width: 0.01, height: 0.01 }));

  scene.commit(
    title.layout.alignTo(scene.coordinate.relToAbs(uv(0.5, 0.86)), { anchor: uv(0.5, 0.5) }),
  );
  await scene.play(title.create({ duration: 0.6 }));
  await scene.play(
    subtitle.layout.nextTo(title, [0, -1], { gap: 0.3, duration: 0.4 }),
    subtitle.create({ duration: 0.4 }),
  );
  await scene.play(...cards.map((c) => c.create({ duration: 0.4 })));
  await scene.play(
    container.layout.arrange(cards, {
      direction: "row",
      gap: 0.4,
      origin: xy(-3.8, -0.4),
      duration: 0.7,
    }),
  );
});

export function NextToArrangeDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} controls={{ timeline: true }} />
    </div>
  );
}
