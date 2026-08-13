import assert from "node:assert/strict";
import test from "node:test";

import {
  documentBriefingSourceIdForPresentation,
  documentBriefingTargets,
  prepareDocumentBriefingWorkflow,
} from "../app/lib/document-briefing.ts";
import { parseDeckSource } from "../app/lib/deck.ts";
import { portableSourceRevision } from "../app/lib/source-revision.ts";
import { buildWorkspaceDependencyGraph } from "../app/lib/dependency-graph.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { buildWorkspaceTransactionReview } from "../app/lib/transaction-review.ts";

const sourceDocument = {
  id: "launch-source",
  name: "launch-source.md",
  kind: "document",
  language: "Markdown",
  source: `# Product launch

## Context

The release gives teams one place to review documents and presentations.

The first cohort values source traceability and local control.

## Evidence

- Reviewers completed their work faster.
- Every proposed change remained visible before apply.

## Decision

Launch with a focused workflow, then expand formats from measured demand.
`,
};

function input(overrides = {}) {
  return {
    sourceArtifactId: sourceDocument.id,
    title: "Launch briefing",
    audience: "leadership",
    focus: "Decide whether the launch is ready for the next cohort.",
    slideCount: 6,
    locale: "en",
    ...overrides,
  };
}

test("compiles one reviewed Document into an exact source-linked Deck transaction", () => {
  const artifacts = [sourceDocument];
  const result = prepareDocumentBriefingWorkflow(artifacts, input());
  assert.deepEqual(result.errors, []);
  assert.equal(result.plan?.patches.length, 0);
  assert.equal(result.plan?.creations.length, 1);
  const deck = result.plan?.creations[0].artifact;
  assert.ok(deck);
  assert.equal(deck.kind, "slides");
  assert.equal(deck.language, "Deck Markdown");
  const parsed = parseDeckSource(deck.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.deck?.slides.length, 6);
  assert.equal(parsed.deck?.frontmatter.origin, sourceDocument.id);
  assert.equal(parsed.deck?.frontmatter.origin_revision, portableSourceRevision(sourceDocument.source));
  assert.equal(parsed.deck?.frontmatter.lang, "en");
  assert.equal(parsed.deck?.frontmatter.audience, "leadership");
  assert.equal(parsed.deck?.frontmatter.purpose, "Decide whether the launch is ready for the next cohort.");

  const graph = buildWorkspaceDependencyGraph([...artifacts, deck]);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(graph.edges.map((edge) => [edge.fromArtifactId, edge.toArtifactId, edge.kind]), [
    [sourceDocument.id, deck.id, "deck-origin"],
  ]);
  const review = buildWorkspaceTransactionReview(artifacts, [], result.plan.creations);
  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.nodes.map((node) => [node.artifactId, node.status]), [
    [sourceDocument.id, "input"],
    [deck.id, "created"],
  ]);
  assert.deepEqual(review.edges.map((edge) => [edge.kind, edge.status]), [["deck-origin", "added"]]);
});

test("preserves all nine interface locales as Deck document metadata", () => {
  for (const locale of ["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]) {
    const result = prepareDocumentBriefingWorkflow([sourceDocument], input({ locale, slideCount: 4 }));
    assert.deepEqual(result.errors, [], locale);
    const source = result.plan?.creations[0].artifact.source;
    assert.ok(source);
    assert.equal(parseDeckSource(source).deck?.frontmatter.lang, locale);
  }
});

test("refreshes one linked presentation in place while retaining identity and lineage", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input()).plan?.creations[0].artifact;
  assert.ok(created);
  const themedDeck = { ...created, source: created.source.replace("theme: rune", "theme: rune-dark") };
  assert.equal(documentBriefingSourceIdForPresentation(themedDeck), sourceDocument.id);
  assert.deepEqual(documentBriefingTargets([sourceDocument, themedDeck], sourceDocument.id), [{
    artifactId: themedDeck.id,
    name: themedDeck.name,
    title: "Launch briefing",
    slideCount: 6,
    locale: "en",
    audience: "leadership",
    purpose: "Decide whether the launch is ready for the next cohort.",
    freshness: "current",
  }]);

  const updatedDocument = {
    ...sourceDocument,
    source: sourceDocument.source.replace(
      "Launch with a focused workflow",
      "Launch the reviewed workflow this month",
    ),
  };
  assert.equal(documentBriefingTargets([updatedDocument, themedDeck], updatedDocument.id)[0]?.freshness, "changed");
  const refreshed = prepareDocumentBriefingWorkflow(
    [updatedDocument, themedDeck],
    input({ targetArtifactId: themedDeck.id, focus: "Approve the launch plan for this month." }),
  );
  assert.deepEqual(refreshed.errors, []);
  assert.equal(refreshed.plan?.creations.length, 0);
  assert.equal(refreshed.plan?.patches.length, 1);
  assert.equal(refreshed.plan?.patches[0].artifactId, themedDeck.id);
  assert.notEqual(refreshed.plan?.patches[0].nextSource, themedDeck.source);
  const nextDeck = { ...themedDeck, source: refreshed.plan?.patches[0].nextSource ?? "" };
  assert.equal(nextDeck.id, themedDeck.id);
  assert.equal(nextDeck.name, themedDeck.name);
  assert.equal(parseDeckSource(nextDeck.source).deck?.frontmatter.origin, sourceDocument.id);
  assert.equal(parseDeckSource(nextDeck.source).deck?.frontmatter.theme, "rune-dark");
  assert.equal(parseDeckSource(nextDeck.source).deck?.frontmatter.purpose, "Approve the launch plan for this month.");
  assert.equal(documentBriefingTargets([updatedDocument, nextDeck], updatedDocument.id)[0]?.freshness, "current");

  const review = buildWorkspaceTransactionReview([updatedDocument, themedDeck], refreshed.plan?.patches ?? [], []);
  assert.deepEqual(review.errors, []);
  assert.deepEqual(review.nodes.map((node) => [node.artifactId, node.status]), [
    [updatedDocument.id, "input"],
    [themedDeck.id, "edited"],
  ]);
  assert.deepEqual(review.edges.map((edge) => [edge.kind, edge.status]), [["deck-origin", "retained"]]);
});

test("round-trips a portable briefing recipe from Deck source into the next refresh", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input({
    audience: "customer",
    focus: "  Confirm   the customer launch story.  ",
    slideCount: 4,
  })).plan?.creations[0].artifact;
  assert.ok(created);
  const [recipe] = documentBriefingTargets([sourceDocument, created], sourceDocument.id);
  assert.deepEqual(recipe, {
    artifactId: created.id,
    name: created.name,
    title: "Launch briefing",
    slideCount: 4,
    locale: "en",
    audience: "customer",
    purpose: "Confirm the customer launch story.",
    freshness: "current",
  });
  const refreshed = prepareDocumentBriefingWorkflow([sourceDocument, created], {
    sourceArtifactId: sourceDocument.id,
    targetArtifactId: recipe.artifactId,
    title: recipe.title,
    audience: recipe.audience,
    focus: recipe.purpose,
    slideCount: recipe.slideCount,
    locale: recipe.locale,
  });
  assert.equal(refreshed.plan, undefined);
  assert.match(refreshed.errors.join(" "), /proposed source is unchanged/);
});

test("keeps pre-freshness Decks refreshable with an explicit unknown baseline", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input({ slideCount: 4 })).plan?.creations[0].artifact;
  assert.ok(created);
  const legacy = { ...created, source: created.source.replace(/^origin_revision: .*\n/mu, "") };
  assert.deepEqual(parseDeckSource(legacy.source).errors, []);
  assert.equal(documentBriefingTargets([sourceDocument, legacy], sourceDocument.id)[0]?.freshness, "unknown");
  const refreshed = prepareDocumentBriefingWorkflow(
    [sourceDocument, legacy],
    input({ slideCount: 4, targetArtifactId: legacy.id }),
  );
  assert.deepEqual(refreshed.errors, []);
  assert.equal(refreshed.plan?.patches.length, 1);
  assert.match(refreshed.plan?.patches[0].nextSource ?? "", /^origin_revision: r1-/mu);
});

test("sanitizes imported document syntax instead of creating executable or implicit bindings", () => {
  const unsafe = {
    ...sourceDocument,
    source: sourceDocument.source
      .replace("The release", "<script>alert(1)</script> The release")
      .replace("local control.", "local control.\n\n---"),
  };
  const result = prepareDocumentBriefingWorkflow([unsafe], input({ slideCount: 4 }));
  assert.deepEqual(result.errors, []);
  const source = result.plan?.creations[0].artifact.source ?? "";
  assert.doesNotMatch(source, /<script/u);
  assert.deepEqual(parseDeckSource(source).errors, []);
});

test("resolves presentation name and id conflicts case-insensitively", () => {
  const existingDeck = {
    id: "launch-briefing",
    name: "LAUNCH-BRIEFING.DECK.MD",
    kind: "slides",
    language: "Deck Markdown",
    source: "---\nversion: 1\ntitle: Existing\ntheme: rune\nratio: 16:9\nlang: en\n---\n\n# Existing",
  };
  const result = prepareDocumentBriefingWorkflow([sourceDocument, existingDeck], input({ slideCount: 4 }));
  assert.deepEqual(result.errors, []);
  const created = result.plan?.creations[0].artifact;
  assert.ok(created);
  assert.notEqual(created.id, existingDeck.id);
  assert.notEqual(created.name.toLowerCase(), existingDeck.name.toLowerCase());
});

test("fails without mutating frozen inputs when the source identity, kind, or content is invalid", () => {
  const frozen = Object.freeze([Object.freeze({ ...sourceDocument })]);
  const before = JSON.stringify(frozen);
  const missing = prepareDocumentBriefingWorkflow(frozen, input({ sourceArtifactId: "missing" }));
  assert.equal(missing.plan, undefined);
  assert.match(missing.errors.join(" "), /missing/);
  const wrongKind = prepareDocumentBriefingWorkflow([
    { ...sourceDocument, kind: "data", source: "Item,Value\nA,1" },
  ], input());
  assert.equal(wrongKind.plan, undefined);
  assert.match(wrongKind.errors.join(" "), /must be a Document/);
  const short = prepareDocumentBriefingWorkflow([
    { ...sourceDocument, source: "# Short\n\nTiny." },
  ], input({ slideCount: 8 }));
  assert.equal(short.plan, undefined);
  assert.match(short.errors.join(" "), /enough readable material/);
  assert.equal(JSON.stringify(frozen), before);
});

test("refuses missing, wrong-kind, unrelated, and unchanged refresh targets without mutation", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input({ slideCount: 4 })).plan?.creations[0].artifact;
  assert.ok(created);
  const frozen = Object.freeze([Object.freeze({ ...sourceDocument }), Object.freeze({ ...created })]);
  const before = JSON.stringify(frozen);
  const missing = prepareDocumentBriefingWorkflow(frozen, input({ slideCount: 4, targetArtifactId: "missing" }));
  assert.equal(missing.plan, undefined);
  assert.match(missing.errors.join(" "), /target is missing/);
  const wrongKind = prepareDocumentBriefingWorkflow(frozen, input({ slideCount: 4, targetArtifactId: sourceDocument.id }));
  assert.equal(wrongKind.plan, undefined);
  assert.match(wrongKind.errors.join(" "), /must be a Deck Markdown/);
  const otherSource = { ...sourceDocument, id: "other-source", name: "other.md" };
  const unrelated = prepareDocumentBriefingWorkflow(
    [otherSource, created],
    input({ sourceArtifactId: otherSource.id, slideCount: 4, targetArtifactId: created.id }),
  );
  assert.equal(unrelated.plan, undefined);
  assert.match(unrelated.errors.join(" "), /is not linked to Document source/);
  const unchanged = prepareDocumentBriefingWorkflow(frozen, input({ slideCount: 4, targetArtifactId: created.id }));
  assert.equal(unchanged.plan, undefined);
  assert.match(unchanged.errors.join(" "), /proposed source is unchanged/);
  assert.equal(JSON.stringify(frozen), before);
});

test("rejects a created Deck whose explicit Document origin cannot resolve", () => {
  const creation = prepareDocumentBriefingWorkflow([sourceDocument], input({ slideCount: 4 })).plan?.creations[0];
  assert.ok(creation);
  const invalid = {
    ...creation,
    artifact: { ...creation.artifact, source: creation.artifact.source.replace("origin: launch-source", "origin: missing") },
  };
  const result = prepareWorkspaceMutation([sourceDocument], [], [invalid]);
  assert.match(result.errors.join(" "), /Presentation Document source is unresolved/);
  assert.deepEqual(result.nextArtifacts, [sourceDocument]);
});
