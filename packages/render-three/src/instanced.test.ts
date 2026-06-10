import { describe, expect, it } from "vitest";
import {
  buildProgram,
  circle,
  createInitialState2D,
  createProgram,
  instanceField,
  xy,
  type IMObject2D,
  type ObjectRenderState,
  type ObjectTransform2D,
  type RenderSnapshot,
} from "@intermact/core";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { InstancedObjectView } from "./object-view-instanced";
import { ThreeSceneView } from "./scene-view";

const CTX = { worldPerPixel: 1 };

function renderState(object: IMObject2D): ObjectRenderState {
  return { id: "field", object, state: createInitialState2D() };
}

describe("InstancedObjectView (M16, design.md §15.2)", () => {
  const transforms: ObjectTransform2D[] = [
    { position: xy(-1, 0), rotation: 0 },
    { position: xy(1, 0), rotation: 0 },
    { position: xy(0, 2), scale: 2 },
  ];
  const base = circle({ radius: 0.2, samples: 24, style: { fill: "#ef4444", stroke: "#1e293b" } });

  it("draws one InstancedMesh per channel sized to the instance count", () => {
    const field = instanceField(base, transforms);
    const view = new InstancedObjectView(field);
    view.update(renderState(field), CTX);

    const meshes = view.group.children.filter((c) => c instanceof InstancedMesh) as InstancedMesh[];
    // fill + stroke channels.
    expect(meshes.length).toBe(2);
    for (const mesh of meshes) expect(mesh.count).toBe(transforms.length);
    expect(view.instanceCount).toBe(transforms.length);
    view.dispose();
  });

  it("bakes per-instance transforms into the instance matrices", () => {
    const field = instanceField(base, transforms);
    const view = new InstancedObjectView(field);
    view.update(renderState(field), CTX);
    const mesh = view.group.children.find((c) => c instanceof InstancedMesh) as InstancedMesh;

    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();
    mesh.getMatrixAt(2, m);
    m.decompose(pos, quat, scale);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(2);
    expect(scale.x).toBeCloseTo(2);
    expect(scale.y).toBeCloseTo(2);
    view.dispose();
  });

  it("disables frustum culling so scattered instances are never wrongly culled", () => {
    const field = instanceField(base, transforms);
    const view = new InstancedObjectView(field);
    view.update(renderState(field), CTX);
    const meshes = view.group.children.filter((c) => c instanceof InstancedMesh) as InstancedMesh[];
    expect(meshes.length).toBe(2);
    for (const mesh of meshes) expect(mesh.frustumCulled).toBe(false);
    view.dispose();
  });

  it("re-dispatches a view when an object gains/loses its instanced trait", () => {
    const plain = circle({ radius: 0.2, samples: 8, style: { fill: "#fff", stroke: "#000" } });
    const snap = (object: IMObject2D): RenderSnapshot =>
      ({
        objects: new Map([["x", { id: "x", object, state: createInitialState2D() }]]),
      }) as unknown as RenderSnapshot;
    const view = new ThreeSceneView();

    view.update(snap(plain), CTX);
    let group = view.root.children[0]!;
    expect(group.children.some((c) => c instanceof InstancedMesh)).toBe(false);

    view.update(snap(instanceField(base, transforms)), CTX);
    group = view.root.children[0]!;
    expect(group.children.some((c) => c instanceof InstancedMesh)).toBe(true);
    expect(view.root.children.length).toBe(1);
    view.dispose();
  });

  it("ThreeSceneView dispatches instanced objects to the instanced view", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      scene.register(instanceField(base, transforms));
    });
    const { player } = await buildProgram(program);

    const view = new ThreeSceneView();
    view.update(player.getSnapshot(), CTX);
    const group = view.root.children[0]!;
    const instanced = group.children.filter((c) => c instanceof InstancedMesh) as InstancedMesh[];
    expect(instanced.length).toBeGreaterThan(0);
    expect(instanced[0]!.count).toBe(transforms.length);
    view.dispose();
  });
});
