import { useEffect, useState } from "react";

/**
 * Track the user's `prefers-reduced-motion` setting (design.md §17 a11y). Returns
 * `true` when the OS/browser requests reduced motion, so callers can present the
 * end-state instead of animating. SSR-safe: defaults to `false` until mounted.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
