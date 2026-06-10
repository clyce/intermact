/**
 * Error handling and contract codes (design.md §16).
 */

/** Stable error codes for programmatic handling and dev diagnostics. */
export type IntermactErrorCode =
  | "object-dimension-mismatch"
  | "scene-coordinate-mismatch"
  | "unsupported-animation"
  | "missing-trait"
  | "renderer-adapter-error"
  | "asset-load-error"
  | "non-seekable-side-effect"
  | "external-state-error"
  | "serialization-error"
  | "plugin-error"
  | "invalid-argument";

/** Base error carrying a stable {@link IntermactErrorCode} and optional detail. */
export class IntermactError extends Error {
  constructor(
    readonly code: IntermactErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "IntermactError";
  }
}

/**
 * Exhaustiveness guard for `switch`/discriminated-union dispatch. Calling this
 * is a compile-time error if `value` is not `never`, surfacing missed cases.
 */
export function assertNever(value: never, message?: string): never {
  throw new IntermactError(
    "invalid-argument",
    message ?? `Unhandled variant: ${JSON.stringify(value)}`,
    value,
  );
}
