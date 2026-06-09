import { type ReadonlySignal } from "../reactive/signal";
import { derived, type ReactiveObjectSource } from "../reactive/derived";
import { glyphText } from "../text/text-layout";

/** Options for {@link decimalNumber}. */
export interface DecimalOptions {
  readonly prefix?: string;
  readonly digits?: number;
  /** Glyph height in world units (default 0.36). */
  readonly size?: number;
}

/**
 * Reactive decimal readout driven by a numeric signal (design.md §7.4, §8).
 * Returns a {@link ReactiveObjectSource} for `scene.registerReactive`. The text
 * is rendered with the built-in stroke-font glyph renderer ({@link glyphText}).
 */
export function decimalNumber(
  tracker: ReadonlySignal<number>,
  opts: DecimalOptions = {},
): ReactiveObjectSource {
  const digits = opts.digits ?? 2;
  const prefix = opts.prefix ?? "";
  const size = opts.size;
  return derived([tracker], () => {
    const text = `${prefix}${tracker.get().toFixed(digits)}`;
    return glyphText(
      text,
      { stroke: "#e2e8f0", lineWidth: 0.04 },
      size !== undefined ? { size } : {},
    );
  });
}
