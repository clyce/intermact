import { describe, expect, it } from "vitest";
import {
  QUAT_IDENTITY,
  quatFromAxisAngle,
  quatFromEuler,
  quatLookAt,
  quatMultiply,
  quatNormalize,
  quatRotateVec3,
  quatSlerp,
} from "./quaternion";
import { type Quaternion, type Vec3 } from "./vec";

function expectVec3(actual: Vec3, expected: Vec3, eps = 1e-6): void {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
  expect(actual[2]).toBeCloseTo(expected[2], 5);
  void eps;
}

function quatLen(q: Quaternion): number {
  return Math.hypot(q[0], q[1], q[2], q[3]);
}

describe("quaternion algebra (M14, design.md §10.1)", () => {
  it("identity leaves vectors unchanged", () => {
    expectVec3(quatRotateVec3(QUAT_IDENTITY, [1, 2, 3]), [1, 2, 3]);
  });

  it("axis-angle rotates about Z by 90°", () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    expectVec3(quatRotateVec3(q, [1, 0, 0]), [0, 1, 0]);
    expectVec3(quatRotateVec3(q, [0, 1, 0]), [-1, 0, 0]);
  });

  it("composition (Hamilton product) applies right then left", () => {
    const half = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    const full = quatMultiply(half, half);
    expectVec3(quatRotateVec3(full, [1, 0, 0]), [-1, 0, 0]);
  });

  it("Euler XYZ matches single-axis axis-angle", () => {
    const eulerZ = quatFromEuler(0, 0, Math.PI / 2);
    const axisZ = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    expectVec3(quatRotateVec3(eulerZ, [1, 0, 0]), quatRotateVec3(axisZ, [1, 0, 0]));
  });

  it("normalize yields a unit quaternion", () => {
    const q = quatNormalize([0, 0, 3, 4]);
    expect(quatLen(q)).toBeCloseTo(1, 6);
  });

  it("slerp hits its endpoints and the half-way rotation", () => {
    const a = QUAT_IDENTITY;
    const b = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    expectVec3(quatRotateVec3(quatSlerp(a, b, 0), [1, 0, 0]), [1, 0, 0]);
    expectVec3(quatRotateVec3(quatSlerp(a, b, 1), [1, 0, 0]), quatRotateVec3(b, [1, 0, 0]));
    // Half-way is a 45° rotation about +Y: (1,0,0) -> (cos45, 0, -sin45).
    const mid = quatSlerp(a, b, 0.5);
    expectVec3(quatRotateVec3(mid, [1, 0, 0]), [Math.SQRT1_2, 0, -Math.SQRT1_2]);
  });

  it("lookAt orients -Z toward the target", () => {
    // Camera convention: view looks down local -Z. world dir = R·(0,0,-1).
    const downZ: Vec3 = [0, 0, -1];
    const qz = quatLookAt([0, 0, 5], [0, 0, 0]);
    expectVec3(quatRotateVec3(qz, downZ), [0, 0, -1]);
    const qx = quatLookAt([5, 0, 0], [0, 0, 0]);
    expectVec3(quatRotateVec3(qx, downZ), [-1, 0, 0]);
    const qdiag = quatLookAt([0, 0, 0], [1, 0, 0]);
    expectVec3(quatRotateVec3(qdiag, downZ), [1, 0, 0]);
  });
});
