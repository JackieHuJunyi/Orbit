import assert from "node:assert/strict";
import test from "node:test";

import { parseDeckSource } from "../app/lib/deck.ts";
import { prepareSemanticHtmlEditableCopy } from "../app/lib/semantic-html-editable-copy.ts";

function semanticHtmlArtifact(source, overrides = {}) {
  return Object.freeze({
    id: "quarterly-brief",
    name: "quarterly-brief.html",
    kind: "slides",
    language: "Semantic HTML",
    source,
    ...overrides,
  });
}

const source = `<!doctype html>
<html lang="en">
<head><style>section { color: navy; }</style></head>
<body><main>
<section data-layout="cover"><h1>Quarterly brief</h1><p>Readable source.</p></section>
<section><h2>Decision</h2><ul><li>Ship the reviewed plan</li></ul></section>
</main></body>
</html>`;

test("prepares one collision-safe editable Deck copy without changing canonical HTML", () => {
  const html = semanticHtmlArtifact(source);
  const existingDeck = Object.freeze({
    id: "existing-deck",
    name: "quarterly-brief.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Existing
theme: orbit
ratio: 16:9
lang: en
---

<!-- layout: cover -->
# Existing`,
  });
  const workspace = Object.freeze([html, existingDeck]);
  const result = prepareSemanticHtmlEditableCopy(workspace, html);

  assert.deepEqual(result.errors, []);
  assert.ok(result.review);
  assert.equal(result.review.purpose, "editable-copy");
  assert.equal(result.review.baseArtifacts, workspace);
  assert.equal(result.review.importedArtifacts.length, 1);
  const copy = result.review.importedArtifacts[0];
  assert.equal(copy.id, "quarterly-brief-2");
  assert.equal(copy.name, "quarterly-brief-2.deck.md");
  assert.equal(copy.kind, "slides");
  assert.equal(copy.language, "Deck Markdown");
  assert.equal(parseDeckSource(copy.source).errors.length, 0);
  assert.equal(parseDeckSource(copy.source).deck?.slides.length, 2);
  assert.match(result.review.warnings.join(" "), /independent editable Deck Markdown copy/iu);
  assert.match(result.review.warnings.join(" "), /original semantic HTML remains unchanged/iu);
  assert.match(result.review.warnings.join(" "), /CSS, exact positioning, animation/iu);
  assert.equal(result.review.nextArtifacts.length, 3);
  assert.equal(result.review.nextArtifacts[0], html);
  assert.equal(html.source, source);
  assert.equal(workspace.length, 2);
});

test("fails closed for stale identity and invalid semantic HTML", () => {
  const html = semanticHtmlArtifact(source);
  const workspace = [html];
  const stale = prepareSemanticHtmlEditableCopy(workspace, { ...html });
  assert.equal(stale.review, null);
  assert.match(stale.errors.join(" "), /source changed/iu);

  const scripted = semanticHtmlArtifact(
    `<!doctype html><html><body><main><section><h1>Unsafe</h1><script>alert(1)</script></section></main></body></html>`,
  );
  const invalid = prepareSemanticHtmlEditableCopy([scripted], scripted);
  assert.equal(invalid.review, null);
  assert.match(invalid.errors.join(" "), /scripts/iu);
});

test("is deterministic for the same exact workspace revision", () => {
  const html = semanticHtmlArtifact(source);
  const workspace = [html];
  const first = prepareSemanticHtmlEditableCopy(workspace, html);
  const second = prepareSemanticHtmlEditableCopy(workspace, html);
  assert.deepEqual(first, second);
  assert.equal(first.review?.importedArtifacts[0].id, "quarterly-brief-2");
  assert.equal(first.review?.importedArtifacts[0].name, "quarterly-brief-2.deck.md");
});
