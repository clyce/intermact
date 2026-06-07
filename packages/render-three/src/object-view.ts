import { Group, Mesh, type MeshBasicMaterial } from "three";
import {
  cumulativeLengths,
  findTrait,
  type IMObject2D,
  type LineWidth,
  type ObjectRenderState,
  type ObjectStyle,
  type SampledContour2D,
  type SampledPath2D,
} from "@intermact/core";
import { buildStrokeGeometry } from "./stroke";
import { buildFillGeometry } from "./fill";
import { makeBasicMaterial } from "./material";

/** Context the renderer passes to object views (e.g. for px→world line width). */
export interface RenderContext {
  /** World units per device-independent pixel, for `unit: "px"` line widths. */
  readonly worldPerPixel: number;
}

const DEFAULT_LINE_WIDTH = 0.02;

function resolveLineWidth(width: LineWidth | undefined, ctx: RenderContext): number {
  if (width === undefined) return DEFAULT_LINE_WIDTH;
  if (typeof width === "number") return width;
  return width.unit === "px" ? width.value * ctx.worldPerPixel : width.value;
}

function effectiveStyle(object: IMObject2D, state: ObjectRenderState["state"]): ObjectStyle {
  return { ...object.style, ...state.styleOverrides };
}

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

  private lastRevealStart = NaN;
  private lastRevealEnd = NaN;
  private lastWidth = NaN;
  private lastGeometryVersion = -1;

  constructor(private object: IMObject2D) {}

  update(render: ObjectRenderState, ctx: RenderContext): void {
    const { state } = render;
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

    this.updateFill(style, state, geometryChanged);
    this.updateStroke(style, state, width, geometryChanged);
    this.lastGeometryVersion = state.geometryVersion;
  }

  private resolveStrokePath(state: ObjectRenderState["state"]): SampledPath2D | null {
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

  private resolveFillContours(state: ObjectRenderState["state"]): SampledContour2D[] | null {
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

  private updateFill(
    style: ObjectStyle,
    state: ObjectRenderState["state"],
    geometryChanged: boolean,
  ): void {
    const contours = this.resolveFillContours(state);
    if (!contours || !style.fill) {
      this.disposeFill();
      return;
    }
    if (!this.fillMesh || geometryChanged) {
      this.disposeFill();
      const geometry = buildFillGeometry(contours);
      const material = makeBasicMaterial(style.fill, state.opacity * state.fillProgress);
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = state.transform.zIndex;
      this.fillMesh = mesh;
      this.group.add(mesh);
    } else {
      const material = this.fillMesh.material as MeshBasicMaterial;
      const { alpha } = splitOpacity(style.fill);
      material.opacity = alpha * state.opacity * state.fillProgress;
    }
  }

  private updateStroke(
    style: ObjectStyle,
    state: ObjectRenderState["state"],
    width: number,
    geometryChanged: boolean,
  ): void {
    const path = this.resolveStrokePath(state);
    if (!path || !style.stroke) {
      this.disposeStroke();
      return;
    }
    const revealChanged =
      state.revealStart !== this.lastRevealStart || state.revealEnd !== this.lastRevealEnd;
    const widthChanged = width !== this.lastWidth;

    if (!this.strokeMesh || geometryChanged || revealChanged || widthChanged) {
      const geometry = buildStrokeGeometry(path, width, state.revealStart, state.revealEnd);
      if (this.strokeMesh) {
        this.strokeMesh.geometry.dispose();
        this.strokeMesh.geometry = geometry;
        (this.strokeMesh.material as MeshBasicMaterial).opacity =
          splitOpacity(style.stroke).alpha * state.opacity;
      } else {
        const material = makeBasicMaterial(style.stroke, state.opacity);
        const mesh = new Mesh(geometry, material);
        mesh.renderOrder = state.transform.zIndex + 0.1;
        this.strokeMesh = mesh;
        this.group.add(mesh);
      }
      this.lastRevealStart = state.revealStart;
      this.lastRevealEnd = state.revealEnd;
      this.lastWidth = width;
    } else {
      (this.strokeMesh.material as MeshBasicMaterial).opacity =
        splitOpacity(style.stroke).alpha * state.opacity;
    }
  }

  private disposeStroke(): void {
    if (!this.strokeMesh) return;
    this.group.remove(this.strokeMesh);
    this.strokeMesh.geometry.dispose();
    (this.strokeMesh.material as MeshBasicMaterial).dispose();
    this.strokeMesh = null;
  }

  private disposeFill(): void {
    if (!this.fillMesh) return;
    this.group.remove(this.fillMesh);
    this.fillMesh.geometry.dispose();
    (this.fillMesh.material as MeshBasicMaterial).dispose();
    this.fillMesh = null;
  }

  dispose(): void {
    this.disposeStroke();
    this.disposeFill();
  }
}

function splitOpacity(css: string): { alpha: number } {
  const rgba = css.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const parts = rgba[1]!.split(",");
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return { alpha: Number.isFinite(a) ? a : 1 };
  }
  return { alpha: 1 };
}
