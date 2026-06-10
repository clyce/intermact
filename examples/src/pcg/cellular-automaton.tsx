import {
  cellularAutomaton,
  cellularAutomatonFrames,
  createProgram,
  createRng,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/pcg/cellular-automaton` (dev-roadmap.md M13, design.md §6.4).
 *
 * Two deterministic CAs side by side. Left: Wolfram **Rule 30** as a static
 * space-time diagram (each row one generation from a single live cell). Right:
 * a 2D **Game of Life** soup driven by `cellularAutomatonFrames` — one object
 * per generation, cross-faded along the timeline so the colony visibly evolves.
 * Same seed ⇒ same colony every run.
 */
const rule30 = cellularAutomaton({
  kind: "1d",
  rule: 30,
  width: 61,
  generations: 30,
  cellSize: 0.045,
  origin: xy(-4.6, 1.0),
  style: { fill: "#34d399", stroke: "#34d399", lineWidth: 0.001 },
});

const LIFE_STEPS = 16;
const lifeFrames = cellularAutomatonFrames({
  kind: "2d",
  width: 22,
  height: 22,
  steps: LIFE_STEPS,
  init: { density: 0.4 },
  rng: createRng("intermact-life"),
  cellSize: 0.09,
  origin: xy(1.2, -1.1),
  style: { fill: "#38bdf8", stroke: "#38bdf8", lineWidth: 0.002 },
});

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-3, 3] },
    fit: "contain",
    background: "#06140c",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  scene.register(rule30);

  // All Life generations share one cell; only the active one is visible.
  const handles = lifeFrames.map((frame) => scene.register(frame));
  for (let i = 1; i < handles.length; i++) {
    await scene.play(
      handles[i - 1]!.fadeOut({ duration: 0.12 }),
      handles[i]!.fadeIn({ duration: 0.12 }),
    );
    await scene.wait(0.2);
  }
});

export function CellularAutomatonDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
