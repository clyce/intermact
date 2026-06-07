import { createProgram, xy } from "@intermact/core";
import { useTimelinePlayer } from "../lib/useTimelinePlayer";
import { SvgScene } from "../lib/SvgScene";
import { TimelineControls } from "../lib/TimelineControls";

/**
 * `examples/timeline/seek-basics` (dev-roadmap.md M1).
 *
 * A single eased tween whose progress bar can be scrubbed, sped up, slowed, and
 * reversed — directly validating the seekable, deterministic timeline.
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-1, 7], y: [-2, 2] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const dot = scene.registerEmpty({ position: xy(0, 0) });
  await scene.play(dot.moveTo(xy(6, 0), { duration: 2, easing: "cubicInOut" }));
  await scene.play(dot.scaleTo(2.2, { duration: 1, easing: "backInOut" }));
});

export function SeekBasicsDemo() {
  const { player, scene, snapshot } = useTimelinePlayer(program);
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Seek basics</h2>
      <p style={{ color: "#94a3b8", maxWidth: 640 }}>
        One eased move + scale tween. Drag the slider to seek to any moment, change the rate, or set
        it to -1× to play in reverse — the frame is computed deterministically from the timeline.
      </p>
      <SvgScene scene={scene} snapshot={snapshot} />
      <TimelineControls player={player} time={snapshot?.time ?? 0} />
    </div>
  );
}
