/**
 * Matrix construct (design.md §7.4): a grid of numeric/string entries wrapped in
 * brackets. Layout is computed internally and emitted as a single stroke object
 * (brackets + entry glyphs share one style), mirroring `axesObject`.
 */
import { type AbsXY, xy } from "../math/vec";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { labelContours } from "../text/text-layout";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { strokeObject } from "./shared";

/** Authoring spec for {@link matrixObject}. */
export interface MatrixSpec {
  readonly values: readonly (readonly (number | string)[])[];
  /** World center of the matrix (default `[0,0]`). */
  readonly center?: AbsXY;
  readonly cellWidth?: number;
  readonly cellHeight?: number;
  /** Bracket style (default square). */
  readonly bracket?: "square" | "none";
  /** Glyph height for entries (default 0.26). */
  readonly entrySize?: number;
  /** Fractional digits when an entry is a number (default 0). */
  readonly entryDigits?: number;
  readonly style?: ObjectStyle;
}

/** Format a matrix entry to its glyph string. */
function entryText(value: number | string, digits: number): string {
  return typeof value === "number" ? value.toFixed(digits) : value;
}

/** Build a bracketed matrix as a single stroke object. */
export function matrixObject(spec: MatrixSpec): IMObject2D {
  const rows = spec.values.length;
  const cols = spec.values.reduce((m, r) => Math.max(m, r.length), 0);
  const cellWidth = spec.cellWidth ?? 0.9;
  const cellHeight = spec.cellHeight ?? 0.6;
  const entrySize = spec.entrySize ?? 0.26;
  const digits = spec.entryDigits ?? 0;
  const [cx, cy] = spec.center ?? xy(0, 0);

  const totalWidth = cols * cellWidth;
  const totalHeight = rows * cellHeight;
  const left = cx - totalWidth / 2;
  const top = cy + totalHeight / 2;

  const contours: RawContour[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = spec.values[r]?.[c];
      if (value === undefined) continue;
      const ex = left + (c + 0.5) * cellWidth;
      const ey = top - (r + 0.5) * cellHeight;
      contours.push(
        ...labelContours(entryText(value, digits), {
          size: entrySize,
          origin: xy(ex, ey),
          align: "center",
          baseline: "middle",
        }).contours,
      );
    }
  }

  if ((spec.bracket ?? "square") === "square") {
    const pad = 0.12;
    const serif = 0.12;
    const lx = left - pad;
    const rx = left + totalWidth + pad;
    const bTop = top + pad;
    const bBottom = top - totalHeight - pad;
    // Left bracket
    contours.push(rawContourFromPoints([xy(lx, bTop), xy(lx, bBottom)], false));
    contours.push(rawContourFromPoints([xy(lx, bTop), xy(lx + serif, bTop)], false));
    contours.push(rawContourFromPoints([xy(lx, bBottom), xy(lx + serif, bBottom)], false));
    // Right bracket
    contours.push(rawContourFromPoints([xy(rx, bTop), xy(rx, bBottom)], false));
    contours.push(rawContourFromPoints([xy(rx, bTop), xy(rx - serif, bTop)], false));
    contours.push(rawContourFromPoints([xy(rx, bBottom), xy(rx - serif, bBottom)], false));
  }

  return strokeObject("matrix", contours, {
    stroke: "#e2e8f0",
    lineWidth: 0.03,
    ...spec.style,
  });
}
