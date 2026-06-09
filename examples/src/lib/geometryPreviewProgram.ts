import {
  circle,
  createProgram,
  findTrait,
  polyline,
  rectangle,
  triangulate,
  type Bounds2D,
  type IMObject2D,
  xy,
} from "@intermact/core";

/** Padded square domain centered on an object's bounds (preserves aspect in the viewport). */
export function domainFor(
  bounds: Bounds2D,
  pad = 0.2,
): {
  x: [number, number];
  y: [number, number];
} {
  const w = bounds.size[0] || 1;
  const h = bounds.size[1] || 1;
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  const half = (Math.max(w, h) * (1 + 2 * pad)) / 2;
  return { x: [cx - half, cx + half], y: [cy - half, cy + half] };
}

/** Static preview program: one object, domain fitted to its bounds. */
export function geometryPreviewProgram(object: IMObject2D) {
  const bounds = object.geometry.getBounds();
  const domain = domainFor(bounds);

  return createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain,
      fit: "contain",
      background: "#0b1020",
    });
    ctx.mount(scene, ctx.createCamera2D(scene));
    scene.register(object);
  });
}

/** Sampling-debug program: shape plus optional sample/bounds/triangulation overlays. */
export function samplingDebugProgram(object: IMObject2D, samples: number) {
  const bounds = object.geometry.getBounds();
  const domain = domainFor(bounds, 0.25);
  const unit = Math.min(bounds.size[0] || 1, bounds.size[1] || 1);

  return createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain,
      fit: "contain",
      background: "#0b1020",
    });
    ctx.mount(scene, ctx.createCamera2D(scene));
    scene.register(object);

    scene.register(
      rectangle({
        width: bounds.size[0],
        height: bounds.size[1],
        style: { stroke: "#f59e0b", lineWidth: unit * 0.012 },
      }),
      { position: xy(bounds.center[0], bounds.center[1]) },
    );

    const path = object.geometry.samplePath({ samples });
    const dotR = unit * 0.018;
    for (const contour of path.contours) {
      for (let i = 0; i < contour.points.length; i += 2) {
        scene.register(circle({ radius: dotR, style: { fill: "#f43f5e" } }), {
          position: xy(contour.points[i]!, contour.points[i + 1]!),
        });
      }
    }

    const lineW = unit * 0.005;
    const fill = findTrait(object.traits, "fill");
    if (fill) {
      const contours = fill.contours({ samples });
      const tri = triangulate(contours);
      for (let i = 0; i < tri.indices.length; i += 3) {
        const pts = [0, 1, 2].map((k) => {
          const idx = tri.indices[i + k]! * 2;
          return xy(tri.vertices[idx]!, tri.vertices[idx + 1]!);
        });
        scene.register(
          polyline({
            points: [pts[0]!, pts[1]!, pts[2]!, pts[0]!],
            style: { stroke: "#a78bfa", lineWidth: lineW },
          }),
        );
      }
    }
  });
}
