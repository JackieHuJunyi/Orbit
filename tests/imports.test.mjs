import assert from "node:assert/strict";
import test from "node:test";

import { prepareWorkspaceImport } from "../app/lib/imports.ts";
import { defaultArtifacts } from "../app/lib/workspace.ts";

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
