/**
 * VitePress theme: `/demos/` is a static embedded SPA (see `public/demos/`), not a VP
 * markdown route. In-app clicks must use full page navigation; otherwise VP's client
 * router shows its 404 page even though `dist/demos/index.html` exists.
 */
import DefaultTheme from "vitepress/theme";
import { inBrowser } from "vitepress";

declare global {
  interface Window {
    __intermactDemosNav?: boolean;
  }
}

/** Path relative to site base, e.g. `/demos/` or `/Intermact/demos/`. */
function demosPathname(pathname: string, base: string): string {
  if (base === "/") return pathname;
  if (pathname === base.slice(0, -1)) return "/";
  if (pathname.startsWith(base)) {
    const rest = pathname.slice(base.length - 1);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return pathname;
}

function isDemosPath(pathname: string, base: string): boolean {
  const rel = demosPathname(pathname, base);
  return rel === "/demos" || rel.startsWith("/demos/");
}

function installDemosFullPageNav() {
  if (typeof window === "undefined" || window.__intermactDemosNav) return;
  window.__intermactDemosNav = true;

  const base = import.meta.env.BASE_URL;

  document.addEventListener(
    "click",
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") {
        return;
      }

      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("mailto:")) return;

      let url: URL;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (!isDemosPath(url.pathname, base)) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    },
    true,
  );
}

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (inBrowser) installDemosFullPageNav();
  },
};
