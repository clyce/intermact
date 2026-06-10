import { resultTransferables, runComputeJob } from "./kernel";
import { type ComputeRequest, type ComputeResponse } from "./protocol";

/**
 * The worker-global surface {@link handleComputeMessages} wires into. Typed
 * structurally (postMessage + onmessage) so this file needs neither the DOM nor
 * the WebWorker lib — a host's `self` satisfies it inside a real Worker.
 */
export interface ComputeWorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: { data: ComputeRequest }) => void) | null;
}

/**
 * Install the compute-job handler on a worker scope (design.md §15.2 #6). In a
 * real Worker entry module call `handleComputeMessages(self)`. Each request runs
 * the pure kernel and posts back a typed {@link ComputeResponse}, transferring
 * result buffers to avoid a copy. Errors are reported, never thrown across the
 * boundary.
 */
export function handleComputeMessages(scope: ComputeWorkerScope): void {
  scope.onmessage = (ev) => {
    const { id, job } = ev.data;
    let response: ComputeResponse;
    let transfer: Transferable[] = [];
    try {
      const result = runComputeJob(job);
      response = { id, ok: true, result };
      transfer = resultTransferables(result);
    } catch (error) {
      response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    scope.postMessage(response, transfer);
  };
}
