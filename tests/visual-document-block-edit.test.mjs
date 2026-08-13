import assert from "node:assert/strict";
import test from "node:test";

import { deriveDocumentBlockPreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  canVisualEditDocumentBlock,
  projectVisualDocumentBlockDraft,
  prepareVisualDocumentBlockEdit,
  visualDocumentBlockDraft,
} from "../app/lib/visual-document-block-edit.ts";

function document(source) {
  return { id: "brief", kind: "document", language: "Markdown", name: "brief.md", source };
}

function targetOf(artifact, type) {
  return deriveDocumentBlockPreviewSourceTargets(artifact).find((target) => target.blockType === type);
}

test("replaces one exact paragraph block and preserves every byte outside its range", () => {
  const source = "# Brief\r\n\r\nOpening **note**.\r\n\r\n## Decision\r\n\r\nWait.\r\n";
  const artifact = document(source);
  const target = targetOf(artifact, "paragraph");
  assert.ok(target);
  assert.equal(canVisualEditDocumentBlock(artifact, target), true);
  assert.equal(visualDocumentBlockDraft(artifact, target), "Opening **note**.");

  const result = prepareVisualDocumentBlockEdit(artifact, target, {
    draft: "  \nVerified **opening** note.\n",
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.nextTarget);
  assert.equal(result.nextTarget.blockType, "paragraph");
  assert.equal(result.nextTarget.label, "Verified opening note.");
  assert.equal(result.nextSource.slice(0, target.start), source.slice(0, target.start));
  assert.equal(result.nextSource.slice(result.nextTarget.end), source.slice(target.end));
  assert.equal(
    result.nextSource.slice(result.nextTarget.start, result.nextTarget.end),
    "Verified **opening** note.",
  );
});

test("keeps headings at the same level and returns the renamed block target", () => {
  const artifact = document("# Brief\n\nOpening.\n");
  const target = targetOf(artifact, "heading");
  assert.ok(target);
  assert.equal(target.headingLevel, 1);
  const accepted = prepareVisualDocumentBlockEdit(artifact, target, { draft: "# Verified brief" });
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.nextTarget?.label, "Verified brief");
  assert.equal(accepted.nextTarget?.headingLevel, 1);
  const rejected = prepareVisualDocumentBlockEdit(artifact, target, { draft: "## Verified brief" });
  assert.match(rejected.errors[0], /heading level unchanged/u);
});

test("preserves one list, quote, code, or GFM table block", () => {
  const cases = [
    ["list", "- One\n- Two", "- One\n- Three"],
    ["quote", "> Wait.", "> Proceed."],
    ["code", "```js\nconst answer = 42;\n```", "```js\nconst answer = 43;\n```"],
    ["table", "| A | B |\n| - | - |\n| 1 | 2 |", "| A | B |\n| - | - |\n| 1 | 3 |"],
  ];
  cases.forEach(([type, current, draft]) => {
    const artifact = document(current);
    const target = targetOf(artifact, type);
    assert.ok(target, type);
    const result = prepareVisualDocumentBlockEdit(artifact, target, { draft });
    assert.deepEqual(result.errors, [], type);
    assert.equal(result.nextTarget?.blockType, type);
    assert.equal(result.nextSource, draft);
  });
});

test("rejects stale, empty, unchanged, multi-block, and type-changing edits", () => {
  const artifact = document("# Brief\n\nOpening.\n");
  const target = targetOf(artifact, "paragraph");
  assert.ok(target);
  assert.match(prepareVisualDocumentBlockEdit(artifact, { ...target, start: target.start + 1 }, { draft: "Updated." }).errors[0], /no longer matches/u);
  assert.match(prepareVisualDocumentBlockEdit(artifact, target, { draft: " \n" }).errors[0], /cannot be empty/u);
  assert.match(prepareVisualDocumentBlockEdit(artifact, target, { draft: "Opening." }).errors[0], /unchanged/u);
  assert.match(prepareVisualDocumentBlockEdit(artifact, target, { draft: "One.\n\nTwo." }).errors[0], /one paragraph block/u);
  assert.match(prepareVisualDocumentBlockEdit(artifact, target, { draft: "- One" }).errors[0], /one paragraph block/u);
});

test("keeps source-owned live bindings byte-stable", () => {
  const artifact = document('Revenue is {{ metric("q2-total") }}.');
  const target = targetOf(artifact, "paragraph");
  assert.ok(target);
  const accepted = prepareVisualDocumentBlockEdit(artifact, target, {
    draft: 'Verified revenue is {{ metric("q2-total") }}.',
  });
  assert.deepEqual(accepted.errors, []);
  const rejected = prepareVisualDocumentBlockEdit(artifact, target, {
    draft: 'Revenue is {{ metric("q3-total") }}.',
  });
  assert.match(rejected.errors[0], /bindings unchanged/u);
  const malformed = prepareVisualDocumentBlockEdit(artifact, target, {
    draft: 'Revenue is {{ metric("q2-total") }} and {{ unfinished.',
  });
  assert.match(malformed.errors[0], /bindings unchanged/u);
});

test("leaves dividers navigation-only", () => {
  const artifact = document("---");
  const target = targetOf(artifact, "rule");
  assert.ok(target);
  assert.equal(canVisualEditDocumentBlock(artifact, target), false);
  assert.match(prepareVisualDocumentBlockEdit(artifact, target, { draft: "---" }).errors[0], /remain source-only/u);
});

test("withholds visual editing from an oversized block", () => {
  const artifact = document("a".repeat(16_001));
  const target = targetOf(artifact, "paragraph");
  assert.ok(target);
  assert.equal(canVisualEditDocumentBlock(artifact, target), false);
  assert.match(
    prepareVisualDocumentBlockEdit(artifact, target, { draft: "Updated." }).errors[0],
    /limited to 16,000 characters/u,
  );
});

test("rejects malformed binding syntax even when the current block has no binding", () => {
  const artifact = document("Revenue is pending.");
  const target = targetOf(artifact, "paragraph");
  assert.ok(target);
  assert.match(
    prepareVisualDocumentBlockEdit(artifact, target, { draft: "Revenue is {{ unfinished." }).errors[0],
    /bindings unchanged/u,
  );
});

test("projects an unsaved block draft as a full-source mirror with an exact highlight range", () => {
  const source = "# Brief\n\nOpening.\n\n## Decision\n\nWait.\n";
  const artifact = Object.freeze(document(source));
  const target = deriveDocumentBlockPreviewSourceTargets(artifact).find((candidate) => candidate.label === "Wait.");
  assert.ok(target);

  const projected = projectVisualDocumentBlockDraft(artifact, target, { draft: "Proceed now." });
  assert.deepEqual(projected.errors, []);
  assert.equal(artifact.source, source);
  assert.equal(projected.start, target.start);
  assert.equal(projected.end, target.start + "Proceed now.".length);
  assert.equal(projected.nextSource, `${source.slice(0, target.start)}Proceed now.${source.slice(target.end)}`);

  const invalid = projectVisualDocumentBlockDraft(artifact, target, { draft: "- Changed type" });
  assert.match(invalid.errors[0], /one paragraph block/u);
  assert.match(invalid.nextSource, /- Changed type/u);
  assert.equal(artifact.source, source);
});
