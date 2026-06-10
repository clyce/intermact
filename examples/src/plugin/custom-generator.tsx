import {
  circle,
  createProgram,
  createRng,
  definePlugin,
  type IMObject2D,
  installPlugin,
  instanceField,
  type ObjectTransform2D,
  runGenerator,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/plugin/custom-generator` (dev-roadmap.md M17, design.md §18).
 *
 * A plugin registers a PCG **generator** (`"phyllotaxis"`) — a sunflower seed
 * head laid out on the golden angle. It composes existing primitives
 * (`circle` + `instanceField`) and takes all randomness from the injected
 * {@link createRng} (design.md §6.7), so the same seed/params reproduce the same
 * head. `runGenerator` dispatches by name through the registries; no core code
 * knows what "phyllotaxis" is.
 */

interface PhyllotaxisParams {
  readonly count?: number;
  readonly spread?: number;
  readonly dotRadius?: number;
  readonly jitter?: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const phyllotaxisPlugin = definePlugin({
  name: "intermact-phyllotaxis",
  version: "1.0.0",
  install(registries) {
    if (registries.generators.has("phyllotaxis")) return;
    registries.generators.register("phyllotaxis", {
      name: "phyllotaxis",
      description: "Golden-angle sunflower seed head (instanced)",
      generate: (params, rng) => {
        const {
          count = 500,
          spread = 0.16,
          dotRadius = 0.12,
          jitter = 0,
        } = params as PhyllotaxisParams;
        const transforms: ObjectTransform2D[] = [];
        for (let i = 0; i < count; i++) {
          const angle = i * GOLDEN_ANGLE;
          const radius = spread * Math.sqrt(i);
          const jx = jitter ? (rng.next() - 0.5) * jitter : 0;
          const jy = jitter ? (rng.next() - 0.5) * jitter : 0;
          transforms.push({
            position: xy(Math.cos(angle) * radius + jx, Math.sin(angle) * radius + jy),
            // Seeds grow from small (center) to large (rim).
            scale: 0.35 + 0.9 * (i / count),
          });
        }
        const seed = circle({ radius: dotRadius, samples: 12, style: { fill: "#fbbf24" } });
        return instanceField(seed, transforms);
      },
    });
  },
});

installPlugin(phyllotaxisPlugin);

const head = runGenerator(
  "phyllotaxis",
  { count: 700, spread: 0.16, jitter: 0.02 } satisfies PhyllotaxisParams,
  createRng("sunflower"),
) as IMObject2D;

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-5, 5], y: [-5, 5] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const handle = scene.register(head);
  await scene.play(handle.fadeIn({ duration: 1.6 }));
});

export function CustomGeneratorPluginDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
