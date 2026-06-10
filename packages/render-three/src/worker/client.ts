import { runComputeJob } from "./kernel";
import {
  type ComputeJob,
  type ComputeRequest,
  type ComputeResponse,
  type ComputeResult,
  type ResultFor,
} from "./protocol";

/**
 * A handle for running {@link ComputeJob}s, whether on a Worker or in-process.
 * Always async so callers don't branch on which backend is in use.
 */
export interface ComputeClient {
  /** Run a job, resolving with its typed result. */
  run<K extends ComputeJob["kind"]>(job: Extract<ComputeJob, { kind: K }>): Promise<ResultFor<K>>;
  /** Release resources (terminates an owned Worker). */
  dispose(): void;
}

/**
 * In-process fallback (design.md §15.2 #6). Runs the kernel synchronously and
 * resolves immediately — used when no Worker is available (Node, SSR, tests) so
 * the same code path works everywhere, just without offloading.
 */
export function createLocalComputeClient(): ComputeClient {
  return {
    run<K extends ComputeJob["kind"]>(job: Extract<ComputeJob, { kind: K }>) {
      try {
        return Promise.resolve(runComputeJob(job) as ResultFor<K>);
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    dispose() {},
  };
}

/** Minimal Worker surface needed by {@link createWorkerComputeClient}. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: { data: ComputeResponse }) => void): void;
  removeEventListener(type: "message", listener: (ev: { data: ComputeResponse }) => void): void;
  terminate?(): void;
}

/**
 * Wrap a Worker (running {@link handleComputeMessages}) as a {@link ComputeClient}.
 * Requests are correlated by a monotonic id; results stream back as responses.
 * The host owns Worker construction (bundler-specific, e.g.
 * `new Worker(new URL("./entry", import.meta.url), { type: "module" })`).
 */
export function createWorkerComputeClient(worker: WorkerLike): ComputeClient {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (r: ComputeResult) => void; reject: (e: Error) => void }
  >();

  const onMessage = (ev: { data: ComputeResponse }): void => {
    const res = ev.data;
    const entry = pending.get(res.id);
    if (!entry) return;
    pending.delete(res.id);
    if (res.ok) entry.resolve(res.result);
    else entry.reject(new Error(res.error));
  };
  worker.addEventListener("message", onMessage);

  return {
    run<K extends ComputeJob["kind"]>(job: Extract<ComputeJob, { kind: K }>) {
      const id = nextId++;
      const request: ComputeRequest = { id, job };
      return new Promise<ResultFor<K>>((resolve, reject) => {
        pending.set(id, {
          resolve: (r) => resolve(r as ResultFor<K>),
          reject,
        });
        worker.postMessage(request);
      });
    },
    dispose() {
      worker.removeEventListener("message", onMessage);
      worker.terminate?.();
      pending.forEach((p) => p.reject(new Error("compute client disposed")));
      pending.clear();
    },
  };
}
