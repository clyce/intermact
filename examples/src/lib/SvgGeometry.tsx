import { type Bounds2D, findTrait, type IMObject2D, triangulate } from "@intermact/core";

type ToScreen = (x: number, y: number) => [number, number];

/**
 * Build a padded *square* domain centered on the object's bounds. Using a single
 * extent for both axes preserves aspect ratio when mapped into the square SVG
 * viewport, so e.g. a near-horizontal arrow is not stretched into a diagonal.
 */
function domainFor(bounds: Bounds2D, pad = 0.2): { x: [number, number]; y: [number, number] } {
  const w = bounds.size[0] || 1;
  const h = bounds.size[1] || 1;
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  const half = (Math.max(w, h) * (1 + 2 * pad)) / 2;
  return {
    x: [cx - half, cx + half],
    y: [cy - half, cy + half],
  };
}

function contourPath(points: Float32Array, closed: boolean, toScreen: ToScreen): string {
  let d = "";
  for (let i = 0; i < points.length; i += 2) {
    const [sx, sy] = toScreen(points[i]!, points[i + 1]!);
    d += `${i === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)} `;
  }
  return d + (closed ? "Z" : "");
}

/**
 * Render an Intermact 2D object to SVG by sampling its stroke/fill traits.
 * Optional overlays visualize the arc-length sample points, the AABB, and the
 * earcut triangulation mesh (used by the M2 sampling-debug demo).
 */
export function GeometryView({
  object,
  width = 220,
  height = 220,
  samples,
  showSamples = false,
  showBounds = false,
  showTriangulation = false,
}: {
  object: IMObject2D;
  width?: number;
  height?: number;
  samples?: number;
  showSamples?: boolean;
  showBounds?: boolean;
  showTriangulation?: boolean;
}) {
  const bounds = object.geometry.getBounds();
  const domain = domainFor(bounds);
  const [xMin, xMax] = domain.x;
  const [yMin, yMax] = domain.y;
  const toScreen: ToScreen = (x, y) => [
    ((x - xMin) / (xMax - xMin)) * width,
    height - ((y - yMin) / (yMax - yMin)) * height,
  ];

  const opts = samples !== undefined ? { samples } : undefined;
  const path = object.geometry.samplePath(opts);
  const fill = findTrait(object.traits, "fill");
  const fillContours = fill?.contours(opts) ?? [];
  const style = object.style ?? {};

  return (
    <svg width={width} height={height} style={{ background: "#0b1020", borderRadius: 8 }}>
      {showBounds && (
        <rect
          x={toScreen(bounds.min[0], bounds.max[1])[0]}
          y={toScreen(bounds.min[0], bounds.max[1])[1]}
          width={((bounds.size[0] || 0) / (xMax - xMin)) * width}
          height={((bounds.size[1] || 0) / (yMax - yMin)) * height}
          fill="none"
          stroke="#f59e0b"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
      )}

      {fill && fillContours.length > 0 && (
        <path
          d={fillContours.map((c) => contourPath(c.points, c.closed, toScreen)).join(" ")}
          fill={style.fill ?? "rgba(56,189,248,0.25)"}
          fillRule={fill.fillRule === "evenodd" ? "evenodd" : "nonzero"}
          stroke="none"
        />
      )}

      {showTriangulation &&
        fill &&
        fillContours.length > 0 &&
        (() => {
          const tri = triangulate(fillContours);
          const lines: string[] = [];
          for (let i = 0; i < tri.indices.length; i += 3) {
            const a = tri.indices[i]! * 2;
            const b = tri.indices[i + 1]! * 2;
            const c = tri.indices[i + 2]! * 2;
            const pa = toScreen(tri.vertices[a]!, tri.vertices[a + 1]!);
            const pb = toScreen(tri.vertices[b]!, tri.vertices[b + 1]!);
            const pc = toScreen(tri.vertices[c]!, tri.vertices[c + 1]!);
            lines.push(`M ${pa[0]} ${pa[1]} L ${pb[0]} ${pb[1]} L ${pc[0]} ${pc[1]} Z`);
          }
          return (
            <path
              d={lines.join(" ")}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={0.5}
              opacity={0.7}
            />
          );
        })()}

      {path.contours.map((c, i) => (
        <path
          key={i}
          d={contourPath(c.points, c.closed, toScreen)}
          fill="none"
          stroke={style.stroke ?? "#38bdf8"}
          strokeWidth={1.5}
        />
      ))}

      {showSamples &&
        path.contours.flatMap((c, ci) => {
          const dots = [];
          for (let i = 0; i < c.points.length; i += 2) {
            const [sx, sy] = toScreen(c.points[i]!, c.points[i + 1]!);
            dots.push(<circle key={`${ci}-${i}`} cx={sx} cy={sy} r={2} fill="#f43f5e" />);
          }
          return dots;
        })}
    </svg>
  );
}
