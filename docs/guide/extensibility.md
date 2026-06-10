# 扩展性：插件与注册表

Intermact 的对象、动画、生成器、渲染后端都通过**注册表**扩展——新增能力无需改动 `@intermact/core`（`design.md §18`）。一个插件就是「名字 + `install(registries)`」，在构建期之前装一次，处处可见。

## 注册表（Registries）

四个扩展点，每个是一个泛型 `Registry<string, V>`：

```ts
import { createRegistries, globalRegistries } from "@intermact/core";

// 一个隔离的注册表集合（测试常用）
const registries = createRegistries();

// 进程级默认集合：构建期（StoryboardBuilder）默认消费它
globalRegistries.objects; // type    -> ObjectTypeDescriptor
globalRegistries.animations; // kind -> AnimationCompiler
globalRegistries.generators; // name -> GeneratorDescriptor
globalRegistries.renderers; // name  -> RendererFactory
```

`Registry` API：`register(key, value, { override? })`、`get`/`require`/`has`、`unregister`/`clear`、`keys`/`values`。重复键默认抛 `plugin-error`，需 `{ override: true }` 显式替换（防止误覆盖内建）。

## 定义与安装插件

```ts
import { definePlugin, installPlugin } from "@intermact/core";

const myPlugin = definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  install(registries) {
    // 用 has() 守护可让 install 幂等（HMR 友好）
    if (!registries.objects.has("gear")) {
      registries.objects.register("gear", {
        type: "gear",
        create: (params) => buildGear(params),
      });
    }
  },
});

installPlugin(myPlugin); // 默认装进 globalRegistries
// 或 installPlugin(myPlugin, registries) 装进隔离集合
```

## 新增对象类型

Intermact 的对象是 **trait 组合**（`design.md §4.2`）。插件对象只要返回带 stroke/fill/instanced trait 的不可变定义，就**开箱**经既有采样 / 填充 / 拾取 / SVG / 渲染管线工作——无需任何渲染器改动。

```ts
import { createRegisteredObject, rawContourFromPoints, shapeObject, xy } from "@intermact/core";

function buildGear(params: { teeth?: number; fill?: string }) {
  const rim = []; /* 计算齿廓点 */
  const hole = []; /* 中心孔点 */
  return shapeObject(
    "gear",
    [rawContourFromPoints(rim, true), rawContourFromPoints(hole, true)],
    { fill: params.fill ?? "#38bdf8", fillRule: "evenodd" }, // even-odd ⇒ 中心孔
  );
}

const gear = createRegisteredObject("gear", { teeth: 14 });
scene.register(gear, { position: xy(0, 0) });
```

## 新增动画 kind

注册一个 `AnimationCompiler`，把 `custom` spec 编译成纯可 seek 的 `Track`。`scene.play(customAnimation(...))` 会经 `globalRegistries.animations` 自动分发，无需在 scene/program 调用点穿线。

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

// 安装后即可使用：
await scene.play(customAnimation("spin", { targetId: gear.id, params: { turns: 2 }, duration: 4 }));
```

`custom` spec 的 `params` 必须可 JSON 化——这样动画能随 `serialize`/`deserialize` 往返（反序列化端需安装同名 compiler，否则抛 `unsupported-animation`）。

## 新增 PCG 生成器

```ts
import { runGenerator, createRng } from "@intermact/core";

registries.generators.register("phyllotaxis", {
  name: "phyllotaxis",
  generate: (params, rng) => buildSunflower(params, rng), // 随机走注入的 rng（design.md §6.7）
});

const head = runGenerator("phyllotaxis", { count: 700 }, createRng("sunflower"));
```

## 新增渲染后端（RendererFactory）

后端也是「一条注册表项」。`RendererFactory` 带可选的 `isSupported()` 特性探测，`selectRenderer` 按偏好顺序选出首个可用后端：

```ts
import { selectRenderer } from "@intermact/core";

registries.renderers.register("webgpu", {
  name: "webgpu",
  isSupported: () => typeof navigator !== "undefined" && "gpu" in navigator,
  create: (options) => makeWebGpuBackend(options),
});

const backend = selectRenderer(["webgpu", "webgl"]); // "webgpu" 或回退 "webgl"
```

> 示例见画廊 `plugin/custom-object`、`plugin/custom-generator`、`plugin/webgpu-backend`。
