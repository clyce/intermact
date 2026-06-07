import { Color } from "three";

/** A parsed CSS color split into an RGB color and a separate alpha channel. */
export interface ParsedColor {
  readonly color: Color;
  readonly alpha: number;
}

/**
 * Parse a CSS color string into a three.js {@link Color} plus alpha. three's
 * `Color` ignores alpha, so we extract it from `rgba()/hsla()` ourselves and
 * fall back to `Color`'s own parsing for hex/named/rgb.
 */
export function parseColor(css: string | undefined, fallback = "#ffffff"): ParsedColor {
  if (!css) return { color: new Color(fallback), alpha: 1 };
  const rgba = css.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const parts = rgba[1]!.split(",").map((s) => s.trim());
    const r = parseFloat(parts[0] ?? "0");
    const g = parseFloat(parts[1] ?? "0");
    const b = parseFloat(parts[2] ?? "0");
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return { color: new Color(r / 255, g / 255, b / 255), alpha: Number.isFinite(a) ? a : 1 };
  }
  const hsla = css.match(/hsla\(([^)]+)\)/i);
  if (hsla) {
    const parts = hsla[1]!.split(",").map((s) => s.trim());
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return { color: new Color(css.replace(/hsla/i, "hsl")), alpha: Number.isFinite(a) ? a : 1 };
  }
  return { color: new Color(css), alpha: 1 };
}
