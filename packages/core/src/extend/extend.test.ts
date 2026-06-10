import { describe, expect, it } from "vitest";
import { buildProgram } from "../program/build";
import { createProgram } from "../program/context";
import { customAnimation } from "../animation/orchestration";
import { serialize, deserialize } from "../serialize/serialize";
import { sampleFrameHashes } from "../serialize/frame-hash";
import {
  type AnimationCompiler,
  compileSpec,
  createIdGen,
  type Projection,
  type Track,
} from "../animation/track";
import { rawContourFromPoints } from "../geometry/sampling";
import { shapeObject } from "../constructs/shared";
import { xy } from "../math/vec";
import { createRng } from "../random/rng";
import { type Player } from "../animation/player";
import {
  createRegisteredObject,
  createRegistries,
  definePlugin,
  globalRegistries,
  installPlugin,
  Registry,
  runGenerator,
  selectRenderer,
} from "./index";

function triangleContour() {
  return rawContourFromPoints([xy(-0.5, -0.5), xy(0.5, -0.5), xy(0, 0.6)], true);
}

function opacityOf(player: Player, id: string): number {
  const state = player.getSnapshot().objects.get(id)?.state;
  if (!state) throw new Error(`no state for ${id}`);
  return state.opacity;
}

/** A custom animation compiler that tweens opacity to `params.to` (design.md §18). */
const pulseCompiler: AnimationCompiler = {
  describe: "opacity pulse",
  compile(spec, ctx) {
    const targetId = spec.targetId ?? "";
    const to = (spec.params as { to: number }).to;
    const from = (ctx.projection.read(targetId, { type: "opacity" }) as number | undefined) ?? 1;
    const track: Track = {
      id: ctx.ids.next("track"),
      targetId,
      start: ctx.startTime,
      duration: spec.duration,
      easing: "linear",
      evaluate(localProgress: number) {
        const p = Math.min(1, Math.max(0, localProgress));
        return { targetId, changes: { opacity: from + (to - from) * p } };
      },
    };
    ctx.projection.write(targetId, { type: "opacity" }, to);
    return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
  },
};

describe("Registry (design.md §18)", () => {
  it("registers, looks up, and reports membership", () => {
    const r = new Registry<string, number>();
    r.register("a", 1);
    expect(r.get("a")).toBe(1);
    expect(r.has("a")).toBe(true);
    expect(r.has("b")).toBe(false);
    expect(r.size).toBe(1);
    expect(r.keys()).toEqual(["a"]);
    expect(r.values()).toEqual([1]);
  });

  it("throws on duplicate registration unless override is set", () => {
    const r = new Registry<string, number>();
    r.register("a", 1);
    expect(() => r.register("a", 2)).toThrow(/already has an entry/);
    r.register("a", 2, { override: true });
    expect(r.get("a")).toBe(2);
  });

  it("require throws a plugin-error when absent", () => {
    const r = new Registry<string, number>();
    expect(() => r.require("missing")).toThrow(/No registry entry/);
  });

  it("unregisters and clears", () => {
    const r = new Registry<string, number>();
    r.register("a", 1).register("b", 2);
    expect(r.unregister("a")).toBe(true);
    expect(r.unregister("a")).toBe(false);
    expect(r.size).toBe(1);
    r.clear();
    expect(r.size).toBe(0);
  });
});

describe("plugin install adds an object type + a generator with no core edits", () => {
  it("registers an ObjectTypeDescriptor and a GeneratorDescriptor into a fresh bundle", () => {
    const r = createRegistries();
    const plugin = definePlugin({
      name: "demo-shapes",
      version: "1.0.0",
      install(registries) {
        registries.objects.register("demo-triangle", {
          type: "demo-triangle",
          create: (params) => {
            const fill = (params as { fill?: string }).fill ?? "#22d3ee";
            return shapeObject("demo-triangle", [triangleContour()], { fill });
          },
        });
        registries.generators.register("demo-rings", {
          name: "demo-rings",
          generate: (params, rng) => {
            const count = (params as { count?: number }).count ?? 3;
            // Reproducible jitter from the injected rng (design.md §6.7).
            const wobble = rng.next() * 0.01;
            const contour = rawContourFromPoints(
              [xy(-0.5 + wobble, -0.5), xy(0.5, -0.5), xy(0.5, 0.5), xy(-0.5, 0.5)],
              true,
            );
            return shapeObject(`demo-rings-${count}`, [contour], { fill: "#f59e0b" });
          },
        });
      },
    });

    installPlugin(plugin, r);

    expect(r.objects.has("demo-triangle")).toBe(true);
    expect(r.generators.has("demo-rings")).toBe(true);

    const obj = createRegisteredObject("demo-triangle", { fill: "#abcabc" }, r);
    expect(obj.type).toBe("demo-triangle");
    expect(obj.dimension).toBe("2d");
    expect(obj.style?.fill).toBe("#abcabc");

    const gen = runGenerator("demo-rings", { count: 4 }, createRng("seed"), r);
    expect(gen.type).toBe("demo-rings-4");
    expect(gen.dimension).toBe("2d");
  });

  it("installs into the global registries by default", () => {
    const plugin = definePlugin({
      name: "demo-global",
      install(registries) {
        registries.objects.register("demo-global-obj", {
          type: "demo-global-obj",
          create: () => shapeObject("demo-global-obj", [triangleContour()], { fill: "#fff" }),
        });
      },
    });
    try {
      installPlugin(plugin);
      expect(globalRegistries.objects.has("demo-global-obj")).toBe(true);
    } finally {
      globalRegistries.objects.unregister("demo-global-obj");
    }
  });
});

describe("custom animation dispatch (design.md §18)", () => {
  it("compiles a registered custom spec through compileSpec", () => {
    const ids = createIdGen();
    const projection: Projection = { read: () => 1, write: () => {} };
    const result = compileSpec(
      { kind: "custom", type: "pulse", targetId: "x", params: { to: 0.2 }, duration: 2 },
      0,
      projection,
      ids,
      {
        getObject: () => undefined,
        resolveAnimation: (type) => (type === "pulse" ? pulseCompiler : undefined),
      },
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.duration).toBe(2);
    // from=1, to=0.2 -> at p=0.5 opacity = 1 + (0.2-1)*0.5 = 0.6
    expect(result.tracks[0]!.evaluate(0.5).changes).toEqual({ opacity: 0.6 });
  });

  it("throws unsupported-animation when no compiler is registered", () => {
    const ids = createIdGen();
    const projection: Projection = { read: () => 1, write: () => {} };
    expect(() =>
      compileSpec({ kind: "custom", type: "missing", duration: 1 }, 0, projection, ids, {
        getObject: () => undefined,
      }),
    ).toThrow(/No animation compiler registered/);
  });

  it("is wired through the build pass via the global animations registry", async () => {
    try {
      globalRegistries.animations.register("e2e-pulse", pulseCompiler);
      let dotId = "";
      const program = createProgram(async (ctx) => {
        const scene = ctx.createScene2D({
          coordinate: "cartesian",
          domain: { x: [-4, 4], y: [-3, 3] },
        });
        ctx.mount(scene, ctx.createCamera2D(scene));
        const dot = scene.registerEmpty({ position: xy(0, 0) });
        dotId = dot.id;
        await scene.play(
          customAnimation("e2e-pulse", { targetId: dot.id, params: { to: 0 }, duration: 1 }),
        );
      });
      const { player } = await buildProgram(program);
      player.seek(0);
      expect(opacityOf(player, dotId)).toBeCloseTo(1, 5);
      player.seek(0.5);
      expect(opacityOf(player, dotId)).toBeCloseTo(0.5, 5);
      player.seek(1);
      expect(opacityOf(player, dotId)).toBeCloseTo(0, 5);
    } finally {
      globalRegistries.animations.unregister("e2e-pulse");
    }
  });
});

describe("registries injection (M17 / §22.8)", () => {
  it("resolves custom animations from an injected bundle (never the global)", async () => {
    const registries = createRegistries();
    registries.animations.register("inj-pulse", pulseCompiler);
    let dotId = "";
    let seenRegistries: unknown;
    const program = createProgram(async (ctx) => {
      seenRegistries = ctx.registries;
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dot = scene.registerEmpty({ position: xy(0, 0) });
      dotId = dot.id;
      await scene.play(
        customAnimation("inj-pulse", { targetId: dot.id, params: { to: 0 }, duration: 1 }),
      );
    });
    const { player } = await buildProgram(program, { registries });
    expect(seenRegistries).toBe(registries);
    player.seek(1);
    expect(opacityOf(player, dotId)).toBeCloseTo(0, 5);
    // The injected compiler must not have touched process-global state.
    expect(globalRegistries.animations.has("inj-pulse")).toBe(false);
  });

  it("round-trips a custom animation through serialize/deserialize with the same bundle", async () => {
    const registries = createRegistries();
    registries.animations.register("rt-pulse", pulseCompiler);
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const dot = scene.registerEmpty({ position: xy(0, 0) });
      await scene.play(
        customAnimation("rt-pulse", { targetId: dot.id, params: { to: 0.25 }, duration: 1 }),
      );
    });
    const { player } = await buildProgram(program, { registries });
    const project = serialize(player);
    const restored = deserialize(project, { registries }).player;
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(player, { fps: 30 }),
    );
    // Deserializing without the bundle fails fast (unknown compiler).
    expect(() => deserialize(project)).toThrow(/No animation compiler registered/);
  });

  it("rejects non-JSON-serializable custom params at authoring time", () => {
    expect(() => customAnimation("x", { params: { cb: () => 1 } })).toThrow(/JSON-serializable/);
    expect(() => customAnimation("x", { params: { n: Infinity } })).toThrow(/non-finite/);
    expect(() => customAnimation("x", { params: { d: new Date() } })).toThrow(/plain JSON/);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => customAnimation("x", { params: circular })).toThrow(/circular/);
    // Plain nested data is accepted.
    expect(() => customAnimation("x", { params: { a: [1, 2, { b: "ok" }] } })).not.toThrow();
  });
});

describe("renderer backend selection (design.md §18)", () => {
  it("selects the first supported backend in preference order", () => {
    const r = createRegistries();
    r.renderers.register("webgpu", {
      name: "webgpu",
      isSupported: () => false,
      create: () => ({ kind: "webgpu" }),
    });
    r.renderers.register("webgl", {
      name: "webgl",
      create: () => ({ kind: "webgl" }),
    });
    expect(selectRenderer(["webgpu", "webgl"], r)).toBe("webgl");
    expect(selectRenderer(["nope"], r)).toBeUndefined();
  });
});
