import { circle, createProgram, easings, type EasingName, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

const EASING_NAMES = Object.keys(easings) as EasingName[];

/** M4: easing curve comparison along parallel tweens. */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-1, EASING_NAMES.length + 1], y: [-1, 3] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dots = EASING_NAMES.map((easing, i) => {
    const d = scene.register(
      circle({
        radius: 0.18,
        style: { fill: `hsl(${(i * 360) / EASING_NAMES.length}, 70%, 65%)` },
      }),
      { position: xy(i + 0.5, 0) },
    );
    return { d, easing, i };
  });

  await scene.play(
    ...dots.map(({ d, easing, i }) => d.moveTo(xy(i + 0.5, 2), { duration: 2, easing })),
  );
});

export function EasingGalleryDemo() {
  return (
    <div style={{ height: 360 }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
