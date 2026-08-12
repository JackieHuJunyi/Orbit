import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveDocumentBlockPreviewSourceTargets,
} from "../app/lib/preview-targets.ts";
import {
  MAX_VISUAL_DOCUMENT_INSERT_CHARS,
  documentBlockStructureCapabilities,
  prepareVisualDocumentBlockStructure,
} from "../app/lib/visual-document-block-structure.ts";

function document(source) {
  return {
    id: "brief",
    name: "brief.md",
    kind: "document",
    language: "Markdown",
    source,
  };
}

function targetAt(artifact, index) {
  return deriveDocumentBlockPreviewSourceTargets(artifact)[index];
}

test("inserts exactly one paragraph before or after a revision-bound block", () => {
  const artifact = document("# Brief\r\n\r\nOpening.\r\n");
  const heading = targetAt(artifact, 0);
  assert.ok(heading);
  const after = prepareVisualDocumentBlockStructure(artifact, heading, {
    action: "insert-after",
    draft: "New context.",
  });
  assert.deepEqual(after.errors, []);
  assert.equal(after.nextSource, "# Brief\r\n\r\nNew context.\r\n\r\nOpening.\r\n");
  assert.equal(after.nextTarget?.blockType, "paragraph");
  assert.equal(after.nextTarget?.label, "New context.");

  const opening = targetAt(artifact, 1);
  assert.ok(opening);
  const before = prepareVisualDocumentBlockStructure(artifact, opening, {
    action: "insert-before",
    draft: "- One\n- Two\n",
  });
  assert.deepEqual(before.errors, []);
  assert.equal(before.nextSource, "# Brief\r\n\r\n- One\r\n- Two\r\n\r\nOpening.\r\n");
  assert.equal(before.nextTarget?.blockType, "list");
});

test("normalizes surrounding separators without accumulating extra blank lines", () => {
  const artifact = document("# Brief\n\n\nOpening.\n");
  const heading = targetAt(artifact, 0);
  assert.ok(heading);
  const inserted = prepareVisualDocumentBlockStructure(artifact, heading, {
    action: "insert-after",
    draft: "New context.",
  });
  assert.deepEqual(inserted.errors, []);
  assert.equal(inserted.nextSource, "# Brief\n\nNew context.\n\nOpening.\n");
});

test("rejects empty, oversized, multi-block, binding, and stale insertion drafts", () => {
  const artifact = document("# Brief\n\nOpening.");
  const target = targetAt(artifact, 1);
  assert.ok(target);
  assert.match(prepareVisualDocumentBlockStructure(artifact, target, {
    action: "insert-before",
    draft: "",
  }).errors[0], /Write one new Markdown block/u);
  assert.match(prepareVisualDocumentBlockStructure(artifact, target, {
    action: "insert-before",
    draft: "a".repeat(MAX_VISUAL_DOCUMENT_INSERT_CHARS + 1),
  }).errors[0], /limited to 16,000/u);
  assert.match(prepareVisualDocumentBlockStructure(artifact, target, {
    action: "insert-before",
    draft: "One.\n\nTwo.",
  }).errors[0], /exactly one supported/u);
  assert.match(prepareVisualDocumentBlockStructure(artifact, target, {
    action: "insert-before",
    draft: '{{ metric("total") }}',
  }).errors[0], /live metric or Chart dependencies/u);
  assert.match(prepareVisualDocumentBlockStructure(artifact, { ...target, start: target.start + 1 }, {
    action: "insert-before",
    draft: "New.",
  }).errors[0], /no longer matches/u);
});

test("moves one exact block while preserving its bytes and the outer source", () => {
  const artifact = document("# Brief\n\nAlpha **one**.\n\nBeta {{ metric(\"total\") }}.\n");
  const alpha = targetAt(artifact, 1);
  assert.ok(alpha);
  const down = prepareVisualDocumentBlockStructure(artifact, alpha, { action: "move-down" });
  assert.deepEqual(down.errors, []);
  assert.equal(down.nextSource, "# Brief\n\nBeta {{ metric(\"total\") }}.\n\nAlpha **one**.\n");
  assert.match(down.nextTarget?.label ?? "", /^Alpha one\s*\.$/u);
  assert.equal(down.nextTarget?.index, 2);

  const beta = targetAt(artifact, 2);
  assert.ok(beta);
  const up = prepareVisualDocumentBlockStructure(artifact, beta, { action: "move-up" });
  assert.deepEqual(up.errors, []);
  assert.equal(up.nextSource, down.nextSource);
  assert.equal(up.nextTarget?.label, "Beta live value.");
  assert.equal(up.nextTarget?.index, 1);
});

test("exposes deterministic structure capabilities at document boundaries", () => {
  const artifact = document("# Brief\n\nOpening.\n\n---\n");
  const first = targetAt(artifact, 0);
  const middle = targetAt(artifact, 1);
  const last = targetAt(artifact, 2);
  assert.deepEqual(documentBlockStructureCapabilities(artifact, first), {
    available: true,
    canInsertBefore: true,
    canInsertAfter: true,
    canMoveUp: false,
    canMoveDown: true,
    canDelete: true,
  });
  assert.equal(documentBlockStructureCapabilities(artifact, middle).canMoveUp, true);
  assert.equal(documentBlockStructureCapabilities(artifact, middle).canMoveDown, true);
  assert.equal(documentBlockStructureCapabilities(artifact, last).canMoveDown, false);
});

test("deletes one exact block and selects a deterministic surviving neighbor", () => {
  const artifact = document("# Brief\n\nOpening.\n\nClosing.\n");
  const opening = targetAt(artifact, 1);
  assert.ok(opening);
  const deleted = prepareVisualDocumentBlockStructure(artifact, opening, { action: "delete" });
  assert.deepEqual(deleted.errors, []);
  assert.equal(deleted.nextSource, "# Brief\n\nClosing.\n");
  assert.equal(deleted.nextTarget?.label, "Closing.");

  const last = document("Only block.");
  const only = targetAt(last, 0);
  assert.ok(only);
  assert.equal(documentBlockStructureCapabilities(last, only).canDelete, false);
  assert.match(
    prepareVisualDocumentBlockStructure(last, only, { action: "delete" }).errors[0],
    /last Document block/u,
  );
});

test("warns before deleting bindings or moving a heading without its body", () => {
  const artifact = document('# Brief\n\nRevenue {{ metric("total") }}.\n\nClosing.');
  const heading = targetAt(artifact, 0);
  const revenue = targetAt(artifact, 1);
  assert.ok(heading);
  assert.ok(revenue);
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, heading, { action: "move-down" }).warnings[0],
    /Only this heading moves/u,
  );
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, revenue, { action: "delete" }).warnings[0],
    /removes 1 live binding/u,
  );
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, revenue, { action: "move-up" }).warnings[0],
    /moves across a heading/u,
  );
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, revenue, {
      action: "insert-after",
      draft: "## New section",
    }).warnings[0],
    /changes the outline/u,
  );
});

test("fails closed when a supported target borders unsupported top-level HTML", () => {
  const artifact = document("# Brief\n\n<div>Owned HTML</div>\n\nOpening.");
  const targets = deriveDocumentBlockPreviewSourceTargets(artifact);
  const heading = targets.find((target) => target.blockType === "heading");
  const opening = targets.find((target) => target.label === "Opening.");
  assert.ok(heading);
  assert.ok(opening);
  assert.equal(documentBlockStructureCapabilities(artifact, heading).canMoveDown, false);
  assert.equal(documentBlockStructureCapabilities(artifact, opening).canMoveUp, false);
  assert.equal(documentBlockStructureCapabilities(artifact, heading).canInsertAfter, false);
  assert.equal(documentBlockStructureCapabilities(artifact, opening).canInsertBefore, false);
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, heading, { action: "move-down" }).errors[0],
    /unsupported Markdown structure/u,
  );
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, heading, {
      action: "insert-after",
      draft: "New.",
    }).errors[0],
    /unsupported or ambiguous Markdown structure/u,
  );
  const oneSupported = document("<div>Owned HTML</div>\n\nOpening.");
  const onlyVisible = deriveDocumentBlockPreviewSourceTargets(oneSupported)[0];
  assert.ok(onlyVisible);
  assert.equal(documentBlockStructureCapabilities(oneSupported, onlyVisible).canDelete, false);
  assert.match(
    prepareVisualDocumentBlockStructure(oneSupported, onlyVisible, { action: "delete" }).errors[0],
    /last Document block/u,
  );
});

test("withholds oversized two-block structure mutations", () => {
  const artifact = document(`${"a".repeat(9_000)}\n\n${"b".repeat(9_000)}`);
  const first = targetAt(artifact, 0);
  assert.ok(first);
  const capabilities = documentBlockStructureCapabilities(artifact, first);
  assert.equal(capabilities.canMoveDown, false);
  assert.match(
    prepareVisualDocumentBlockStructure(artifact, first, { action: "move-down" }).errors[0],
    /limited to 16,000 source characters/u,
  );
});
