import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildRuneImageInsertion,
  createRuneAssetReference,
  detectRuneImageMimeType,
  extractRuneAssetIds,
  MAX_RUNE_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGE_BYTES,
  MAX_RUNE_LOCAL_IMAGES,
  parseRuneAssetReference,
  parseRuneMarkdownImage,
  prepareRuneImageAsset,
  runeImageAltFromName,
  runeImageDimensions,
} from "../app/lib/local-assets.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);

test("recognizes only the four bounded local image formats from contents", () => {
  assert.equal(detectRuneImageMimeType(png), "image/png");
  assert.equal(detectRuneImageMimeType(jpeg), "image/jpeg");
  assert.equal(detectRuneImageMimeType(webp), "image/webp");
  assert.equal(detectRuneImageMimeType(gif), "image/gif");
  assert.equal(detectRuneImageMimeType(Uint8Array.from([1, 2, 3, 4])), null);
  assert.equal(MAX_RUNE_IMAGE_BYTES, 8 * 1_024 * 1_024);
  assert.equal(MAX_RUNE_LOCAL_IMAGES, 40);
  assert.equal(MAX_RUNE_LOCAL_IMAGE_BYTES, 64 * 1_024 * 1_024);
});

test("creates deterministic content identity without mutating caller bytes", async () => {
  const before = png.slice();
  const asset = await prepareRuneImageAsset("  Q2\u0000 view.png  ", "image/png", png.buffer);
  assert.equal(asset.id, createHash("sha256").update(png).digest("hex"));
  assert.equal(asset.name, "Q2  view.png");
  assert.equal(asset.mimeType, "image/png");
  assert.equal(asset.size, png.length);
  assert.deepEqual(png, before);
  asset.bytes[0] = 0;
  assert.deepEqual(png, before);
});

test("rejects disguised, empty, and oversized image input before persistence", async () => {
  await assert.rejects(() => prepareRuneImageAsset("fake.png", "image/png", Uint8Array.from([1, 2, 3]).buffer), /real PNG/);
  await assert.rejects(() => prepareRuneImageAsset("photo.jpg", "image/jpeg", png.buffer), /do not match/);
  await assert.rejects(() => prepareRuneImageAsset("empty.gif", "image/gif", new ArrayBuffer(0)), /empty/);
  await assert.rejects(() => prepareRuneImageAsset("large.png", "image/png", new Uint8Array(MAX_RUNE_IMAGE_BYTES + 1).buffer), /8 MB/);
});

test("inserts one readable Markdown reference at an exact UTF-16 boundary", () => {
  const id = "a".repeat(64);
  const source = "# Note\n\nBefore🙂After";
  const offset = source.indexOf("After");
  const result = buildRuneImageInsertion(source, offset, "Q2 [view]", id);
  assert.equal(result.markdown, `![Q2 \\[view\\]](rune-asset:sha256:${id})`);
  assert.equal(result.nextSource, `# Note\n\nBefore🙂\n\n${result.markdown}\n\nAfter`);
  assert.equal(result.nextSource.slice(result.start, result.end), result.markdown);
  assert.throws(() => buildRuneImageInsertion(source, source.indexOf("🙂") + 1, "split", id), /insertion point/);
  assert.equal(source, "# Note\n\nBefore🙂After");
});

test("parses strict references, deduplicates source identities, and keeps alt text readable", () => {
  const first = "1".repeat(64);
  const second = "2".repeat(64);
  const letters = "a".repeat(64);
  assert.equal(createRuneAssetReference(first), `rune-asset:sha256:${first}`);
  assert.equal(parseRuneAssetReference(`rune-asset:sha256:${first}`), first);
  assert.equal(parseRuneAssetReference(`rune-asset:${first}`), null);
  assert.equal(parseRuneAssetReference(`rune-asset:sha256:${letters.toUpperCase()}`), null);
  assert.deepEqual(extractRuneAssetIds(`${first}\nrune-asset:sha256:${first}\nrune-asset:sha256:${second}\nrune-asset:sha256:${first}`), [first, second]);
  assert.deepEqual(parseRuneMarkdownImage(`  ![Q2 \\[view\\]](rune-asset:sha256:${first})  `), { id: first, alt: "Q2 [view]" });
  assert.equal(parseRuneMarkdownImage(`Before ![Q2](rune-asset:sha256:${first})`), null);
  assert.equal(runeImageAltFromName("  Product   hero.JPEG  "), "Product hero");
});

test("reads bounded image dimensions from portable headers", () => {
  const pngHeader = new Uint8Array(24);
  pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  pngHeader.set([0, 0, 0x06, 0x40, 0, 0, 0x03, 0x84], 16);
  assert.deepEqual(runeImageDimensions(pngHeader), { width: 1600, height: 900 });

  const gifHeader = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]);
  assert.deepEqual(runeImageDimensions(gifHeader), { width: 800, height: 600 });
  assert.equal(runeImageDimensions(png), null);
});
