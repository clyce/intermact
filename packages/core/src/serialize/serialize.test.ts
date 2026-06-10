import { describe, expect, it, beforeAll } from "vitest";
import { circle, rectangle } from "../geometry/primitives";
import { group2D } from "../geometry/group";
import { polyline3D, surface3D } from "../object3d/factories";
import { morph } from "../animation/morph";
import { call } from "../animation/orchestration";
import { tweenSignal } from "../reactive/tween-signal";
import { buildProgram } from "../program/build";
import { createProgram } from "../program/context";
import { xy, xyz } from "../math/vec";
import { type Player } from "../animation/player";
import { textObject } from "../text/text-layout";
import { loadTestFont } from "../text/test-font";
import { type MorphStrategy } from "../animation/spec";
import { serialize, deserialize } from "./serialize";
import { encodeShareUrl, decodeShareUrl } from "./share-url";
import { sampleFrameHashes, hashSnapshot } from "./frame-hash";
import { degradeForReducedMotion } from "./reduced-motion";
import { semanticLayerFromProject, semanticLayerFromPlayer } from "./semantic";
import { snapshotToSVG } from "./svg";

/**
 * Round-trip serialization tests (design.md §17, §21). The contract is frame
 * equality: a deserialized player must produce byte-identical runtime-state
 * frame hashes to the original for the seekable subset of the language.
 */

/** A representative 2D program: create + fill, multi-leg moves, fade, wait, marker. */
function build2D(): Promise<{ player: Player }> {
  const program = createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain: { x: [-4, 4], y: [-3, 3] },
    });
    ctx.mount(scene, ctx.createCamera2D(scene));
    const c = scene.register(
      circle({
        radius: 1,
        style: { stroke: "#38bdf8", fill: "#0ea5e9", lineWidth: 0.05 },
        metadata: { label: "Sun", href: "https://example.com/sun", a11yLabel: "A blue sun" },
      }),
      { position: xy(-2, 0) },
    );
    const r = scene.register(rectangle({ width: 1.5, height: 1, style: { stroke: "#f59e0b" } }), {
      position: xy(2, 0),
    });
    await scene.play(c.create({ duration: 1, easing: "cubicInOut" }));
    scene.marker("created");
    await scene.play(
      c.moveTo(xy(0, 1), { duration: 1, easing: "quadOut" }),
      r.fadeIn({ duration: 1 }),
    );
    await scene.play(r.moveTo(xy(0, -1), { duration: 1 }), c.scaleTo(1.5, { duration: 1 }));
    await scene.wait(0.5);
    await scene.play(c.fadeOut({ duration: 1 }));
  });
  return buildProgram(program);
}

describe("serialize / deserialize (M15)", () => {
  it("round-trips a 2D program to identical frame hashes", async () => {
    const { player } = await build2D();
    const project = serialize(player);
    const { player: restored } = deserialize(project);

    expect(restored.duration).toBeCloseTo(player.duration, 6);
    const original = sampleFrameHashes(player, { fps: 30 });
    const roundTrip = sampleFrameHashes(restored, { fps: 30 });
    expect(roundTrip).toEqual(original);
  });

  it("survives a JSON share-url round-trip", async () => {
    const { player } = await build2D();
    const project = serialize(player);
    const encoded = encodeShareUrl(project);
    expect(typeof encoded).toBe("string");
    const decoded = decodeShareUrl(encoded);
    expect(decoded).toEqual(JSON.parse(JSON.stringify(project)));

    const { player: restored } = deserialize(decoded);
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(player, { fps: 30 }),
    );
  });

  it("reduced-motion degrade shows the final frame at t=0", async () => {
    const { player } = await build2D();
    const project = serialize(player);
    const reduced = deserialize(degradeForReducedMotion(project)).player;

    expect(reduced.duration).toBeCloseTo(0, 6);
    const finalFrames = sampleFrameHashes(player, { fps: 30 });
    reduced.seek(0);
    expect(hashSnapshot(reduced.getSnapshot())).toBe(finalFrames[finalFrames.length - 1]);
  });

  it("extracts the semantic layer from objects' metadata", async () => {
    const { player } = await build2D();
    const fromPlayer = semanticLayerFromPlayer(player);
    expect(fromPlayer.some((e) => e.label === "Sun" && e.href?.includes("sun"))).toBe(true);

    const project = serialize(player);
    const fromProject = semanticLayerFromProject(project);
    expect(fromProject).toEqual(fromPlayer);
  });

  it("renders a snapshot to a standalone SVG string", async () => {
    const { player } = await build2D();
    player.seek(player.duration);
    const svg = snapshotToSVG(player.getSnapshot(), {
      domain: { x: [-4, 4], y: [-3, 3] },
      width: 400,
      height: 300,
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<path");
    expect(svg).toContain("</svg>");
  });

  it("captures and restores signals + seed", async () => {
    const program = createProgram(async (ctx) => {
      const t = ctx.valueTracker(2);
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      scene.register(circle({ radius: 0.5 }));
      await scene.play(tweenSignal(t, 9, { duration: 2, easing: "linear" }));
    });
    const { player } = await buildProgram(program, { seed: 42 });
    const project = serialize(player);

    expect(project.seed).toBe(42);
    expect(Object.keys(project.signals).length).toBeGreaterThan(0);
    expect(Object.values(project.signals)).toContain(2);

    const { player: restored } = deserialize(project);
    expect(restored.duration).toBeCloseTo(player.duration, 6);
  });

  it("strict mode rejects non-serializable call side effects", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-1, 1], y: [-1, 1] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 0.5 }));
      await scene.play(c.fadeIn({ duration: 1 }));
      await scene.play(call(() => void 0));
    });
    const { player } = await buildProgram(program);
    expect(() => serialize(player, { mode: "strict" })).toThrowError(/call/i);
    // Degrade mode silently drops the call effect.
    expect(() => serialize(player, { mode: "degrade" })).not.toThrow();
  });

  it("round-trips an arc-length morph to identical frame hashes", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1, style: { stroke: "#fff", fill: "#0af" } }));
      await scene.play(c.create({ duration: 0.5 }));
      await scene.play(
        morph(c, rectangle({ width: 2, height: 1.5, style: { stroke: "#fff", fill: "#fa0" } }), {
          duration: 1,
          strategy: "arc-length",
        }),
      );
    });
    const { player } = await buildProgram(program);
    const restored = deserialize(serialize(player)).player;
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(player, { fps: 30 }),
    );
  });

  it("rejects malformed share-url payloads", () => {
    expect(() => decodeShareUrl("not valid!!! base64 @@@")).toThrowError(/share-url/i);
  });

  it("hashes are stable per state and change when state changes", async () => {
    const { player } = await build2D();
    player.seek(0);
    const a = hashSnapshot(player.getSnapshot());
    player.seek(0);
    expect(hashSnapshot(player.getSnapshot())).toBe(a);
    player.seek(player.duration);
    expect(hashSnapshot(player.getSnapshot())).not.toBe(a);
  });

  it("round-trips a 3D program to identical frame hashes", async () => {
    let id = "";
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene3D();
      ctx.mount(scene, ctx.createCamera3D(scene, { position: xyz(0, 0, 5) }));
      const mesh = scene.register(
        surface3D({ fn: (u, v) => [u, 0, v], uSegments: 3, vSegments: 3 }),
      );
      const lineObj = scene.register(
        polyline3D({
          points: [
            [0, 0, 0],
            [1, 1, 1],
          ],
        }),
      );
      id = mesh.id;
      await scene.play(mesh.create({ duration: 1 }));
      await scene.play(
        lineObj.moveTo(xyz(2, 0, 0), { duration: 1 }),
        mesh.fadeTo(0.5, { duration: 1 }),
      );
    });
    const { player } = await buildProgram(program);
    const project = serialize(player);
    expect(project.scene.kind).toBe("scene-3d");

    const { player: restored, dimension } = deserialize(project);
    expect(dimension).toBe("3d");
    expect(restored.duration).toBeCloseTo(player.duration, 6);
    expect(sampleFrameHashes(restored, { fps: 24 })).toEqual(
      sampleFrameHashes(player, { fps: 24 }),
    );
    expect(id).not.toBe("");
  });
});

describe("deserialize schema validation (M15 / §13.3.1)", () => {
  it("rejects a non-object payload", () => {
    expect(() => deserialize(null as never)).toThrowError(/serialized project/i);
  });

  it("rejects an unsupported version", async () => {
    const { player } = await build2D();
    const p = JSON.parse(JSON.stringify(serialize(player)));
    p.version = "0.0.0-bogus";
    expect(() => deserialize(p)).toThrowError(/version/i);
  });

  it("rejects an invalid scene kind", async () => {
    const { player } = await build2D();
    const p = JSON.parse(JSON.stringify(serialize(player)));
    p.scene.kind = "scene-4d";
    expect(() => deserialize(p)).toThrowError(/scene\.kind/i);
  });

  it("rejects an object missing its geometry", async () => {
    const { player } = await build2D();
    const p = JSON.parse(JSON.stringify(serialize(player)));
    delete p.objects[0].geometry;
    expect(() => deserialize(p)).toThrowError(/geometry/i);
  });

  it("rejects an unknown parent reference", async () => {
    const { player } = await build2D();
    const p = JSON.parse(JSON.stringify(serialize(player)));
    p.objects[0].parentId = "ghost-parent";
    expect(() => deserialize(p)).toThrowError(/unknown parent/i);
  });

  it("rejects a malformed timeline op", async () => {
    const { player } = await build2D();
    const p = JSON.parse(JSON.stringify(serialize(player)));
    p.storyboard.ops.push({ op: "teleport" });
    expect(() => deserialize(p)).toThrowError(/timeline op/i);
  });
});

describe("share-url limits + unicode (M15 / §13.3.3)", () => {
  it("round-trips non-ASCII content through base64url (UTF-8)", () => {
    const payload = { note: "曲线 π≈3.14 — café 🎯", labels: ["α", "β", "γ"] };
    const decoded = decodeShareUrl(encodeShareUrl(payload as never)) as unknown as typeof payload;
    expect(decoded).toEqual(payload);
  });

  it("rejects oversized payloads above maxBytes", async () => {
    const { player } = await build2D();
    const encoded = encodeShareUrl(serialize(player));
    expect(() => decodeShareUrl(encoded, { maxBytes: 16 })).toThrowError(/limit/i);
    // Default (2 MB) accepts a typical few-KB scene.
    expect(() => decodeShareUrl(encoded)).not.toThrow();
  });
});

/** Build a single-strategy morph program for the round-trip matrix. */
function buildMorph(strategy: MorphStrategy): Promise<{ player: Player }> {
  const program = createProgram(async (ctx) => {
    const scene = ctx.createScene2D({
      coordinate: "cartesian",
      domain: { x: [-3, 3], y: [-3, 3] },
    });
    ctx.mount(scene, ctx.createCamera2D(scene));
    const c = scene.register(circle({ radius: 1, style: { stroke: "#fff", fill: "#0af" } }));
    await scene.play(c.create({ duration: 0.5 }));
    await scene.play(
      morph(c, rectangle({ width: 2, height: 1.5, style: { stroke: "#fff", fill: "#fa0" } }), {
        duration: 1,
        strategy,
      }),
    );
  });
  return buildProgram(program);
}

describe("serialize round-trip matrix (M15 / §13.3.2)", () => {
  for (const strategy of ["arc-length", "anchor", "cross-fade"] as const) {
    it(`round-trips a ${strategy} morph to identical frame hashes`, async () => {
      const { player } = await buildMorph(strategy);
      const restored = deserialize(serialize(player)).player;
      expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
        sampleFrameHashes(player, { fps: 30 }),
      );
    });
  }

  it("round-trips a part-keyed `matching` morph (composite parts)", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-4, 4] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const src = group2D([
        { key: "a", object: circle({ radius: 0.6, style: { fill: "#0af" } }) },
        { key: "b", object: rectangle({ width: 1, height: 1, style: { fill: "#fa0" } }) },
      ]);
      const dst = group2D([
        { key: "a", object: rectangle({ width: 1.2, height: 0.8, style: { fill: "#0af" } }) },
        { key: "b", object: circle({ radius: 0.5, style: { fill: "#fa0" } }) },
      ]);
      const g = scene.register(src);
      await scene.play(g.transformMatchingTo(dst, { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    const restored = deserialize(serialize(player)).player;
    expect(sampleFrameHashes(restored, { fps: 24 })).toEqual(
      sampleFrameHashes(player, { fps: 24 }),
    );
  });

  it("round-trips a parent hierarchy (child composes parent transform)", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const parent = scene.register(circle({ radius: 0.5 }), { position: xy(1, 0) });
      const child = scene.register(rectangle({ width: 0.5, height: 0.5 }), {
        position: xy(0.5, 0),
      });
      scene.setParent(child, parent);
      await scene.play(parent.rotateTo(Math.PI / 2, { duration: 1 }));
      await scene.play(parent.moveTo(xy(-1, 1), { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    const project = serialize(player);
    expect(project.objects.some((o) => o.parentId)).toBe(true);
    const restored = deserialize(project).player;
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(player, { fps: 30 }),
    );
  });

  it("round-trips a `commit` (instant state set) op", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1 }));
      scene.commit(c.moveTo(xy(2, 1)), c.fadeTo(0.4));
      await scene.play(c.moveTo(xy(-2, -1), { duration: 1 }));
    });
    const { player } = await buildProgram(program);
    const project = serialize(player);
    expect(project.storyboard.ops.some((o) => o.op === "commit")).toBe(true);
    const restored = deserialize(project).player;
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(player, { fps: 30 }),
    );
  });

  it("degrades function easings (strict throws, degrade falls back to linear)", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-3, 3], y: [-3, 3] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const c = scene.register(circle({ radius: 1 }));
      await scene.play(c.moveTo(xy(2, 0), { duration: 1, easing: (t) => t * t }));
    });
    const { player } = await buildProgram(program);
    expect(() => serialize(player, { mode: "strict" })).toThrowError(/function easing/i);
    // Degrade replaces the function easing with linear: the t=mid frame differs.
    const restored = deserialize(serialize(player, { mode: "degrade" })).player;
    player.seek(0.5);
    restored.seek(0.5);
    expect(hashSnapshot(restored.getSnapshot())).not.toBe(hashSnapshot(player.getSnapshot()));
    // Endpoints still match (easing only reshapes the interior).
    player.seek(player.duration);
    restored.seek(restored.duration);
    expect(hashSnapshot(restored.getSnapshot())).toBe(hashSnapshot(player.getSnapshot()));
  });
});

describe("text write + frame-hash (M15 / §13.3.2)", () => {
  beforeAll(async () => {
    await loadTestFont();
  });

  it("includes per-glyph write spans in the frame hash (determinism)", async () => {
    const program = createProgram(async (ctx) => {
      const scene = ctx.createScene2D({
        coordinate: "cartesian",
        domain: { x: [-4, 4], y: [-2, 2] },
      });
      ctx.mount(scene, ctx.createCamera2D(scene));
      const label = scene.register(textObject({ text: "Hi", size: 1, fill: "#fff" }));
      await scene.play(label.write({ duration: 1 }));
    });
    const { player } = await buildProgram(program);

    // A frame's hash must capture `glyphWriteSpans`: a mid-write frame differs
    // from the start, and the same seek is byte-stable (design.md §13.3.2).
    player.seek(0);
    const atStart = hashSnapshot(player.getSnapshot());
    player.seek(0.5);
    const atMid = hashSnapshot(player.getSnapshot());
    expect(atMid).not.toBe(atStart);
    player.seek(0.5);
    expect(hashSnapshot(player.getSnapshot())).toBe(atMid);

    // The restored player is self-consistent (text layout degrades to plain
    // geometry on round-trip — documented §13.3.3 — so we assert determinism,
    // not byte-equality, here).
    const restored = deserialize(serialize(player)).player;
    expect(restored.duration).toBeCloseTo(player.duration, 6);
    expect(sampleFrameHashes(restored, { fps: 30 })).toEqual(
      sampleFrameHashes(restored, { fps: 30 }),
    );
  });
});
