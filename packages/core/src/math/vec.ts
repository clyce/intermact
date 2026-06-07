/**
 * Vector types and space-aware algebra (design.md §7.1).
 *
 * Coordinate spaces are distinguished at the type level via a phantom `__space`
 * brand so that absolute world coordinates, normalized UV, and screen pixels can
 * never be silently mixed. At runtime a branded vector is just a plain readonly
 * tuple; the brand exists only for the type checker.
 */

/** Plain 2D tuple. */
export type Vec2 = readonly [number, number];
/** Plain 3D tuple. */
export type Vec3 = readonly [number, number, number];
/** Quaternion (x, y, z, w). */
export type Quaternion = readonly [number, number, number, number];

/** Scene world coordinate (math units). */
export type AbsXY = Vec2 & { readonly __space: "abs-xy" };
/** Normalized coordinate relative to a viewport/domain, components in [0,1]. */
export type RelUV = Vec2 & { readonly __space: "rel-uv" };
/** Scene world coordinate in 3D. */
export type AbsXYZ = Vec3 & { readonly __space: "abs-xyz" };
/** Normalized 3D coordinate. */
export type RelUVW = Vec3 & { readonly __space: "rel-uvw" };

/** Construct an absolute world-space 2D point. */
export function xy(x: number, y: number): AbsXY {
  return [x, y] as unknown as AbsXY;
}

/** Construct a normalized (relative) 2D point. */
export function uv(u: number, v: number): RelUV {
  return [u, v] as unknown as RelUV;
}

/** Construct an absolute world-space 3D point. */
export function xyz(x: number, y: number, z: number): AbsXYZ {
  return [x, y, z] as unknown as AbsXYZ;
}

/** Construct a normalized (relative) 3D point. */
export function uvw(u: number, v: number, w: number): RelUVW {
  return [u, v, w] as unknown as RelUVW;
}

/**
 * Space-aware 2D vector algebra. Operations preserve the brand of their inputs,
 * so e.g. `V2.add(absA, absB)` stays `AbsXY` and the type checker rejects
 * mixing `AbsXY` with `RelUV`.
 */
export const V2 = {
  add<T extends Vec2>(a: T, b: T): T {
    return [a[0] + b[0], a[1] + b[1]] as unknown as T;
  },
  sub<T extends Vec2>(a: T, b: T): T {
    return [a[0] - b[0], a[1] - b[1]] as unknown as T;
  },
  scale<T extends Vec2>(a: T, k: number): T {
    return [a[0] * k, a[1] * k] as unknown as T;
  },
  lerp<T extends Vec2>(a: T, b: T, t: number): T {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as unknown as T;
  },
  dot(a: Vec2, b: Vec2): number {
    return a[0] * b[0] + a[1] * b[1];
  },
  len(a: Vec2): number {
    return Math.hypot(a[0], a[1]);
  },
  distance(a: Vec2, b: Vec2): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  },
  normalize<T extends Vec2>(a: T): T {
    const l = Math.hypot(a[0], a[1]);
    if (l === 0) return [0, 0] as unknown as T;
    return [a[0] / l, a[1] / l] as unknown as T;
  },
  equals(a: Vec2, b: Vec2, eps = 0): boolean {
    return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
  },
} as const;

/** Space-aware 3D vector algebra (mirrors {@link V2}). */
export const V3 = {
  add<T extends Vec3>(a: T, b: T): T {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as unknown as T;
  },
  sub<T extends Vec3>(a: T, b: T): T {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as unknown as T;
  },
  scale<T extends Vec3>(a: T, k: number): T {
    return [a[0] * k, a[1] * k, a[2] * k] as unknown as T;
  },
  lerp<T extends Vec3>(a: T, b: T, t: number): T {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ] as unknown as T;
  },
  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  len(a: Vec3): number {
    return Math.hypot(a[0], a[1], a[2]);
  },
} as const;

/** Clamp a number to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between two numbers. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
