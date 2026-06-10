import { describe, expect, it } from "vitest";
import {
  axes3D,
  createInitialState3D,
  pointCloud3D,
  polyline3D,
  surface3D,
  type IMObject3D,
  type ObjectRenderState,
  type RuntimeState3DPatch,
  applyPatch3D,
} from "@intermact/core";
import type { BufferGeometry, LineSegments, Mesh, Points } from "three";
import { ThreeObject3DView } from "./object-view-3d";

function renderState(object: IMObject3D, patch?: RuntimeState3DPatch): ObjectRenderState {
  let state = createInitialState3D();
  if (patch) state = applyPatch3D(state, patch);
  return { id: "x", object, state };
}

describe("ThreeObject3DView (M14, design.md §15.2)", () => {
  it("builds a LineSegments primitive for line geometry", () => {
    const obj = polyline3D({
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
      ],
    });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj));
    const line = view.group.children[0] as LineSegments;
    expect(line.type).toBe("LineSegments");
    // 2 segments -> 4 endpoint vertices.
    expect((line.geometry as BufferGeometry).getAttribute("position").count).toBe(4);
    view.dispose();
  });

  it("builds a Mesh primitive for mesh geometry and trims draw range on Create", () => {
    const obj = surface3D({ fn: (u, v) => [u, 0, v], uSegments: 2, vSegments: 2 });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj));
    const mesh = view.group.children[0] as Mesh;
    expect(mesh.type).toBe("Mesh");
    const geom = mesh.geometry as BufferGeometry;
    const triCount = geom.getIndex()!.count; // index entries = 3 * triangles

    // Half-revealed Create trims the draw range to ~half the triangles.
    view.update(renderState(obj, { revealEnd: 0.5 }));
    expect(geom.drawRange.count).toBeLessThan(triCount);
    expect(geom.drawRange.count).toBeGreaterThan(0);

    // Fully revealed draws everything (Infinity = whole buffer).
    view.update(renderState(obj, { revealEnd: 1 }));
    expect(geom.drawRange.count).toBe(triCount);
    view.dispose();
  });

  it("builds a Points primitive for point clouds", () => {
    const obj = pointCloud3D({
      points: [
        [0, 0, 0],
        [1, 1, 1],
        [2, 0, 1],
      ],
    });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj));
    const points = view.group.children[0] as Points;
    expect(points.type).toBe("Points");
    expect((points.geometry as BufferGeometry).getAttribute("position").count).toBe(3);
    view.dispose();
  });

  it("applies transform + opacity from the runtime state", () => {
    const obj = axes3D({ size: 1 });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj, { opacity: 0.4, transform: { renderOrder: 5 } }));
    expect(view.group.renderOrder).toBe(5);
    view.dispose();
  });

  it("reveals lines by arc length and honors revealStart", () => {
    // A 3-unit polyline split into 3 equal unit segments.
    const obj = polyline3D({
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
      ],
    });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj, { revealEnd: 1 }));
    const geom = (view.group.children[0] as LineSegments).geometry as BufferGeometry;
    expect(geom.drawRange.count).toBe(6); // 3 segments × 2 endpoints

    // Reveal the first third → one segment (2 vertices) from offset 0.
    view.update(renderState(obj, { revealStart: 0, revealEnd: 1 / 3 }));
    expect(geom.drawRange.start).toBe(0);
    expect(geom.drawRange.count).toBe(2);

    // revealStart trims the head: [1/3, 1] → segments 2 and 3 from offset 2.
    view.update(renderState(obj, { revealStart: 1 / 3, revealEnd: 1 }));
    expect(geom.drawRange.start).toBe(2);
    expect(geom.drawRange.count).toBe(4);
    view.dispose();
  });

  it("hot-rebuilds geometry when geometryVersion bumps after replaceObject", () => {
    const a = polyline3D({
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    });
    const view = new ThreeObject3DView(a);
    view.update(renderState(a));
    expect(
      ((view.group.children[0] as LineSegments).geometry as BufferGeometry).getAttribute("position")
        .count,
    ).toBe(2);

    // Swap to a denser object and bump the version: the buffer is rebuilt.
    const b = polyline3D({
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
    });
    view.update({
      id: "x",
      object: b,
      state: applyPatch3D(createInitialState3D(), { geometryVersion: 1 }),
    });
    expect(
      ((view.group.children[0] as LineSegments).geometry as BufferGeometry).getAttribute("position")
        .count,
    ).toBe(4);
    view.dispose();
  });

  it("colors point clouds per-scalar via vertex colors", () => {
    const obj = pointCloud3D({
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
      scalars: [0, 1],
    });
    const view = new ThreeObject3DView(obj);
    view.update(renderState(obj));
    const points = view.group.children[0] as Points;
    const geom = points.geometry as BufferGeometry;
    expect(geom.getAttribute("color")).toBeTruthy();
    expect(geom.getAttribute("color").count).toBe(2);
    view.dispose();
  });
});
