import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ARTIFACT_TITLE_CHARS,
  MAX_WORKSPACE_ARTIFACTS,
  commitPreparedArtifactCreation,
  prepareArtifactCreation,
} from "../app/lib/artifact-creation.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { validateWorkspaceArtifacts } from "../app/lib/patches.ts";
import { parseDataSource } from "../app/lib/workspace.ts";

test("creates a readable blank Markdown document without mutating the workspace", () => {
  const existing = [{ id: "existing", name: "existing.md", kind: "document", language: "Markdown", source: "# Existing\n" }];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "Project Brief" });
  assert.deepEqual(prepared.errors, []);
  assert.deepEqual(prepared.artifact, {
    id: "project-brief",
    name: "project-brief.md",
    kind: "document",
    language: "Markdown",
    source: "# Project Brief\n\n",
  });
  assert.equal(prepared.nextArtifacts.length, 2);
  assert.equal(prepared.nextArtifacts[0], existing[0]);
  assert.equal(existing.length, 1);
  assert.deepEqual(validateWorkspaceArtifacts(prepared.nextArtifacts), []);
});

test("creates an empty valid CSV table with explicit columns", () => {
  const prepared = prepareArtifactCreation([], { kind: "data", title: "Operating Metrics" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "operating-metrics.csv");
  assert.deepEqual(parseDataSource(prepared.artifact.source), {
    columns: ["Item", "Value"],
    rows: [],
    errors: [],
    format: "CSV",
  });
});

test("creates strict Deck Markdown that compiles from one readable cover slide", () => {
  const prepared = prepareArtifactCreation([], { kind: "slides", title: "Board Narrative" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "board-narrative.deck.md");
  const parsed = parseDeckSource(prepared.artifact.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.deck.frontmatter.title, "Board Narrative");
  assert.equal(parsed.deck.slides.length, 1);
  assert.match(parsed.deck.slides[0].source, /^# Board Narrative/);
});

test("resolves filename and id collisions case-insensitively", () => {
  const existing = [{
    id: "project-brief",
    name: "PROJECT-BRIEF.MD",
    kind: "document",
    language: "Markdown",
    source: "# Existing\n",
  }];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "Project Brief" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.id, "project-brief-2");
  assert.equal(prepared.artifact.name, "project-brief-2.md");
});

test("keeps Unicode titles readable while producing portable source identity", () => {
  const prepared = prepareArtifactCreation([], { kind: "document", title: "  Q3 增长 计划  " });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.artifact.name, "q3-增长-计划.md");
  assert.equal(prepared.artifact.source, "# Q3 增长 计划\n\n");

  const reserved = prepareArtifactCreation([], { kind: "document", title: "CON" });
  assert.equal(reserved.artifact.name, "rune-con.md");
});

test("rejects unsafe titles and an overfull workspace without partial artifacts", () => {
  const invalidTitles = [
    "",
    "Line one\nLine two",
    "<script>",
    "x".repeat(MAX_ARTIFACT_TITLE_CHARS + 1),
  ];
  invalidTitles.forEach((title) => {
    const prepared = prepareArtifactCreation([], { kind: "document", title });
    assert.equal(prepared.artifact, undefined);
    assert.equal(prepared.nextArtifacts.length, 0);
    assert.ok(prepared.errors.length);
  });

  const full = Array.from({ length: MAX_WORKSPACE_ARTIFACTS }, (_, index) => ({
    id: `artifact-${index}`,
    name: `artifact-${index}.md`,
    kind: "document",
    language: "Markdown",
    source: `# Artifact ${index}\n`,
  }));
  const prepared = prepareArtifactCreation(full, { kind: "document", title: "One too many" });
  assert.equal(prepared.artifact, undefined);
  assert.equal(prepared.nextArtifacts, full);
  assert.match(prepared.errors[0], /limited to 50 artifacts/i);
});

test("blocks creation when the complete current workspace is invalid", () => {
  const invalidWorkspace = [{
    id: "broken",
    name: "broken.md",
    kind: "document",
    language: "Markdown",
    source: '# Broken\n\n{{ metric("missing") }}',
  }];
  const prepared = prepareArtifactCreation(invalidWorkspace, { kind: "document", title: "New report" });
  assert.equal(prepared.artifact, undefined);
  assert.equal(prepared.nextArtifacts, invalidWorkspace);
  assert.match(prepared.errors.join(" "), /unresolved metric missing/i);
});

test("commits one prepared workspace write and exposes storage failure without mutation", () => {
  const existing = [{ id: "existing", name: "existing.md", kind: "document", language: "Markdown", source: "# Existing\n" }];
  const prepared = prepareArtifactCreation(existing, { kind: "document", title: "New report" });
  const writes = [];
  const committed = commitPreparedArtifactCreation(prepared, (artifacts, selectedId) => {
    writes.push({ artifacts, selectedId });
  });
  assert.deepEqual(committed, { committed: true, error: "" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].artifacts, prepared.nextArtifacts);
  assert.equal(writes[0].selectedId, prepared.artifact.id);

  const failed = commitPreparedArtifactCreation(prepared, () => {
    throw new Error("quota");
  });
  assert.equal(failed.committed, false);
  assert.match(failed.error, /workspace unchanged/i);
  assert.equal(existing.length, 1);
});
