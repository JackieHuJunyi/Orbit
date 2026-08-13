import assert from "node:assert/strict";
import test from "node:test";

import {
  createImportSourcePreview,
  prepareWorkspaceImport,
  prepareWorkspaceImportReview,
  validateWorkspaceImportReview,
} from "../app/lib/imports.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";
import { prepareRuneImageAsset } from "../app/lib/local-assets.ts";

const onePixelPng = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwTtWQAAAABJRU5ErkJggg==", "base64"));

test("renames duplicate compound filenames and ids without changing source", () => {
  const deck = defaultArtifacts.find((artifact) => artifact.kind === "slides");
  assert.ok(deck);
  const prepared = prepareWorkspaceImport(defaultArtifacts, [{ ...deck }]);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.importedArtifacts[0].name, "board-briefing-2.deck.md");
  assert.equal(prepared.importedArtifacts[0].id, "board-briefing-2");
  assert.equal(prepared.importedArtifacts[0].source, deck.source);
  assert.equal(prepared.nextArtifacts.length, defaultArtifacts.length + 1);
});

test("treats imported filenames as case-insensitive filesystem identities", () => {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  assert.ok(document);
  const prepared = prepareWorkspaceImport(defaultArtifacts, [{
    ...document,
    id: "uppercase-copy",
    name: document.name.toUpperCase(),
  }]);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.importedArtifacts[0].name, "Q2-REVIEW-2.MD");
});

test("keeps the complete existing workspace unchanged when any imported source is invalid", () => {
  const invalidDeck = {
    id: "bad-deck",
    name: "bad.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: "# Missing frontmatter",
  };
  const prepared = prepareWorkspaceImport(defaultArtifacts, [invalidDeck]);
  assert.match(prepared.errors.join(" "), /frontmatter/);
  assert.equal(prepared.nextArtifacts, defaultArtifacts);
  assert.deepEqual(prepared.importedArtifacts, []);
});

test("holds a deduplicated import review against the exact base workspace", () => {
  const document = defaultArtifacts.find((artifact) => artifact.kind === "document");
  assert.ok(document);
  const prepared = prepareWorkspaceImportReview(
    defaultArtifacts,
    [{ ...document, id: "review-copy", name: "review-copy.md" }],
    "review.docx",
    ["An image was omitted.", "An image was omitted."],
  );
  assert.deepEqual(prepared.errors, []);
  assert.ok(prepared.review);
  assert.equal(prepared.review.baseArtifacts, defaultArtifacts);
  assert.deepEqual(prepared.review.warnings, ["An image was omitted."]);
  assert.deepEqual(validateWorkspaceImportReview(defaultArtifacts, prepared.review), []);
  assert.match(validateWorkspaceImportReview([...defaultArtifacts], prepared.review).join(" "), /workspace changed/i);
});

test("bounds import source previews without changing source statistics", () => {
  const source = Array.from({ length: 20 }, (_, index) => `${index}:${"x".repeat(180)}`).join("\n");
  const preview = createImportSourcePreview(source);
  assert.equal(preview.lineCount, 20);
  assert.equal(preview.charCount, source.length);
  assert.equal(preview.truncated, true);
  assert.ok(preview.text.length <= 1_600);
  assert.ok(preview.text.split("\n").length <= 12);
});

test("binds imported image sources and bytes into one exact reviewed transaction", async () => {
  const asset = await prepareRuneImageAsset("proof.png", "image/png", onePixelPng.slice().buffer);
  const imported = [{
    id: "portable-report",
    name: "portable-report.md",
    kind: "document",
    language: "Markdown",
    source: `# Proof\n\n![proof](rune-asset:sha256:${asset.id})\n`,
  }];
  const prepared = prepareWorkspaceImportReview(defaultArtifacts, imported, "proof.docx", [], [asset, asset]);
  assert.deepEqual(prepared.errors, []);
  assert.ok(prepared.review);
  assert.equal(prepared.review.assets.length, 1);
  assert.deepEqual(validateWorkspaceImportReview(defaultArtifacts, prepared.review), []);

  const missing = prepareWorkspaceImportReview(defaultArtifacts, imported, "proof.docx", [], [{ ...asset, id: "f".repeat(64) }]);
  assert.match(missing.errors.join(" "), /exact portable transaction/iu);

  const conflicting = prepareWorkspaceImportReview(defaultArtifacts, imported, "proof.docx", [], [
    asset,
    { ...asset, bytes: new Uint8Array([...asset.bytes.slice(0, -1), asset.bytes.at(-1) ^ 1]) },
  ]);
  assert.match(conflicting.errors.join(" "), /conflicting bytes/iu);
});
