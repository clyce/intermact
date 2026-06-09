/**
 * Brace construct (design.md §7.4): a curly brace spanning one side of a target
 * object's bounds, pointing in a given direction. Accepts a {@link Bounds2D} or
 * any {@link IMObject2D} (its geometry bounds are used), avoiding a dependency on
 * the scene/RegisteredObject layer.
 */
import { type AbsXY, type Vec2, xy } from "../math/vec";
import { sampleBezier } from "../geometry/curves";
import { rawContourFromPoints } from "../geometry/sampling";
import { type Bounds2D } from "../object/geometry-provider";
import { type IMObject2D } from "../object/types";
import { type ObjectStyle } from "../object/style";
import { strokeObject } from "./shared";

/** Options for {@link brace}. */
export interface BraceOptions {
  /** How far the brace tip extends from the target edge (default 0.3). */
  readonly depth?: number;
  /** Gap between the target edge and the brace (default 0.1). */
  readonly gap?: number;
  readonly samples?: number;
  readonly style?: ObjectStyle;
}

/** Local brace shape: spans local x in `[0, L]`, dipping to `-depth` at center. */
function localBrace(length: number, depth: number, samples: number): AbsXY[] {
  const mid = length / 2;
  const left = sampleBezier([xy(0, 0), xy(length * 0.15, -depth), xy(mid, -depth * 0.85)], samples);
  const right = sampleBezier(
    [xy(mid, -depth * 0.85), xy(length * 0.85, -depth), xy(length, 0)],
    samples,
  );
  return [...left, xy(mid, -depth), ...right];
}

function boundsOf(target: Bounds2D | IMObject2D): Bounds2D {
  return "geometry" in target ? target.geometry.getBounds() : target;
}

/** Pick the dominant side from a direction vector. */
function sideOf(direction: Vec2): "up" | "down" | "left" | "right" {
  const [dx, dy] = direction;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "down" : "up";
  return dx < 0 ? "left" : "right";
}

/** Curly brace spanning one side of a target's bounds (design.md §7.4). */
export function brace(
  target: Bounds2D | IMObject2D,
  direction: Vec2,
  opts: BraceOptions = {},
): IMObject2D {
  const bounds = boundsOf(target);
  const depth = opts.depth ?? 0.3;
  const gap = opts.gap ?? 0.1;
  const samples = opts.samples ?? 24;
  const side = sideOf(direction);

  const width = bounds.size[0];
  const height = bounds.size[1];
  const length = side === "left" || side === "right" ? height : width;
  const local = localBrace(length, depth, samples);

  const mapped: AbsXY[] = local.map(([lx, ly]) => {
    switch (side) {
      case "down":
        return xy(bounds.min[0] + lx, bounds.min[1] - gap + ly);
      case "up":
        return xy(bounds.min[0] + lx, bounds.max[1] + gap - ly);
      case "left":
        return xy(bounds.min[0] - gap + ly, bounds.min[1] + lx);
      case "right":
        return xy(bounds.max[0] + gap - ly, bounds.min[1] + lx);
    }
  });

  return strokeObject("brace", [rawContourFromPoints(mapped, false)], {
    stroke: "#e2e8f0",
    lineWidth: 0.03,
    ...opts.style,
  });
}
