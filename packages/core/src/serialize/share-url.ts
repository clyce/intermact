import { IntermactError } from "../errors";
import { type SerializedProject } from "./types";

/**
 * Share-URL codec (design.md §17). Encodes a {@link SerializedProject} as a
 * compact, URL-safe string so a scene can be shared/embedded by link. The codec
 * is framework-free (no `btoa`/`Buffer`/DOM): it uses {@link TextEncoder} /
 * {@link TextDecoder} (available in Node, browsers, and Workers) plus a manual
 * base64url table, so the same code runs headless in tests and live in the page.
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "";
  }
  return out;
}

function base64UrlToBytes(str: string): Uint8Array {
  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const clean = str.trim();
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? lookup[code]! : -1;
    if (v < 0) {
      throw new IntermactError("serialization-error", `Invalid share-url character at index ${i}.`);
    }
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/**
 * Default maximum decoded payload size (bytes). Guards {@link decodeShareUrl}
 * against untrusted megabyte-scale strings (DoS / accidental paste); a typical
 * scene is a few KB. Override via {@link DecodeShareUrlOptions.maxBytes}.
 */
export const DEFAULT_SHARE_URL_MAX_BYTES = 2_000_000;

/** Options for {@link decodeShareUrl}. */
export interface DecodeShareUrlOptions {
  /** Reject payloads whose decoded byte length exceeds this (default 2 MB). */
  readonly maxBytes?: number;
}

/** Encode a {@link SerializedProject} into a URL-safe base64 string. */
export function encodeShareUrl(project: SerializedProject): string {
  const json = JSON.stringify(project);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/**
 * Decode a share-url string back into a {@link SerializedProject}. The decoder is
 * UTF-8 (via {@link TextDecoder}) so non-ASCII content (labels, metadata)
 * round-trips. Oversized payloads are rejected with `serialization-error`.
 */
export function decodeShareUrl(
  encoded: string,
  options: DecodeShareUrlOptions = {},
): SerializedProject {
  const maxBytes = options.maxBytes ?? DEFAULT_SHARE_URL_MAX_BYTES;
  // Cheap upper bound before allocating: 4 base64 chars → 3 bytes.
  if (Math.ceil((encoded.length * 3) / 4) > maxBytes) {
    throw new IntermactError(
      "serialization-error",
      `Share-url payload exceeds the ${maxBytes}-byte limit.`,
    );
  }
  const bytes = base64UrlToBytes(encoded);
  if (bytes.length > maxBytes) {
    throw new IntermactError(
      "serialization-error",
      `Share-url payload exceeds the ${maxBytes}-byte limit.`,
    );
  }
  const json = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(json) as SerializedProject;
  } catch {
    throw new IntermactError("serialization-error", "Share-url payload is not valid JSON.");
  }
}
