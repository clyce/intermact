/**
 * Resolve navigation targets when the gallery is embedded under the docs site
 * (`/demos/` or `/<repo>/demos/` per {@link import.meta.env.BASE_URL}).
 */

/** VitePress site root — one level above the examples gallery base path. */
export function siteHomeHref(): string {
  const base = import.meta.env.BASE_URL;
  const home = base.replace(/\/?demos\/?$/, "/");
  return home || "/";
}
