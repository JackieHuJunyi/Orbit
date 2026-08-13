import assert from "node:assert/strict";
import test from "node:test";

import { derivePreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  canVisualEditDocumentSection,
  projectVisualDocumentSectionDraft,
  prepareVisualDocumentSectionEdit,
} from "../app/lib/visual-document-edit.ts";

function document(source) {
  return { id: "brief", kind: "document", language: "Markdown", name: "brief.md", source };
}

test("replaces one exact Document section and preserves every byte outside its range", () => {
  const source = "# Brief\r\n\r\nOpening.\r\n\r\n## Decision\r\n\r\nWait.\r\n\r\n## Owner\r\n\r\nMina.\r\n";
  const artifact = document(source);
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);
  assert.equal(canVisualEditDocumentSection(artifact, target), true);

  const result = prepareVisualDocumentSectionEdit(artifact, target, {
    draft: "## Proceed\n\nShip the verified plan.",
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.nextTarget);
  assert.equal(result.nextTarget.label, "Proceed");
  assert.equal(result.nextSource.slice(0, target.start), source.slice(0, target.start));
  assert.equal(result.nextSource.slice(result.nextTarget.end), source.slice(target.end));
  assert.equal(
    result.nextSource.slice(result.nextTarget.start, result.nextTarget.end),
    "## Proceed\r\n\r\nShip the verified plan.",
  );
});

test("keeps fenced headings inside the same editable Document section", () => {
  const artifact = document("# Brief\n\n## Notes\n\n```md\n## Example\n```\n\nKeep this.\n");
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Notes");
  assert.ok(target);
  const result = prepareVisualDocumentSectionEdit(artifact, target, {
    draft: "## Notes\n\n```md\n# Still code\n```\n\nUpdated.",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.nextTarget?.label, "Notes");
});

test("preserves leading indentation in a heading-free Document body", () => {
  const artifact = document("    const answer = 42;\n    return answer;\n");
  const [target] = derivePreviewSourceTargets(artifact);
  assert.equal(artifact.source.slice(target.start, target.end), "    const answer = 42;\n    return answer;");
  const result = prepareVisualDocumentSectionEdit(artifact, target, {
    draft: "    const answer = 43;\n    return answer;",
  });
  assert.deepEqual(result.errors, []);
  assert.match(result.nextSource, /^    const answer = 43;/u);
});

test("rejects stale, empty, unchanged, and structure-changing section edits", () => {
  const artifact = document("# Brief\n\nIntro.\n\n## Decision\n\nWait.\n");
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);
  assert.match(prepareVisualDocumentSectionEdit(artifact, { ...target, start: target.start + 1 }, { draft: "## Decision\n\nShip." }).errors[0], /no longer matches/u);
  assert.match(prepareVisualDocumentSectionEdit(artifact, target, { draft: "  \n" }).errors[0], /cannot be empty/u);
  assert.match(prepareVisualDocumentSectionEdit(artifact, target, { draft: artifact.source.slice(target.start, target.end) }).errors[0], /unchanged/u);
  assert.match(prepareVisualDocumentSectionEdit(artifact, target, { draft: "### Decision\n\nShip." }).errors[0], /heading level/u);
  assert.match(prepareVisualDocumentSectionEdit(artifact, target, { draft: "## Decision\n\nShip.\n\n## Extra\n\nLater." }).errors[0], /inside one section/u);
});

test("keeps source-owned live bindings byte-stable during a visual text edit", () => {
  const artifact = document('# Brief\n\n## Result\n\nRevenue is {{ metric("Q2 Revenue", "currency") }}.\n');
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Result");
  assert.ok(target);
  const accepted = prepareVisualDocumentSectionEdit(artifact, target, {
    draft: '## Result\n\nVerified revenue is {{ metric("Q2 Revenue", "currency") }}.',
  });
  assert.deepEqual(accepted.errors, []);
  const rejected = prepareVisualDocumentSectionEdit(artifact, target, {
    draft: '## Result\n\nRevenue is {{ metric("Q3 Revenue", "currency") }}.',
  });
  assert.match(rejected.errors[0], /bindings unchanged/u);
});

test("projects an unsaved section draft into the complete canonical source without mutating input", () => {
  const source = "# Brief\n\nOpening.\n\n## Decision\n\nWait.\n\n## Owner\n\nMina.\n";
  const artifact = Object.freeze(document(source));
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);

  const projected = projectVisualDocumentSectionDraft(artifact, target, {
    draft: "## Decision\n\nShip the verified plan.",
  });
  assert.deepEqual(projected.errors, []);
  assert.equal(artifact.source, source);
  assert.equal(projected.nextSource.slice(0, projected.start), source.slice(0, target.start));
  assert.equal(projected.nextSource.slice(projected.start, projected.end), "## Decision\n\nShip the verified plan.");
  assert.equal(projected.nextSource.slice(projected.end), source.slice(target.end));

  const invalid = projectVisualDocumentSectionDraft(artifact, target, { draft: "" });
  assert.match(invalid.errors[0], /cannot be empty/u);
  assert.equal(invalid.nextSource, `${source.slice(0, target.start)}${source.slice(target.end)}`);
  assert.equal(artifact.source, source);
});
