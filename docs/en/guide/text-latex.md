# Text and LaTeX Pipeline

Turn text and formulas into geometry that can be written, scaled, and part-morphed (`design.md §13`). All text is parsed at **build time** into immutable glyph geometry, so any `seek(t)` at playback is deterministic.

## Pipeline overview

```
OpenType / MathJax → parseSvgPath → fill contours (per-glyph fill groups)
        ↘ FillTrait (earcut per glyph group, inner holes correctly owned)
        ↘ StrokeTrait (outline stroke / left-to-right sequential write)
        ↘ TextLayoutTrait (token → part key, for transformMatchingTex)
```

**No longer uses** built-in stroke skeleton fonts; all text/LaTeX comes from **OpenType outlines** or **MathJax 3 SVG** (serif math glyphs).

## Font loading (required)

Load fonts at build time and register default (for sync APIs like axis labels):

```ts
import { setDefaultFont } from "@intermact/core";

const program = createProgram(async (ctx) => {
  const face = await ctx.assets.font("/fonts/DejaVuSans.woff");
  setDefaultFont(face.family);

  const label = textObject({
    text: "Hello",
    font: face.family,
    fill: "#38bdf8",
  });
});
```

`IntermactCanvas` needs `fetchBinary` to resolve font URLs.

## textObject

```ts
const t = textObject({
  text: "INTERMACT",
  font: sans.family,
  size: 1.1,
  align: "center",
  fill: "#38bdf8",
  stroke: "#bae6fd",
  strokeWidth: 0.03,
});
await scene.play(
  t.write({
    duration: 2.4,
    stroke: { direction: "ltr", glyphOverlap: 0.15 },
  }),
);
```

| Parameter | Meaning |
| --- | --- |
| `font` | Registered font id (omit to use `setDefaultFont` default) |
| `fill` / `stroke` / `strokeWidth` | Solid, outline, or stroke + fill |

### Write mode

| `stroke` option | Meaning |
| --- | --- |
| `direction` | `"ltr"` (default) or `"rtl"` |
| `glyphOverlap` | Overlap ratio between adjacent glyph writes (`0` = strict per-glyph; `0.2` = next glyph starts when previous is 80% done) |

## LaTeX (MathJax serif)

```ts
const { object } = await ctx.assets.latex(String.raw`E = mc^2`, {
  engine: "mathjax",
  size: 1.1,
  fill: "#38bdf8",
});
await scene.play(object.write({ stroke: { direction: "ltr" } }));
```

Each MathJax path is an independent glyph part; **per-glyph grouped triangulation** ensures inner holes in `0`, `O`, `\frac` etc. fill correctly.

## transformMatchingTex

Source and target formulas both laid out via MathJax, matched by token key:

```ts
const { object: src } = await ctx.assets.latex(String.raw`a^2+b^2=c^2`, { engine: "mathjax", fill });
const { object: tgt } = await ctx.assets.latex(String.raw`c^2`, { engine: "mathjax", fill });
await scene.play(formula.write({ stroke: { direction: "ltr" } }));
await scene.play(formula.transformMatchingTo(tgt, { duration: 2 }));
```

## Related examples

- `text/writing` — DejaVu outlines + left-to-right writing
- `text/multi-font-writing` — Sans / Serif multi-font writing
- `latex/latex-writing` — MathJax serif formula writing
- `latex/transform-matching-tex` — MathJax + transformMatchingTex
- `text/font-scale` — vector outline multi-scale
