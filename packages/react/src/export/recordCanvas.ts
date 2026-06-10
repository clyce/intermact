import { frameTimes, type Player } from "@intermact/core";

/**
 * Browser video-export glue (design.md §17). The deterministic, headless export
 * primitives (`sampleFrameHashes`, `snapshotToSVG`) live in `@intermact/core`;
 * this is the browser half that turns the live GL `<canvas>` into a downloadable
 * artifact. Two distinct paths (per §13.3.3):
 *
 * - **Preview recording** — {@link recordCanvasVideo}: real-time `MediaRecorder`
 *   capture. Convenient but subject to frame-rate jitter / tab throttling.
 * - **Deterministic export** — {@link captureFrameSequencePng}: fixed-fps
 *   `player.seek(t)` + `canvas.toBlob()` per frame. Frame-exact and reproducible
 *   (requires a canvas created with `preserveDrawingBuffer: true`).
 */

/** Candidate recorder MIME types, in preference order (most compatible last). */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

/**
 * Pick the first {@link MediaRecorder}-supported MIME type (probing
 * `isTypeSupported`, which Safari and Chrome answer differently). Returns
 * `undefined` if none are supported or the API is unavailable.
 */
export function pickSupportedMimeType(preferred?: string): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return preferred;
  }
  const candidates = preferred ? [preferred, ...MIME_CANDIDATES] : MIME_CANDIDATES;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

/** Options for {@link recordCanvasVideo}. */
export interface RecordVideoOptions {
  /** Capture frame rate (default 30). */
  readonly fps?: number;
  /** Seconds to record (default: the player's duration). */
  readonly duration?: number;
  /** Preferred recorder MIME type (auto-detected/validated via `isTypeSupported`). */
  readonly mimeType?: string;
  /** Video bitrate in bits/sec (default 8 Mbps). */
  readonly bitsPerSecond?: number;
}

/**
 * Record a canvas while a {@link Player} plays from the start, resolving with the
 * encoded video {@link Blob}. Seeks to 0, plays in real time, and stops after
 * `duration` seconds, then **resets the player** (seek 0 + pause). Browser only
 * (requires `MediaRecorder` + `captureStream`); the MIME type is auto-negotiated.
 */
export function recordCanvasVideo(
  canvas: HTMLCanvasElement,
  player: Player,
  options: RecordVideoOptions = {},
): Promise<Blob> {
  const fps = options.fps ?? 30;
  const duration = options.duration ?? player.duration;
  const mimeType = pickSupportedMimeType(options.mimeType);
  if (!mimeType) {
    return Promise.reject(new Error("No MediaRecorder MIME type is supported in this browser."));
  }
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    ...(options.bitsPerSecond ? { videoBitsPerSecond: options.bitsPerSecond } : {}),
  });
  const chunks: BlobPart[] = [];

  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      // Reset playback so the canvas returns to a clean initial frame.
      player.pause();
      player.seek(0);
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => reject(new Error("MediaRecorder failed during capture."));

    player.seek(0);
    player.play();
    recorder.start();
    window.setTimeout(
      () => {
        player.pause();
        recorder.stop();
      },
      Math.max(0, duration * 1000) + 100,
    );
  });
}

/** Options for deterministic frame-sequence export. */
export interface FrameSequenceOptions {
  /** Frames per second (default 30). */
  readonly fps?: number;
  /** Seconds to export (default: the player's duration). */
  readonly duration?: number;
  /**
   * Force a synchronous redraw of `canvas` after each `player.seek`. Wire this to
   * your R3F `gl.render(scene, camera)` (or call from a `useFrame`-driven loop)
   * so the captured pixels match the seeked frame.
   */
  readonly renderFrame?: (time: number) => void;
}

/** Capture the current canvas pixels as a PNG {@link Blob} (frame-exact export). */
export function captureFramePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null."));
    }, "image/png");
  });
}

/**
 * Deterministically export a fixed-fps PNG sequence by seeking the player frame
 * by frame and capturing each frame (design.md §17). Unlike
 * {@link recordCanvasVideo} this is reproducible and frame-exact. The canvas must
 * be created with `preserveDrawingBuffer: true` so `toBlob` sees the drawn pixels.
 */
export async function captureFrameSequencePng(
  canvas: HTMLCanvasElement,
  player: Player,
  options: FrameSequenceOptions = {},
): Promise<Blob[]> {
  const times = frameTimes(player, {
    fps: options.fps ?? 30,
    ...(options.duration !== undefined ? { duration: options.duration } : {}),
  });
  const frames: Blob[] = [];
  for (const t of times) {
    player.seek(t);
    options.renderFrame?.(t);
    frames.push(await captureFramePng(canvas));
  }
  player.seek(0);
  return frames;
}

/** Trigger a browser download of a {@link Blob} under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
