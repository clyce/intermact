/**
 * `transformMatchingTex` (design.md §13 step 3): morph between two LaTeX/text
 * objects by matching token **part keys**. Because `latexObject`/`textObject`
 * already key their parts (token value by default), this is the M9 `matching`
 * strategy applied to formulas — shared tokens transform, dropped tokens
 * collapse, new tokens grow.
 */
import {
  type Animation,
  type MorphOptions,
  type MorphSource,
  transformMatching,
} from "../animation";
import { type IMObject2D } from "../object/types";

/** Morph `source` (a registered text/LaTeX object) into `target` by token keys. */
export function transformMatchingTex(
  source: MorphSource,
  target: IMObject2D,
  options?: MorphOptions,
): Animation {
  return transformMatching(source, target, options);
}
