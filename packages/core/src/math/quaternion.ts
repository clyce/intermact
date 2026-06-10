/**
 * Quaternion algebra for 3D rotation (design.md §10.1). Quaternions are stored as
 * `[x, y, z, w]` (matching three.js order) so rotations compose without gimbal
 * lock and interpolate smoothly via slerp. Pure functions, framework-free.
 */
import { type Quaternion, type Vec3 } from "./vec";

/** Identity rotation. */
export const QUAT_IDENTITY: Quaternion = [0, 0, 0, 1];

/** Normalize a quaternion to unit length (returns identity if degenerate). */
export function quatNormalize(q: Quaternion): Quaternion {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len === 0) return QUAT_IDENTITY;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

/** Hamilton product `a ⊗ b` (apply `b` then `a`). */
export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Build a quaternion from an axis (need not be unit) and an angle in radians. */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quaternion {
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (len === 0) return QUAT_IDENTITY;
  const half = angle / 2;
  const s = Math.sin(half) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

/** Build a quaternion from intrinsic XYZ Euler angles (radians). */
export function quatFromEuler(x: number, y: number, z: number): Quaternion {
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

/** Rotate a 3D vector by a quaternion. */
export function quatRotateVec3(q: Quaternion, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Spherical linear interpolation between two unit quaternions. */
export function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let [bx, by, bz, bw] = b;
  let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    // Nearly parallel: linear interpolate then normalize.
    return quatNormalize([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t,
    ]);
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return [a[0] * s0 + bx * s1, a[1] * s0 + by * s1, a[2] * s0 + bz * s1, a[3] * s0 + bw * s1];
}

function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Quaternion orienting a camera/object at `eye` to look toward `target`, with the
 * given world `up`. Uses a right-handed basis where the view looks down -Z
 * (three.js camera convention).
 */
export function quatLookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Quaternion {
  const forward = normalizeVec3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]); // +Z
  let right = cross(up, forward);
  if (Math.hypot(right[0], right[1], right[2]) < 1e-6) {
    // up parallel to forward: pick an alternate up.
    right = cross([0, 0, 1], forward);
    if (Math.hypot(right[0], right[1], right[2]) < 1e-6) right = [1, 0, 0];
  }
  right = normalizeVec3(right);
  const trueUp = cross(forward, right);
  // Rotation matrix columns (right, trueUp, forward) -> quaternion.
  const m00 = right[0];
  const m10 = right[1];
  const m20 = right[2];
  const m01 = trueUp[0];
  const m11 = trueUp[1];
  const m21 = trueUp[2];
  const m02 = forward[0];
  const m12 = forward[1];
  const m22 = forward[2];
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return quatNormalize([(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]);
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return quatNormalize([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]);
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return quatNormalize([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]);
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return quatNormalize([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]);
}
