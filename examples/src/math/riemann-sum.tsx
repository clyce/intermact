import { useEffect, useMemo } from "react";
import { useControls } from "leva";
import {
  createProgram,
  decimalNumber,
  derived,
  functionGraph,
  riemannRectangles,
  riemannSum,
  signal,
  xy,
  type RiemannSample,
} from "@intermact/core";
import { DemoCanvas } from "../lib/DemoCanvas";

/**
 * M8 / design.md §7.4: Riemann rectangles that converge to the true area as `n`
 * grows. `n` and the sampling rule are Leva-bound signals; a reactive
 * `decimalNumber` shows the running sum (∫₀³ x² dx = 9).
 */
const FN = (x: number) => x * x;
const RANGE: [number, number] = [0, 3];
const SAMPLE_MODES: RiemannSample[] = ["left", "midpoint", "right"];

export function RiemannSumDemo() {
  const leva = useControls({
    n: { value: 6, min: 1, max: 60, step: 1 },
    sample: { value: 1, min: 0, max: 2, step: 1, label: "0=left 1=mid 2=right" },
  });

  const { nSig, sampleSig, areaSig, program } = useMemo(() => {
    const nSig = signal(6);
    const sampleSig = signal(1);
    const areaSig = signal(riemannSum(FN, RANGE, 6, "midpoint"));
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-0.6, 3.4], y: [-0.8, 9.8] },
        background: "#0b1020",
      });
      ctx.mount(scene, ctx.createCamera2D(scene));

      const ax = scene.getAxes({ x: [0, 3], y: [0, 9], tickCount: 6 });
      const curve = scene.register(
        functionGraph(ax.handle, FN, {
          domain: RANGE,
          samples: 160,
          style: { stroke: "#f8fafc", lineWidth: 0.03 },
        }),
      );
      scene.registerReactive(
        derived([nSig, sampleSig], () =>
          riemannRectangles(ax.handle, FN, {
            domain: RANGE,
            n: nSig.get(),
            sample: SAMPLE_MODES[sampleSig.get()] ?? "midpoint",
          }),
        ),
      );
      scene.registerReactive(decimalNumber(areaSig, { digits: 3, size: 0.4 }), {
        position: xy(0.4, 9.2),
      });

      await scene.play(ax.create({ duration: 0.5 }), curve.create({ duration: 0.9 }));
    });
    return { nSig, sampleSig, areaSig, program };
  }, []);

  useEffect(() => {
    nSig.set(leva.n);
    sampleSig.set(leva.sample);
    areaSig.set(riemannSum(FN, RANGE, leva.n, SAMPLE_MODES[leva.sample] ?? "midpoint"));
  }, [nSig, sampleSig, areaSig, leva.n, leva.sample]);

  return (
    <div style={{ height: "100%" }}>
      <DemoCanvas program={program} autoplay />
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 0" }}>
        Riemann sum of x² on [0, 3] �?converges to 9. Increase <code>n</code> to watch the
        approximation tighten.
      </p>
    </div>
  );
}
