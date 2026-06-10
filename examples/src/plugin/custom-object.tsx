import {
  type AnimationCompiler,
  type AnimationSpec,
  createProgram,
  createRegisteredObject,
  customAnimation,
  definePlugin,
  type IMObject2D,
  installPlugin,
  rawContourFromPoints,
  shapeObject,
  type Track,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/plugin/custom-object` (dev-roadmap.md M17, design.md §18).
 *
 * A plugin registers a brand-new **object type** (`"gear"`) and a brand-new
 * **animation kind** (`"spin"`) into the registries. Neither touches core: the
 * gear is built from ordinary stroke/fill contours (so it samples, fills,
 * hit-tests and renders through the existing trait pipeline) and the spin
 * compiler emits a normal seekable {@link Track}. `installPlugin` wires both
 * through the global registries that the build pass already consults.
 */

interface GearParams {
  readonly teeth?: number;
  readonly outerRadius?: number;
  readonly rootRadius?: number;
  readonly hubRadius?: number;
  readonly fill?: string;
  readonly stroke?: string;
}

/** A toothed gear ring with a center hole (even-odd fill makes the hole). */
function gear(params: GearParams): IMObject2D {
  const teeth = params.teeth ?? 12;
  const outer = params.outerRadius ?? 1;
  const root = params.rootRadius ?? outer * 0.78;
  const hub = params.hubRadius ?? outer * 0.32;
  const steps = teeth * 4;
  const rim: ReturnType<typeof xy>[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    // Two samples at the tooth tip, two in the valley → a square tooth profile.
    const onTooth = i % 4 === 0 || i % 4 === 1;
    const r = onTooth ? outer : root;
    rim.push(xy(Math.cos(angle) * r, Math.sin(angle) * r));
  }
  const hole: ReturnType<typeof xy>[] = [];
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    hole.push(xy(Math.cos(angle) * hub, Math.sin(angle) * hub));
  }
  return shapeObject("gear", [rawContourFromPoints(rim, true), rawContourFromPoints(hole, true)], {
    fill: params.fill ?? "#38bdf8",
    stroke: params.stroke ?? "#bae6fd",
    lineWidth: 0.03,
    fillRule: "evenodd",
  });
}

/** Custom animation: rotate `params.turns` full turns with a smoothstep ease. */
const spinCompiler: AnimationCompiler = {
  describe: "multi-turn spin",
  compile(spec: Extract<AnimationSpec, { kind: "custom" }>, ctx) {
    const targetId = spec.targetId ?? "";
    const turns = (spec.params as { turns?: number }).turns ?? 1;
    const from =
      (ctx.projection.read(targetId, { type: "transform", key: "rotation" }) as
        | number
        | undefined) ?? 0;
    const to = from + turns * Math.PI * 2;
    const track: Track = {
      id: ctx.ids.next("track"),
      targetId,
      start: ctx.startTime,
      duration: spec.duration,
      easing: "linear",
      evaluate(localProgress: number) {
        const p = Math.min(1, Math.max(0, localProgress));
        const eased = p * p * (3 - 2 * p);
        return { targetId, changes: { transform: { rotation: from + (to - from) * eased } } };
      },
    };
    ctx.projection.write(targetId, { type: "transform", key: "rotation" }, to);
    return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
  },
};

/** A plugin bundling the new object type + animation kind (idempotent install). */
const mechanismPlugin = definePlugin({
  name: "intermact-mechanism",
  version: "1.0.0",
  install(registries) {
    if (!registries.objects.has("gear")) {
      registries.objects.register("gear", {
        type: "gear",
        description: "Toothed gear ring with a center hub hole",
        create: (params) => gear(params as GearParams),
      });
    }
    if (!registries.animations.has("spin")) {
      registries.animations.register("spin", spinCompiler);
    }
  },
});

installPlugin(mechanismPlugin);

const bigGear = createRegisteredObject("gear", {
  teeth: 14,
  outerRadius: 1.5,
  fill: "#38bdf8",
}) as IMObject2D;
const smallGear = createRegisteredObject("gear", {
  teeth: 9,
  outerRadius: 0.96,
  fill: "#f472b6",
  stroke: "#fbcfe8",
}) as IMObject2D;

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-4.2, 4.2], y: [-2.6, 2.6] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const left = scene.register(bigGear, { position: xy(-1.35, 0) });
  const right = scene.register(smallGear, { position: xy(1.18, 0) });

  await scene.play(left.create({ duration: 1 }), right.create({ duration: 1 }));
  // Two meshing gears spin opposite directions — both via the plugin "spin" kind.
  await scene.play(
    customAnimation("spin", { targetId: left.id, params: { turns: 1 }, duration: 4 }),
    customAnimation("spin", { targetId: right.id, params: { turns: -14 / 9 }, duration: 4 }),
  );
});

export function CustomObjectPluginDemo() {
  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
    </div>
  );
}
