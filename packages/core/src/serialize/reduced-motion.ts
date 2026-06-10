import {
  type SerializedOp,
  type SerializedProject,
  type SerializedSpec,
  type SerializedStoryboard,
} from "./types";

/**
 * `prefers-reduced-motion` degrade (design.md §17). Accessibility guidance is to
 * present the *end state* without motion for users who opt out of animation.
 * {@link degradeForReducedMotion} returns a project whose timeline collapses to
 * zero-duration steps: every tween/create/morph/fade jumps straight to its final
 * value and all waits vanish, so `deserialize(degraded).player` shows the final
 * composed frame at `t=0` with no in-between motion.
 */

function collapseSpec(spec: SerializedSpec): SerializedSpec {
  switch (spec.kind) {
    case "tween":
    case "create":
    case "morph":
    case "tween-signal":
    case "fade":
    case "wait":
    case "custom":
      return { ...spec, duration: 0 };
    case "sequence":
      return { kind: "sequence", children: spec.children.map(collapseSpec) };
    case "parallel":
      return { kind: "parallel", children: spec.children.map(collapseSpec) };
    case "stagger":
      return { kind: "stagger", children: spec.children.map(collapseSpec), lag: 0 };
    case "repeat":
      return { kind: "repeat", child: collapseSpec(spec.child), times: spec.times };
  }
}

function collapseOp(op: SerializedOp): SerializedOp {
  switch (op.op) {
    case "play":
      return { op: "play", specs: op.specs.map(collapseSpec) };
    case "commit":
      return { op: "commit", specs: op.specs.map(collapseSpec) };
    case "wait":
      return { op: "wait", duration: 0 };
    case "marker":
      return op;
  }
}

/** Return a motion-free copy of a project (final state shown instantly). */
export function degradeForReducedMotion(project: SerializedProject): SerializedProject {
  const storyboard: SerializedStoryboard = {
    ops: project.storyboard.ops.map(collapseOp),
    duration: 0,
  };
  return { ...project, storyboard };
}
