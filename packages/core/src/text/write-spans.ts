/**
 * Temporal windows for sequential left-to-right glyph writing animations.
 */
import { type GlyphRevealSpan } from "../runtime/state";

/** Writing direction for glyph-ordered reveal. */
export type WriteDirection = "ltr" | "rtl" | "simultaneous";

/** Epsilon for treating a glyph write animation as finished. */
export const GLYPH_WRITE_COMPLETE_EPS = 1e-5;

/**
 * Compute per-glyph stroke windows on the global reveal timeline [0,1].
 * `overlap` is the fraction of each glyph stroke that may overlap with the next
 * (0 = strict sequential, 0.3 = next glyph starts when previous is 70% done).
 * `simultaneous` gives every glyph the full [0,1] window.
 */
export function computeGlyphRevealSpans(
  count: number,
  overlap = 0,
  direction: WriteDirection = "ltr",
): readonly GlyphRevealSpan[] {
  if (count <= 0) return [];
  if (count === 1) return [{ start: 0, end: 1 }];
  if (direction === "simultaneous") {
    return Array.from({ length: count }, () => ({ start: 0, end: 1 }));
  }
  const clamped = Math.max(0, Math.min(overlap, 0.95));
  const step = 1 / (count - (count - 1) * clamped);
  const spans: GlyphRevealSpan[] = [];
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      spans.push({ start: Math.max(0, 1 - step), end: 1 });
    } else {
      const start = i * step * (1 - clamped);
      spans.push({ start, end: start + step });
    }
  }
  return direction === "rtl" ? [...spans].reverse() : spans;
}

/** True when a sequential `write()` has fully finished (stroke + fill). */
export function isGlyphWriteComplete(
  revealEnd: number,
  fillProgress: number,
  spans?: readonly GlyphRevealSpan[],
): boolean {
  return (
    revealEnd >= 1 - GLYPH_WRITE_COMPLETE_EPS && fillProgress >= 1 - GLYPH_WRITE_COMPLETE_EPS
  );
}

/** Map a global reveal value to a glyph-local [0,1] progress. */
export function glyphLocalReveal(globalReveal: number, span: GlyphRevealSpan): number {
  if (span.end <= span.start) return globalReveal >= span.end ? 1 : 0;
  return Math.max(0, Math.min(1, (globalReveal - span.start) / (span.end - span.start)));
}

/** Map a global fill value to glyph-local fill progress (starts after stroke ends). */
export function glyphLocalFill(
  globalFill: number,
  span: GlyphRevealSpan,
  fillOverlap = 0.2,
): number {
  const fillStart = span.end - (span.end - span.start) * fillOverlap;
  if (globalFill <= 0) return 0;
  if (fillStart >= 1) return globalFill;
  return Math.max(0, Math.min(1, (globalFill - fillStart) / (1 - fillStart)));
}
