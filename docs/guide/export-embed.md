# 导出、分享与嵌入

一个 Intermact 程序构建后即可**完全序列化**：场景、对象、时间线 op-log、相机都进入一个 JSON 安全的 `SerializedProject`（`design.md §17`）。由此衍生出分享链接、无头定帧导出、视频/GIF 录制与框架无关的嵌入。

## 序列化与重建

```ts
import { buildProgram, serialize, deserialize } from "@intermact/core";

const { player } = await buildProgram(program);
const project = serialize(player); // SerializedProject（含 scene/cameras）
const { player: restored } = deserialize(project); // 重放 op-log，逐帧哈希一致
```

`deserialize` 会做 schema 校验，非法负载抛 `serialization-error`。自定义动画需在反序列化端提供同名 compiler（传 `deserialize(project, { registries })`），否则抛 `unsupported-animation`。

## 分享链接

`encodeShareUrl` / `decodeShareUrl` 把工程编码成 URL-safe 字符串（带版本前缀、大小上限、Unicode 安全）。`SerializedCanvas`（`@intermact/react`）可直接挂载编码串：

```ts
import { encodeShareUrl } from "@intermact/core";
const encoded = encodeShareUrl(project);
// <SerializedCanvas project={encoded} autoplay timeline />
```

## 无头定帧导出（确定性）

无需 GL 即可导出静态帧与做金标测试：

```ts
import { sampleFrames, sampleFrameHashes, snapshotToSVG } from "@intermact/core";

const hashes = sampleFrameHashes(player, { fps: 30 }); // 固定 fps，逐帧哈希
const svg = snapshotToSVG(player.getSnapshot(), { domain: { x: [-4, 4], y: [-3, 3] } });
```

`sampleFrames`/`sampleFrameHashes` 按固定 fps seek，确定性可复现，是金标帧测试的基础；`snapshotToSVG` 零 DOM/GL 依赖输出独立 SVG（2D；3D 帧走 GL 渲染器）。

## 视频 / GIF（浏览器）

`@intermact/react` 的 `export/` 提供浏览器编码路径：

| 工具 | 作用 |
| --- | --- |
| `recordCanvasVideo` | `MediaRecorder` 录制 GL 画布为 WebM（自动协商 mime） |
| `captureFrameSequencePng` | 固定 fps 逐帧 PNG 序列（确定性） |
| `encodeGif` / `exportCanvasGif` | 无依赖 GIF89a 编码 |

```ts
import { recordCanvasVideo } from "@intermact/react";
const blob = await recordCanvasVideo(canvas, player, { fps: 30 });
```

## 嵌入：Web Component 与 iframe

`defineIntermactEmbed()` 注册框架无关的 `<intermact-embed>` 自定义元素，从 share-url 字符串挂载场景；`buildEmbedIframe(options)` 生成自包含的 `<iframe>` 片段，便于贴进任意页面。

```ts
import { defineIntermactEmbed, buildEmbedIframe } from "@intermact/react";
defineIntermactEmbed(); // <intermact-embed project="...">
const html = buildEmbedIframe({ project: encoded, width: 640, height: 360 });
```

## 相关示例

- `export/share-url` — `encodeShareUrl`/`decodeShareUrl` 往返
- `export/svg-snapshot` — `snapshotToSVG` + `sampleFrames` 无头定帧
- `export/video-render` — `recordCanvasVideo` + 逐帧 PNG 导出
- `export/semantic-handout` — 语义讲义导出
- `embed/web-component` — `<intermact-embed>` 自定义元素挂载

完整清单见[示例索引](/examples/)。
