import { Player } from "../animation/player";
import { type AnimationSpec, type Animation, toAnimation } from "../animation/spec";
import { StoryboardBuilder, type AnimationResolver } from "../animation/storyboard";
import { globalRegistries } from "../extend/registries";
import { type Registries } from "../extend/types";
import { ReactiveEngine } from "../reactive/engine";
import { createSignalWithId } from "../reactive/signal";
import { RegisteredCamera3D } from "../scene/camera3d";
import { emptyObject3D } from "../scene/empty3d";
import { RegisteredObject3D } from "../scene/registered-object-3d";
import { IntermactError } from "../errors";
import { xyz } from "../math/vec";
import { type IMObject } from "../object/types";
import { type RuntimeState } from "../runtime/state";
import { bakeObject, rebuildObject } from "./bake";
import { bakeOp, unbakeOp } from "./timeline";
import {
  SERIALIZED_VERSION,
  type SerializedObject,
  type SerializedProject,
  type SerializeOptions,
} from "./types";

/**
 * Project serialization (design.md §17). {@link serialize} turns a `buildProgram`
 * {@link Player} into a plain-JSON {@link SerializedProject} (baked objects +
 * timeline op-log + signals + seed); {@link deserialize} reconstructs an
 * equivalent Player **without re-running the user program**. Round-tripping is
 * exact for the seekable subset of the language (everything except dropped `call`
 * side effects and degraded function easings — see {@link SerializeOptions}).
 */

/** Options for {@link deserialize}. */
export interface DeserializeOptions {
  /**
   * Extension registries for resolving `custom` animation compilers (design.md
   * §18, §22.8). Defaults to {@link globalRegistries}; pass the same bundle used
   * at build time so custom animations round-trip without process-global state.
   */
  readonly registries?: Registries;
}

/** A reconstructed program ready to play / render (design.md §17). */
export interface DeserializedProgram {
  readonly player: Player;
  readonly dimension: "2d" | "3d";
  /** Primary scene authoring props (domain/fit/background for 2D). */
  readonly sceneProps: unknown;
  readonly sceneKind: "scene-2d" | "scene-3d";
  /** Reconstructed primary 3D camera (undefined for 2D scenes). */
  readonly camera3d?: RegisteredCamera3D;
}

/**
 * Serialize a built {@link Player} into a {@link SerializedProject}. The Player
 * must have been produced by `buildProgram` (it carries the serialization
 * metadata: seed, scene descriptor, timeline op-log, signals).
 */
export function serialize(player: Player, options: SerializeOptions = {}): SerializedProject {
  const meta = player.getSerializationMeta();
  if (!meta) {
    throw new IntermactError(
      "serialization-error",
      "Player has no serialization metadata; only programs built via buildProgram are serializable.",
    );
  }
  const mode = options.mode ?? "degrade";
  const objects = player.getObjects();
  const pristine = meta.initialStates;
  const fallback = player.getInitialStates();
  const parents = player.getParents();

  const baked: SerializedObject[] = [];
  for (const [id, object] of objects) {
    const state = pristine.get(id) ?? fallback.get(id);
    if (!state) continue;
    const parentId = parents.get(id);
    baked.push(bakeObject(id, object, state, parentId));
  }

  return {
    version: SERIALIZED_VERSION,
    seed: meta.seed,
    scene: meta.scene,
    objects: baked,
    storyboard: {
      ops: meta.timeline.map((op) => bakeOp(op, mode)),
      duration: player.duration,
    },
    signals: { ...(meta.signals as Record<string, unknown>) },
    cameras: meta.cameras.map((c) => ({ ...c })),
  };
}

function fail(message: string): never {
  throw new IntermactError("serialization-error", message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const OP_KINDS = new Set(["play", "commit", "wait", "marker"]);

/**
 * Validate the structural shape of a {@link SerializedProject} before
 * reconstruction (design.md §17). Catches corrupt/hand-edited/malicious payloads
 * at the boundary with a clear `serialization-error` instead of letting a deep
 * `rebuildObject`/`unbakeOp` throw an opaque error. Checks required fields,
 * id/parent references, and op shapes — not value ranges (those degrade safely).
 */
export function validateSerializedProject(project: unknown): asserts project is SerializedProject {
  if (!isPlainObject(project)) fail("Serialized project must be an object.");
  const p = project as Record<string, unknown>;
  if (p.version !== SERIALIZED_VERSION) {
    fail(
      `Unsupported serialized version "${String(p.version)}" (expected "${SERIALIZED_VERSION}").`,
    );
  }
  if (typeof p.seed !== "number" && typeof p.seed !== "string") {
    fail("Serialized project is missing a numeric/string `seed`.");
  }
  if (!isPlainObject(p.scene) || (p.scene.kind !== "scene-2d" && p.scene.kind !== "scene-3d")) {
    fail('Serialized `scene.kind` must be "scene-2d" or "scene-3d".');
  }
  if (!Array.isArray(p.objects)) fail("Serialized `objects` must be an array.");
  const ids = new Set<string>();
  for (const o of p.objects as unknown[]) {
    if (!isPlainObject(o)) fail("Each serialized object must be an object.");
    if (typeof o.id !== "string") fail("Each serialized object needs a string `id`.");
    if (typeof o.type !== "string") fail(`Object "${o.id}" is missing a string \`type\`.`);
    if (o.dimension !== "2d" && o.dimension !== "3d") {
      fail(`Object "${String(o.id)}" has an invalid \`dimension\`.`);
    }
    if (!isPlainObject(o.geometry) || typeof (o.geometry as { kind?: unknown }).kind !== "string") {
      fail(`Object "${String(o.id)}" has invalid baked \`geometry\`.`);
    }
    if (!isPlainObject(o.initialState)) {
      fail(`Object "${String(o.id)}" is missing \`initialState\`.`);
    }
    ids.add(o.id as string);
  }
  // Parent references must resolve.
  for (const o of p.objects as Record<string, unknown>[]) {
    if (o.parentId !== undefined && !ids.has(o.parentId as string)) {
      fail(`Object "${String(o.id)}" references unknown parent "${String(o.parentId)}".`);
    }
  }
  if (!isPlainObject(p.storyboard) || !Array.isArray((p.storyboard as { ops?: unknown }).ops)) {
    fail("Serialized `storyboard.ops` must be an array.");
  }
  for (const op of (p.storyboard as { ops: unknown[] }).ops) {
    if (!isPlainObject(op) || typeof op.op !== "string" || !OP_KINDS.has(op.op)) {
      fail(`Invalid timeline op (expected play/commit/wait/marker).`);
    }
    if ((op.op === "play" || op.op === "commit") && !Array.isArray(op.specs)) {
      fail(`Timeline "${op.op}" op must carry a \`specs\` array.`);
    }
    if (op.op === "wait" && typeof op.duration !== "number") {
      fail("Timeline `wait` op must carry a numeric `duration`.");
    }
    if (op.op === "marker" && typeof op.name !== "string") {
      fail("Timeline `marker` op must carry a string `name`.");
    }
  }
  if (!isPlainObject(p.signals)) fail("Serialized `signals` must be an object.");
  if (!Array.isArray(p.cameras)) fail("Serialized `cameras` must be an array.");
}

/**
 * Reconstruct a playable {@link Player} from a {@link SerializedProject}. Replays
 * the timeline op-log on a fresh {@link StoryboardBuilder} (which re-applies the
 * same compile-time baseline patches the original build did), rebuilds the object
 * tree and signals, and assembles a Player.
 *
 * The payload is structurally validated first ({@link validateSerializedProject})
 * so corrupt input fails fast with a clear `serialization-error`.
 */
export function deserialize(
  project: SerializedProject,
  options: DeserializeOptions = {},
): DeserializedProgram {
  validateSerializedProject(project);
  const registries = options.registries ?? globalRegistries;
  const resolveAnimation: AnimationResolver = (type) => registries.animations.get(type);

  const objects = new Map<string, IMObject>();
  const initialStates = new Map<string, RuntimeState>();
  const parents = new Map<string, string>();
  for (const s of project.objects) {
    objects.set(s.id, rebuildObject(s));
    initialStates.set(s.id, JSON.parse(JSON.stringify(s.initialState)) as RuntimeState);
    if (s.parentId) parents.set(s.id, s.parentId);
  }

  const reactive = new ReactiveEngine();
  for (const [idStr, value] of Object.entries(project.signals)) {
    const sig = createSignalWithId(Number(idStr), value);
    reactive.registerSignal(sig);
  }

  const toHandle = (spec: AnimationSpec): Animation => toAnimation(spec);
  const builder = new StoryboardBuilder(initialStates, objects, resolveAnimation);
  for (const op of project.storyboard.ops) {
    const unbaked = unbakeOp(op);
    switch (unbaked.op) {
      case "play":
        builder.play(unbaked.specs.map(toHandle));
        break;
      case "commit":
        builder.commit(unbaked.specs.map(toHandle));
        break;
      case "wait":
        builder.wait(unbaked.duration);
        break;
      case "marker":
        builder.marker(unbaked.name);
        break;
    }
  }
  const storyboard = builder.build();

  const dimension: "2d" | "3d" = project.scene.kind === "scene-2d" ? "2d" : "3d";
  const player = new Player(storyboard, {
    initialStates,
    objects,
    reactive,
    parents,
  });

  const cameraMeta = project.cameras[0];
  const camera3d = cameraMeta
    ? new RegisteredCamera3D(
        new RegisteredObject3D(cameraMeta.id, emptyObject3D("camera-3d"), {}),
        {
          position: xyz(cameraMeta.position[0], cameraMeta.position[1], cameraMeta.position[2]),
          target: [cameraMeta.target[0], cameraMeta.target[1], cameraMeta.target[2]],
          fov: cameraMeta.fov,
          near: cameraMeta.near,
          far: cameraMeta.far,
          projection: cameraMeta.projection,
          zoom: cameraMeta.zoom,
        },
      )
    : undefined;

  return {
    player,
    dimension,
    sceneProps: project.scene.props,
    sceneKind: project.scene.kind,
    ...(camera3d ? { camera3d } : {}),
  };
}
