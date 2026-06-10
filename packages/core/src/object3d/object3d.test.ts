import { describe, expect, it } from "vitest";
import {
  axes3D,
  CoordinateTransform3D,
  createProgram,
  curve3D,
  findTrait,
  group3D,
  isosurface,
  meshObject,
  pointCloud3D,
  polyline3D,
  scalarField3D,
  surface3D,
  xyz,
} from "../index";
import { marchingCubes } from "../geometry/marching-cubes";
import { quatFromAxisAngle, quatRotateVec3 } from "../math/quaternion";
import { type Quaternion, type Vec3 } from "../math/vec";
import { buildProgram } from "../program/build";
import { type Player } from "../animation/player";
import { composeTransform3D, resolveTransform3D } from "../runtime/world-transform";
import { type RuntimeState3D } from "../runtime/state";

function state3D(player: Player, id: string): RuntimeState3D {
  const s = player.getSnapshot().objects.get(id)?.state;
  if (!s) throw new Error(`no state for ${id}`);
  if (s.dimension !== "3d") throw new Error(`expected 3d state for ${id}`);
  return s;
}

describe("3D factories + bounds (M14, design.md §5.3)", () => {
  it("polyline3D bounds span the point extents", () => {
    const o = polyline3D({
      points: [
        [0, 0, 0],
        [1, 2, 3],
        [-1, 0, 2],
      ],
    });
    const b = o.geometry.getBounds();
    expect(b.min).toEqual([-1, 0, 0]);
    expect(b.max).toEqual([1, 2, 3]);
    expect(o.geometry.kind).toBe("line");
  });

  it("curve3D samples the requested number of points", () => {
    const o = curve3D({ fn: (t) => [t, t * t, 0], tRange: [0, 2], samples: 33 });
    const lines = o.geometry.sampleLines?.() ?? [];
    expect(lines).toHaveLength(1);
    expect(lines[0]!.points.length / 3).toBe(33);
    expect(o.geometry.getBounds().max[1]).toBeCloseTo(4, 5);
  });

  it("surface3D meshes a (u,v) grid with predictable bounds", () => {
    const o = surface3D({
      fn: (u, v) => [u, 0, v],
      uRange: [0, 2],
      vRange: [0, 3],
      uSegments: 2,
      vSegments: 3,
    });
    const b = o.geometry.getBounds();
    expect(b.min).toEqual([0, 0, 0]);
    expect(b.max).toEqual([2, 0, 3]);
    const mesh = o.geometry.sampleMesh?.();
    // (2x3) quads -> 2*3*2 triangles -> 36 indices; (3x4) grid -> 12 vertices.
    expect(mesh!.indices.length).toBe(2 * 3 * 6);
    expect(mesh!.positions.length / 3).toBe(3 * 4);
  });

  it("pointCloud3D carries per-point scalars and bounds", () => {
    const o = pointCloud3D({
      points: [
        [0, 0, 0],
        [2, 2, 2],
      ],
      scalars: [0, 1],
    });
    const pts = o.geometry.samplePoints?.();
    expect(pts!.positions.length / 3).toBe(2);
    expect([...(pts!.scalars ?? [])]).toEqual([0, 1]);
    expect(o.geometry.getBounds().center).toEqual([1, 1, 1]);
  });

  it("axes3D builds three segments with total length 3·size", () => {
    const o = axes3D({ size: 2 });
    expect(o.geometry.sampleLines?.()).toHaveLength(3);
    expect(o.geometry.totalLength?.()).toBeCloseTo(6, 5);
    expect(o.geometry.getBounds().max).toEqual([2, 2, 2]);
  });

  it("meshObject keeps the supplied indices", () => {
    const o = meshObject({
      positions: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      indices: [0, 1, 2],
    });
    const mesh = o.geometry.sampleMesh?.();
    expect([...mesh!.indices]).toEqual([0, 1, 2]);
    expect(mesh!.normals!.length).toBe(9);
  });
});

describe("3D world-transform composition (M14, design.md §9.3)", () => {
  it("composes parent rotation + scale onto a child position", () => {
    const parent = resolveTransform3D({
      position: xyz(1, 0, 0),
      rotation: quatFromAxisAngle([0, 0, 1], Math.PI / 2),
      scale: 2,
    });
    const child = resolveTransform3D({ position: xyz(1, 0, 0), scale: 3 });
    const world = composeTransform3D(parent, child);
    // child (1,0,0) scaled by 2 -> (2,0,0), rotated 90° about Z -> (0,2,0), + parent (1,0,0).
    expect(world.position[0]).toBeCloseTo(1, 5);
    expect(world.position[1]).toBeCloseTo(2, 5);
    expect(world.position[2]).toBeCloseTo(0, 5);
    expect(world.scale).toEqual([6, 6, 6]);
  });

  it("resolveTransform3D fills identity defaults", () => {
    const t = resolveTransform3D(undefined);
    expect(t.position).toEqual([0, 0, 0]);
    expect(t.rotation).toEqual([0, 0, 0, 1]);
    expect(t.scale).toEqual([1, 1, 1]);
  });
});

describe("marching cubes isosurface (M14, design.md §6)", () => {
  const sphere = (x: number, y: number, z: number): number => x * x + y * y + z * z - 1;

  it("extracts a watertight, deterministic sphere mesh", () => {
    const mesh = marchingCubes(sphere, { min: [-2, -2, -2], max: [2, 2, 2], resolution: 16 });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);

    // Every interior edge must be shared by exactly two triangles (watertight).
    const edges = new Map<string, number>();
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const tri = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!];
      for (let e = 0; e < 3; e++) {
        const a = tri[e]!;
        const b = tri[(e + 1) % 3]!;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    for (const count of edges.values()) expect(count).toBe(2);

    // Total surface area approximates 4πr² = 4π.
    let area = 0;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const ia = mesh.indices[t]! * 3;
      const ib = mesh.indices[t + 1]! * 3;
      const ic = mesh.indices[t + 2]! * 3;
      const ux = mesh.positions[ib]! - mesh.positions[ia]!;
      const uy = mesh.positions[ib + 1]! - mesh.positions[ia + 1]!;
      const uz = mesh.positions[ib + 2]! - mesh.positions[ia + 2]!;
      const vx = mesh.positions[ic]! - mesh.positions[ia]!;
      const vy = mesh.positions[ic + 1]! - mesh.positions[ia + 1]!;
      const vz = mesh.positions[ic + 2]! - mesh.positions[ia + 2]!;
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      area += 0.5 * Math.hypot(cx, cy, cz);
    }
    expect(area).toBeGreaterThan(11);
    expect(area).toBeLessThan(13);

    // Determinism: identical inputs -> identical buffers.
    const again = marchingCubes(sphere, { min: [-2, -2, -2], max: [2, 2, 2], resolution: 16 });
    expect(again.indices.length).toBe(mesh.indices.length);
    expect([...again.positions.slice(0, 12)]).toEqual([...mesh.positions.slice(0, 12)]);
  });

  it("metaball isosurface is watertight with consistent outward winding", () => {
    const metaballs = (x: number, y: number, z: number): number => {
      const d0 = (x - 0.7) ** 2 + y * y + z * z;
      const d1 = (x + 0.7) ** 2 + y * y + z * z;
      return 1 / (d0 + 0.05) + 1 / (d1 + 0.05) - 2.2;
    };
    const grad = (x: number, y: number, z: number): [number, number, number] => {
      const d0 = (x - 0.7) ** 2 + y * y + z * z;
      const d1 = (x + 0.7) ** 2 + y * y + z * z;
      const s0 = d0 + 0.05;
      const s1 = d1 + 0.05;
      return [
        (-2 * (x - 0.7)) / (s0 * s0) + (-2 * (x + 0.7)) / (s1 * s1),
        (-2 * y) / (s0 * s0) + (-2 * y) / (s1 * s1),
        (-2 * z) / (s0 * s0) + (-2 * z) / (s1 * s1),
      ];
    };
    const mesh = marchingCubes(metaballs, { min: [-2, -2, -2], max: [2, 2, 2], resolution: 24 });

    const edges = new Map<string, number>();
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const tri = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!];
      for (let e = 0; e < 3; e++) {
        const a = tri[e]!;
        const b = tri[(e + 1) % 3]!;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    for (const count of edges.values()) expect(count).toBe(2);

    let misaligned = 0;
    const tris = mesh.indices.length / 3;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const ia = mesh.indices[t]! * 3;
      const ib = mesh.indices[t + 1]! * 3;
      const ic = mesh.indices[t + 2]! * 3;
      const ax = mesh.positions[ia]!;
      const ay = mesh.positions[ia + 1]!;
      const az = mesh.positions[ia + 2]!;
      const bx = mesh.positions[ib]!;
      const by = mesh.positions[ib + 1]!;
      const bz = mesh.positions[ib + 2]!;
      const cx = mesh.positions[ic]!;
      const cy = mesh.positions[ic + 1]!;
      const cz = mesh.positions[ic + 2]!;
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cx - ax;
      const vy = cy - ay;
      const vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const mx = (ax + bx + cx) / 3;
      const my = (ay + by + cy) / 3;
      const mz = (az + bz + cz) / 3;
      const [gx, gy, gz] = grad(mx, my, mz);
      if (nx * gx + ny * gy + nz * gz < 0) misaligned++;
    }
    expect(misaligned / tris).toBeLessThan(0.02);
  });

  it("isosurface() wraps a ScalarField3D into a mesh object", () => {
    const field = scalarField3D({ x: [-2, 2], y: [-2, 2], z: [-2, 2] }, sphere);
    const o = isosurface(field, { level: 0, resolution: 12 });
    expect(o.type).toBe("isosurface-3d");
    expect(o.geometry.kind).toBe("mesh");
    expect(o.geometry.sampleMesh?.()!.indices.length).toBeGreaterThan(0);
  });
});

describe("Scene3D + Player snapshot (M14, design.md §10)", () => {
  it("3D moveTo tweens the snapshot transform and is seekable", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      const camera = ctx.createCamera3D(scene, { position: xyz(0, 0, 5) });
      ctx.mount(scene, camera);
      const line = scene.register(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }),
      );
      id = line.id;
      await scene.play(line.moveTo(xyz(2, 0, 0), { duration: 2 }));
    });
    const { player } = await buildProgram(program);

    player.seek(0);
    expect(state3D(player, id).transform.position[0]).toBeCloseTo(0, 5);
    player.seek(1);
    expect(state3D(player, id).transform.position[0]).toBeCloseTo(1, 5);
    player.seek(2);
    expect(state3D(player, id).transform.position[0]).toBeCloseTo(2, 5);
  });

  it("3D Create reveals the object (revealEnd 0 -> 1)", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      ctx.mount(scene, ctx.createCamera3D(scene));
      const mesh = scene.register(
        surface3D({ fn: (u, v) => [u, 0, v], uSegments: 4, vSegments: 4 }),
      );
      id = mesh.id;
      await scene.play(mesh.create({ duration: 2 }));
    });
    const { player } = await buildProgram(program);

    player.seek(0);
    expect(state3D(player, id).revealEnd).toBeCloseTo(0, 5);
    player.seek(2);
    expect(state3D(player, id).revealEnd).toBeCloseTo(1, 5);
  });

  it("rotateTo interpolates via slerp (45° at the half-way point)", async () => {
    let id = "";
    const target: Quaternion = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      ctx.mount(scene, ctx.createCamera3D(scene));
      const o = scene.register(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }),
      );
      id = o.id;
      await scene.play(o.rotateTo(target, { duration: 2 }));
    });
    const { player } = await buildProgram(program);

    player.seek(1);
    const mid = state3D(player, id).transform.rotation;
    const v: Vec3 = quatRotateVec3(mid, [1, 0, 0]);
    // Half of a 90° Y-rotation: (1,0,0) -> (cos45, 0, -sin45).
    expect(v[0]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(v[2]).toBeCloseTo(-Math.SQRT1_2, 4);
  });

  it("group3D parents children so the parent moves the whole group", async () => {
    let childId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      ctx.mount(scene, ctx.createCamera3D(scene));
      const child = scene.register(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }),
        {
          position: xyz(1, 0, 0),
        },
      );
      childId = child.id;
      const group = scene.group3D([child], { position: xyz(0, 5, 0) });
      await scene.play(group.moveTo(xyz(0, 10, 0), { duration: 1 }));
    });
    const { player } = await buildProgram(program);

    player.seek(1);
    const p = state3D(player, childId).transform.position;
    // child local (1,0,0) + parent world (0,10,0) = (1,10,0).
    expect(p[0]).toBeCloseTo(1, 5);
    expect(p[1]).toBeCloseTo(10, 5);
  });
});

describe("3D capability traits + group3D factory (M14, design.md §4.2, §5.3)", () => {
  it("factories tag objects with a geometry-3d capability marker", () => {
    expect(
      findTrait(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }).traits,
        "geometry-3d",
      ),
    ).toEqual({
      kind: "geometry-3d",
      geometryKind: "line",
    });
    expect(
      findTrait(surface3D({ fn: (u, v) => [u, 0, v] }).traits, "geometry-3d")?.geometryKind,
    ).toBe("mesh");
    expect(
      findTrait(pointCloud3D({ points: [[0, 0, 0]] }).traits, "geometry-3d")?.geometryKind,
    ).toBe("points");
  });

  it("group3D aggregates homogeneous line children and keeps part keys", () => {
    const g = group3D([
      polyline3D({
        points: [
          [0, 0, 0],
          [1, 0, 0],
        ],
      }),
      polyline3D({
        points: [
          [0, 1, 0],
          [1, 1, 0],
        ],
      }),
    ]);
    expect(g.type).toBe("group-3d");
    expect(g.geometry.kind).toBe("line");
    expect(g.geometry.sampleLines?.()).toHaveLength(2);
    expect(g.parts?.map((p) => p.key)).toEqual(["0", "1"]);
  });

  it("group3D merges meshes with offset indices into one buffer", () => {
    const tri = (): ReturnType<typeof meshObject> =>
      meshObject({
        positions: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        indices: [0, 1, 2],
      });
    const g = group3D([tri(), tri()]);
    const mesh = g.geometry.sampleMesh?.();
    expect(mesh!.positions.length / 3).toBe(6);
    expect([...mesh!.indices]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("group3D rejects mixed primitive channels", () => {
    expect(() =>
      group3D([
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }),
        pointCloud3D({ points: [[0, 0, 0]] }),
      ]),
    ).toThrow(/single primitive channel/);
  });
});

describe("CoordinateTransform3D + Scene3D.getAxes (M14, design.md §7.2, §9.1)", () => {
  it("maps absolute world coords to normalized domain UVW and back", () => {
    const ct = new CoordinateTransform3D({ x: [0, 10], y: [-5, 5], z: [0, 1] });
    expect(ct.absToRel(xyz(5, 0, 0.5))).toEqual([0.5, 0.5, 0.5]);
    expect(ct.relToAbs([0.5, 0.5, 0.5])).toEqual([5, 0, 0.5]);
  });

  it("round-trips cylindrical and spherical coordinates", () => {
    const ct = new CoordinateTransform3D();
    const cyl = ct.toCylindrical(xyz(3, 4, 7));
    const back = ct.fromCylindrical(cyl.r, cyl.theta, cyl.z);
    expect(back[0]).toBeCloseTo(3, 6);
    expect(back[1]).toBeCloseTo(4, 6);
    expect(back[2]).toBeCloseTo(7, 6);
    const sph = ct.toSpherical(xyz(1, 2, 2));
    const sb = ct.fromSpherical(sph.r, sph.theta, sph.phi);
    expect(sb[0]).toBeCloseTo(1, 6);
    expect(sb[1]).toBeCloseTo(2, 6);
    expect(sb[2]).toBeCloseTo(2, 6);
  });

  it("getAxes registers a RegisteredAxes3D with an identity handle and 3 axes", async () => {
    let lines = 0;
    let mapped: readonly [number, number, number] = [0, 0, 0];
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3], z: [0, 4] },
      });
      ctx.mount(scene, ctx.createCamera3D(scene));
      const ax = scene.getAxes({ x: [-3, 3], y: [-3, 3], z: [0, 4] });
      lines = ax.object.geometry.sampleLines?.().length ?? 0;
      mapped = ax.handle.c2p([1, 2, 3]);
    });
    await buildProgram(program);
    expect(lines).toBeGreaterThanOrEqual(3);
    expect(mapped).toEqual([1, 2, 3]);
  });
});

describe("RegisteredCamera3D camera-follow (M14, design.md §10.1)", () => {
  it("parenting the camera node under a target makes the eye track it", async () => {
    let camId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      const camera = ctx.createCamera3D(scene, { position: xyz(0, 0, 5), target: [0, 0, 0] });
      camId = camera.id;
      ctx.mount(scene, camera);
      const target = scene.register(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
          ],
        }),
      );
      camera.follow(scene, target);
      await scene.play(target.moveTo(xyz(0, 5, 0), { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    player.seek(1);
    const p = state3D(player, camId).transform.position;
    // camera local eye (0,0,5) + parent world (0,5,0) = (0,5,5).
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(5, 5);
    expect(p[2]).toBeCloseTo(5, 5);
  });
});

describe("RegisteredCamera3D in the timeline (M14, design.md §10.1)", () => {
  it("orbit rotates the eye around the target", async () => {
    let camId = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      const camera = ctx.createCamera3D(scene, { position: xyz(3, 0, 4), target: [0, 0, 0] });
      camId = camera.id;
      ctx.mount(scene, camera);
      await scene.play(camera.orbit(Math.PI, { duration: 1 }));
    });
    const { player } = await buildProgram(program);

    player.seek(1);
    const p = state3D(player, camId).transform.position;
    // 180° orbit about +Y: (3,0,4) -> (-3,0,-4).
    expect(p[0]).toBeCloseTo(-3, 4);
    expect(p[1]).toBeCloseTo(0, 4);
    expect(p[2]).toBeCloseTo(-4, 4);
  });
});
