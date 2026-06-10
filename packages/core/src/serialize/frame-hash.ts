import { type Player } from "../animation/player";
import { type RenderSnapshot } from "../animation/snapshot";
import { type RuntimeState } from "../runtime/state";

/**
 * Deterministic frame hashing (design.md §17, §21). A program is deterministic
 * iff identical seeds + identical seeks yield identical runtime state. These
 * helpers hash the *serializable* portion of each frame (runtime state, not the
 * closure-bearing geometry providers) so tests can assert round-trip equality
 * and deterministic export without a GL renderer.
 */

/** Round to 6 decimals to ignore sub-ULP float drift while staying exact for our math. */
function r(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Canonical string for partial style overrides (sorted keys for stability). */
function hashStyleOverrides(overrides: Record<string, unknown> | undefined): string {
  if (!overrides) return "";
  const keys = Object.keys(overrides).sort();
  return keys.map((k) => `${k}:${String((overrides as Record<string, unknown>)[k])}`).join("|");
}

/** Canonical string for per-glyph write spans (sequential `write()` state). */
function hashGlyphSpans(spans: readonly { start: number; end: number }[] | undefined): string {
  if (!spans || spans.length === 0) return "";
  return spans.map((s) => `${r(s.start)}-${r(s.end)}`).join("|");
}

/** Canonical string for a single runtime state. */
export function hashRuntimeState(state: RuntimeState): string {
  if (state.dimension === "2d") {
    const t = state.transform;
    return [
      "2d",
      state.visible ? 1 : 0,
      r(state.opacity),
      r(t.position[0]),
      r(t.position[1]),
      r(t.rotation),
      r(t.scale[0]),
      r(t.scale[1]),
      t.zIndex,
      r(state.revealStart),
      r(state.revealEnd),
      r(state.fillProgress),
      state.geometryVersion,
      // Style animations + sequential text write must affect the frame hash so
      // their round-trip / determinism is covered (design.md §17, §13.3.2).
      hashStyleOverrides(state.styleOverrides as Record<string, unknown> | undefined),
      hashGlyphSpans(state.glyphWriteSpans),
    ].join(",");
  }
  const t = state.transform;
  return [
    "3d",
    state.visible ? 1 : 0,
    r(state.opacity),
    r(t.position[0]),
    r(t.position[1]),
    r(t.position[2]),
    r(t.rotation[0]),
    r(t.rotation[1]),
    r(t.rotation[2]),
    r(t.rotation[3]),
    r(t.scale[0]),
    r(t.scale[1]),
    r(t.scale[2]),
    t.renderOrder,
    r(state.revealStart),
    r(state.revealEnd),
    state.geometryVersion,
  ].join(",");
}

/** FNV-1a 32-bit hash → 8-char hex (compact, dependency-free). */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable hash of a whole snapshot (object ids sorted; per-object state hashed). */
export function hashSnapshot(snapshot: RenderSnapshot): string {
  const ids = [...snapshot.objects.keys()].sort();
  const parts: string[] = [];
  for (const id of ids) {
    const entry = snapshot.objects.get(id)!;
    parts.push(`${id}=${hashRuntimeState(entry.state)}`);
  }
  return fnv1a(parts.join(";"));
}

/** Options controlling fixed-fps frame sampling. */
export interface FrameSampleOptions {
  /** Frames per second (default 30). */
  readonly fps?: number;
  /** Total seconds to sample (default: the player's duration). */
  readonly duration?: number;
}

/** Deterministic fixed-fps seek times (seconds), inclusive of the final frame. */
export function frameTimes(player: Player, options: FrameSampleOptions = {}): number[] {
  const fps = options.fps ?? 30;
  const duration = options.duration ?? player.duration;
  const total = Math.max(0, Math.round(duration * fps));
  const times: number[] = [];
  for (let i = 0; i <= total; i++) times.push(i / fps);
  return times;
}

/** Sample a player at fixed fps and return the per-frame snapshots (seek-based). */
export function sampleFrames(player: Player, options: FrameSampleOptions = {}): RenderSnapshot[] {
  return frameTimes(player, options).map((t) => {
    player.seek(t);
    return player.getSnapshot();
  });
}

/** Sample a player at fixed fps and return per-frame snapshot hashes. */
export function sampleFrameHashes(player: Player, options: FrameSampleOptions = {}): string[] {
  return frameTimes(player, options).map((t) => {
    player.seek(t);
    return hashSnapshot(player.getSnapshot());
  });
}
