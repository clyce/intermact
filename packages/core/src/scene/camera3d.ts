import { type Animation, parallel, type TweenOptions } from "../animation";
import { quatFromAxisAngle, quatLookAt, quatRotateVec3 } from "../math/quaternion";
import { type AbsXYZ, type Vec3, xyz } from "../math/vec";
import { type RegisteredObject3D } from "./registered-object-3d";

/** 3D camera authoring props (design.md §10.1). */
export interface Camera3DProps {
  readonly position?: AbsXYZ;
  readonly target?: Vec3;
  readonly up?: Vec3;
  /** Vertical field of view in degrees (perspective). Default 50. */
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly projection?: "perspective" | "orthographic";
  /** Orthographic zoom factor (ignored for perspective). Default 1. */
  readonly zoom?: number;
}

/**
 * A camera registered into a {@link Scene3D} as a transform node (design.md
 * §10.1, resolving the v0.1 deferral). It is backed by a {@link RegisteredObject3D}
 * so its eye position + look orientation live in the seekable timeline; the
 * renderer reads the camera node's snapshot transform each frame. Motion methods
 * (`moveTo`/`lookAt`/`orbit`/`dollyTo`) return seekable {@link Animation}s built
 * from quaternion look-at orientation.
 */
export class RegisteredCamera3D {
  readonly kind = "camera-3d" as const;

  /** Optics (not animated by the timeline; read by the renderer). */
  fov: number;
  near: number;
  far: number;
  projection: "perspective" | "orthographic";
  zoom: number;

  private eye: AbsXYZ;
  private targetPoint: Vec3;
  private readonly up: Vec3;

  constructor(
    private readonly node_: RegisteredObject3D,
    props: Camera3DProps = {},
  ) {
    this.eye = props.position ?? xyz(3, 3, 5);
    this.targetPoint = props.target ?? [0, 0, 0];
    this.up = props.up ?? [0, 1, 0];
    this.fov = props.fov ?? 50;
    this.near = props.near ?? 0.1;
    this.far = props.far ?? 1000;
    this.projection = props.projection ?? "perspective";
    this.zoom = props.zoom ?? 1;
    this.node_.setTransform({
      position: this.eye,
      rotation: quatLookAt(this.eye, this.targetPoint, this.up),
    });
  }

  /** Id of the backing transform node (for renderer lookup). */
  get id(): string {
    return this.node_.id;
  }

  /**
   * The backing transform node (design.md §10.1). Exposed so the camera can be
   * parented for **camera-follow**: `scene.setParent(camera.node, target)` makes
   * the eye position compose with the target's world transform, so the camera
   * tracks a moving object while its local `moveTo`/`orbit` still apply.
   */
  get node(): RegisteredObject3D {
    return this.node_;
  }

  /** Convenience: parent the camera under `target` so it tracks the target's motion. */
  follow(
    scene: { setParent(child: RegisteredObject3D, parent: RegisteredObject3D | null): void },
    target: RegisteredObject3D | null,
  ): void {
    scene.setParent(this.node_, target);
  }

  /**
   * Current **authoring** eye position (the build-time final value, design.md
   * §10.1). The seekable per-frame eye lives on the node's timeline; renderers
   * read the camera node's snapshot transform, not this getter.
   */
  get position(): AbsXYZ {
    return this.eye;
  }

  /** Current authoring look-at target (build-time final value; see {@link position}). */
  get target(): Vec3 {
    return this.targetPoint;
  }

  /** Move the eye to `position`, re-orienting to keep looking at the target. */
  moveTo(position: AbsXYZ, options?: TweenOptions): Animation {
    this.eye = position;
    const look = quatLookAt(this.eye, this.targetPoint, this.up);
    return parallel(this.node_.moveTo(position, options), this.node_.rotateTo(look, options));
  }

  /** Re-orient the camera to look at `target` from the current eye. */
  lookAt(target: Vec3, options?: TweenOptions): Animation {
    this.targetPoint = target;
    const look = quatLookAt(this.eye, this.targetPoint, this.up);
    return this.node_.rotateTo(look, options);
  }

  /**
   * Dolly the eye to `distance` units from the target along the current view
   * direction (a seekable zoom that preserves perspective).
   */
  dollyTo(distance: number, options?: TweenOptions): Animation {
    const dir = [
      this.eye[0] - this.targetPoint[0],
      this.eye[1] - this.targetPoint[1],
      this.eye[2] - this.targetPoint[2],
    ] as Vec3;
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const k = distance / len;
    const next = xyz(
      this.targetPoint[0] + dir[0] * k,
      this.targetPoint[1] + dir[1] * k,
      this.targetPoint[2] + dir[2] * k,
    );
    return this.moveTo(next, options);
  }

  /** Alias for {@link dollyTo}: zoom in/out by repositioning the eye. */
  zoomTo(distance: number, options?: TweenOptions): Animation {
    return this.dollyTo(distance, options);
  }

  /**
   * Orbit the eye around the target by `angle` radians about `axis` (default the
   * camera up vector), keeping the look-at target fixed.
   */
  orbit(angle: number, options?: TweenOptions & { readonly axis?: Vec3 }): Animation {
    const axis = options?.axis ?? this.up;
    const q = quatFromAxisAngle(axis, angle);
    const offset: Vec3 = [
      this.eye[0] - this.targetPoint[0],
      this.eye[1] - this.targetPoint[1],
      this.eye[2] - this.targetPoint[2],
    ];
    const rotated = quatRotateVec3(q, offset);
    const next = xyz(
      this.targetPoint[0] + rotated[0],
      this.targetPoint[1] + rotated[1],
      this.targetPoint[2] + rotated[2],
    );
    return this.moveTo(next, options);
  }
}
