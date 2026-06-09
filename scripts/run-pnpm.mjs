/**
 * Cross-platform `pnpm` runner for site orchestration scripts.
 * Windows needs `shell: true` (Node 22+ rejects bare `.cmd` spawnSync).
 */
import { spawn, spawnSync } from "node:child_process";

/**
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, stdio?: "inherit" | "pipe" }} opts
 * @returns {import("node:child_process").SpawnSyncReturns<Buffer | null>}
 */
export function runPnpmSync(args, opts) {
  return spawnSync("pnpm", args, {
    cwd: opts.cwd,
    stdio: opts.stdio ?? "inherit",
    env: opts.env ?? process.env,
    shell: process.platform === "win32",
  });
}

/**
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts
 */
export function runPnpm(args, opts) {
  return spawn("pnpm", args, {
    cwd: opts.cwd,
    stdio: "inherit",
    env: opts.env ?? process.env,
    shell: process.platform === "win32",
  });
}

/**
 * Run `pnpm` and exit the process on failure.
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts
 */
export function runPnpmOrExit(args, opts) {
  const result = runPnpmSync(args, opts);
  if (result.error) {
    console.error(`[site] pnpm ${args.join(" ")} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
