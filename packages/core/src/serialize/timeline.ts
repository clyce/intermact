import { type Easing, type EasingName } from "../animation/easing";
import { type AnimationSpec, type PropertyPath } from "../animation/spec";
import { type TimelineOp } from "../animation/storyboard";
import { IntermactError } from "../errors";
import { createInitialState2D } from "../runtime/state";
import { bakeObjectDef, rebuildObject } from "./bake";
import {
  type SerializedObject,
  type SerializedOp,
  type SerializedPropertyPath,
  type SerializedSpec,
} from "./types";
import { type IMObject2D } from "../object/types";

/**
 * Timeline op-log ↔ serialized form (design.md §17). The {@link StoryboardBuilder}
 * records every build-pass operation as {@link AnimationSpec} data; here we strip
 * the non-serializable members so the timeline survives a JSON round-trip and the
 * Phase-1 serialization debts are resolved:
 *
 * - **Easing**: function easings degrade to `linear` (or throw in `strict` mode);
 *   named easings pass through and re-resolve via the registry on the other side.
 * - **`morph.toObject`**: the embedded definition is baked into geometry.
 * - **`morph.matchBy`**: a custom key function is dropped; matching falls back to
 *   `part.key` (the default).
 * - **`call`**: non-seekable side effects are dropped (`degrade`) or rejected
 *   (`strict`) — they cannot be reconstructed from data.
 */

function bakeEasing(
  easing: Easing | undefined,
  mode: "degrade" | "strict",
): EasingName | undefined {
  if (easing === undefined) return undefined;
  if (typeof easing === "string") return easing;
  if (mode === "strict") {
    throw new IntermactError(
      "serialization-error",
      "Cannot serialize a function easing; use a named easing or serialize with mode:'degrade'.",
    );
  }
  return undefined;
}

function bakeProperty(property: PropertyPath): SerializedPropertyPath {
  return property as SerializedPropertyPath;
}

/** Spread helper: `{ easing }` when a serializable easing survives, else `{}`. */
function easingProp(
  easing: Easing | undefined,
  mode: "degrade" | "strict",
): { easing?: EasingName } {
  const name = bakeEasing(easing, mode);
  return name ? { easing: name } : {};
}

/**
 * Bake one spec into its serializable form. Returns `null` when the spec is a
 * non-serializable side effect that must be dropped (e.g. `call` in degrade mode).
 */
export function bakeSpec(spec: AnimationSpec, mode: "degrade" | "strict"): SerializedSpec | null {
  switch (spec.kind) {
    case "tween":
      return {
        kind: "tween",
        targetId: spec.targetId,
        property: bakeProperty(spec.property),
        ...(spec.from !== undefined ? { from: spec.from } : {}),
        to: spec.to,
        duration: spec.duration,
        ...easingProp(spec.easing, mode),
      };
    case "create":
      return {
        kind: "create",
        targetId: spec.targetId,
        duration: spec.duration,
        ...(spec.stroke ? { stroke: spec.stroke } : {}),
        ...(spec.fill ? { fill: spec.fill } : {}),
        ...easingProp(spec.easing, mode),
      };
    case "morph":
      return {
        kind: "morph",
        targetId: spec.targetId,
        toObject: {
          id: `${spec.targetId}:morph-target`,
          ...bakeObjectDef(spec.toObject),
          initialState: createInitialState2D(),
        } as SerializedObject,
        strategy: spec.strategy,
        duration: spec.duration,
        ...easingProp(spec.easing, mode),
        ...(spec.sampleCount !== undefined ? { sampleCount: spec.sampleCount } : {}),
        ...(spec.preserveStyle !== undefined ? { preserveStyle: spec.preserveStyle } : {}),
      };
    case "tween-signal":
      return {
        kind: "tween-signal",
        signalId: spec.signalId,
        from: spec.from,
        to: spec.to,
        duration: spec.duration,
        ...easingProp(spec.easing, mode),
      };
    case "fade":
      return {
        kind: "fade",
        targetId: spec.targetId,
        ...(spec.from !== undefined ? { from: spec.from } : {}),
        to: spec.to,
        duration: spec.duration,
        ...easingProp(spec.easing, mode),
      };
    case "wait":
      return { kind: "wait", duration: spec.duration };
    case "custom":
      return {
        kind: "custom",
        type: spec.type,
        ...(spec.targetId !== undefined ? { targetId: spec.targetId } : {}),
        ...(spec.params !== undefined ? { params: spec.params } : {}),
        duration: spec.duration,
      };
    case "sequence":
      return { kind: "sequence", children: bakeChildren(spec.children, mode) };
    case "parallel":
      return { kind: "parallel", children: bakeChildren(spec.children, mode) };
    case "stagger":
      return { kind: "stagger", children: bakeChildren(spec.children, mode), lag: spec.lag };
    case "repeat": {
      const child = bakeSpec(spec.child, mode);
      if (!child) return null;
      return { kind: "repeat", child, times: spec.times };
    }
    case "call":
      if (mode === "strict") {
        throw new IntermactError(
          "serialization-error",
          "Cannot serialize a `call` side effect; remove it or serialize with mode:'degrade'.",
        );
      }
      return null;
  }
}

function bakeChildren(
  children: readonly AnimationSpec[],
  mode: "degrade" | "strict",
): SerializedSpec[] {
  return children.map((c) => bakeSpec(c, mode)).filter((c): c is SerializedSpec => c !== null);
}

/** Bake a build-pass {@link TimelineOp} into its serializable form. */
export function bakeOp(op: TimelineOp, mode: "degrade" | "strict"): SerializedOp {
  switch (op.op) {
    case "play":
      return {
        op: "play",
        specs: op.specs
          .map((s) => bakeSpec(s, mode))
          .filter((s): s is SerializedSpec => s !== null),
      };
    case "commit":
      return {
        op: "commit",
        specs: op.specs
          .map((s) => bakeSpec(s, mode))
          .filter((s): s is SerializedSpec => s !== null),
      };
    case "wait":
      return { op: "wait", duration: op.duration };
    case "marker":
      return { op: "marker", name: op.name };
  }
}

/** Rebuild an {@link AnimationSpec} from its serialized form. */
export function unbakeSpec(spec: SerializedSpec): AnimationSpec {
  switch (spec.kind) {
    case "tween":
      return {
        kind: "tween",
        targetId: spec.targetId,
        property: spec.property as PropertyPath,
        ...(spec.from !== undefined ? { from: spec.from } : {}),
        to: spec.to,
        duration: spec.duration,
        ...(spec.easing ? { easing: spec.easing } : {}),
      };
    case "create":
      return {
        kind: "create",
        targetId: spec.targetId,
        duration: spec.duration,
        ...(spec.stroke ? { stroke: spec.stroke } : {}),
        ...(spec.fill ? { fill: spec.fill } : {}),
        ...(spec.easing ? { easing: spec.easing } : {}),
      };
    case "morph":
      return {
        kind: "morph",
        targetId: spec.targetId,
        toObject: rebuildObject(spec.toObject) as IMObject2D,
        strategy: spec.strategy,
        duration: spec.duration,
        ...(spec.easing ? { easing: spec.easing } : {}),
        ...(spec.sampleCount !== undefined ? { sampleCount: spec.sampleCount } : {}),
        ...(spec.preserveStyle !== undefined ? { preserveStyle: spec.preserveStyle } : {}),
      };
    case "tween-signal":
      return {
        kind: "tween-signal",
        signalId: spec.signalId,
        from: spec.from,
        to: spec.to,
        duration: spec.duration,
        ...(spec.easing ? { easing: spec.easing } : {}),
      };
    case "fade":
      return {
        kind: "fade",
        targetId: spec.targetId,
        ...(spec.from !== undefined ? { from: spec.from } : {}),
        to: spec.to,
        duration: spec.duration,
        ...(spec.easing ? { easing: spec.easing } : {}),
      };
    case "wait":
      return { kind: "wait", duration: spec.duration };
    case "custom":
      return {
        kind: "custom",
        type: spec.type,
        ...(spec.targetId !== undefined ? { targetId: spec.targetId } : {}),
        ...(spec.params !== undefined ? { params: spec.params } : {}),
        duration: spec.duration,
      };
    case "sequence":
      return { kind: "sequence", children: spec.children.map(unbakeSpec) };
    case "parallel":
      return { kind: "parallel", children: spec.children.map(unbakeSpec) };
    case "stagger":
      return { kind: "stagger", children: spec.children.map(unbakeSpec), lag: spec.lag };
    case "repeat":
      return { kind: "repeat", child: unbakeSpec(spec.child), times: spec.times };
  }
}

/** Rebuild a {@link TimelineOp} from its serialized form. */
export function unbakeOp(op: SerializedOp): TimelineOp {
  switch (op.op) {
    case "play":
      return { op: "play", specs: op.specs.map(unbakeSpec) };
    case "commit":
      return { op: "commit", specs: op.specs.map(unbakeSpec) };
    case "wait":
      return { op: "wait", duration: op.duration };
    case "marker":
      return { op: "marker", name: op.name };
  }
}
