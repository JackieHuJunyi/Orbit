import assert from "node:assert/strict";
import test from "node:test";

import { derivePreviewSourceTargets } from "../app/lib/preview-targets.ts";
import {
  MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS,
  canVisualEditSemanticHtmlSlide,
  prepareVisualSemanticHtmlSlideEdit,
  projectVisualSemanticHtmlSlideDraft,
  visualSemanticHtmlSlideDraft,
  visualSemanticHtmlSlidePreview,
} from "../app/lib/visual-semantic-html-slide-edit.ts";

function semanticHtml(source) {
  return Object.freeze({
    id: "semantic-brief",
    kind: "slides",
    language: "Semantic HTML",
    name: "semantic-brief.html",
    source,
  });
}

const source = `<!doctype html>
<html lang="en">
<head><style>section { color: #123456; }</style></head>
<body>
  <main class="presentation">
    <section class="cover" data-layout="cover">
      <h1>Opening</h1>
      <p>Bound value: {{ chart("revenue") }}</p>
    </section>
    <section class="decision">
      <h2>Commit now</h2>
      <p>One action.</p>
    </section>
  </main>
</body>
</html>`;

test("projects and prepares one exact semantic HTML slide while preserving the rest of the presentation", () => {
  const artifact = semanticHtml(source);
  const targets = derivePreviewSourceTargets(artifact);
  const target = targets[1];
  const input = Object.freeze({
    draft: `<section class="decision" data-layout="conclusion">
      <h2>Commit this week</h2>
      <p>One accountable action.</p>
    </section>`,
  });

  assert.equal(canVisualEditSemanticHtmlSlide(artifact, target), true);
  assert.deepEqual(visualSemanticHtmlSlideDraft(artifact, target), {
    draft: source.slice(target.start, target.end),
  });

  const projection = projectVisualSemanticHtmlSlideDraft(artifact, target, input);
  assert.deepEqual(projection.errors, []);
  assert.equal(projection.start, target.start);
  assert.equal(projection.end, target.start + input.draft.length);
  assert.equal(projection.nextSource.slice(projection.start, projection.end), input.draft);

  const prepared = prepareVisualSemanticHtmlSlideEdit(artifact, target, input);
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.nextTarget?.index, 1);
  assert.equal(prepared.nextTarget?.start, target.start);
  assert.match(prepared.nextSource, /<h2>Commit this week<\/h2>/u);
  assert.match(prepared.nextSource, /<h1>Opening<\/h1>/u);
  assert.match(prepared.nextSource, /section \{ color: #123456; \}/u);
  assert.equal(source, artifact.source);
  assert.deepEqual(input, {
    draft: `<section class="decision" data-layout="conclusion">
      <h2>Commit this week</h2>
      <p>One accountable action.</p>
    </section>`,
  });
});

test("renders a valid draft through the original isolated document and shared styles", () => {
  const artifact = semanticHtml(source);
  const target = derivePreviewSourceTargets(artifact)[1];
  const preview = visualSemanticHtmlSlidePreview(artifact, target, {
    draft: `<section class="decision"><h2>Decide now</h2><p>Visible draft.</p></section>`,
  });

  assert.deepEqual(preview.errors, []);
  assert.match(preview.html, /Content-Security-Policy/u);
  assert.match(preview.html, /section \{ color: #123456; \}/u);
  assert.match(preview.html, /<h2>Decide now<\/h2>/u);
  assert.doesNotMatch(preview.html, /<h1>Opening<\/h1>/u);
});

test("keeps unchanged drafts previewable but refuses to persist a no-op", () => {
  const artifact = semanticHtml(source);
  const target = derivePreviewSourceTargets(artifact)[0];
  const input = visualSemanticHtmlSlideDraft(artifact, target);
  assert.ok(input);

  const projection = projectVisualSemanticHtmlSlideDraft(artifact, target, input);
  assert.deepEqual(projection.errors, []);
  assert.equal(projection.nextSource, source);
  assert.deepEqual(visualSemanticHtmlSlidePreview(artifact, target, input).errors, []);
  assert.match(prepareVisualSemanticHtmlSlideEdit(artifact, target, input).errors[0], /unchanged/u);
});

test("fails closed for stale identity, unsafe structure, scripts, binding changes, and oversized drafts", () => {
  const artifact = semanticHtml(source);
  const target = derivePreviewSourceTargets(artifact)[0];
  const current = visualSemanticHtmlSlideDraft(artifact, target);
  assert.ok(current);

  const invalid = [
    [{ ...target, end: target.end - 1 }, current, /no longer matches/u],
    [target, { draft: "<section><h1>One</h1></section><section><h2>Two</h2></section>" }, /exactly one outer/u],
    [target, { draft: "<div><section><h1>Nested</h1></section></div>" }, /exactly one outer/u],
    [target, { draft: "<section><script>alert(1)</script></section>" }, /Scripts are blocked/u],
    [
      target,
      { draft: current.draft.replace('{{ chart("revenue") }}', '{{ chart("invented") }}') },
      /bindings unchanged/u,
    ],
    [target, { draft: `<section>${"x".repeat(MAX_VISUAL_SEMANTIC_HTML_SLIDE_CHARS)}</section>` }, /limited/u],
  ];

  for (const [requested, input, message] of invalid) {
    const result = prepareVisualSemanticHtmlSlideEdit(artifact, requested, input);
    assert.equal(result.nextSource, source);
    assert.equal(result.nextTarget, null);
    assert.match(result.errors[0], message);
  }

  assert.equal(canVisualEditSemanticHtmlSlide({ ...artifact, language: "Deck Markdown" }, target), false);
  assert.equal(canVisualEditSemanticHtmlSlide({ ...artifact, name: "semantic-brief.txt" }, target), false);
});

test("normalizes textarea newlines to the canonical artifact convention deterministically", () => {
  const crlfSource = source.replace(/\n/gu, "\r\n");
  const artifact = semanticHtml(crlfSource);
  const target = derivePreviewSourceTargets(artifact)[1];
  const input = {
    draft: `<section class="decision">
  <h2>Ship</h2>
  <p>Now.</p>
</section>`,
  };

  const first = prepareVisualSemanticHtmlSlideEdit(artifact, target, input);
  const second = prepareVisualSemanticHtmlSlideEdit(artifact, target, input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.errors, []);
  assert.match(first.nextSource, /<section class="decision">\r\n  <h2>Ship<\/h2>/u);
  assert.doesNotMatch(first.nextSource, /(?<!\r)\n/u);
});
