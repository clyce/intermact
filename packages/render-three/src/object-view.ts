import { Group, Mesh, type MeshBasicMaterial } from "three";
import {
  cumulativeLengths,
  findTrait,
  GLYPH_WRITE_COMPLETE_EPS,
  glyphLocalFill,
  isGlyphWriteComplete,
  type IMObject2D,
  type ObjectRenderState,
  type ObjectStyle,
  type RuntimeState2D,
  type SampledContour2D,
  type SampledPath2D,
} from "@intermact/core";
import { buildStrokeGeometry } from "./stroke";
import { buildFillGeometry } from "./fill";
import { parseColor } from "./color";
import { makeBasicMaterial } from "./material";
import { type RenderContext, effectiveStyle, resolveLineWidth } from "./object-view-utils";

export { type RenderContext };

/**
 * Holds the three.js objects for one Intermact object and updates them from a
 * RuntimeState diff (design.md §15.2): transform/opacity every frame, stroke
 * geometry when reveal/width/geometryVersion changes, fill geometry when
 * geometryVersion changes.
 */
export class ThreeObjectView {
  readonly group = new Group();
  private strokeMesh: Mesh | null = null;
  private fillMesh: Mesh | null = null;
  private fillGroupMeshes: Mesh[] = [];
  private underlayMesh: Mesh | null = null;

  private lastRevealStart = NaN;
  private lastRevealEnd = NaN;
  private lastWidth = NaN;
  private lastGeometryVersion = -1;
  private lastStrokeColor = "";
  private lastFillColor = "";
  private lastUnderlayColor = "";

  constructor(private object: IMObject2D) {}

  update(render: ObjectRenderState, ctx: RenderContext): void {
    const state = render.state as RuntimeState2D;
    this.object = render.object as IMObject2D;
    const g = this.group;
    g.visible = state.visible;
    g.position.set(state.transform.position[0], state.transform.position[1], 0);
    g.rotation.z = state.transform.rotation;
    g.scale.set(state.transform.scale[0], state.transform.scale[1], 1);
    g.renderOrder = state.transform.zIndex;

    const style = effectiveStyle(this.object, state);
    const width = resolveLineWidth(style.lineWidth, ctx);
    const geometryChanged = state.geometryVersion !== this.lastGeometryVersion;

    this.updateUnderlayFill(style, state, geometryChanged);
    this.updateFill(style, state, geometryChanged);
    this.updateStroke(style, state, width, geometryChanged);
    if (this.underlayMesh) this.underlayMesh.renderOrder = state.transform.zIndex - 0.05;
    if (this.fillMesh) this.fillMesh.renderOrder = state.transform.zIndex;
    if (this.strokeMesh) this.strokeMesh.renderOrder = state.transform.zIndex + 0.1;
    this.lastGeometryVersion = state.geometryVersion;
  }

  private resolveStrokePath(state: RuntimeState2D): SampledPath2D | null {
    const stroke = findTrait(this.object.traits, "stroke");
    if (state.geometryOverride) {
      const contours: SampledContour2D[] = state.geometryOverride.contours.map((c) => {
        const cumulative = cumulativeLengths(c.points, c.closed).cumulative;
        return { points: c.points, closed: c.closed, cumulativeLength: cumulative };
      });
      const totalLength = contours.reduce(
        (sum, c) => sum + cumulativeLengths(c.points, c.closed).total,
        0,
      );
      return { contours, totalLength };
    }
    return stroke?.samplePath() ?? null;
  }

  private resolveFillContours(state: RuntimeState2D): SampledContour2D[] | null {
    const fill = findTrait(this.object.traits, "fill");
    if (state.geometryOverride) {
      return state.geometryOverride.contours.map((c) => {
        const cumulative = cumulativeLengths(c.points, c.closed).cumulative;
        return { points: c.points, closed: c.closed, cumulativeLength: cumulative };
      });
    }
    const raw = fill?.contours();
    return raw ? [...raw] : null;
  }

  private resolveUnderlayContours(state: RuntimeState2D): SampledContour2D[] | null {
    if (state.geometryOverride) return null;
    const path = this.object.geometry.sampleUnderlayPath?.() ?? null;
    return path ? [...path.contours] : null;
  }

  private updateUnderlayFill(
    style: ObjectStyle,
    state: RuntimeState2D,
    geometryChanged: boolean,
  ): void {
    const contours = this.resolveUnderlayContours(state);
    if (!contours || !style.underlayFill) {
      this.disposeUnderlayFill();
      return;
    }
    const alpha = state.opacity * state.fillProgress;
    if (!this.underlayMesh || geometryChanged) {
      this.disposeUnderlayFill();
      const geometry = buildFillGeometry(contours);
      const material = makeBasicMaterial(style.underlayFill, alpha);
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = state.transform.zIndex - 0.05;
      this.underlayMesh = mesh;
      this.group.add(mesh);
      this.lastUnderlayColor = style.underlayFill;
    } else {
      const material = this.underlayMesh.material as MeshBasicMaterial;
      const { color, alpha: parsedAlpha } = parseColor(style.underlayFill);
      if (style.underlayFill !== this.lastUnderlayColor) {
        material.color.copy(color);
        this.lastUnderlayColor = style.underlayFill;
      }
      material.opacity = parsedAlpha * alpha;
    }
  }

  private updateFill(style: ObjectStyle, state: RuntimeState2D, geometryChanged: boolean): void {
    const fill = findTrait(this.object.traits, "fill");
    const groups = state.geometryOverride ? null : (fill?.fillGroups?.() ?? null);
    const contours = this.resolveFillContours(state);
    if (!contours || !style.fill) {
      this.disposeFill();
      return;
    }

    // Per-group colors (heatmap / colored cells, design.md §6.2): one mesh per
    // group, each with its own color. Takes precedence over a single fill mesh.
    const groupColors = state.geometryOverride ? null : (fill?.fillGroupColors?.() ?? null);
    if (groups && groups.length > 0 && groupColors && groupColors.length === groups.length) {
      this.updateColoredFillGroups(groups, groupColors, state, geometryChanged);
      return;
    }

    const spans = state.glyphWriteSpans;
    const fillOverlap = 0.2;
    const writeComplete = isGlyphWriteComplete(state.revealEnd, state.fillProgress, spans);

    // Keep per-glyph fill groups for the whole write so completed lines do not
    // flash/disappear when switching to a merged mesh at writeComplete.
    if (groups && groups.length > 0 && spans?.length) {
      this.disposeFillMesh();
      while (this.fillGroupMeshes.length < groups.length) {
        const mesh = new Mesh(undefined, makeBasicMaterial(style.fill, 1));
        mesh.renderOrder = state.transform.zIndex;
        this.fillGroupMeshes.push(mesh);
        this.group.add(mesh);
      }
      while (this.fillGroupMeshes.length > groups.length) {
        const mesh = this.fillGroupMeshes.pop()!;
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
      }
      groups.forEach((group, gi) => {
        const mesh = this.fillGroupMeshes[gi]!;
        const localFill = writeComplete
          ? 1
          : glyphLocalFill(state.fillProgress, spans[gi] ?? { start: 0, end: 1 }, fillOverlap);
        if (!mesh.geometry || geometryChanged) {
          mesh.geometry?.dispose();
          mesh.geometry = buildFillGeometry(group, [group]);
        }
        const material = mesh.material as MeshBasicMaterial;
        const { color, alpha } = parseColor(style.fill);
        if (style.fill !== this.lastFillColor) material.color.copy(color);
        material.opacity = alpha * state.opacity * localFill;
        mesh.visible = localFill > 0.001;
      });
      this.lastFillColor = style.fill;
      return;
    }

    this.disposeFillGroupMeshes();
    if (!this.fillMesh || geometryChanged) {
      this.disposeFillMesh();
      const geometry = buildFillGeometry(contours, groups ?? undefined);
      const material = makeBasicMaterial(style.fill, state.opacity * state.fillProgress);
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = state.transform.zIndex;
      this.fillMesh = mesh;
      this.group.add(mesh);
    } else {
      const material = this.fillMesh.material as MeshBasicMaterial;
      const { color, alpha } = parseColor(style.fill);
      if (style.fill !== this.lastFillColor) {
        material.color.copy(color);
        this.lastFillColor = style.fill;
      }
      material.opacity = alpha * state.opacity * state.fillProgress;
    }
  }

  /**
   * Stroke color for rendering. Explicit `style.stroke` always wins. When a glyph
   * is fill-only, Manim-style `write()` / Create still needs a
   * visible outline during the reveal phase (DrawBorderThenFill) — borrow the
   * fill color until both reveal and fill are complete.
   */
  private resolveStrokeColor(style: ObjectStyle, state: RuntimeState2D): string | undefined {
    if (style.stroke) return style.stroke;
    const writeComplete = isGlyphWriteComplete(
      state.revealEnd,
      state.fillProgress,
      state.glyphWriteSpans,
    );
    const revealing =
      !writeComplete &&
      (state.revealEnd < 1 - GLYPH_WRITE_COMPLETE_EPS ||
        state.fillProgress < 1 - GLYPH_WRITE_COMPLETE_EPS);
    if (!revealing) return undefined;
    if (style.underlayFill) return style.underlayFill;
    if (style.fill) return style.fill;
    return undefined;
  }

  private updateStroke(
    style: ObjectStyle,
    state: RuntimeState2D,
    width: number,
    geometryChanged: boolean,
  ): void {
    const path = this.resolveStrokePath(state);
    const strokeColor = this.resolveStrokeColor(style, state);
    if (!path || !strokeColor) {
      this.disposeStroke();
      return;
    }
    const revealChanged =
      state.revealStart !== this.lastRevealStart || state.revealEnd !== this.lastRevealEnd;
    const widthChanged = width !== this.lastWidth;

    const fillTrait = findTrait(this.object.traits, "fill");
    const layout = findTrait(this.object.traits, "text-layout");
    const writeComplete = isGlyphWriteComplete(
      state.revealEnd,
      state.fillProgress,
      state.glyphWriteSpans,
    );
    const axesLayout = findTrait(this.object.traits, "axes-layout");
    const contourGlyphIndex =
      layout?.contourGlyphIndex() ??
      axesLayout?.contourGroupIndex() ??
      fillTrait?.contourGlyphIndex?.() ??
      undefined;
    const revealMode = state.strokeRevealMode ?? "path-order";
    const revealOpts =
      !writeComplete && state.glyphWriteSpans?.length && contourGlyphIndex?.length
        ? {
            contourGlyphIndex,
            glyphWriteSpans: state.glyphWriteSpans,
            mode: revealMode,
          }
        : { mode: revealMode };

    if (!this.strokeMesh || geometryChanged || revealChanged || widthChanged) {
      const geometry = buildStrokeGeometry(
        path,
        width,
        state.revealStart,
        state.revealEnd,
        revealOpts,
      );
      if (this.strokeMesh) {
        this.strokeMesh.geometry.dispose();
        this.strokeMesh.geometry = geometry;
        const { color, alpha } = parseColor(strokeColor);
        const material = this.strokeMesh.material as MeshBasicMaterial;
        material.color.copy(color);
        material.opacity = alpha * state.opacity;
        this.lastStrokeColor = strokeColor;
      } else {
        const material = makeBasicMaterial(strokeColor, state.opacity);
        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = state.transform.zIndex + 0.1;
        this.strokeMesh = mesh;
        this.group.add(mesh);
      }
      this.lastRevealStart = state.revealStart;
      this.lastRevealEnd = state.revealEnd;
      this.lastWidth = width;
    } else {
      const material = this.strokeMesh.material as MeshBasicMaterial;
      const { color, alpha } = parseColor(strokeColor);
      if (strokeColor !== this.lastStrokeColor) {
        material.color.copy(color);
        this.lastStrokeColor = strokeColor;
      }
      material.opacity = alpha * state.opacity;
    }
  }

  /** Render one mesh per fill group, each filled with its own color. */
  private updateColoredFillGroups(
    groups: readonly (readonly SampledContour2D[])[],
    colors: readonly string[],
    state: RuntimeState2D,
    geometryChanged: boolean,
  ): void {
    this.disposeFillMesh();
    while (this.fillGroupMeshes.length < groups.length) {
      const mesh = new Mesh(undefined, makeBasicMaterial("#000000", 1));
      mesh.renderOrder = state.transform.zIndex;
      this.fillGroupMeshes.push(mesh);
      this.group.add(mesh);
    }
    while (this.fillGroupMeshes.length > groups.length) {
      const mesh = this.fillGroupMeshes.pop()!;
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    groups.forEach((group, gi) => {
      const mesh = this.fillGroupMeshes[gi]!;
      if (!mesh.geometry || geometryChanged) {
        mesh.geometry?.dispose();
        mesh.geometry = buildFillGeometry([...group], [[...group]]);
      }
      const material = mesh.material as MeshBasicMaterial;
      const { color, alpha } = parseColor(colors[gi] ?? "#000000");
      material.color.copy(color);
      material.opacity = alpha * state.opacity * state.fillProgress;
      mesh.renderOrder = state.transform.zIndex;
      mesh.visible = material.opacity > 0.001;
    });
  }

  private disposeStroke(): void {
    if (!this.strokeMesh) return;
    this.group.remove(this.strokeMesh);
    this.strokeMesh.geometry.dispose();
    (this.strokeMesh.material as MeshBasicMaterial).dispose();
    this.strokeMesh = null;
  }

  private disposeFillMesh(): void {
    if (!this.fillMesh) return;
    this.group.remove(this.fillMesh);
    this.fillMesh.geometry.dispose();
    (this.fillMesh.material as MeshBasicMaterial).dispose();
    this.fillMesh = null;
  }

  private disposeFillGroupMeshes(): void {
    for (const mesh of this.fillGroupMeshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.fillGroupMeshes = [];
  }

  private disposeFill(): void {
    this.disposeFillMesh();
    this.disposeFillGroupMeshes();
  }

  private disposeUnderlayFill(): void {
    if (!this.underlayMesh) return;
    this.group.remove(this.underlayMesh);
    this.underlayMesh.geometry.dispose();
    (this.underlayMesh.material as MeshBasicMaterial).dispose();
    this.underlayMesh = null;
  }

  dispose(): void {
    this.disposeStroke();
    this.disposeUnderlayFill();
    this.disposeFill();
  }
}
