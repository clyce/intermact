/**
 * Example gallery asset fetchers for {@link buildProgram} / {@link IntermactCanvas}.
 * Fonts resolve to binary buffers; SVG/JSON use text fetch.
 */

/** Fetch a text asset (SVG markup, JSON). */
export async function exampleAssetFetch(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch asset "${src}": ${res.status}`);
  return res.text();
}

/** Fetch a binary font asset (TTF/OTF/WOFF). */
export async function exampleAssetFetchBinary(src: string): Promise<ArrayBuffer> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch font "${src}": ${res.status}`);
  return res.arrayBuffer();
}
