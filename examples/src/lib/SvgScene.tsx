import { type RenderSnapshot, type Scene2D } from "@intermact/core";

/**
 * A tiny SVG visualizer for the M1 timeline demos. It maps each object's world
 * position into the scene domain and draws a dot. This is intentionally NOT the
 * real renderer (that is the R3F adapter in M3); it only proves the Player
 * produces correct per-frame state.
 */
export function SvgScene({
  scene,
  snapshot,
  width = 640,
  height = 360,
}: {
  scene: Scene2D | null;
  snapshot: RenderSnapshot | null;
  width?: number;
  height?: number;
}) {
  if (!scene || !snapshot) return null;
  const { x, y } = scene.props.domain;
  const [xMin, xMax] = x;
  const [yMin, yMax] = y;
  const toScreen = (px: number, py: number): [number, number] => [
    ((px - xMin) / (xMax - xMin)) * width,
    height - ((py - yMin) / (yMax - yMin)) * height,
  ];

  return (
    <svg
      width={width}
      height={height}
      style={{ background: scene.props.background ?? "#0b1020", borderRadius: 8 }}
    >
      {/* axes */}
      {(() => {
        const [, oy] = toScreen(0, 0);
        const [ox] = toScreen(0, 0);
        return (
          <g stroke="#334155" strokeWidth={1}>
            <line x1={0} y1={oy} x2={width} y2={oy} />
            <line x1={ox} y1={0} x2={ox} y2={height} />
          </g>
        );
      })()}
      {[...snapshot.objects.values()].map((o) => {
        const [sx, sy] = toScreen(o.state.transform.position[0], o.state.transform.position[1]);
        const r = 10 * Math.max(o.state.transform.scale[0], 0.4);
        return (
          <circle
            key={o.id}
            cx={sx}
            cy={sy}
            r={r}
            fill="#38bdf8"
            opacity={o.state.opacity}
            transform={`rotate(${(o.state.transform.rotation * 180) / Math.PI} ${sx} ${sy})`}
          />
        );
      })}
    </svg>
  );
}
