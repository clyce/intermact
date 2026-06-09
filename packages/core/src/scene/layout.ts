import { type Animation, toAnimation, type TweenOptions } from "../animation";
import { type AbsXY, type RelUV, uv, type Vec2, xy } from "../math/vec";
import { type Bounds2D } from "../object/geometry-provider";
import { type IMObject2D } from "../object/types";
import { type ResolvedTransform2D } from "../runtime/state";
import {
  composeTransform2D,
  resolveTransform2D,
  transformBounds,
  worldDeltaToLocal,
} from "../runtime/world-transform";
import { type Transform2D } from "./transform";

/**
 * RectTransform-/Manim-style layout (design.md §9.4). `LayoutHandle` methods
 * compute target transforms from world-space bounds and return Animation
 * handles (`duration: 0` ⇒ instant; play/`commit` to apply). They also commit
 * the new authoring transform so subsequent `getBounds`/layout calls chain
 * deterministically within the build pass.
 */
export interface LayoutHandle {
  /** World-space axis-aligned bounds (parents composed). */
  getBounds(): Bounds2D;
  /** Place the object's `anchor` (self-bounds UV, default center) at a world point. */
  alignTo(point: AbsXY, opts?: AlignOptions): Animation;
  /** Position adjacent to another object along `direction` (e.g. `[1,0]` = right). */
  nextTo(target: LayoutTargetLike, direction: Vec2, opts?: NextToOptions): Animation;
  /** Scale (uniform) + center so the object fits within `bounds`. */
  fitTo(bounds: Bounds2D, opts?: FitOptions): Animation;
  /** Arrange children in a row/column/grid; returns a parallel Animation. */
  arrange(children: readonly LayoutTargetLike[], opts?: ArrangeOptions): Animation;
}

/** Anything carrying a {@link LayoutHandle} (a handle itself or a RegisteredObject2D). */
export type LayoutTargetLike = LayoutHandle | { readonly layout: LayoutHandle };

export interface AlignOptions extends TweenOptions {
  /** Self anchor as normalized bounds UV (default `uv(0.5, 0.5)`). */
  readonly anchor?: RelUV;
}
export interface NextToOptions extends TweenOptions {
  /** Edge gap in world units (default 0.25). */
  readonly gap?: number;
}
export interface FitOptions extends TweenOptions {
  /** Inset applied to the target bounds before fitting (default 0). */
  readonly padding?: number;
}
export type ArrangeDirection = "row" | "column" | "grid";
export interface ArrangeOptions extends TweenOptions {
  readonly direction?: ArrangeDirection;
  /** Spacing between cells in world units (default 0.25). */
  readonly gap?: number;
  /** Columns per row for `grid` (default 3). */
  readonly cols?: number;
  /** Top-left world origin where packing starts (default the container center). */
  readonly origin?: AbsXY;
}

/** Scene surface the layout handle needs (avoids a scene → handle import cycle). */
export interface LayoutHost {
  relToAbs(p: RelUV): AbsXY;
  /** Composed world transform of the object's parent chain (identity if root). */
  parentWorldTransform(id: string): ResolvedTransform2D;
}

/** The registered object surface a layout handle drives. */
export interface LayoutSelf {
  readonly id: string;
  readonly object: IMObject2D;
  getTransform(): Transform2D;
  setTransform(t: Partial<Transform2D>): void;
  moveTo(position: AbsXY, options?: TweenOptions): Animation;
  scaleTo(scale: Vec2 | number, options?: TweenOptions): Animation;
}

function asHandle(t: LayoutTargetLike): LayoutHandle {
  return "getBounds" in t ? t : t.layout;
}

function tweenOpts(opts?: TweenOptions): TweenOptions {
  return {
    duration: opts?.duration ?? 0,
    ...(opts?.easing !== undefined ? { easing: opts.easing } : {}),
  };
}

/** Build a {@link LayoutHandle} bound to a registered object and its scene host. */
export function createLayoutHandle(self: LayoutSelf, host: LayoutHost): LayoutHandle {
  const selfWorld = (): ResolvedTransform2D =>
    composeTransform2D(host.parentWorldTransform(self.id), resolveTransform2D(self.getTransform()));

  const getBounds = (): Bounds2D => transformBounds(self.object.geometry.getBounds(), selfWorld());

  /** Move so the object's local origin lands at `desiredWorldOrigin`. */
  const moveOriginTo = (desiredWorldOrigin: AbsXY, opts?: TweenOptions): Animation => {
    const parentW = host.parentWorldTransform(self.id);
    const curLocal = self.getTransform().position ?? xy(0, 0);
    const curWorld = selfWorld().position;
    const worldDelta = xy(desiredWorldOrigin[0] - curWorld[0], desiredWorldOrigin[1] - curWorld[1]);
    const localDelta = worldDeltaToLocal(parentW, worldDelta);
    const newLocal = xy(curLocal[0] + localDelta[0], curLocal[1] + localDelta[1]);
    self.setTransform({ position: newLocal });
    return self.moveTo(newLocal, tweenOpts(opts));
  };

  /** Move so the object's world-bounds center lands at `worldCenter`. */
  const moveCenterTo = (worldCenter: AbsXY, opts?: TweenOptions): Animation => {
    const b = getBounds();
    const origin = selfWorld().position;
    const target = xy(
      origin[0] + (worldCenter[0] - b.center[0]),
      origin[1] + (worldCenter[1] - b.center[1]),
    );
    return moveOriginTo(target, opts);
  };

  const handle: LayoutHandle = {
    getBounds,

    alignTo(point, opts) {
      const b = getBounds();
      const anchor = opts?.anchor ?? uv(0.5, 0.5);
      const anchorWorld = xy(b.min[0] + anchor[0] * b.size[0], b.min[1] + anchor[1] * b.size[1]);
      const origin = selfWorld().position;
      const target = xy(
        origin[0] + (point[0] - anchorWorld[0]),
        origin[1] + (point[1] - anchorWorld[1]),
      );
      return moveOriginTo(target, opts);
    },

    nextTo(target, direction, opts) {
      const tb = asHandle(target).getBounds();
      const sb = getBounds();
      const gap = opts?.gap ?? 0.25;
      const sgnX = Math.sign(direction[0]);
      const sgnY = Math.sign(direction[1]);
      const cx =
        sgnX !== 0 ? tb.center[0] + sgnX * (tb.size[0] / 2 + sb.size[0] / 2 + gap) : tb.center[0];
      const cy =
        sgnY !== 0 ? tb.center[1] + sgnY * (tb.size[1] / 2 + sb.size[1] / 2 + gap) : tb.center[1];
      return moveCenterTo(xy(cx, cy), opts);
    },

    fitTo(bounds, opts) {
      const padding = opts?.padding ?? 0;
      const sb = getBounds();
      const cur = resolveTransform2D(self.getTransform());
      const targetW = Math.max(bounds.size[0] - 2 * padding, 0);
      const targetH = Math.max(bounds.size[1] - 2 * padding, 0);
      const factor = Math.min(
        sb.size[0] > 0 ? targetW / sb.size[0] : Infinity,
        sb.size[1] > 0 ? targetH / sb.size[1] : Infinity,
      );
      const safe = Number.isFinite(factor) ? factor : 1;
      const newScale: Vec2 = [cur.scale[0] * safe, cur.scale[1] * safe];
      self.setTransform({ scale: newScale });
      const scaleAnim = self.scaleTo(newScale, tweenOpts(opts));
      const moveAnim = moveCenterTo(bounds.center, opts);
      return toAnimation({ kind: "parallel", children: [scaleAnim.spec, moveAnim.spec] });
    },

    arrange(children, opts) {
      const dir = opts?.direction ?? "row";
      const gap = opts?.gap ?? 0.25;
      const cols = Math.max(1, opts?.cols ?? 3);
      const origin = opts?.origin ?? getBounds().center;
      const anims: Animation[] = [];

      if (dir === "grid") {
        let row: LayoutTargetLike[] = [];
        let y = origin[1];
        let i = 0;
        const flushRow = (): void => {
          let x = origin[0];
          let rowH = 0;
          for (const child of row) {
            const cb = asHandle(child).getBounds();
            anims.push(
              asHandle(child).alignTo(xy(x + cb.size[0] / 2, y - cb.size[1] / 2), {
                anchor: uv(0.5, 0.5),
                ...tweenOpts(opts),
              }),
            );
            x += cb.size[0] + gap;
            rowH = Math.max(rowH, cb.size[1]);
          }
          y -= rowH + gap;
          row = [];
        };
        for (const child of children) {
          row.push(child);
          if (++i % cols === 0) flushRow();
        }
        if (row.length > 0) flushRow();
      } else {
        let cursor = dir === "row" ? origin[0] : origin[1];
        for (const child of children) {
          const cb = asHandle(child).getBounds();
          const center =
            dir === "row"
              ? xy(cursor + cb.size[0] / 2, origin[1])
              : xy(origin[0], cursor - cb.size[1] / 2);
          anims.push(asHandle(child).alignTo(center, { anchor: uv(0.5, 0.5), ...tweenOpts(opts) }));
          cursor += (dir === "row" ? cb.size[0] : -cb.size[1]) + (dir === "row" ? gap : -gap);
        }
      }
      return toAnimation({ kind: "parallel", children: anims.map((a) => a.spec) });
    },
  };

  return handle;
}
