import { type AbsXYZ, type Vec3, xyz } from "../math/vec";

/** World-coordinate domain of a 3D scene (design.md §7.2, §10). */
export interface Domain3D {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly z: readonly [number, number];
}

/** 3D coordinate system family (design.md §10). */
export type CoordinateSystem3D = "cartesian" | "cylindrical" | "spherical";

const UNIT_DOMAIN_3D: Domain3D = { x: [-1, 1], y: [-1, 1], z: [-1, 1] };

/**
 * Scene coordinate transforms for a 3D scene (design.md §7.2, §10). Mirror of
 * {@link CoordinateTransform2D}: maps between absolute world coordinates and
 * normalized domain UVW, plus cylindrical/spherical conversions for the matching
 * coordinate systems. In 3D the math space *is* the world space, so the camera
 * (not this transform) handles projection.
 */
export class CoordinateTransform3D {
  /** World-coordinate domain (defaults to the unit cube). */
  readonly domain: Domain3D;

  constructor(
    domain: Domain3D = UNIT_DOMAIN_3D,
    readonly system: CoordinateSystem3D = "cartesian",
  ) {
    this.domain = domain;
  }

  /** Map absolute world coordinates to normalized domain UVW in [0,1]³. */
  absToRel(value: AbsXYZ): Vec3 {
    const { x: dx, y: dy, z: dz } = this.domain;
    return [
      (value[0] - dx[0]) / (dx[1] - dx[0]),
      (value[1] - dy[0]) / (dy[1] - dy[0]),
      (value[2] - dz[0]) / (dz[1] - dz[0]),
    ];
  }

  /** Map normalized domain UVW back to absolute world coordinates. */
  relToAbs(value: Vec3): AbsXYZ {
    const { x: dx, y: dy, z: dz } = this.domain;
    return xyz(
      dx[0] + value[0] * (dx[1] - dx[0]),
      dy[0] + value[1] * (dy[1] - dy[0]),
      dz[0] + value[2] * (dz[1] - dz[0]),
    );
  }

  /** Cylindrical radius/angle (radians)/height of an absolute point (z is the axis). */
  toCylindrical(value: AbsXYZ): { readonly r: number; readonly theta: number; readonly z: number } {
    return {
      r: Math.hypot(value[0], value[1]),
      theta: Math.atan2(value[1], value[0]),
      z: value[2],
    };
  }

  /** Absolute point from cylindrical coordinates. */
  fromCylindrical(r: number, theta: number, z: number): AbsXYZ {
    return xyz(r * Math.cos(theta), r * Math.sin(theta), z);
  }

  /**
   * Spherical radius / azimuth `theta` (around z) / polar `phi` (from +z) of an
   * absolute point, all in radians.
   */
  toSpherical(value: AbsXYZ): { readonly r: number; readonly theta: number; readonly phi: number } {
    const r = Math.hypot(value[0], value[1], value[2]);
    return {
      r,
      theta: Math.atan2(value[1], value[0]),
      phi: r > 0 ? Math.acos(value[2] / r) : 0,
    };
  }

  /** Absolute point from spherical coordinates. */
  fromSpherical(r: number, theta: number, phi: number): AbsXYZ {
    const sinPhi = Math.sin(phi);
    return xyz(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * Math.cos(phi));
  }
}
