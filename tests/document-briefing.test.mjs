import assert from "node:assert/strict";
import test from "node:test";

import {
  documentBriefingSourceIdForPresentation,
  documentBriefingTargets,
  prepareDocumentBriefingEvidence,
  prepareDocumentBriefingWorkflow,
} from "../app/lib/document-briefing.ts";
import { compileLegacyHtmlSlides } from "../app/lib/legacy-html-slides.ts";
import { portableSourceRevision } from "../app/lib/source-revision.ts";
import { semanticHtmlPresentationMetadata } from "../app/lib/semantic-html-presentation.ts";
import { buildWorkspaceDependencyGraph } from "../app/lib/dependency-graph.ts";
import { loadOrbitLocaleCatalog } from "../app/lib/localization.ts";
import { prepareWorkspaceMutation } from "../app/lib/patches.ts";
import { buildWorkspaceTransactionReview } from "../app/lib/transaction-review.ts";

await Promise.all(["zh-TW", "fr", "es", "ru", "ar", "ja", "ko"].map((locale) => loadOrbitLocaleCatalog(locale)));

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

test("compiles one reviewed Document into an exact source-linked semantic HTML transaction", () => {
  const artifacts = [sourceDocument];
  const result = prepareDocumentBriefingWorkflow(artifacts, input());
  assert.deepEqual(result.errors, []);
  assert.equal(result.plan?.patches.length, 0);
  assert.equal(result.plan?.creations.length, 1);
  const presentation = result.plan?.creations[0].artifact;
  assert.ok(presentation);
  assert.equal(presentation.kind, "slides");
  assert.equal(presentation.language, "Semantic HTML");
  assert.equal(presentation.name, "launch-briefing.html");
  const parsed = compileLegacyHtmlSlides(presentation.source);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.slides.length, 6);
  assert.deepEqual(semanticHtmlPresentationMetadata(presentation.source), {
    title: "Launch briefing",
    theme: "orbit",
    lang: "en",
    origin: sourceDocument.id,
    originRevision: portableSourceRevision(sourceDocument.source),
    audience: "leadership",
    purpose: "Decide whether the launch is ready for the next cohort.",
  });

  const graph = buildWorkspaceDependencyGraph([...artifacts, presentation]);
  assert.deepEqual(graph.issues, []);
  assert.deepEqual(
    graph.edges.map((edge) => [edge.fromArtifactId, edge.toArtifactId, edge.kind]),
    [[sourceDocument.id, presentation.id, "deck-origin"]],
  );
  const review = buildWorkspaceTransactionReview(artifacts, [], result.plan.creations);
  assert.deepEqual(review.errors, []);
  assert.deepEqual(
    review.nodes.map((node) => [node.artifactId, node.status]),
    [
      [sourceDocument.id, "input"],
      [presentation.id, "created"],
    ],
  );
  assert.deepEqual(
    review.edges.map((edge) => [edge.kind, edge.status]),
    [["deck-origin", "added"]],
  );
});

test("compiles a model-shaped outline only when every bounded source unit remains exact", () => {
  const evidence = prepareDocumentBriefingEvidence([sourceDocument], input());
  assert.deepEqual(evidence.errors, []);
  assert.equal(evidence.evidenceUnits?.length, 4);
  const outline = {
    slides: evidence.evidenceUnits.map((unit, index) => ({
      sourceUnitId: unit.id,
      title: `Decision signal ${index + 1}`,
      bullets: [`Evidence-grounded point ${index + 1}`, `Implication for leadership ${index + 1}`],
    })),
  };
  const result = prepareDocumentBriefingWorkflow([sourceDocument], input(), outline);
  assert.deepEqual(result.errors, []);
  const source = result.plan?.creations[0].artifact.source ?? "";
  for (const unit of evidence.evidenceUnits)
    assert.match(source, new RegExp(`data-orbit-source-unit="${unit.id}"`, "u"));
  assert.match(source, /<h2>Decision signal 1<\/h2>/u);
  assert.match(source, /<li>Evidence-grounded point 4<\/li>/u);
  assert.equal(compileLegacyHtmlSlides(source).slides.length, 6);

  const duplicateEvidence = {
    slides: outline.slides.map((slide) => ({ ...slide, sourceUnitId: "source-1" })),
  };
  const rejected = prepareDocumentBriefingWorkflow([sourceDocument], input(), duplicateEvidence);
  assert.equal(rejected.plan, undefined);
  assert.match(rejected.errors.join(" "), /Every bounded source unit/);
});

test("rejects executable model text without mutating the reviewed Document", () => {
  const frozen = Object.freeze([Object.freeze({ ...sourceDocument })]);
  const before = JSON.stringify(frozen);
  const evidence = prepareDocumentBriefingEvidence(frozen, input());
  const outline = {
    slides: evidence.evidenceUnits.map((unit, index) => ({
      sourceUnitId: unit.id,
      title: index ? `Signal ${index}` : "<script>alert(1)</script>",
      bullets: ["Grounded point"],
    })),
  };
  const result = prepareDocumentBriefingWorkflow(frozen, input(), outline);
  assert.equal(result.plan, undefined);
  assert.match(result.errors.join(" "), /plain text|invalid presentation outline/);
  assert.equal(JSON.stringify(frozen), before);
});

test("preserves all nine interface locales as semantic HTML presentation metadata", () => {
  for (const locale of ["en", "zh-CN", "zh-TW", "fr", "es", "ru", "ar", "ja", "ko"]) {
    const result = prepareDocumentBriefingWorkflow([sourceDocument], input({ locale, slideCount: 4 }));
    assert.deepEqual(result.errors, [], locale);
    const source = result.plan?.creations[0].artifact.source;
    assert.ok(source);
    assert.equal(semanticHtmlPresentationMetadata(source)?.lang, locale);
  }
});

test("refreshes one linked presentation in place while retaining identity and lineage", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input()).plan?.creations[0].artifact;
  assert.ok(created);
  const themedPresentation = {
    ...created,
    source: created.source.replace('data-orbit-theme="orbit"', 'data-orbit-theme="orbit-dark"'),
  };
  assert.equal(documentBriefingSourceIdForPresentation(themedPresentation), sourceDocument.id);
  assert.deepEqual(documentBriefingTargets([sourceDocument, themedPresentation], sourceDocument.id), [
    {
      artifactId: themedPresentation.id,
      name: themedPresentation.name,
      title: "Launch briefing",
      slideCount: 6,
      locale: "en",
      audience: "leadership",
      purpose: "Decide whether the launch is ready for the next cohort.",
      freshness: "current",
    },
  ]);

  const updatedDocument = {
    ...sourceDocument,
    source: sourceDocument.source.replace("Launch with a focused workflow", "Launch the reviewed workflow this month"),
  };
  assert.equal(
    documentBriefingTargets([updatedDocument, themedPresentation], updatedDocument.id)[0]?.freshness,
    "changed",
  );
  const refreshed = prepareDocumentBriefingWorkflow(
    [updatedDocument, themedPresentation],
    input({ targetArtifactId: themedPresentation.id, focus: "Approve the launch plan for this month." }),
  );
  assert.deepEqual(refreshed.errors, []);
  assert.equal(refreshed.plan?.creations.length, 0);
  assert.equal(refreshed.plan?.patches.length, 1);
  assert.equal(refreshed.plan?.patches[0].artifactId, themedPresentation.id);
  assert.notEqual(refreshed.plan?.patches[0].nextSource, themedPresentation.source);
  const nextPresentation = { ...themedPresentation, source: refreshed.plan?.patches[0].nextSource ?? "" };
  assert.equal(nextPresentation.id, themedPresentation.id);
  assert.equal(nextPresentation.name, themedPresentation.name);
  assert.deepEqual(semanticHtmlPresentationMetadata(nextPresentation.source), {
    title: "Launch briefing",
    theme: "orbit-dark",
    lang: "en",
    origin: sourceDocument.id,
    originRevision: portableSourceRevision(updatedDocument.source),
    audience: "leadership",
    purpose: "Approve the launch plan for this month.",
  });
  assert.equal(
    documentBriefingTargets([updatedDocument, nextPresentation], updatedDocument.id)[0]?.freshness,
    "current",
  );

  const review = buildWorkspaceTransactionReview(
    [updatedDocument, themedPresentation],
    refreshed.plan?.patches ?? [],
    [],
  );
  assert.deepEqual(review.errors, []);
  assert.deepEqual(
    review.nodes.map((node) => [node.artifactId, node.status]),
    [
      [updatedDocument.id, "input"],
      [themedPresentation.id, "edited"],
    ],
  );
  assert.deepEqual(
    review.edges.map((edge) => [edge.kind, edge.status]),
    [["deck-origin", "retained"]],
  );
});

test("round-trips a portable briefing recipe from semantic HTML into the next refresh", () => {
  const created = prepareDocumentBriefingWorkflow(
    [sourceDocument],
    input({
      audience: "customer",
      focus: "  Confirm   the customer launch story.  ",
      slideCount: 4,
    }),
  ).plan?.creations[0].artifact;
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

test("keeps pre-freshness Deck Markdown refreshable as a compatibility source", () => {
  const legacy = {
    id: "legacy-briefing",
    name: "legacy-briefing.deck.md",
    kind: "slides",
    language: "Deck Markdown",
    source: `---
version: 1
title: Launch briefing
theme: orbit
ratio: 16:9
lang: en
origin: launch-source
audience: leadership
purpose: Decide whether the launch is ready for the next cohort.
---

# Launch briefing

Source

---

## Context

One

---

## Evidence

Two

---

## Decision

Three
`,
  };
  assert.equal(documentBriefingTargets([sourceDocument, legacy], sourceDocument.id)[0]?.freshness, "unknown");
  const refreshed = prepareDocumentBriefingWorkflow(
    [sourceDocument, legacy],
    input({ slideCount: 4, targetArtifactId: legacy.id }),
  );
  assert.deepEqual(refreshed.errors, []);
  assert.equal(refreshed.plan?.patches.length, 1);
  assert.match(refreshed.plan?.patches[0].nextSource ?? "", /^origin_revision: r1-/mu);
  assert.match(refreshed.plan?.patches[0].nextSource ?? "", /^---/u);
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
  assert.deepEqual(compileLegacyHtmlSlides(source).errors, []);
});

test("resolves presentation name and id conflicts case-insensitively", () => {
  const existingDeck = {
    id: "launch-briefing",
    name: "LAUNCH-BRIEFING.DECK.MD",
    kind: "slides",
    language: "Deck Markdown",
    source: "---\nversion: 1\ntitle: Existing\ntheme: orbit\nratio: 16:9\nlang: en\n---\n\n# Existing",
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
  const wrongKind = prepareDocumentBriefingWorkflow(
    [{ ...sourceDocument, kind: "data", source: "Item,Value\nA,1" }],
    input(),
  );
  assert.equal(wrongKind.plan, undefined);
  assert.match(wrongKind.errors.join(" "), /must be a Document/);
  const short = prepareDocumentBriefingWorkflow(
    [{ ...sourceDocument, source: "# Short\n\nTiny." }],
    input({ slideCount: 8 }),
  );
  assert.equal(short.plan, undefined);
  assert.match(short.errors.join(" "), /enough readable material/);
  assert.equal(JSON.stringify(frozen), before);
});

test("refuses missing, wrong-kind, unrelated, and unchanged refresh targets without mutation", () => {
  const created = prepareDocumentBriefingWorkflow([sourceDocument], input({ slideCount: 4 })).plan?.creations[0]
    .artifact;
  assert.ok(created);
  const frozen = Object.freeze([Object.freeze({ ...sourceDocument }), Object.freeze({ ...created })]);
  const before = JSON.stringify(frozen);
  const missing = prepareDocumentBriefingWorkflow(frozen, input({ slideCount: 4, targetArtifactId: "missing" }));
  assert.equal(missing.plan, undefined);
  assert.match(missing.errors.join(" "), /target is missing/);
  const wrongKind = prepareDocumentBriefingWorkflow(
    frozen,
    input({ slideCount: 4, targetArtifactId: sourceDocument.id }),
  );
  assert.equal(wrongKind.plan, undefined);
  assert.match(wrongKind.errors.join(" "), /valid Semantic HTML or Deck Markdown/);
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

test("rejects a created semantic HTML presentation whose explicit Document origin cannot resolve", () => {
  const creation = prepareDocumentBriefingWorkflow([sourceDocument], input({ slideCount: 4 })).plan?.creations[0];
  assert.ok(creation);
  const invalid = {
    ...creation,
    artifact: {
      ...creation.artifact,
      source: creation.artifact.source.replace('data-orbit-origin="launch-source"', 'data-orbit-origin="missing"'),
    },
  };
  const result = prepareWorkspaceMutation([sourceDocument], [], [invalid]);
  assert.match(result.errors.join(" "), /Presentation Document source is unresolved/);
  assert.deepEqual(result.nextArtifacts, [sourceDocument]);
});
