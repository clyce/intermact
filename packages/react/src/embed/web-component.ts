import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type SerializedProject } from "@intermact/core";
import { SerializedCanvas } from "../components/SerializedCanvas";

/**
 * Web-component / iframe embed (design.md §17). {@link defineIntermactEmbed}
 * registers a custom element that mounts a serialized project — the framework
 * -agnostic distribution surface: a share-url link or `<script>` tag drops a live,
 * accessible Intermact scene into any page (or iframe) with no React on the host.
 *
 * ```html
 * <intermact-embed project="<share-url>" autoplay timeline></intermact-embed>
 * ```
 *
 * Attributes: `project` (share-url string) or `data` (inline JSON);
 * `autoplay`, `interactive`, `timeline` (boolean, presence = true);
 * `reduced-motion` (`auto`|`on`|`off`); `semantic` (`sr-only`|`visible`|`off`).
 */

function boolAttr(el: HTMLElement, name: string, fallback: boolean): boolean {
  if (!el.hasAttribute(name)) return fallback;
  const v = el.getAttribute(name);
  return v !== "false" && v !== "0";
}

function readProject(el: HTMLElement): SerializedProject | string | null {
  const data = el.getAttribute("data");
  if (data) {
    try {
      return JSON.parse(data) as SerializedProject;
    } catch {
      return null;
    }
  }
  return el.getAttribute("project");
}

class IntermactEmbedElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["project", "data", "autoplay", "interactive", "reduced-motion", "timeline", "semantic"];
  }

  private root: Root | null = null;
  private mountPoint: HTMLDivElement | null = null;

  connectedCallback(): void {
    if (!this.mountPoint) {
      this.mountPoint = document.createElement("div");
      this.mountPoint.style.width = "100%";
      this.mountPoint.style.height = "100%";
      this.style.display = this.style.display || "block";
      this.appendChild(this.mountPoint);
      this.root = createRoot(this.mountPoint);
    }
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.root) this.render();
  }

  disconnectedCallback(): void {
    this.root?.unmount();
    this.root = null;
    // Remove the mount node too, so re-connecting (move in the DOM) does not
    // append a second div and orphan the old one (design.md §17 / §13.3.3).
    if (this.mountPoint && this.mountPoint.parentNode === this) {
      this.removeChild(this.mountPoint);
    }
    this.mountPoint = null;
  }

  private render(): void {
    if (!this.root) return;
    const project = readProject(this);
    if (!project) {
      // Surface a readable message instead of a silently blank element when the
      // `project`/`data` attribute is missing or its JSON is malformed.
      this.root.render(
        createElement(
          "div",
          { style: { color: "#94a3b8", font: "13px system-ui", padding: "8px" } },
          "intermact-embed: missing or invalid `project`/`data` attribute.",
        ),
      );
      return;
    }
    const semanticAttr = this.getAttribute("semantic");
    const semantic =
      semanticAttr === "off"
        ? false
        : semanticAttr === "visible"
          ? "visible"
          : ("sr-only" as const);
    const reducedMotion = (this.getAttribute("reduced-motion") as "auto" | "on" | "off") ?? "auto";
    this.root.render(
      createElement(SerializedCanvas, {
        project,
        autoplay: boolAttr(this, "autoplay", true),
        interactive: boolAttr(this, "interactive", true),
        timeline: boolAttr(this, "timeline", false),
        reducedMotion,
        semantic,
      }),
    );
  }
}

/**
 * Register the `<intermact-embed>` custom element (idempotent). No-op outside the
 * browser. Returns the resolved tag name.
 */
export function defineIntermactEmbed(tagName = "intermact-embed"): string {
  if (typeof window === "undefined" || typeof customElements === "undefined") return tagName;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, IntermactEmbedElement);
  }
  return tagName;
}

/** Options for {@link buildEmbedIframe}. */
export interface EmbedIframeOptions {
  /** Share-url string (preferred) — passed as the `project` attribute. */
  readonly shareUrl?: string;
  /** Inline serialized JSON — passed as the `data` attribute (overrides shareUrl). */
  readonly data?: string;
  /** URL of the bundle that calls {@link defineIntermactEmbed} (script tag src). */
  readonly scriptUrl: string;
  /** Custom element tag (default `intermact-embed`). */
  readonly tagName?: string;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly autoplay?: boolean;
  readonly interactive?: boolean;
  readonly timeline?: boolean;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build a self-contained `<iframe srcdoc>` snippet that hosts a serialized scene
 * via the `<intermact-embed>` custom element (design.md §17). The `scriptUrl`
 * must point at a bundle that imports and calls {@link defineIntermactEmbed}. The
 * iframe sandboxes the scene from the host page, so a share-url drops a live,
 * isolated Intermact scene anywhere.
 */
export function buildEmbedIframe(options: EmbedIframeOptions): string {
  const tag = options.tagName ?? "intermact-embed";
  const width = options.width ?? "100%";
  const height = options.height ?? 480;
  const attrs: string[] = [];
  if (options.data) attrs.push(`data="${escapeHtmlAttr(options.data)}"`);
  else if (options.shareUrl) attrs.push(`project="${escapeHtmlAttr(options.shareUrl)}"`);
  if (options.autoplay ?? true) attrs.push("autoplay");
  if (options.interactive ?? true) attrs.push("interactive");
  if (options.timeline) attrs.push("timeline");

  const srcdoc = [
    '<!doctype html><html><head><meta charset="utf-8">',
    "<style>html,body{margin:0;height:100%;background:#0b1020}",
    `${tag}{display:block;width:100vw;height:100vh}</style></head><body>`,
    `<${tag} ${attrs.join(" ")}></${tag}>`,
    `<script type="module" src="${escapeHtmlAttr(options.scriptUrl)}"></script>`,
    "</body></html>",
  ].join("");

  const dim = (v: number | string): string => (typeof v === "number" ? `${v}` : `"${v}"`);
  return (
    `<iframe width=${dim(width)} height=${dim(height)} ` +
    `style="border:0" loading="lazy" ` +
    `srcdoc="${escapeHtmlAttr(srcdoc)}"></iframe>`
  );
}
