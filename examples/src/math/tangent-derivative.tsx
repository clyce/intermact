import { useEffect, useMemo } from "react";
import { useControls } from "leva";
import {
  circle,
  createProgram,
  decimalNumber,
  derived,
  functionGraph,
  signal,
  slopeAt,
  tangentLine,
  xy,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M8 / design.md §7.4: an explorable derivative. Drag the Leva slider to move
 * the point of tangency; the tangent line and the slope readout
 * (`decimalNumber`) update reactively through the M6 signal graph.
 */
const FN = (x: number) => 2 * Math.sin(x);

export function TangentDerivativeDemo() {
  const leva = useControls({
    x: { value: 0.6, min: -3, max: 3, step: 0.02 },
  });

  const { xSig, slopeSig, program } = useMemo(() => {
    const xSig = signal(0.6);
    const slopeSig = signal(slopeAt(FN, 0.6));
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3.4, 3.4], y: [-3.2, 3.2] },
        background: "#0b1020",
      });
      ctx.mount(scene, ctx.createCamera2D(scene));

      const ax = scene.getAxes({ x: [-3, 3], y: [-3, 3], tickCount: 6 });
      const curve = scene.register(
        functionGraph(ax.handle, FN, {
          domain: [-3.3, 3.3],
          samples: 200,
          style: { stroke: "#38bdf8", lineWidth: 0.03 },
        }),
      );

      scene.registerReactive(
        derived([xSig], () =>
          tangentLine(ax.handle, FN, xSig.get(), {
            length: 1.6,
            style: { stroke: "#f97316", lineWidth: 0.035 },
          }),
        ),
      );

      const dot = scene.register(circle({ radius: 0.13, style: { fill: "#fbbf24" } }));
      dot.addUpdater(() => {
        dot.setTransform({ position: ax.handle.c2p([xSig.get(), FN(xSig.get())]) });
      });

      scene.registerReactive(decimalNumber(slopeSig, { digits: 2, size: 0.4 }), {
        position: xy(-3.1, 2.9),
      });

      await scene.play(ax.create({ duration: 0.5 }), curve.create({ duration: 1 }));
    });
    return { xSig, slopeSig, program };
  }, []);

  useEffect(() => {
    xSig.set(leva.x);
    slopeSig.set(slopeAt(FN, leva.x));
  }, [xSig, slopeSig, leva.x]);

  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay />
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 0" }}>
        f(x) = 2·sin(x); the readout shows f�?x) = 2·cos(x) at the moving point.
      </p>
    </div>
  );
}
