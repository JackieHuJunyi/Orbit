import assert from "node:assert/strict";
import test from "node:test";

import { compileDeckSource, parseDeckSource } from "../app/lib/deck.ts";
import { derivePreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  canVisualEditDeckSlide,
  projectVisualDeckSlideDraft,
  prepareVisualDeckSlideEdit,
  visualDeckSlideDraft,
  visualDeckSlidePreviewSource,
} from "../app/lib/visual-deck-edit.ts";

function deck(source) {
  return { id: "briefing", kind: "slides", language: "Deck Markdown", name: "briefing.deck.md", source };
}

const source =
  "---\r\nversion: 1\r\ntitle: Briefing\r\ntheme: orbit\r\nratio: 16:9\r\nlang: en\r\n---\r\n\r\n<!-- layout: cover -->\r\n<!-- eyebrow: Review -->\r\n# Opening\r\n\r\nStart here.\r\n\r\n---\r\n\r\n<!-- layout: content -->\r\n## Decision\r\n\r\nWait.\r\n";

test("replaces one exact Deck slide and preserves every byte outside its range", () => {
  const artifact = deck(source);
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);
  assert.equal(canVisualEditDeckSlide(artifact, target), true);
  assert.deepEqual(visualDeckSlideDraft(artifact, target), {
    layout: "content",
    eyebrow: "",
    draft: "## Decision\n\nWait.",
  });

  const result = prepareVisualDeckSlideEdit(artifact, target, {
    layout: "conclusion",
    eyebrow: "Decision",
    draft: "## Proceed\n\nShip the verified plan.",
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.nextTarget);
  assert.equal(result.nextTarget.label, "Proceed");
  assert.equal(result.nextSource.slice(0, target.start), source.slice(0, target.start));
  assert.equal(result.nextSource.slice(result.nextTarget.end), source.slice(target.end));
  assert.equal(
    result.nextSource.slice(result.nextTarget.start, result.nextTarget.end),
    "<!-- layout: conclusion -->\r\n<!-- eyebrow: Decision -->\r\n\r\n## Proceed\r\n\r\nShip the verified plan.",
  );
  assert.equal(parseDeckSource(result.nextSource).deck?.slides.length, 2);
});

test("builds a sandbox-ready one-slide preview from the controlled fields", () => {
  const preview = visualDeckSlidePreviewSource(deck(source), {
    layout: "metrics",
    eyebrow: "Live result",
    draft: "# Revenue\n\n- APAC\n- Europe",
  });
  assert.deepEqual(preview.errors, []);
  const parsed = parseDeckSource(preview.source);
  assert.equal(parsed.deck?.slides.length, 1);
  assert.equal(parsed.deck?.slides[0].layout, "metrics");
  assert.equal(parsed.deck?.slides[0].eyebrow, "Live result");
  assert.equal(compileDeckSource(preview.source).slideCount, 1);
});

test("projects one unsaved slide into the complete Deck source", () => {
  const artifact = Object.freeze(deck(source));
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);
  const projection = projectVisualDeckSlideDraft(artifact, target, {
    layout: "conclusion",
    eyebrow: "Decision",
    draft: "## Proceed\n\nShip.",
  });
  assert.deepEqual(projection.errors, []);
  assert.match(projection.nextSource.slice(projection.start, projection.end), /^<!-- layout: conclusion -->/u);
  assert.match(projection.nextSource.slice(projection.start, projection.end), /## Proceed/u);
  assert.equal(artifact.source, source);
});

test("rejects stale, empty, unchanged, cross-slide, and unsafe metadata edits", () => {
  const artifact = deck(source);
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Opening");
  assert.ok(target);
  const current = visualDeckSlideDraft(artifact, target);
  assert.ok(current);
  assert.match(
    prepareVisualDeckSlideEdit(artifact, { ...target, end: target.end - 1 }, current).errors[0],
    /no longer matches/u,
  );
  assert.match(
    prepareVisualDeckSlideEdit(artifact, target, { ...current, draft: "  \n" }).errors[0],
    /cannot be empty/u,
  );
  assert.match(prepareVisualDeckSlideEdit(artifact, target, current).errors[0], /unchanged/u);
  assert.match(
    prepareVisualDeckSlideEdit(artifact, target, { ...current, draft: "# Opening\n\n---\n\n# Injected" }).errors[0],
    /inside one slide/u,
  );
  assert.match(
    prepareVisualDeckSlideEdit(artifact, target, { ...current, eyebrow: "unsafe --> value" }).errors[0],
    /plain-text line/u,
  );
  assert.match(
    prepareVisualDeckSlideEdit(artifact, target, { ...current, draft: "# Opening\n\n<script>alert(1)</script>" })
      .errors[0],
    /raw HTML/u,
  );
});

test("keeps source-owned live bindings byte-stable during a visual slide edit", () => {
  const artifact = deck(source.replace("Wait.", 'Revenue is {{ metric("Q2 Revenue", "currency") }}.'));
  const target = derivePreviewSourceTargets(artifact).find((candidate) => candidate.label === "Decision");
  assert.ok(target);
  const accepted = prepareVisualDeckSlideEdit(artifact, target, {
    layout: "content",
    eyebrow: "",
    draft: '## Decision\n\nVerified revenue is {{ metric("Q2 Revenue", "currency") }}.',
  });
  assert.deepEqual(accepted.errors, []);
  const rejected = prepareVisualDeckSlideEdit(artifact, target, {
    layout: "content",
    eyebrow: "",
    draft: '## Decision\n\nRevenue is {{ metric("Q3 Revenue", "currency") }}.',
  });
  assert.match(rejected.errors[0], /bindings unchanged/u);
});

test("keeps legacy HTML presentations outside the controlled Deck editor", () => {
  const artifact = {
    id: "legacy",
    kind: "slides",
    language: "Semantic HTML",
    name: "legacy.html",
    source: "<main><section>Legacy</section></main>",
  };
  const target = {
    id: "deck-slide:0:0",
    index: 0,
    kind: "deck-slide",
    label: "Legacy",
    start: 0,
    end: artifact.source.length,
  };
  assert.equal(canVisualEditDeckSlide(artifact, target), false);
  assert.match(
    prepareVisualDeckSlideEdit(artifact, target, { layout: "content", eyebrow: "", draft: "# Legacy" }).errors[0],
    /Deck Markdown/u,
  );
});
