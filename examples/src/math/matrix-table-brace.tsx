import {
  brace,
  createProgram,
  decimalNumber,
  matrixObject,
  tableObject,
  tweenSignal,
  xy,
} from "@intermact/core";
import { IntermactCanvas } from "@intermact/react";

/**
 * M8 / design.md §7.4: Matrix, Table, Brace, and a reactive DecimalNumber.
 * Each construct computes its own internal layout and emits a single object; the
 * brace reads the matrix's bounds. (Glyphs use the seven-segment stopgap until
 * the M10 text pipeline upgrades them.)
 */
const program = createProgram(async (ctx) => {
  const scene = ctx.createScene2D({
    coordinate: "cartesian",
    domain: { x: [-7, 7], y: [-4, 4] },
    background: "#0b1020",
  });
  ctx.mount(scene, ctx.createCamera2D(scene));

  const matrixDef = matrixObject({
    values: [
      [2, -1],
      [0, 3],
    ],
    center: xy(-3.6, 1.3),
    style: { stroke: "#a5b4fc", lineWidth: 0.035 },
  });
  const matrix = scene.register(matrixDef);
  const matrixBrace = scene.register(brace(matrixDef, [0, -1], { depth: 0.35 }));

  const table = scene.register(
    tableObject({
      data: [
        [1, 1],
        [2, 4],
        [3, 9],
      ],
      center: xy(3.4, 1.1),
      cellWidth: 1.1,
      cellHeight: 0.55,
      style: { stroke: "#5eead4", lineWidth: 0.02 },
    }),
  );

  const counter = ctx.valueTracker(0);
  scene.registerReactive(decimalNumber(counter, { digits: 0, size: 0.6 }), {
    position: xy(0, -2.8),
  });

  await scene.play(matrix.create({ duration: 1 }), table.create({ duration: 1 }));
  await scene.play(matrixBrace.create({ duration: 0.6 }));
  await scene.play(tweenSignal(counter, 42, { duration: 1.6, easing: "sineInOut" }));
});

export function MatrixTableBraceDemo() {
  return (
    <div style={{ height: "100%" }}>
      <IntermactCanvas program={program} autoplay controls={{ timeline: true }} />
    </div>
  );
}
