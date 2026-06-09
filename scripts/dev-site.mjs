/**
 * Dev orchestration: examples gallery (`:5173`, base `/demos/`) + VitePress (`:5174`)
 * with `/demos/` proxied to the gallery (see `docs/.vitepress/config.ts`).
 */
import { createConnection } from "node:net";
import { demosBase, docsEnv, examplesBuildEnv, repoRoot, siteBase } from "./site-config.mjs";
import { runPnpm } from "./run-pnpm.mjs";

const EXAMPLES_PORT = 5173;
const DOCS_PORT = 5174;

/**
 * Wait until a TCP port accepts connections.
 * @param {number} port
 * @param {number} [timeoutMs]
 */
function waitForPort(port, timeoutMs = 60_000) {
  const host = "127.0.0.1";
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`[site] timed out waiting for ${host}:${port}`));
        return;
      }
      const socket = createConnection({ port, host }, () => {
        socket.end();
        resolve(undefined);
      });
      socket.on("error", () => {
        setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

console.log(
  `[site] dev SITE_BASE=${siteBase()} DEMOS_BASE=${demosBase()} → http://localhost:${DOCS_PORT}/demos/`,
);

const examples = runPnpm(["--filter", "@intermact/examples", "run", "dev:embed"], {
  cwd: repoRoot,
  env: examplesBuildEnv(),
});

let docs = null;

const shutdown = (code = 0) => {
  if (docs && !docs.killed) docs.kill("SIGTERM");
  if (!examples.killed) examples.kill("SIGTERM");
  process.exit(code);
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

examples.on("error", (err) => {
  console.error("[site] examples dev failed:", err);
  shutdown(1);
});

examples.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});

waitForPort(EXAMPLES_PORT)
  .then(() => {
    docs = runPnpm(["--filter", "@intermact/docs", "run", "dev"], {
      cwd: repoRoot,
      env: docsEnv({ INTERMACT_DEV_SITE: "1" }),
    });
    docs.on("exit", (code) => shutdown(code ?? 0));
  })
  .catch((err) => {
    console.error(err.message);
    shutdown(1);
  });
