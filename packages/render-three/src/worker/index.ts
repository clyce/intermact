/**
 * Compute-worker offloading (design.md §15.2 #6). Pure, serializable jobs
 * (resample / triangulate / marching-cubes / parse-svg-path) that can run either
 * in-process or on a Worker. core stays DOM-free; this is the worker glue.
 */
export * from "./protocol";
export * from "./kernel";
export * from "./client";
export * from "./entry";
