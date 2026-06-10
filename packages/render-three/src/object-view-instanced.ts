import {
  type BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  type MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  cumulativeLengths,
  findTrait,
  type GeometryOverride,
  type IMObject2D,
  type InstancedTrait,
  type ObjectRenderState,
  type ObjectStyle,
  type RuntimeState2D,
  type SampledContour2D,
  type SampledPath2D,
} from "@intermact/core";
import { buildFillGeometry } from "./fill";
import { buildStrokeGeometry } from "./stroke";
import { parseColor } from "./color";
import { makeBasicMaterial } from "./material";
import { type RenderContext, effectiveStyle, resolveLineWidth } from "./object-view-utils";

const Z_AXIS = new Vector3(0, 0, 1);

/** Lift a runtime {@link GeometryOverride} into sampled contours for re-building. */
function overrideContours(override: GeometryOverride): SampledContour2D[] {
  return override.contours.map((c) => ({
    points: c.points,
    closed: c.closed,
    cumulativeLength: cumulativeLengths(c.points, c.closed).cumulative,
  }));
}

/**
 * Renders an {@link InstancedTrait} object via real GPU instancing (design.md
 * §15.2 #3). A single base fill/stroke geometry is uploaded once and drawn N
 * times through three.js {@link InstancedMesh}; per-instance transforms become
 * instance matrices. This replaces the M13 fallback that baked every instance
 * into one giant buffer. The instanced object can still be transformed/faded as
 * a whole — that lives on the parent {@link Group}.
 */
export class InstancedObjectView {
  readonly group = new Group();
  private fillMesh: InstancedMesh | null = null;
  private strokeMesh: InstancedMesh | null = null;
  private lastGeometryVersion = -1;
  private lastFillColor = "";
  private lastStrokeColor = "";

  constructor(private object: IMObject2D) {}

  /** Number of instances drawn by the most recent fill/stroke mesh (for tests/inspection). */
  get instanceCount(): number {
    return (this.fillMesh ?? this.strokeMesh)?.count ?? 0;
  }

  update(render: ObjectRenderState, ctx: RenderContext): void {
    const state = render.state as RuntimeState2D;
    this.object = render.object as IMObject2D;
    const trait = findTrait(this.object.traits, "instanced");
    const g = this.group;
    g.visible = state.visible;
    g.position.set(state.transform.position[0], state.transform.position[1], 0);
    g.rotation.z = state.transform.rotation;
    g.scale.set(state.transform.scale[0], state.transform.scale[1], 1);
    g.renderOrder = state.transform.zIndex;

    if (!trait || trait.instances.length === 0) {
      this.dispose();
      return;
    }

    const style = effectiveStyle(this.object, state);
    const geometryChanged = state.geometryVersion !== this.lastGeometryVersion;
    // A morph in flight replaces the base geometry that gets instanced, so the
    // override contours (not the static trait base) drive the per-instance mesh.
    const override = state.geometryOverride ?? null;
    const baseFill: readonly SampledContour2D[] | undefined = override
      ? overrideContours(override)
      : trait.baseFill;
    const baseStroke: SampledPath2D | undefined = override
      ? { contours: overrideContours(override), totalLength: 0 }
      : trait.baseStroke;
    this.updateFill(trait, baseFill, style, state, geometryChanged);
    this.updateStroke(trait, baseStroke, style, state, ctx, geometryChanged);
    this.lastGeometryVersion = state.geometryVersion;
  }

  private updateFill(
    trait: InstancedTrait,
    baseFill: readonly SampledContour2D[] | undefined,
    style: ObjectStyle,
    state: RuntimeState2D,
    geometryChanged: boolean,
  ): void {
    if (!baseFill || !style.fill) {
      this.disposeFill();
      return;
    }
    if (!this.fillMesh || geometryChanged) {
      this.disposeFill();
      const geometry = buildFillGeometry(baseFill);
      const material = makeBasicMaterial(style.fill, state.opacity * state.fillProgress);
      this.fillMesh = this.makeInstanced(geometry, material, trait, state.transform.zIndex);
      this.lastFillColor = style.fill;
      this.group.add(this.fillMesh);
    } else {
      const material = this.fillMesh.material as MeshBasicMaterial;
      const { color, alpha } = parseColor(style.fill);
      if (style.fill !== this.lastFillColor) {
        material.color.copy(color);
        this.lastFillColor = style.fill;
      }
      material.opacity = alpha * state.opacity * state.fillProgress;
    }
    this.fillMesh.renderOrder = state.transform.zIndex;
  }

  private updateStroke(
    trait: InstancedTrait,
    baseStroke: SampledPath2D | undefined,
    style: ObjectStyle,
    state: RuntimeState2D,
    ctx: RenderContext,
    geometryChanged: boolean,
  ): void {
    if (!baseStroke || !style.stroke) {
      this.disposeStroke();
      return;
    }
    if (!this.strokeMesh || geometryChanged) {
      this.disposeStroke();
      const width = resolveLineWidth(this.object.style?.lineWidth, ctx);
      const geometry = buildStrokeGeometry(baseStroke, width);
      const material = makeBasicMaterial(style.stroke, state.opacity);
      this.strokeMesh = this.makeInstanced(geometry, material, trait, state.transform.zIndex + 0.1);
      this.lastStrokeColor = style.stroke;
      this.group.add(this.strokeMesh);
    } else {
      const material = this.strokeMesh.material as MeshBasicMaterial;
      const { color, alpha } = parseColor(style.stroke);
      if (style.stroke !== this.lastStrokeColor) {
        material.color.copy(color);
        this.lastStrokeColor = style.stroke;
      }
      material.opacity = alpha * state.opacity;
    }
    this.strokeMesh.renderOrder = state.transform.zIndex + 0.1;
  }

  private makeInstanced(
    geometry: BufferGeometry,
    material: MeshBasicMaterial,
    trait: InstancedTrait,
    renderOrder: number,
  ): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, trait.instances.length);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    trait.instances.forEach((inst, i) => {
      position.set(inst.position[0], inst.position[1], 0);
      quaternion.setFromAxisAngle(Z_AXIS, inst.rotation);
      scale.set(inst.scale[0], inst.scale[1], 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = renderOrder;
    // The base geometry is centered near the origin, but instances scatter it
    // across the scene. three.js computes the bounding sphere from the base
    // geometry alone, so per-instance frustum culling would wrongly drop the
    // whole mesh as the camera pans. Disable it and let the scene-level group
    // visibility govern drawing.
    mesh.frustumCulled = false;
    return mesh;
  }

  private disposeFill(): void {
    if (!this.fillMesh) return;
    this.group.remove(this.fillMesh);
    this.fillMesh.geometry.dispose();
    (this.fillMesh.material as MeshBasicMaterial).dispose();
    this.fillMesh.dispose();
    this.fillMesh = null;
  }

  private disposeStroke(): void {
    if (!this.strokeMesh) return;
    this.group.remove(this.strokeMesh);
    this.strokeMesh.geometry.dispose();
    (this.strokeMesh.material as MeshBasicMaterial).dispose();
    this.strokeMesh.dispose();
    this.strokeMesh = null;
  }

  dispose(): void {
    this.disposeFill();
    this.disposeStroke();
  }
}
