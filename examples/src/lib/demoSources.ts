import { type DemoEntry, demoSourcePath } from "../registry";

/**
 * Lazy loaders for every demo `.tsx` under `examples/src/` as raw text.
 * Vite resolves these at dev time and inlines the strings during `vite build`
 * (including `build:site` → `build:embed`), so demo pages never duplicate source.
 */
const sourceLoaders = import.meta.glob("../**/*.tsx", {
  query: "?raw",
  import: "default",
});

const sourceCache = new Map<string, string>();

/**
 * Vite `import.meta.glob` key for a demo's primary source file
 * (paths are relative to this module under `examples/src/lib/`).
 */
export function demoSourceGlobKey(demo: DemoEntry): string {
  const rel = demoSourcePath(demo).replace(/^examples\/src\//, "");
  return `../${rel}`;
}

/**
 * Load the on-disk source text for a demo entry.
 * Results are cached per {@link DemoEntry.id} for the session.
 */
export async function loadDemoSource(demo: DemoEntry): Promise<string> {
  const cached = sourceCache.get(demo.id);
  if (cached !== undefined) return cached;

  const key = demoSourceGlobKey(demo);
  const loader = sourceLoaders[key];
  if (!loader) {
    const missing = `// Source file not found: ${demoSourcePath(demo)}\n// Glob key: ${key}`;
    sourceCache.set(demo.id, missing);
    return missing;
  }

  const text = (await loader()) as string;
  sourceCache.set(demo.id, text);
  return text;
}
