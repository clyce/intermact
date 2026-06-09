# 文本与 LaTeX 管线

把文字与公式变成可 writing、可缩放、可分部变形的几何（`design.md §13`）。所有文本在**构建期**解析为不可变的字形几何，故播放期任意 `seek(t)` 都确定。

## 管线总览

```
OpenType / MathJax → parseSvgPath → 填充轮廓（每字形独立 fill group）
        ↘ FillTrait（按字形分组 earcut，内环洞正确归属）
        ↘ StrokeTrait（沿轮廓勾线 / 从左到右 sequential write）
        ↘ TextLayoutTrait（token → 部件 key，供 transformMatchingTex）
```

**不再使用**内置笔画骨架字体；所有文本/LaTeX 均来自 **OpenType 轮廓** 或 **MathJax 3 SVG**（衬线数学字形）。

## 字体加载（必须）

构建期先加载字体并注册默认字体（供轴标签等同步 API 使用）：

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

`IntermactCanvas` 需传入 `fetchBinary` 解析字体 URL。

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

| 参数 | 含义 |
| --- | --- |
| `font` | 注册字体 id（省略则用 `setDefaultFont` 设置的默认字体） |
| `fill` / `stroke` / `strokeWidth` | 实心、空心、或描边+填充 |

### 书写模式（write）

| `stroke` 选项 | 含义 |
| --- | --- |
| `direction` | `"ltr"`（默认）或 `"rtl"` |
| `glyphOverlap` | 相邻字形书写重叠比例（`0` = 严格逐字；`0.2` = 上一字写到 80% 时下一字开始） |

## LaTeX（MathJax 衬线）

```ts
const { object } = await ctx.assets.latex(String.raw`E = mc^2`, {
  engine: "mathjax",
  size: 1.1,
  fill: "#38bdf8",
});
await scene.play(object.write({ stroke: { direction: "ltr" } }));
```

每个 MathJax 路径为独立字形部件；**按字形分组的三角化**确保 `0`、`O`、`\frac` 等内环洞不会填错区域。

## transformMatchingTex

源与目标公式均通过 MathJax 布局，按 token key 匹配变形：

```ts
const { object: src } = await ctx.assets.latex(String.raw`a^2+b^2=c^2`, { engine: "mathjax", fill });
const { object: tgt } = await ctx.assets.latex(String.raw`c^2`, { engine: "mathjax", fill });
await scene.play(formula.write({ stroke: { direction: "ltr" } }));
await scene.play(formula.transformMatchingTo(tgt, { duration: 2 }));
```

## 相关示例

- `text/writing` — DejaVu 轮廓 + 从左到右 writing
- `text/multi-font-writing` — Sans / Serif 多字体 writing
- `latex/latex-writing` — MathJax 衬线公式 writing
- `latex/transform-matching-tex` — MathJax + transformMatchingTex
- `text/font-scale` — 矢量轮廓多尺度
