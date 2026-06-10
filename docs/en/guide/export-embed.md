# Export, Share, and Embed

Once an Intermact program is built, it can be **fully serialized**: scene, objects, timeline op-log, cameras all enter a JSON-safe `SerializedProject` (`design.md §17`). From this: share links, headless frame export, video/GIF recording, and framework-agnostic embed.

## Serialization and rebuild

```ts
import { buildProgram, serialize, deserialize } from "@intermact/core";

const { player } = await buildProgram(program);
const project = serialize(player); // SerializedProject (includes scene/cameras)
const { player: restored } = deserialize(project); // replay op-log, per-frame hash match
```

`deserialize` validates schema; invalid payload throws `serialization-error`. Custom animations need same-name compiler on deserialize side (`deserialize(project, { registries })`), else `unsupported-animation`.

## Share links

`encodeShareUrl` / `decodeShareUrl` encode project into URL-safe string (version prefix, size limit, Unicode-safe). `SerializedCanvas` (`@intermact/react`) mounts encoded string directly:

```ts
import { encodeShareUrl } from "@intermact/core";
const encoded = encodeShareUrl(project);
// <SerializedCanvas project={encoded} autoplay timeline />
```

## Headless frame export (deterministic)

Export static frames and golden tests without GL:

```ts
import { sampleFrames, sampleFrameHashes, snapshotToSVG } from "@intermact/core";

const hashes = sampleFrameHashes(player, { fps: 30 }); // fixed fps, per-frame hash
const svg = snapshotToSVG(player.getSnapshot(), { domain: { x: [-4, 4], y: [-3, 3] } });
```

`sampleFrames`/`sampleFrameHashes` seek at fixed fps, deterministic and reproducible — foundation for golden frame tests; `snapshotToSVG` outputs standalone SVG with zero DOM/GL dependency (2D; 3D frames via GL renderer).

## Video / GIF (browser)

`@intermact/react` `export/` provides browser encoding:

| Tool | Purpose |
| --- | --- |
| `recordCanvasVideo` | `MediaRecorder` records GL canvas as WebM (auto-negotiated mime) |
| `captureFrameSequencePng` | Fixed fps PNG sequence (deterministic) |
| `encodeGif` / `exportCanvasGif` | Dependency-free GIF89a encoding |

```ts
import { recordCanvasVideo } from "@intermact/react";
const blob = await recordCanvasVideo(canvas, player, { fps: 30 });
```

## Embed: Web Component and iframe

`defineIntermactEmbed()` registers framework-agnostic `<intermact-embed>` custom element, mounting scene from share-url string; `buildEmbedIframe(options)` generates self-contained `<iframe>` snippet for any page.

```ts
import { defineIntermactEmbed, buildEmbedIframe } from "@intermact/react";
defineIntermactEmbed(); // <intermact-embed project="...">
const html = buildEmbedIframe({ project: encoded, width: 640, height: 360 });
```

## Related examples

- `export/share-url` — `encodeShareUrl`/`decodeShareUrl` round-trip
- `export/svg-snapshot` — `snapshotToSVG` + `sampleFrames` headless frames
- `export/video-render` — `recordCanvasVideo` + per-frame PNG export
- `export/semantic-handout` — semantic handout export
- `embed/web-component` — `<intermact-embed>` custom element mount

Full list in [example index](/en/examples/).
