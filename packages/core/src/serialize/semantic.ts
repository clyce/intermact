import { type Player } from "../animation/player";
import { type ObjectMetadata } from "../object/style";
import { type SerializedProject } from "./types";

/**
 * Semantic layer (design.md §17). Objects may carry {@link ObjectMetadata}
 * (label / href / a11yLabel / note). The semantic layer surfaces that metadata
 * so a host can render an accessible overlay (focusable links, screen-reader
 * labels, printable handouts) on top of the visual canvas — making animated
 * figures navigable and linkable, not just pixels.
 */

/** One accessible/linkable entry derived from an object's metadata. */
export interface SemanticEntry {
  readonly id: string;
  readonly label?: string;
  readonly href?: string;
  readonly a11yLabel?: string;
  readonly note?: string;
}

function toEntry(id: string, meta: ObjectMetadata | undefined): SemanticEntry | null {
  if (!meta) return null;
  if (!meta.label && !meta.href && !meta.a11yLabel && !meta.note) return null;
  return {
    id,
    ...(meta.label ? { label: meta.label } : {}),
    ...(meta.href ? { href: meta.href } : {}),
    ...(meta.a11yLabel ? { a11yLabel: meta.a11yLabel } : {}),
    ...(meta.note ? { note: meta.note } : {}),
  };
}

/** Build the semantic layer from a built {@link Player}'s object definitions. */
export function semanticLayerFromPlayer(player: Player): SemanticEntry[] {
  const out: SemanticEntry[] = [];
  for (const [id, object] of player.getObjects()) {
    const entry = toEntry(id, object.metadata);
    if (entry) out.push(entry);
  }
  return out;
}

/** Build the semantic layer from a {@link SerializedProject}. */
export function semanticLayerFromProject(project: SerializedProject): SemanticEntry[] {
  const out: SemanticEntry[] = [];
  for (const s of project.objects) {
    const entry = toEntry(s.id, s.metadata as ObjectMetadata | undefined);
    if (entry) out.push(entry);
  }
  return out;
}
