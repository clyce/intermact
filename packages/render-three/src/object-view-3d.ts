import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Points,
  PointsMaterial,
} from "three";
import {
  findTrait,
  glyphLocalReveal,
  type GeometryProvider3D,
  type IMObject3D,
  type ObjectRenderState,
  type RuntimeState3D,
} from "@intermact/core";
import { type RenderContext } from "./object-view";

/**
 * Map a scalar in [0,1] to an RGB cool→warm ramp (blue → cyan → yellow → red).
 * Used for point-cloud scalar coloring (design.md §6.2 / §16 point clouds).
 */
function rampColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  // Piecewise-linear "turbo-lite" ramp; smooth enough for per-point coloring.
  const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 3)));
  const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 2)));
  const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * x - 1)));
  return [r, g, b];
}

/**
 * Renders one 3D Intermact object (design.md §15.2, §10) into three.js objects
 * and updates them from a {@link RuntimeState3D} diff: transform (position +
 * quaternion + scale), opacity, and `Create` reveal. The provider's
 * {@link GeometryProvider3D.kind} selects line / mesh / points.
 *
 * - **Lines** reveal by **arc length** (honoring `revealStart`/`revealEnd`),
 *   using each segment's cumulative length so motion is uniform regardless of
 *   sample density.
 * - Geometry is **hot-rebuilt** when `geometryVersion` bumps (reactive recompute
 *   / `replaceObject`), mirroring the 2D view.
 * - Point clouds with per-point scalars are colored via a {@link rampColor} ramp.
 *
 * Framework-free: R3F hosts `group` and calls {@link update} per frame.
 */
export class ThreeObject3DView {
  readonly group = new Group();
  private primitive: LineSegments | Mesh | Points | null = null;
  private geometry: BufferGeometry | null = null;
  private material: LineBasicMaterial | MeshStandardMaterial | PointsMaterial | null = null;
  private revealOffset = -1;
  private revealCount = -1;
  private kind: GeometryProvider3D["kind"];
  private vertexCount = 0;
  private indexCount = 0;
  /** Cumulative arc length at the END of each emitted line segment. */
  private segCumEnd: number[] = [];
  /** Axes-layout group index per segment (sequential `create()` reveal). */
  private segGroupIndex: number[] = [];
  /** Segment arc interval within its layout group. */
  private segStartInGroup: number[] = [];
  private segEndInGroup: number[] = [];
  /** Total arc length per layout group. */
  private groupLengths: number[] = [];
  private totalLength = 0;
  /** Last applied geometry version, for hot-rebuild detection. */
  private geometryVersion = -1;

  constructor(private object: IMObject3D) {
    this.kind = object.geometry.kind;
    this.build();
  }

  private resolveColor(): string {
    const style = this.object.style;
    return style?.color ?? style?.stroke ?? style?.fill ?? "#38bdf8";
  }

  private buildLines(geom: GeometryProvider3D, color: string): void {
    const lines = geom.sampleLines?.() ?? [];
    const axesLayout = findTrait(this.object.traits, "axes-layout");
    const lineGroups = axesLayout?.contourGroupIndex() ?? [];
    // Emit each polyline as consecutive point pairs so a single Line never
    // connects separate polylines. Track per-segment cumulative arc length so
    // Create reveal is uniform by length, not by vertex index.
    const segments: number[] = [];
    this.segCumEnd = [];
    this.segGroupIndex = [];
    this.segStartInGroup = [];
    this.segEndInGroup = [];
    this.groupLengths = [];
    const groupAcc = new Map<number, number>();
    let acc = 0;
    const pushSeg = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      group: number,
    ): void => {
      const segLen = Math.hypot(bx - ax, by - ay, bz - az);
      const gStart = groupAcc.get(group) ?? 0;
      segments.push(ax, ay, az, bx, by, bz);
      acc += segLen;
      this.segCumEnd.push(acc);
      this.segGroupIndex.push(group);
      this.segStartInGroup.push(gStart);
      const gEnd = gStart + segLen;
      this.segEndInGroup.push(gEnd);
      groupAcc.set(group, gEnd);
    };
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      const group = lineGroups[li] ?? 0;
      const pts = line.points;
      const n = Math.floor(pts.length / 3);
      for (let i = 0; i < n - 1; i++) {
        pushSeg(
          pts[i * 3]!,
          pts[i * 3 + 1]!,
          pts[i * 3 + 2]!,
          pts[(i + 1) * 3]!,
          pts[(i + 1) * 3 + 1]!,
          pts[(i + 1) * 3 + 2]!,
          group,
        );
      }
      if (line.closed && n > 2) {
        pushSeg(
          pts[(n - 1) * 3]!,
          pts[(n - 1) * 3 + 1]!,
          pts[(n - 1) * 3 + 2]!,
          pts[0]!,
          pts[1]!,
          pts[2]!,
          group,
        );
      }
    }
    const maxGroup = lineGroups.length > 0 ? Math.max(...lineGroups) : 0;
    this.groupLengths = Array.from({ length: maxGroup + 1 }, (_, g) => groupAcc.get(g) ?? 0);
    this.totalLength = acc;
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute(segments, 3));
    this.vertexCount = segments.length / 3;
    this.material = new LineBasicMaterial({ color, transparent: true });
    const lineObj = new LineSegments(this.geometry, this.material);
    this.primitive = lineObj;
    this.group.add(lineObj);
  }

  private buildMesh(geom: GeometryProvider3D, color: string): void {
    const mesh = geom.sampleMesh?.();
    this.geometry = new BufferGeometry();
    if (mesh) {
      this.geometry.setAttribute("position", new Float32BufferAttribute([...mesh.positions], 3));
      if (mesh.normals) {
        this.geometry.setAttribute("normal", new Float32BufferAttribute([...mesh.normals], 3));
      } else {
        this.geometry.computeVertexNormals();
      }
      this.geometry.setIndex([...mesh.indices]);
      this.indexCount = mesh.indices.length;
    }
    const doubleSided = this.object.style?.doubleSided ?? false;
    this.material = new MeshStandardMaterial({
      color,
      transparent: true,
      roughness: 0.6,
      metalness: 0.05,
      side: doubleSided ? DoubleSide : FrontSide,
      flatShading: false,
    });
    const meshObj = new Mesh(this.geometry, this.material);
    this.primitive = meshObj;
    this.group.add(meshObj);
  }

  private buildPoints(geom: GeometryProvider3D, color: string): void {
    const pts = geom.samplePoints?.();
    this.geometry = new BufferGeometry();
    let vertexColors = false;
    if (pts) {
      this.geometry.setAttribute("position", new Float32BufferAttribute([...pts.positions], 3));
      this.vertexCount = pts.positions.length / 3;
      if (pts.scalars && pts.scalars.length === this.vertexCount) {
        const colors = new Float32Array(this.vertexCount * 3);
        for (let i = 0; i < this.vertexCount; i++) {
          const [r, g, b] = rampColor(pts.scalars[i]!);
          colors[i * 3] = r;
          colors[i * 3 + 1] = g;
          colors[i * 3 + 2] = b;
        }
        this.geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
        vertexColors = true;
      }
    }
    this.material = new PointsMaterial({
      color: vertexColors ? "#ffffff" : color,
      size: this.object.style?.pointSize ?? 0.05,
      transparent: true,
      sizeAttenuation: true,
      vertexColors,
    });
    const pointsObj = new Points(this.geometry, this.material);
    this.primitive = pointsObj;
    this.group.add(pointsObj);
  }

  private build(): void {
    const geom = this.object.geometry;
    const color = this.resolveColor();
    this.revealOffset = -1;
    this.revealCount = -1;
    if (this.kind === "line") this.buildLines(geom, color);
    else if (this.kind === "mesh") this.buildMesh(geom, color);
    else this.buildPoints(geom, color);
  }

  /** Dispose the current primitive and rebuild from the (possibly new) object. */
  private rebuild(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.primitive) this.group.remove(this.primitive);
    this.primitive = null;
    this.vertexCount = 0;
    this.indexCount = 0;
    this.kind = this.object.geometry.kind;
    this.build();
  }

  /**
   * Number of segments whose START arc length is `< len` (for line reveal). Used
   * to bound the drawn segment window so `revealStart` trims the head.
   */
  private segmentsBefore(len: number): number {
    let count = 0;
    for (let i = 0; i < this.segCumEnd.length; i++) {
      const start = i === 0 ? 0 : this.segCumEnd[i - 1]!;
      if (start < len - 1e-9) count++;
      else break;
    }
    return count;
  }

  private applyLineReveal(state: RuntimeState3D): void {
    if (!this.geometry) return;
    if (this.totalLength <= 0) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    const { revealStart: start, revealEnd: end, glyphWriteSpans, strokeRevealMode } = state;
    const mode = strokeRevealMode ?? "path-order";

    if (glyphWriteSpans?.length && mode === "sequential" && this.segGroupIndex.length) {
      let firstSeg = this.segCumEnd.length;
      let lastSeg = -1;
      for (let i = 0; i < this.segCumEnd.length; i++) {
        const g = this.segGroupIndex[i]!;
        const span = glyphWriteSpans[g];
        if (!span) continue;
        const gLen = this.groupLengths[g] ?? 0;
        if (gLen <= 0) continue;
        const visStart = glyphLocalReveal(start, span) * gLen;
        const visEnd = glyphLocalReveal(end, span) * gLen;
        const s0 = this.segStartInGroup[i]!;
        const s1 = this.segEndInGroup[i]!;
        if (visEnd > visStart && s1 > visStart && s0 < visEnd) {
          firstSeg = Math.min(firstSeg, i);
          lastSeg = Math.max(lastSeg, i);
        }
      }
      const offset = lastSeg < 0 ? 0 : firstSeg * 2;
      const count = lastSeg < 0 ? 0 : (lastSeg - firstSeg + 1) * 2;
      if (offset !== this.revealOffset || count !== this.revealCount) {
        this.geometry.setDrawRange(offset, count);
        this.revealOffset = offset;
        this.revealCount = count;
      }
      return;
    }

    const startLen = start * this.totalLength;
    const endLen = end * this.totalLength;
    const startSeg = this.segmentsBefore(startLen);
    const endSeg = this.segmentsBefore(endLen);
    const offset = startSeg * 2;
    const count = Math.max(0, (endSeg - startSeg) * 2);
    if (offset !== this.revealOffset || count !== this.revealCount) {
      this.geometry.setDrawRange(offset, count);
      this.revealOffset = offset;
      this.revealCount = count;
    }
  }

  update(render: ObjectRenderState, _ctx?: RenderContext): void {
    void _ctx;
    const state = render.state as RuntimeState3D;
    this.object = render.object as IMObject3D;

    // Hot-rebuild geometry when the provider changed (reactive recompute / swap).
    if (state.geometryVersion !== this.geometryVersion) {
      this.geometryVersion = state.geometryVersion;
      if (this.geometryVersion >= 0 && this.primitive) this.rebuild();
    }

    const g = this.group;
    g.visible = state.visible;
    const p = state.transform.position;
    g.position.set(p[0], p[1], p[2]);
    const q = state.transform.rotation;
    g.quaternion.set(q[0], q[1], q[2], q[3]);
    const s = state.transform.scale;
    g.scale.set(s[0], s[1], s[2]);
    (g as Object3D).renderOrder = state.transform.renderOrder;

    if (this.material) {
      this.material.opacity = state.opacity;
      this.material.transparent = state.opacity < 1;
      this.material.needsUpdate = true;
    }

    // Create reveal (build-on). Lines trim by arc length honoring revealStart;
    // mesh/points reveal by build order (triangle / point batches).
    if (this.geometry) {
      if (this.kind === "line") {
        this.applyLineReveal(state);
      } else if (this.kind === "mesh") {
        const tris = Math.floor((this.indexCount / 3) * state.revealEnd);
        const count = tris * 3;
        if (count !== this.revealCount) {
          this.geometry.setDrawRange(0, count);
          this.revealCount = count;
        }
      } else {
        const count = Math.max(0, Math.floor(this.vertexCount * state.revealEnd));
        if (count !== this.revealCount) {
          this.geometry.setDrawRange(0, count);
          this.revealCount = count;
        }
      }
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.primitive) this.group.remove(this.primitive);
    this.primitive = null;
  }
}
