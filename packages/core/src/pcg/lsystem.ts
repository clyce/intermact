/**
 * L-system generator (design.md §6.4): axiom + production rules expanded for N
 * iterations, then interpreted by a turtle. Randomness (angle jitter) comes from
 * an injected seeded {@link Rng} so output is reproducible (§6.7).
 */
import { type AbsXY, xy } from "../math/vec";
import { type RawContour, rawContourFromPoints } from "../geometry/sampling";
import { type ObjectStyle } from "../object/style";
import { type IMObject2D } from "../object/types";
import { type Rng } from "../random/rng";
import { strokeObject } from "../constructs/shared";
import { IntermactError } from "../errors";

/** Spec for {@link lSystem}. */
export interface LSystemSpec {
  /** Initial string. */
  readonly axiom: string;
  /** Production rules: each symbol maps to its replacement string. */
  readonly rules: Readonly<Record<string, string>>;
  /** Number of rewrite iterations. */
  readonly iterations: number;
  /** Turn angle in degrees for `+` / `-`. */
  readonly angle: number;
  /** Forward step length in world units (default 0.1). */
  readonly step?: number;
  /** Turtle start position (default `[0,0]`). */
  readonly start?: AbsXY;
  /** Initial heading in degrees, CCW from +x (default 90 = up). */
  readonly startAngle?: number;
  /** Random angle jitter amplitude in degrees (default 0). Requires `rng`. */
  readonly jitterAngle?: number;
  /** Seeded RNG for jitter (design.md §6.7). */
  readonly rng?: Rng;
  readonly style?: ObjectStyle;
  /** Safety cap on the expanded string length (default 500000). */
  readonly maxLength?: number;
}

/** Expand an L-system axiom under its rules for `iterations` steps. */
export function expandLSystem(
  axiom: string,
  rules: Readonly<Record<string, string>>,
  iterations: number,
  maxLength = 500000,
): string {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (const ch of current) next += rules[ch] ?? ch;
    current = next;
    if (current.length > maxLength) break;
  }
  return current;
}

interface TurtleState {
  x: number;
  y: number;
  heading: number;
}

/** Generate an L-system curve as a stroke object (design.md §6.4, §19.4). */
export function lSystem(spec: LSystemSpec): IMObject2D {
  const expanded = expandLSystem(spec.axiom, spec.rules, spec.iterations, spec.maxLength);
  const step = spec.step ?? 0.1;
  const angle = (spec.angle * Math.PI) / 180;
  const jitter = ((spec.jitterAngle ?? 0) * Math.PI) / 180;
  // Determinism (§6.7): jitter is randomness and must come from a seeded Rng.
  // Silently degrading to zero jitter would hide a non-reproducible request.
  if (jitter > 0 && !spec.rng) {
    throw new IntermactError(
      "invalid-argument",
      "lSystem: `jitterAngle > 0` requires a seeded `rng` for reproducibility (design.md §6.7).",
    );
  }
  const start = spec.start ?? xy(0, 0);
  let state: TurtleState = {
    x: start[0],
    y: start[1],
    heading: ((spec.startAngle ?? 90) * Math.PI) / 180,
  };
  const stack: TurtleState[] = [];
  const contours: RawContour[] = [];
  let penLine: AbsXY[] | null = null;

  const flush = (): void => {
    if (penLine && penLine.length >= 2) contours.push(rawContourFromPoints(penLine, false));
    penLine = null;
  };

  for (const ch of expanded) {
    switch (ch) {
      case "F": {
        const nx = state.x + step * Math.cos(state.heading);
        const ny = state.y + step * Math.sin(state.heading);
        if (!penLine) penLine = [xy(state.x, state.y)];
        penLine.push(xy(nx, ny));
        state = { ...state, x: nx, y: ny };
        break;
      }
      case "f": {
        flush();
        state = {
          ...state,
          x: state.x + step * Math.cos(state.heading),
          y: state.y + step * Math.sin(state.heading),
        };
        break;
      }
      case "+":
        state = {
          ...state,
          heading: state.heading + angle + (jitter ? (spec.rng!.next() * 2 - 1) * jitter : 0),
        };
        break;
      case "-":
        state = {
          ...state,
          heading: state.heading - angle + (jitter ? (spec.rng!.next() * 2 - 1) * jitter : 0),
        };
        break;
      case "[":
        flush();
        stack.push({ ...state });
        break;
      case "]":
        flush();
        state = stack.pop() ?? state;
        break;
      default:
        break;
    }
  }
  flush();
  if (contours.length === 0) {
    contours.push(rawContourFromPoints([start, start], false));
  }
  return strokeObject("lsystem", contours, {
    stroke: "#34d399",
    lineWidth: 0.02,
    ...spec.style,
  });
}
