import { IntermactError } from "../errors";
import { type Animation, type AnimationSpec, toAnimation } from "./spec";

/**
 * Composition helpers (design.md §11.2). `scene.play(a, b, c)` is parallel by
 * default; use `sequence(...)` for serial. These return Animation handles
 * (data), nothing executes until the Storyboard is played.
 */

/** Run animations one after another. */
export function sequence(...animations: Animation[]): Animation {
  return toAnimation({ kind: "sequence", children: animations.map((a) => a.spec) });
}

/** Run animations simultaneously. */
export function parallel(...animations: Animation[]): Animation {
  return toAnimation({ kind: "parallel", children: animations.map((a) => a.spec) });
}

/** Start each animation offset by `lag` seconds (LaggedStart). */
export function stagger(animations: Animation[], lag: number): Animation {
  return toAnimation({ kind: "stagger", children: animations.map((a) => a.spec), lag });
}

/** Repeat an animation a fixed number of times or infinitely. */
export function repeat(animation: Animation, times: number | "infinite"): Animation {
  return toAnimation({ kind: "repeat", child: animation.spec, times });
}

/** Hold for a duration (advances the build cursor). */
export function wait(duration: number): Animation {
  return toAnimation({ kind: "wait", duration });
}

/**
 * Escape hatch for imperative side effects (design.md §11.5). Marked as a
 * non-seekable boundary: only fired during forward real-time playback, skipped
 * (with a warning) during scrub preview.
 */
export function call(effect: () => void | Promise<void>): Animation {
  const spec: AnimationSpec = { kind: "call", effect };
  return toAnimation(spec);
}

/** Options for {@link customAnimation}. */
export interface CustomAnimationOptions {
  /** Object id the animation targets (optional for non-object effects). */
  readonly targetId?: string;
  /** Serializable parameters forwarded to the registered compiler. */
  readonly params?: unknown;
  /** Total duration in seconds (default 1). */
  readonly duration?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function checkJsonSafe(value: unknown, path: string, seen: WeakSet<object>): void {
  if (value === null) return;
  const t = typeof value;
  if (t === "boolean" || t === "string") return;
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new IntermactError(
        "invalid-argument",
        `custom animation \`params${path}\` must be JSON-serializable; got a non-finite number.`,
      );
    }
    return;
  }
  if (t === "function" || t === "symbol" || t === "bigint" || t === "undefined") {
    throw new IntermactError(
      "invalid-argument",
      `custom animation \`params${path}\` must be JSON-serializable; got ${t}.`,
    );
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new IntermactError(
        "invalid-argument",
        `custom animation \`params${path}\` is circular.`,
      );
    }
    seen.add(value);
    value.forEach((v, i) => checkJsonSafe(v, `${path}[${i}]`, seen));
    seen.delete(value);
    return;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new IntermactError(
        "invalid-argument",
        `custom animation \`params${path}\` is circular.`,
      );
    }
    seen.add(value);
    for (const [k, v] of Object.entries(value)) checkJsonSafe(v, `${path}.${k}`, seen);
    seen.delete(value);
    return;
  }
  // Map / Set / Date / class instance: stringify-then-parse would not round-trip.
  throw new IntermactError(
    "invalid-argument",
    `custom animation \`params${path}\` must be a plain JSON value; got ${Object.prototype.toString.call(
      value,
    )}.`,
  );
}

/**
 * Assert that `params` is JSON round-trippable (no functions/symbols/undefined/
 * bigint/non-finite/Map/Set/Date/class instances/cycles). Custom animations must
 * survive serialize → deserialize, so non-serializable params are rejected at the
 * authoring boundary with a clear, pathed error instead of failing later in
 * `serialize` (design.md §18, §13.5.2).
 */
export function assertSerializableParams(params: unknown): void {
  checkJsonSafe(params, "", new WeakSet());
}

/**
 * Build a plugin-supplied animation (design.md §18). It is compiled by the
 * `AnimationCompiler` registered under `type` in the animations registry, so new
 * animation kinds are added without editing the core compiler. `params` must be
 * JSON-serializable (validated via {@link assertSerializableParams}) so the
 * animation survives serialize/deserialize.
 */
export function customAnimation(type: string, options: CustomAnimationOptions = {}): Animation {
  if (options.params !== undefined) assertSerializableParams(options.params);
  const spec: AnimationSpec = {
    kind: "custom",
    type,
    duration: options.duration ?? 1,
    ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
    ...(options.params !== undefined ? { params: options.params } : {}),
  };
  return toAnimation(spec);
}
