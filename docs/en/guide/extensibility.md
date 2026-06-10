# Extensibility: Plugins and Registries

Intermact extends objects, animations, generators, and render backends through **registries** — new capabilities without changing `@intermact/core` (`design.md §18`). A plugin is "name + `install(registries)`", installed once before build, visible everywhere.

## Registries

Four extension points, each a generic `Registry<string, V>`:

```ts
import { createRegistries, globalRegistries } from "@intermact/core";

// Isolated registry set (common in tests)
const registries = createRegistries();

// Process-wide default: build phase (StoryboardBuilder) consumes by default
globalRegistries.objects; // type    -> ObjectTypeDescriptor
globalRegistries.animations; // kind -> AnimationCompiler
globalRegistries.generators; // name -> GeneratorDescriptor
globalRegistries.renderers; // name  -> RendererFactory
```

`Registry` API: `register(key, value, { override? })`, `get`/`require`/`has`, `unregister`/`clear`, `keys`/`values`. Duplicate keys throw `plugin-error` by default; `{ override: true }` required to replace (prevents accidental overwrite of builtins).

## Define and install plugins

```ts
import { definePlugin, installPlugin } from "@intermact/core";

const myPlugin = definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  install(registries) {
    // has() guard makes install idempotent (HMR-friendly)
    if (!registries.objects.has("gear")) {
      registries.objects.register("gear", {
        type: "gear",
        create: (params) => buildGear(params),
      });
    }
  },
});

installPlugin(myPlugin); // default: globalRegistries
// or installPlugin(myPlugin, registries) for isolated set
```

## New object types

Intermact objects are **trait composition** (`design.md §4.2`). Plugin objects returning immutable definitions with stroke/fill/instanced traits **work out of the box** through existing sampling / fill / picking / SVG / render pipelines — no renderer changes.

```ts
import { createRegisteredObject, rawContourFromPoints, shapeObject, xy } from "@intermact/core";

function buildGear(params: { teeth?: number; fill?: string }) {
  const rim = []; /* compute tooth profile points */
  const hole = []; /* center hole points */
  return shapeObject(
    "gear",
    [rawContourFromPoints(rim, true), rawContourFromPoints(hole, true)],
    { fill: params.fill ?? "#38bdf8", fillRule: "evenodd" }, // even-odd ⇒ center hole
  );
}

const gear = createRegisteredObject("gear", { teeth: 14 });
scene.register(gear, { position: xy(0, 0) });
```

## New animation kinds

Register an `AnimationCompiler` compiling `custom` spec into pure seekable `Track`. `scene.play(customAnimation(...))` dispatches via `globalRegistries.animations` automatically — no wiring at scene/program call sites.

```ts
import { customAnimation, type AnimationCompiler } from "@intermact/core";

const spinCompiler: AnimationCompiler = {
  describe: "multi-turn spin",
  compile(spec, ctx) {
    const targetId = spec.targetId ?? "";
    const turns = (spec.params as { turns?: number }).turns ?? 1;
    const from =
      (ctx.projection.read(targetId, { type: "transform", key: "rotation" }) as number) ?? 0;
    const to = from + turns * Math.PI * 2;
    const track = {
      id: ctx.ids.next("track"),
      targetId,
      start: ctx.startTime,
      duration: spec.duration,
      easing: "linear" as const,
      evaluate: (p: number) => ({
        targetId,
        changes: { transform: { rotation: from + (to - from) * Math.min(1, Math.max(0, p)) } },
      }),
    };
    ctx.projection.write(targetId, { type: "transform", key: "rotation" }, to);
    return { tracks: [track], signalTracks: [], effects: [], duration: spec.duration };
  },
};

// After install:
await scene.play(customAnimation("spin", { targetId: gear.id, params: { turns: 2 }, duration: 4 }));
```

`custom` spec `params` must be JSON-serializable — animations round-trip via `serialize`/`deserialize` (deserialize side needs same-name compiler, else `unsupported-animation`).

## New PCG generators

```ts
import { runGenerator, createRng } from "@intermact/core";

registries.generators.register("phyllotaxis", {
  name: "phyllotaxis",
  generate: (params, rng) => buildSunflower(params, rng), // random via injected rng (design.md §6.7)
});

const head = runGenerator("phyllotaxis", { count: 700 }, createRng("sunflower"));
```

## New render backends (RendererFactory)

Backends are registry entries too. `RendererFactory` has optional `isSupported()` feature probe; `selectRenderer` picks first available in preference order:

```ts
import { selectRenderer } from "@intermact/core";

registries.renderers.register("webgpu", {
  name: "webgpu",
  isSupported: () => typeof navigator !== "undefined" && "gpu" in navigator,
  create: (options) => makeWebGpuBackend(options),
});

const backend = selectRenderer(["webgpu", "webgl"]); // "webgpu" or fallback "webgl"
```

> Examples in gallery `plugin/custom-object`, `plugin/custom-generator`, `plugin/webgpu-backend`.
