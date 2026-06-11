/** Vite `?url` imports (font assets in {@link loadFonts}). */
declare module "*?url" {
  const url: string;
  export default url;
}

/** Vite `?raw` imports (demo source injection in {@link loadDemoSource}). */
declare module "*?raw" {
  const content: string;
  export default content;
}
