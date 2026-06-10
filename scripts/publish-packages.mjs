/**
 * Publish `@intermact/*` packages to the public npm registry in dependency order.
 *
 * `publishConfig.registry` in each package.json targets registry.npmjs.org so
 * a user-level npmmirror default does not affect publish.
 *
 * Usage: `pnpm run publish:packages` (runs build first)
 * Dry run: `pnpm run publish:packages -- --dry-run`
 */
import { repoRoot } from "./site-config.mjs";
import { runPnpmOrExit } from "./run-pnpm.mjs";

const NPM_REGISTRY = "https://registry.npmjs.org/";

/** Topological publish order (dependencies first). */
const PACKAGES = [
  "@intermact/core",
  "@intermact/render-three",
  "@intermact/render-r3f",
  "@intermact/react",
];

const dryRun = process.argv.includes("--dry-run");
/** One-time password from your authenticator app (required when npm 2FA is enabled). */
const otp = process.env.NPM_OTP ?? process.env.NPM_CONFIG_OTP;

console.log(`[publish] registry=${NPM_REGISTRY} dryRun=${dryRun} otp=${otp ? "set" : "missing"}`);

runPnpmOrExit(["run", "build"], { cwd: repoRoot });

for (const name of PACKAGES) {
  const args = [
    "--filter",
    name,
    "publish",
    "--registry",
    NPM_REGISTRY,
    "--access",
    "public",
    "--no-git-checks",
  ];
  if (dryRun) args.push("--dry-run");
  if (otp && !dryRun) args.push("--otp", otp);
  console.log(`[publish] ${name}…`);
  runPnpmOrExit(args, { cwd: repoRoot });
}

console.log("[publish] done");
