import { useEffect, useState } from "react";
import { type DemoEntry } from "../registry";
import { loadDemoSource } from "./demoSources";

/** Fetches demo source text when `enabled`; clears when disabled or demo changes. */
export function useDemoSource(demo: DemoEntry | undefined, enabled: boolean) {
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!demo || !enabled) {
      setSource(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadDemoSource(demo)
      .then((text) => {
        if (!cancelled) {
          setSource(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [demo, enabled]);

  return { source, loading, error };
}
