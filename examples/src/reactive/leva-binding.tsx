import { useEffect, useMemo } from "react";
import { useControls } from "leva";
import { createProgram, decimalNumber, derived, functionGraph, signal, xy } from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/** M6 / design.md §19.2: Leva parameters bound to signals — program builds once. */
export function LevaBindingDemo() {
  const leva = useControls({
    amplitude: { value: 1, min: 0.1, max: 2, step: 0.05 },
    frequency: { value: 1, min: 0.2, max: 4, step: 0.05 },
  });

  const { amp, freq, program } = useMemo(() => {
    const amp = signal(1);
    const freq = signal(1);
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-6.5, 6.5], y: [-2.6, 2.6] },
        background: "#0b1020",
      });
      ctx.mount(scene, ctx.createCamera2D(scene));

      const ax = scene.getAxes({ x: [-6, 6], y: [-2, 2] });
      scene.registerReactive(
        derived([amp, freq], () =>
          functionGraph(ax.handle, (x) => amp.get() * Math.sin(freq.get() * x), {
            domain: [-6, 6],
            samples: 256,
            style: { stroke: "#22c55e", lineWidth: 0.03 },
          }),
        ),
      );
      scene.registerReactive(decimalNumber(amp, { prefix: "A=", digits: 2 }), {
        position: xy(-5.8, 2.2),
      });

      await scene.play(ax.create({ duration: 0.5 }));
    });
    return { amp, freq, program };
  }, []);

  useEffect(() => {
    amp.set(leva.amplitude);
  }, [amp, leva.amplitude]);
  useEffect(() => {
    freq.set(leva.frequency);
  }, [freq, leva.frequency]);

  return (
    <div style={{ height: 480 }}>
      <IntermactCanvas program={program} autoplay />
    </div>
  );
}
