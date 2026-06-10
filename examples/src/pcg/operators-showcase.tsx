import {
  along,
  arrow,
  booleanOp,
  circle,
  createProgram,
  mapPoints,
  parametricCurve2D,
  rectangle,
  repeatObject,
  transformObject,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/operators-showcase` (dev-roadmap.md M13, design.md §6.6).
 *
 * The composition operators are pure `IMObject2D → IMObject2D` functions, so
 * they chain and bake into geometry. Four quadrants exercise the family:
 * `repeatObject` (compounding step), `booleanOp` (polygon difference),
 * `mapPoints` (per-point warp), and `along` (distribute + orient on a path).
 * `transformObject` then places each result without touching the generators.
 */

// Top-left: one tile stamped 9× along a compounding translate+rotate+scale step.
const fan = transformObject(
  repeatObject(
    rectangle({
      width: 0.9,
      height: 0.16,
      style: { stroke: "#f472b6", fill: "rgba(244,114,182,0.25)", lineWidth: 0.01 },
    }),
    9,
    { position: xy(0.1, 0.12), rotation: Math.PI / 14, scale: 0.97 },
  ),
  { position: xy(-2.6, 1.25) },
);

// Top-right: subtract one disk from another to leave a crescent (single-ring boolean).
const crescent = transformObject(
  booleanOp(
    circle({ radius: 0.95, samples: 96 }),
    circle({ radius: 0.95, samples: 96, center: xy(0.55, 0.28) }),
    "subtract",
    { fill: "rgba(56,189,248,0.45)", stroke: "#38bdf8", lineWidth: 0.02 },
  ),
  { position: xy(2.4, 1.25) },
);

// Bottom-left: a swirl map twists a ring's points by radius-dependent angle.
const swirl = transformObject(
  mapPoints(
    circle({ radius: 1, samples: 160, style: { stroke: "#a78bfa", lineWidth: 0.02 } }),
    ([x, y]) => {
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x) + r * 1.6;
      return xy(r * Math.cos(a), r * Math.sin(a));
    },
  ),
  { position: xy(-2.6, -1.25) },
);

// Bottom-right: stamp tangent-oriented arrows evenly along a parametric S-curve.
const sCurve = parametricCurve2D({
  domain: [-1, 1],
  fn: (t) => [t * 1.9, Math.sin(t * Math.PI) * 0.8],
  samples: 200,
  style: { stroke: "#334155", lineWidth: 0.012 },
});
const sCurvePlaced = transformObject(sCurve, { position: xy(2.4, -1.25) });
const arrowsAlong = transformObject(
  along(
    arrow({
      from: xy(-0.12, 0),
      to: xy(0.12, 0),
      headLength: 0.12,
      headWidth: 0.12,
      style: { stroke: "#f59e0b", fill: "#f59e0b", lineWidth: 0.02 },
    }),
    sCurve,
    { count: 9, orient: true },
  ),
  { position: xy(2.4, -1.25) },
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4.8, 4.8], y: [-2.8, 2.8] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const fanHandle = scene.register(fan);
  const crescentHandle = scene.register(crescent);
  const swirlHandle = scene.register(swirl);
  scene.register(sCurvePlaced);
  const arrowsHandle = scene.register(arrowsAlong);
  await scene.play(
    fanHandle.create({ duration: 1.4 }),
    crescentHandle.create({ duration: 1.4 }),
    swirlHandle.create({ duration: 1.4 }),
    arrowsHandle.create({ duration: 1.4 }),
  );
});

export function OperatorsShowcaseDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
