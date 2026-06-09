/**
 * Table construct (design.md §7.4): a grid of cells with separator lines and
 * numeric/string entries. Emitted as a single stroke object. Entries render with
 * the built-in stroke font (M10 text pipeline).
 */
import { type AbsXY, xy } from "../math/vec";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { labelContours } from "../text/text-layout";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { strokeObject } from "./shared";

/** Authoring spec for {@link tableObject}. */
export interface TableSpec {
  readonly data: readonly (readonly (number | string)[])[];
  /** World center of the table (default `[0,0]`). */
  readonly center?: AbsXY;
  readonly cellWidth?: number;
  readonly cellHeight?: number;
  readonly entrySize?: number;
  readonly entryDigits?: number;
  readonly style?: ObjectStyle;
}

/** Build a grid table as a single stroke object. */
export function tableObject(spec: TableSpec): IMObject2D {
  const rows = spec.data.length;
  const cols = spec.data.reduce((m, r) => Math.max(m, r.length), 0);
  const cellWidth = spec.cellWidth ?? 1;
  const cellHeight = spec.cellHeight ?? 0.55;
  const entrySize = spec.entrySize ?? 0.24;
  const digits = spec.entryDigits ?? 0;
  const [cx, cy] = spec.center ?? xy(0, 0);

  const totalWidth = cols * cellWidth;
  const totalHeight = rows * cellHeight;
  const left = cx - totalWidth / 2;
  const top = cy + totalHeight / 2;
  const right = left + totalWidth;
  const bottom = top - totalHeight;

  const contours: RawContour[] = [];

  // Grid lines (rows + cols, inclusive of the outer border).
  for (let r = 0; r <= rows; r++) {
    const y = top - r * cellHeight;
    contours.push(rawContourFromPoints([xy(left, y), xy(right, y)], false));
  }
  for (let c = 0; c <= cols; c++) {
    const x = left + c * cellWidth;
    contours.push(rawContourFromPoints([xy(x, top), xy(x, bottom)], false));
  }

  // Entries.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = spec.data[r]?.[c];
      if (value === undefined) continue;
      const text = typeof value === "number" ? value.toFixed(digits) : value;
      contours.push(
        ...labelContours(text, {
          size: entrySize,
          origin: xy(left + (c + 0.5) * cellWidth, top - (r + 0.5) * cellHeight),
          align: "center",
          baseline: "middle",
        }).contours,
      );
    }
  }

  return strokeObject("table", contours, {
    stroke: "#cbd5e1",
    lineWidth: 0.02,
    ...spec.style,
  });
}
