import { useMemo } from "react";
import {
  circle,
  createProgram,
  definePlugin,
  globalRegistries,
  installPlugin,
  instanceField,
  type ObjectTransform2D,
  type RendererFactory,
  selectRenderer,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * `examples/plugin/webgpu-backend` (dev-roadmap.md M17, design.md §18 — optional
 * WebGPU PoC).
 *
 * A new render backend is "just another registry entry": this plugin registers
 * a `RendererFactory` for `"webgpu"` (feature-detecting `navigator.gpu`) and one
 * for the always-available `"webgl"` fallback. {@link selectRenderer} picks the
 * first supported backend in preference order — the same lookup a renderer
 * adapter would use to choose its device. The scene below still draws through the
 * default WebGL path (the actual WebGPU device wiring is left as the PoC's next
 * step); the overlay reports which backend the registry selected.
 */

interface BackendOptions {
  readonly canvas?: HTMLCanvasElement;
}

interface BackendHandle {
  readonly kind: string;
}

const webgpuFactory: RendererFactory<BackendHandle, BackendOptions> = {
  name: "webgpu",
  description: "WebGPU backend (PoC — falls back to WebGL when unavailable)",
  isSupported: () =>
    typeof navigator !== "undefined" && typeof (navigator as { gpu?: unknown }).gpu !== "undefined",
  create: () => ({ kind: "webgpu" }),
};

const webglFactory: RendererFactory<BackendHandle, BackendOptions> = {
  name: "webgl",
  description: "Default WebGL backend (three.js WebGLRenderer)",
  isSupported: () => true,
  create: () => ({ kind: "webgl" }),
};

const backendPlugin = definePlugin({
  name: "intermact-webgpu-poc",
  version: "1.0.0",
  install(registries) {
    if (!registries.renderers.has("webgpu")) registries.renderers.register("webgpu", webgpuFactory);
    if (!registries.renderers.has("webgl")) registries.renderers.register("webgl", webglFactory);
  },
});

installPlugin(backendPlugin);

const transforms: ObjectTransform2D[] = [];
const RING = 64;
for (let i = 0; i < RING; i++) {
  const angle = (i / RING) * Math.PI * 2;
  transforms.push({ position: xy(Math.cos(angle) * 2.2, Math.sin(angle) * 2.2), scale: 0.7 });
}
const ring = instanceField(
  circle({ radius: 0.2, samples: 16, style: { fill: "#a78bfa" } }),
  transforms,
);

const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-3.4, 3.4], y: [-3.4, 3.4] },
    fit: "contain",
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));
  const handle = scene.register(ring);
  await scene.play(handle.create({ duration: 1.4 }));
});

export function WebGpuBackendPluginDemo() {
  const selected = useMemo(() => selectRenderer(["webgpu", "webgl"]) ?? "(none)", []);
  const available = useMemo(
    () =>
      globalRegistries.renderers
        .values()
        .map((f) => `${f.name}${(f.isSupported?.() ?? true) ? "" : " (unsupported)"}`)
        .join(", "),
    [],
  );
  return (
    <div style={{ height: "100%", position: "relative" }}>
      <DemoCanvas program={program} autoplay controls={{ timeline: true }} skipFonts />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "8px 12px",
          borderRadius: 8,
          font: "12px ui-monospace, monospace",
          color: "#e2e8f0",
          background: "rgba(15,23,42,0.78)",
          border: "1px solid rgba(148,163,184,0.3)",
          pointerEvents: "none",
          lineHeight: 1.5,
        }}
      >
        <div>
          registered backends: <strong>{available}</strong>
        </div>
        <div>
          selected (webgpu→webgl): <strong>{selected}</strong>
        </div>
      </div>
    </div>
  );
}
