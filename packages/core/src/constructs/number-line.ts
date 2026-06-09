/**
 * NumberLine construct (design.md §7.4): a 1D axis mapping a data domain onto a
 * world-space segment, with ticks and numeric labels.
 */
import { type AbsXY, xy } from "../math/vec";
import { linearScale } from "../math/scale";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { labelContours } from "../text/text-layout";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { type Interval } from "../scene/types";
import { strokeObject } from "./shared";

/** Authoring spec for {@link numberLine}. */
export interface NumberLineSpec {
  readonly domain: Interval;
  /** World-space center of the line (default `[0,0]`). */
  readonly center?: AbsXY;
  /** Total world length of the line (default = domain span). */
  readonly length?: number;
  readonly tickCount?: number;
  readonly showTicks?: boolean;
  readonly showLabels?: boolean;
  readonly style?: ObjectStyle;
}

const TICK_LENGTH = 0.1;
const LABEL_SIZE = 0.2;

/** Build a horizontal number line as a single stroke object. */
export function numberLine(spec: NumberLineSpec): IMObject2D {
  const center = spec.center ?? xy(0, 0);
  const length = spec.length ?? spec.domain[1] - spec.domain[0];
  const x0 = center[0] - length / 2;
  const x1 = center[0] + length / 2;
  const scale = linearScale(spec.domain, [x0, x1]);
  const tickCount = spec.tickCount ?? 8;
  const showTicks = spec.showTicks ?? true;
  const showLabels = spec.showLabels ?? true;

  const contours: RawContour[] = [
    rawContourFromPoints([xy(x0, center[1]), xy(x1, center[1])], false),
  ];

  if (showTicks) {
    const fmt = scale.tickFormat(tickCount);
    for (const t of scale.ticks(tickCount)) {
      const wx = scale(t);
      contours.push(
        rawContourFromPoints(
          [xy(wx, center[1] - TICK_LENGTH), xy(wx, center[1] + TICK_LENGTH)],
          false,
        ),
      );
      if (showLabels) {
        contours.push(
          ...labelContours(fmt(t), {
            size: LABEL_SIZE,
            origin: xy(wx, center[1] - TICK_LENGTH - 0.04),
            align: "center",
            baseline: "top",
          }).contours,
        );
      }
    }
  }

  return strokeObject("number-line", contours, {
    stroke: "#94a3b8",
    lineWidth: 0.025,
    ...spec.style,
  });
}
