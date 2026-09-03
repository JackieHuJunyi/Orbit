import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildOrbitHtmlImageInsertion,
  buildOrbitImageInsertion,
  createOrbitAssetReference,
  detectOrbitImageMimeType,
  extractOrbitAssetIds,
  MAX_ORBIT_IMAGE_BYTES,
  MAX_ORBIT_LOCAL_IMAGE_BYTES,
  MAX_ORBIT_LOCAL_IMAGES,
  parseOrbitAssetReference,
  parseOrbitMarkdownImage,
  prepareOrbitImageAsset,
  renderOrbitHtmlAssetReferences,
  orbitImageAltFromName,
  orbitImageDimensions,
} from "../app/lib/local-assets.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);

test("recognizes only the four bounded local image formats from contents", () => {
  assert.equal(detectOrbitImageMimeType(png), "image/png");
  assert.equal(detectOrbitImageMimeType(jpeg), "image/jpeg");
  assert.equal(detectOrbitImageMimeType(webp), "image/webp");
  assert.equal(detectOrbitImageMimeType(gif), "image/gif");
  assert.equal(detectOrbitImageMimeType(Uint8Array.from([1, 2, 3, 4])), null);
  assert.equal(MAX_ORBIT_IMAGE_BYTES, 8 * 1_024 * 1_024);
  assert.equal(MAX_ORBIT_LOCAL_IMAGES, 40);
  assert.equal(MAX_ORBIT_LOCAL_IMAGE_BYTES, 64 * 1_024 * 1_024);
});

test("creates deterministic content identity without mutating caller bytes", async () => {
  const before = png.slice();
  const asset = await prepareOrbitImageAsset("  Q2\u0000 view.png  ", "image/png", png.buffer);
  assert.equal(asset.id, createHash("sha256").update(png).digest("hex"));
  assert.equal(asset.name, "Q2  view.png");
  assert.equal(asset.mimeType, "image/png");
  assert.equal(asset.size, png.length);
  assert.deepEqual(png, before);
  asset.bytes[0] = 0;
  assert.deepEqual(png, before);
});

test("rejects disguised, empty, and oversized image input before persistence", async () => {
  await assert.rejects(
    () => prepareOrbitImageAsset("fake.png", "image/png", Uint8Array.from([1, 2, 3]).buffer),
    /real PNG/,
  );
  await assert.rejects(() => prepareOrbitImageAsset("photo.jpg", "image/jpeg", png.buffer), /do not match/);
  await assert.rejects(() => prepareOrbitImageAsset("empty.gif", "image/gif", new ArrayBuffer(0)), /empty/);
  await assert.rejects(
    () => prepareOrbitImageAsset("large.png", "image/png", new Uint8Array(MAX_ORBIT_IMAGE_BYTES + 1).buffer),
    /8 MB/,
  );
});

test("inserts one readable Markdown reference at an exact UTF-16 boundary", () => {
  const id = "a".repeat(64);
  const source = "# Note\n\nBefore🙂After";
  const offset = source.indexOf("After");
  const result = buildOrbitImageInsertion(source, offset, "Q2 [view]", id);
  assert.equal(result.markdown, `![Q2 \\[view\\]](orbit-asset:sha256:${id})`);
  assert.equal(result.nextSource, `# Note\n\nBefore🙂\n\n${result.markdown}\n\nAfter`);
  assert.equal(result.nextSource.slice(result.start, result.end), result.markdown);
  assert.throws(() => buildOrbitImageInsertion(source, source.indexOf("🙂") + 1, "split", id), /insertion point/);
  assert.equal(source, "# Note\n\nBefore🙂After");
});

test("keeps semantic HTML image source readable and resolves only approved local preview URLs", () => {
  const id = "b".repeat(64);
  const source = "<section><h1>Proof</h1>\n</section>";
  const offset = source.indexOf("</section>");
  const result = buildOrbitHtmlImageInsertion(source, offset, 'Q2 <proof> "view"', id);
  assert.equal(
    result.markdown,
    `<figure class="deck-image"><img src="orbit-asset:sha256:${id}" alt="Q2 &lt;proof&gt; &quot;view&quot;" decoding="async" /></figure>`,
  );
  assert.equal(result.nextSource.slice(result.start, result.end), result.markdown);
  assert.match(
    renderOrbitHtmlAssetReferences(result.nextSource, () => "blob:https://orbit.local/proof"),
    /src="blob:https:\/\/orbit\.local\/proof"/u,
  );
  assert.equal(
    renderOrbitHtmlAssetReferences(result.nextSource, () => "https://tracker.example/image.png"),
    result.nextSource,
  );
  assert.equal(source, "<section><h1>Proof</h1>\n</section>");
});

test("parses strict references, deduplicates source identities, and keeps alt text readable", () => {
  const first = "1".repeat(64);
  const second = "2".repeat(64);
  const letters = "a".repeat(64);
  assert.equal(createOrbitAssetReference(first), `orbit-asset:sha256:${first}`);
  assert.equal(parseOrbitAssetReference(`orbit-asset:sha256:${first}`), first);
  assert.equal(parseOrbitAssetReference(`orbit-asset:${first}`), null);
  assert.equal(parseOrbitAssetReference(`orbit-asset:sha256:${letters.toUpperCase()}`), null);
  assert.deepEqual(
    extractOrbitAssetIds(
      `${first}\norbit-asset:sha256:${first}\norbit-asset:sha256:${second}\norbit-asset:sha256:${first}`,
    ),
    [first, second],
  );
  assert.deepEqual(parseOrbitMarkdownImage(`  ![Q2 \\[view\\]](orbit-asset:sha256:${first})  `), {
    id: first,
    alt: "Q2 [view]",
  });
  assert.equal(parseOrbitMarkdownImage(`Before ![Q2](orbit-asset:sha256:${first})`), null);
  assert.equal(orbitImageAltFromName("  Product   hero.JPEG  "), "Product hero");
});

test("reads bounded image dimensions from portable headers", () => {
  const pngHeader = new Uint8Array(24);
  pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  pngHeader.set([0, 0, 0x06, 0x40, 0, 0, 0x03, 0x84], 16);
  assert.deepEqual(orbitImageDimensions(pngHeader), { width: 1600, height: 900 });

  const gifHeader = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]);
  assert.deepEqual(orbitImageDimensions(gifHeader), { width: 800, height: 600 });
  assert.equal(orbitImageDimensions(png), null);
});
