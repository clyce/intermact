import { type ComputeWorkerScope, handleComputeMessages } from "@intermact/render-three";

/**
 * Dedicated compute Worker entry for `examples/perf/worker-sampling`. Vite bundles
 * this module when referenced via `new Worker(new URL("./compute.worker.ts",
 * import.meta.url), { type: "module" })`. It only wires the pure
 * `@intermact/render-three` job kernel to the worker scope — three.js is unused
 * here and tree-shaken out of the worker bundle.
 */
handleComputeMessages(self as unknown as ComputeWorkerScope);
